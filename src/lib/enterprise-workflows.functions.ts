import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermission, moduleNames } from "@/lib/permissions.functions";

const uuid = z.string().uuid();
const text = (max = 4000) => z.string().trim().min(2).max(max);
const dateTime = z.string().datetime();
const ref = (prefix: string) =>
  `${prefix}-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

export const getEnterpriseWorkflows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: canViewContractors } = await context.supabase.rpc("has_module_permission", {
      _user_id: context.userId,
      _module: "contractors",
      _action: "view",
    });
    const { data: canViewReports } = await context.supabase.rpc("has_module_permission", {
      _user_id: context.userId,
      _module: "reporting",
      _action: "view",
    });
    if (!canViewContractors && !canViewReports)
      throw new Error("You do not have access to enterprise workflows.");
    const [assessments, permits, settings, subscriptions, reports] = await Promise.all([
      context.supabase
        .from("contractor_risk_assessments")
        .select("*")
        .order("created_at", { ascending: false }),
      context.supabase
        .from("permits_to_work")
        .select("*")
        .order("created_at", { ascending: false }),
      context.supabase.from("company_report_settings").select("*").limit(1).maybeSingle(),
      context.supabase
        .from("report_subscriptions")
        .select("*")
        .order("created_at", { ascending: false }),
      context.supabase
        .from("generated_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    const { data: admin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    let delivery: Array<{
      id: string;
      template_name: string;
      recipient_email: string;
      status: string;
      error_message: string | null;
      created_at: string;
    }> = [];
    if (admin && canViewReports) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const result = await supabaseAdmin
        .from("email_send_log")
        .select("id,template_name,recipient_email,status,error_message,created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      delivery = result.data ?? [];
    }
    let letterheadUrl: string | null = null;
    if (canViewReports && settings.data?.letterhead_path) {
      const signed = await context.supabase.storage
        .from("company-letterheads")
        .createSignedUrl(settings.data.letterhead_path, 900);
      letterheadUrl = signed.data?.signedUrl ?? null;
    }
    return {
      assessments: canViewContractors ? (assessments.data ?? []) : [],
      permits: canViewContractors ? (permits.data ?? []) : [],
      settings: canViewReports ? (settings.data ?? null) : null,
      letterheadUrl,
      subscriptions: canViewReports ? (subscriptions.data ?? []) : [],
      reports: canViewReports ? (reports.data ?? []) : [],
      delivery,
    };
  });

export const createContractorAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        contractorId: uuid,
        taskDescription: text(),
        hazards: text(8000),
        controls: text(8000),
        initialRiskScore: z.coerce.number().int().min(1).max(25),
        residualRiskScore: z.coerce.number().int().min(1).max(25),
        validUntil: z.string().date(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertPermission(context, "contractors", "create");
    const { data: contractor } = await context.supabase
      .from("contractors")
      .select("approval_status")
      .eq("id", data.contractorId)
      .single();
    if (contractor?.approval_status !== "approved")
      throw new Error("The contractor must be approved before a task assessment can be created.");
    const { error } = await context.supabase.from("contractor_risk_assessments").insert({
      contractor_id: data.contractorId,
      reference: ref("CRA"),
      task_description: data.taskDescription,
      hazards: data.hazards,
      controls: data.controls,
      initial_risk_score: data.initialRiskScore,
      residual_risk_score: data.residualRiskScore,
      valid_until: data.validUntil,
      assessed_by: context.userId,
    });
    if (error) {
      console.error("[contractors] assessment create failed", error.message);
      throw new Error("The contractor assessment could not be saved. Please try again.");
    }
    return { ok: true };
  });

export const approveContractorAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ assessmentId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    await assertPermission(context, "contractors", "approve");
    const { error } = await context.supabase
      .from("contractor_risk_assessments")
      .update({
        status: "approved",
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", data.assessmentId)
      .eq("status", "draft");
    if (error) {
      console.error("[contractors] assessment approval failed", error.message);
      throw new Error("The contractor assessment could not be approved. Please try again.");
    }
    return { ok: true };
  });

export const createPermit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        contractorId: uuid,
        riskAssessmentId: uuid,
        workScope: text(),
        workLocation: text(500),
        hazards: text(8000),
        controls: text(8000),
        workers: z.string().trim().max(4000).optional().default(""),
        validFrom: dateTime,
        validUntil: dateTime,
      })
      .refine((value) => value.validUntil > value.validFrom, {
        message: "Permit end must be after its start.",
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertPermission(context, "contractors", "approve");
    const [contractor, assessment] = await Promise.all([
      context.supabase
        .from("contractors")
        .select("approval_status")
        .eq("id", data.contractorId)
        .single(),
      context.supabase
        .from("contractor_risk_assessments")
        .select("contractor_id,status,valid_until")
        .eq("id", data.riskAssessmentId)
        .single(),
    ]);
    if (contractor.data?.approval_status !== "approved")
      throw new Error("Contractor approval is required.");
    if (
      assessment.data?.status !== "approved" ||
      assessment.data.contractor_id !== data.contractorId
    )
      throw new Error("An approved matching risk assessment is required.");
    if (assessment.data.valid_until && assessment.data.valid_until < data.validUntil.slice(0, 10))
      throw new Error("The permit cannot outlast its risk assessment.");
    const { error } = await context.supabase.from("permits_to_work").insert({
      contractor_id: data.contractorId,
      risk_assessment_id: data.riskAssessmentId,
      permit_number: ref("PTW"),
      work_scope: data.workScope,
      work_location: data.workLocation,
      hazards: data.hazards,
      controls: data.controls,
      workers: data.workers || null,
      valid_from: data.validFrom,
      valid_until: data.validUntil,
      status: "draft",
      created_by: context.userId,
      requested_by: context.userId,
      requested_at: new Date().toISOString(),
    });
    if (error) {
      console.error("[permits] create failed", error.message);
      throw new Error("The permit draft could not be created. Please try again.");
    }
    return { ok: true };
  });

export const transitionPermit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        permitId: uuid,
        action: z.enum(["issue", "approve", "activate", "suspend", "close"]),
        note: text(4000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertPermission(context, "contractors", "approve");
    const now = new Date().toISOString();
    const { data: permit, error: permitError } = await context.supabase
      .from("permits_to_work")
      .select("status,issued_by")
      .eq("id", data.permitId)
      .single();
    if (permitError || !permit) throw new Error("Permit could not be found.");
    const requiredStatus = {
      issue: "draft",
      approve: "issued",
      activate: "approved",
      suspend: "active",
      close: permit.status,
    }[data.action];
    if (
      permit.status !== requiredStatus ||
      (data.action === "close" && !["active", "suspended"].includes(permit.status))
    )
      throw new Error(`This permit cannot be ${data.action}d from its current state.`);
    if (data.action === "approve" && permit.issued_by === context.userId)
      throw new Error("The permit approver must be different from the issuer.");
    const values =
      data.action === "issue"
        ? { status: "issued", issued_at: now, issued_by: context.userId }
        : data.action === "approve"
          ? {
              status: "approved",
              approved_at: now,
              approved_by: context.userId,
              approval_notes: data.note,
            }
          : data.action === "activate"
            ? { status: "active" }
            : data.action === "suspend"
              ? {
                  status: "suspended",
                  suspended_at: now,
                  suspended_by: context.userId,
                  suspension_reason: data.note,
                }
              : {
                  status: "closed",
                  closed_at: now,
                  closed_by: context.userId,
                  closure_notes: data.note,
                };
    const { error } = await context.supabase
      .from("permits_to_work")
      .update(values)
      .eq("id", data.permitId)
      .eq("status", permit.status);
    if (error) {
      console.error("[permits] transition failed", error.message);
      throw new Error("The permit workflow could not be updated. Please try again.");
    }
    return { ok: true };
  });

export const generatePermitContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ permitId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    await assertPermission(context, "contractors", "edit");
    const { data: permit, error } = await context.supabase
      .from("permits_to_work")
      .select("*")
      .eq("id", data.permitId)
      .single();
    if (error || !permit) throw new Error("Permit could not be found.");
    if (permit.status !== "draft")
      throw new Error("Only draft permits can be generated. Revert to draft first.");

    let contractorName = "the contractor";
    if (permit.contractor_id) {
      const { data: c } = await context.supabase
        .from("contractors")
        .select("company_name")
        .eq("id", permit.contractor_id)
        .single();
      if (c?.company_name) contractorName = c.company_name;
    }

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI service is not configured. Please contact your administrator.");
    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const { generateText, Output } = await import("ai");
    const gateway = createLovableAiGatewayProvider(key);
    const schema = z.object({
      workers: z.string().min(5).max(4000),
      hazards: z.string().min(20).max(8000),
      controls: z.string().min(20).max(8000),
      additional_scope: z.string().min(0).max(4000).optional(),
    });

    try {
      const { output } = await generateText({
        model: gateway("google/gemini-2.5-flash"),
        output: Output.object({ schema }),
        system:
          "You are a senior HSE professional drafting a formal Permit to Work compliant with ISO 45001:2018 (clauses 8.1 Operational planning and control, 8.1.2 Eliminating hazards and reducing OH&S risks, and 8.2 Emergency preparedness and response). Produce professional, neutral, comprehensive content. Each output field must be a bullet list with one item per line, each line starting with '• '. Do not write inline comma-separated lists. Do not mention that the content is computer- or AI-generated.",
        prompt: `Draft the Workers, Hazards and Controls sections for a Permit to Work using the data below. Be specific to the work scope and location. Include site-typical hazards (mechanical, electrical, working at height, hot work, confined space, chemical, ergonomic, environmental, fire, traffic, etc. where applicable to the scope) and the corresponding hierarchy-of-controls measures (elimination, substitution, engineering, administrative, PPE). Mention isolations, LOTO, permits required, monitoring (gas, atmospheric), supervision, rescue plan, emergency arrangements and reporting expectations where relevant. Also produce an "additional_scope" paragraph that elaborates on the work scope in 3-6 sentences for the permit document.

Contractor: ${contractorName}
Work scope: ${permit.work_scope ?? "—"}
Work location: ${permit.work_location ?? "—"}
Valid from: ${permit.valid_from ?? "—"}
Valid until: ${permit.valid_until ?? "—"}
Existing workers list: ${permit.workers ?? "(not provided — propose a typical crew composition for this scope)"}
Existing hazards: ${permit.hazards ?? "(none yet)"}
Existing controls: ${permit.controls ?? "(none yet)"}

Return JSON matching the schema. Each multi-line field uses '\\n' separators and each line begins with '• '.`,
      });
      if (!output) throw new Error("AI did not return permit content.");
      const parsed = schema.parse(output);
      const newScope = parsed.additional_scope
        ? `${permit.work_scope ?? ""}\n\n${parsed.additional_scope}`.trim()
        : permit.work_scope;
      const { error: upErr } = await context.supabase
        .from("permits_to_work")
        .update({
          workers: parsed.workers,
          hazards: parsed.hazards,
          controls: parsed.controls,
          work_scope: newScope,
        })
        .eq("id", data.permitId)
        .eq("status", "draft");
      if (upErr) throw new Error("Generated permit content could not be saved.");
      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("429")) throw new Error("Generation rate limit reached. Please try again shortly.");
      if (msg.includes("402")) throw new Error("Generation credits exhausted. Please contact your administrator.");
      throw new Error(`Permit generation failed: ${msg}`);
    }
  });


export const generateBrandedReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        module: z.enum(moduleNames),
        title: text(300),
        recordId: uuid.optional(),
        data: z.record(z.unknown()),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertPermission(context, "reporting", "create");
    await assertPermission(context, data.module, "view");
    const reportNumber = ref("RPT");
    const { data: report, error } = await context.supabase
      .from("generated_reports")
      .insert({
        report_number: reportNumber,
        module: data.module,
        record_id: data.recordId ?? null,
        title: data.title,
        report_data: data.data as never,
        status: "draft",
        generated_by: context.userId,
      })
      .select("*")
      .single();
    if (error || !report) throw new Error("The report could not be generated.");
    return report;
  });

export const approveGeneratedReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ reportId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    await assertPermission(context, "reporting", "approve");
    const { error } = await context.supabase
      .from("generated_reports")
      .update({
        status: "approved",
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", data.reportId)
      .eq("status", "draft");
    if (error) throw new Error("The report could not be approved.");
    return { ok: true };
  });

export const deleteGeneratedReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ reportIds: z.array(uuid).min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertPermission(context, "reporting", "delete");
    // RLS only allows deletion of draft reports owned by the user or by admin.
    const { error, count } = await context.supabase
      .from("generated_reports")
      .delete({ count: "exact" })
      .in("id", data.reportIds)
      .eq("status", "draft");
    if (error) throw new Error("The reports could not be deleted.");
    return { deleted: count ?? 0 };
  });

export const saveReportSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        companyName: text(200),
        reportFooter: z.string().trim().max(1000).optional().default(""),
        defaultTimezone: z.string().trim().min(3).max(80),
        letterheadPath: z.string().trim().max(300).optional().default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!admin) throw new Error("Only administrators can change report branding.");
    const { data: current } = await context.supabase
      .from("company_report_settings")
      .select("id")
      .limit(1)
      .maybeSingle();
    const values = {
      company_name: data.companyName,
      report_footer: data.reportFooter || null,
      default_timezone: data.defaultTimezone,
      letterhead_path: data.letterheadPath || null,
      updated_by: context.userId,
    };
    const result = current
      ? await context.supabase.from("company_report_settings").update(values).eq("id", current.id)
      : await context.supabase.from("company_report_settings").insert(values);
    if (result.error) {
      console.error("[reports] branding save failed", result.error.message);
      throw new Error("The report branding could not be saved. Please try again.");
    }
    return { ok: true };
  });

export const saveReportSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: uuid.optional(),
        module: z.enum(moduleNames),
        recipients: z.array(z.string().email().max(255)).min(1).max(20),
        cadence: z.enum(["daily", "weekly", "monthly"]),
        weekday: z.coerce.number().int().min(0).max(6).nullable(),
        hourUtc: z.coerce.number().int().min(0).max(23),
        timezone: z.string().trim().min(3).max(80),
        isActive: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!admin) throw new Error("Only administrators can manage report subscriptions.");

    // Normalise + dedupe recipients within this subscription so the same
    // address never receives two copies of the same scheduled report.
    const normalizedRecipients = Array.from(
      new Set(data.recipients.map((email) => email.trim().toLowerCase()).filter(Boolean)),
    );
    if (normalizedRecipients.length === 0) {
      throw new Error("Add at least one valid recipient email.");
    }

    // Reject exact duplicates: same module + cadence + recipient set already
    // active. Prevents the inbox-flooding behaviour caused by accidentally
    // creating the same schedule twice.
    const { data: existing } = await context.supabase
      .from("report_subscriptions")
      .select("id,recipients,cadence,is_active")
      .eq("module", data.module)
      .eq("cadence", data.cadence)
      .eq("is_active", true);
    const sortedNew = [...normalizedRecipients].sort().join("|");
    const clash = (existing ?? []).find((row) => {
      if (data.id && row.id === data.id) return false;
      const sortedExisting = [...(row.recipients ?? [])]
        .map((value: string) => value.trim().toLowerCase())
        .sort()
        .join("|");
      return sortedExisting === sortedNew;
    });
    if (clash) {
      throw new Error(
        "An identical subscription already exists for this module, cadence and recipients. Pause or delete the existing one before adding a duplicate.",
      );
    }

    const next = new Date();
    next.setUTCMinutes(0, 0, 0);
    next.setUTCHours(data.hourUtc);
    if (next <= new Date()) next.setUTCDate(next.getUTCDate() + 1);
    const values = {
      module: data.module,
      recipients: normalizedRecipients,
      cadence: data.cadence,
      weekday: data.cadence === "weekly" ? data.weekday : null,
      hour_utc: data.hourUtc,
      timezone: data.timezone,
      is_active: data.isActive,
      next_run_at: next.toISOString(),
      created_by: context.userId,
    };
    const result = data.id
      ? await context.supabase.from("report_subscriptions").update(values).eq("id", data.id)
      : await context.supabase.from("report_subscriptions").insert(values);
    if (result.error) {
      console.error("[reports] subscription save failed", result.error.message);
      throw new Error("The report schedule could not be saved. Please try again.");
    }
    return { ok: true };
  });

