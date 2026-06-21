import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCreateOrEditPermission, assertPermission } from "@/lib/permissions.functions";

const text = (max = 200) => z.string().trim().min(2).max(max);
const optionalText = (max = 2000) => z.string().trim().max(max).optional().default("");
const employeeId = z.string().uuid().optional().or(z.literal(""));
const level = z.coerce.number().int().min(1).max(5);

const createSchema = z.discriminatedUnion("module", [
  z.object({
    module: z.literal("incidents"),
    title: text(),
    type: z.enum([
      "injury",
      "environmental",
      "property_damage",
      "near_miss",
      "occupational_illness",
      "security",
      "other",
    ]),
    site: text(),
    department: text(),
    location: text(),
    occurredAt: z.string().min(10).max(40),
    severity: z.enum(["low", "moderate", "high", "critical"]),
    description: text(2000),
    immediateAction: optionalText(),
    personsInvolved: optionalText(),
    ownerId: employeeId,
    dueDate: z.string().max(10).optional().default(""),
  }),
  z.object({
    module: z.literal("hazards"),
    site: text(),
    department: text(),
    location: text(),
    description: text(2000),
    likelihood: level,
    severity: level,
    existingControls: optionalText(),
    additionalControls: optionalText(),
    ownerId: employeeId,
  }),
  z.object({
    module: z.literal("observations"),
    observationType: z.enum(["positive_behaviour", "unsafe_act", "unsafe_condition"]),
    site: text(),
    department: text(),
    location: text(),
    description: text(2000),
    immediateResponse: optionalText(),
    observedAt: z.string().min(10).max(40),
    supervisorId: employeeId,
  }),
  z.object({
    module: z.literal("near_misses"),
    title: text(),
    site: text(),
    department: text(),
    location: text(),
    occurredAt: z.string().min(10).max(40),
    description: text(2000),
    potentialSeverity: z.enum(["low", "moderate", "high", "critical"]),
    immediateControls: optionalText(),
    ownerId: employeeId,
    dueDate: z.string().max(10).optional().default(""),
  }),
  z.object({
    module: z.literal("risks"),
    activity: text(),
    site: text(),
    department: text(),
    category: text(),
    hazard: text(1000),
    consequence: text(1000),
    peopleExposed: text(500),
    existingControls: text(2000),
    additionalControls: optionalText(),
    likelihood: level,
    severity: level,
    residualLikelihood: level,
    residualSeverity: level,
    ownerId: employeeId,
    reviewDate: z.string().min(10).max(10),
  }),
  z.object({
    module: z.literal("audits"),
    title: text(),
    auditType: z.enum(["internal", "external", "one_maestro", "icc_audit", "compliance"]),
    site: text(),
    department: text(),
    area: text(),
    scope: text(2000),
    leadAuditor: text(),
    auditTeam: optionalText(),
    scheduledOn: z.string().min(10).max(10),
  }),
  z.object({
    module: z.literal("capa"),
    title: text(),
    actionType: z.enum(["corrective", "preventive"]),
    sourceType: z.enum([
      "incident",
      "hazard",
      "observation",
      "near_miss",
      "risk",
      "audit",
      "inspection",
      "management_review",
      "other",
    ]),
    sourceReference: optionalText(200),
    ownerId: employeeId,
    dueDate: z.string().min(10).max(10),
    priority: z.enum(["low", "medium", "high", "critical"]),
    preventiveAction: optionalText(),
  }),
]);

const transitionSchema = z.object({
  module: z.enum([
    "incidents",
    "hazards",
    "observations",
    "near_misses",
    "risks",
    "audits",
    "capa",
  ]),
  recordId: z.string().uuid(),
  fromStatus: z.string().min(2).max(40),
  toStatus: z.string().min(2).max(40),
  note: z.string().trim().max(4000).optional().default(""),
});

const flows: Record<string, string[]> = {
  incidents: ["reported", "investigated", "approved", "actioned", "verified", "closed"],
  hazards: ["open", "in_progress", "closed"],
  observations: ["open", "in_progress", "closed"],
  near_misses: ["reported", "investigated", "actioned", "verified", "closed"],
  risks: ["draft", "active", "under_review", "closed"],
  audits: ["planned", "conducted", "issued", "actioned", "verified", "closed"],
  capa: ["open", "in_progress", "awaiting_verification", "completed", "closed"],
};

function ref(prefix: string) {
  return `${prefix}-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export const getModulePack = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const permissionChecks = await Promise.all(
      (
        [
          "incidents",
          "hazards",
          "observations",
          "near_misses",
          "risks",
          "audits",
          "capa",
          "employees",
        ] as const
      ).map(async (module) => {
        const { data } = await db.rpc("has_module_permission", {
          _user_id: context.userId,
          _module: module,
          _action: "view",
        });
        return [module, data === true] as const;
      }),
    );
    const canView = Object.fromEntries(permissionChecks) as Record<
      (typeof permissionChecks)[number][0],
      boolean
    >;
    const [
      incidents,
      hazards,
      observations,
      nearMisses,
      risks,
      audits,
      capa,
      employees,
      roles,
      profile,
      directory,
    ] = await Promise.all([
      canView.incidents
        ? db.from("incidents").select("*").order("created_at", { ascending: false }).limit(250)
        : Promise.resolve({ data: [], error: null }),
      canView.hazards
        ? db.from("hazards").select("*").order("created_at", { ascending: false }).limit(250)
        : Promise.resolve({ data: [], error: null }),
      canView.observations
        ? db
            .from("safety_observations")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(250)
        : Promise.resolve({ data: [], error: null }),
      canView.near_misses
        ? db.from("near_misses").select("*").order("created_at", { ascending: false }).limit(250)
        : Promise.resolve({ data: [], error: null }),
      canView.risks
        ? db
            .from("risk_assessments")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(250)
        : Promise.resolve({ data: [], error: null }),
      canView.audits
        ? db.from("audits").select("*").order("created_at", { ascending: false }).limit(250)
        : Promise.resolve({ data: [], error: null }),
      canView.capa
        ? db.from("actions").select("*").order("created_at", { ascending: false }).limit(250)
        : Promise.resolve({ data: [], error: null }),
      canView.employees
        ? db
            .from("employees")
            .select(
              "id,full_name,email,phone,department,job_title,employment_status,user_id,manager_employee_id,approval_level,account_status,avatar_path",
            )
            .order("full_name")
        : Promise.resolve({ data: [], error: null }),
      db.from("user_roles").select("role").eq("user_id", context.userId),
      db.from("profiles").select("avatar_path").eq("id", context.userId).maybeSingle(),
      db.rpc("directory_names"),
    ]);
    const labeled = {
      incidents,
      hazards,
      observations,
      nearMisses,
      risks,
      audits,
      capa,
      employees,
      roles,
      profile,
      directory,
    } as const;
    for (const [name, result] of Object.entries(labeled)) {
      if (result.error) {
        console.error(`[module-pack] ${name} query failed:`, result.error);
        throw new Error(`Unable to load Module Pack 1 records (${name}): ${result.error.message}`);
      }
    }
    const currentRoles = (roles.data ?? []).map((item) => item.role);
    const employeeRoleByUserId = new Map<string, string>();
    if (currentRoles.includes("admin")) {
      const userIds = [...new Set((employees.data ?? []).map((employee) => employee.user_id).filter(Boolean))];
      if (userIds.length) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: employeeRoles, error: employeeRolesError } = await supabaseAdmin
          .from("user_roles")
          .select("user_id,role")
          .in("user_id", userIds as string[]);
        if (employeeRolesError) {
          console.error("[module-pack] employee role query failed:", employeeRolesError.message);
        }
        const priority = new Map([
          ["admin", 8],
          ["director", 7],
          ["hse_manager", 6],
          ["hr_manager", 5],
          ["hse_coordinator", 4],
          ["supervisor", 3],
          ["auditor", 2],
          ["employee", 1],
        ]);
        for (const entry of employeeRoles ?? []) {
          const current = employeeRoleByUserId.get(entry.user_id);
          if (!current || (priority.get(entry.role) ?? 0) > (priority.get(current) ?? 0)) {
            employeeRoleByUserId.set(entry.user_id, entry.role);
          }
        }
      }
    }
    const currentAvatarPath = profile.data?.avatar_path ?? null;
    const avatarPaths = (employees.data ?? [])
      .map((employee) => employee.avatar_path)
      .filter((path): path is string => Boolean(path));
    if (currentAvatarPath && !avatarPaths.includes(currentAvatarPath))
      avatarPaths.push(currentAvatarPath);
    const signed = avatarPaths.length
      ? await db.storage.from("profile-photos").createSignedUrls(avatarPaths, 3600)
      : { data: [], error: null };
    if (signed.error) throw new Error("Unable to load employee profile photos.");
    const avatarUrls = new Map((signed.data ?? []).map((item) => [item.path, item.signedUrl]));
    const employeeRows = (employees.data ?? []).map((employee) => ({
      ...employee,
      role: employee.user_id ? (employeeRoleByUserId.get(employee.user_id) ?? "employee") : "employee",
      avatar_url: employee.avatar_path ? (avatarUrls.get(employee.avatar_path) ?? null) : null,
    }));
    return {
      incidents: incidents.data ?? [],
      hazards: hazards.data ?? [],
      observations: observations.data ?? [],
      near_misses: nearMisses.data ?? [],
      risks: risks.data ?? [],
      audits: audits.data ?? [],
      capa: capa.data ?? [],
      employees: employeeRows,
      directory: (directory.data ?? []) as Array<{ id: string; name: string }>,
      roles: currentRoles,
      currentAvatarPath,
      currentAvatarUrl: currentAvatarPath ? (avatarUrls.get(currentAvatarPath) ?? null) : null,
    };
  });

export const createModuleRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCreateOrEditPermission(context, data.module);
    const db = context.supabase;
    let errorMessage = "";
    let recordId = "";
    const accept = (result: { data: { id: string } | null; error: { message: string } | null }) => {
      recordId = result.data?.id ?? "";
      errorMessage = result.error?.message ?? "";
    };
    if (data.module === "incidents") {
      const { data: emp } = await db
        .from("employees")
        .select("full_name")
        .eq("user_id", context.userId)
        .maybeSingle();
      const { data: prof } = emp?.full_name
        ? { data: null }
        : await db.from("profiles").select("full_name").eq("id", context.userId).maybeSingle();
      const emailName = (context.claims.email ?? "")
        .split("@")[0]
        ?.replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();
      const resolvedReporterName =
        emp?.full_name || prof?.full_name || emailName || context.claims.email || null;
      accept(
        await db
          .from("incidents")
          .insert({
            reference: ref("INC"),
            incident_type: data.type,
            title: data.title,
            site: data.site,
            department: data.department,
            location: data.location,
            occurred_at: data.occurredAt,
            severity: data.severity,
            description: data.description,
            immediate_action: data.immediateAction || null,
            persons_involved: data.personsInvolved || null,
            responsible_person_id: data.ownerId || null,
            action_due_date: data.dueDate || null,
            reporter_name: resolvedReporterName,
            reported_by: context.userId,
          })
          .select("id")
          .single(),
      );
    }

    if (data.module === "hazards")
      accept(
        await db
          .from("hazards")
          .insert({
            reference: ref("HAZ"),
            site: data.site,
            department: data.department,
            location: data.location,
            description: data.description,
            likelihood: data.likelihood,
            severity: data.severity,
            existing_controls: data.existingControls || null,
            additional_controls: data.additionalControls || null,
            owner_id: data.ownerId || null,
            reported_by: context.userId,
          })
          .select("id")
          .single(),
      );
    if (data.module === "observations")
      accept(
        await db
          .from("safety_observations")
          .insert({
            reference: ref("OBS"),
            observation_type: data.observationType,
            site: data.site,
            department: data.department,
            location: data.location,
            description: data.description,
            immediate_response: data.immediateResponse || null,
            observed_at: data.observedAt,
            supervisor_id: data.supervisorId || null,
            observed_by: context.userId,
          })
          .select("id")
          .single(),
      );
    if (data.module === "near_misses")
      accept(
        await db
          .from("near_misses")
          .insert({
            reference: ref("NM"),
            title: data.title,
            site: data.site,
            department: data.department,
            location: data.location,
            occurred_at: data.occurredAt,
            description: data.description,
            potential_severity: data.potentialSeverity,
            immediate_controls: data.immediateControls || null,
            responsible_person_id: data.ownerId || null,
            action_due_date: data.dueDate || null,
            reported_by: context.userId,
          })
          .select("id")
          .single(),
      );
    if (data.module === "risks")
      accept(
        await db
          .from("risk_assessments")
          .insert({
            reference: ref("RSK"),
            activity: data.activity,
            site: data.site,
            department: data.department,
            category: data.category,
            hazard: data.hazard,
            consequence: data.consequence,
            people_exposed: data.peopleExposed,
            existing_controls: data.existingControls,
            additional_controls: data.additionalControls || null,
            likelihood: data.likelihood,
            severity: data.severity,
            residual_likelihood: data.residualLikelihood,
            residual_severity: data.residualSeverity,
            owner_id: data.ownerId || null,
            review_date: data.reviewDate,
            created_by: context.userId,
          })
          .select("id")
          .single(),
      );
    if (data.module === "audits")
      accept(
        await db
          .from("audits")
          .insert({
            audit_number: ref("AUD"),
            title: data.title,
            audit_type: data.auditType,
            site: data.site,
            department: data.department,
            area: data.area,
            scope: data.scope,
            lead_auditor: data.leadAuditor,
            audit_team: data.auditTeam || null,
            scheduled_on: data.scheduledOn,
            created_by: context.userId,
          })
          .select("id")
          .single(),
      );
    if (data.module === "capa")
      accept(
        await db
          .from("actions")
          .insert({
            title: data.title,
            action_type: data.actionType,
            source_type: data.sourceType,
            source_reference: data.sourceReference || null,
            owner_id: data.ownerId || null,
            due_date: data.dueDate,
            priority: data.priority,
            preventive_action: data.preventiveAction || null,
            created_by: context.userId,
          })
          .select("id")
          .single(),
      );
    if (errorMessage || !recordId)
      throw new Error(errorMessage || "The record could not be created.");
    await db.from("workflow_events").insert({
      module:
        data.module === "observations"
          ? "observation"
          : data.module === "incidents"
            ? "incident"
            : data.module === "hazards"
              ? "hazard"
              : data.module === "near_misses"
                ? "near_miss"
                : data.module === "risks"
                  ? "risk"
                  : data.module === "audits"
                    ? "audit"
                    : "capa",
      record_id: recordId,
      to_status:
        data.module === "audits"
          ? "planned"
          : ["incidents", "near_misses"].includes(data.module)
            ? "reported"
            : data.module === "risks"
              ? "draft"
              : "open",
      event_type: "created",
      actor_id: context.userId,
    });
    return { ok: true, recordId };
  });

export const transitionModuleRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => transitionSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertPermission(context, data.module, "approve");
    const flow = flows[data.module] ?? [];
    const current = flow.indexOf(data.fromStatus);
    if (current < 0 || flow[current + 1] !== data.toStatus)
      throw new Error("This workflow transition is not permitted.");
    const roles = ["admin", "hse_manager", "supervisor"] as const;
    const allowed = await Promise.all(
      roles.map((role) =>
        context.supabase.rpc("has_role", { _user_id: context.userId, _role: role }),
      ),
    );
    if (!allowed.some((result) => result.data === true))
      throw new Error("Only authorised HSE workflow owners can advance records.");
    if (
      ["approved", "verified", "closed"].includes(data.toStatus) &&
      !allowed.slice(0, 2).some((result) => result.data === true)
    )
      throw new Error("Only the HSE management team can approve, verify, or close records.");
    const table =
      data.module === "observations"
        ? "safety_observations"
        : data.module === "near_misses"
          ? "near_misses"
          : data.module === "risks"
            ? "risk_assessments"
            : data.module === "capa"
              ? "actions"
              : data.module;
    const currentRecord =
      table === "incidents"
        ? await context.supabase.from("incidents").select("status").eq("id", data.recordId).single()
        : table === "hazards"
          ? await context.supabase.from("hazards").select("status").eq("id", data.recordId).single()
          : table === "safety_observations"
            ? await context.supabase
                .from("safety_observations")
                .select("status")
                .eq("id", data.recordId)
                .single()
            : table === "near_misses"
              ? await context.supabase
                  .from("near_misses")
                  .select("status")
                  .eq("id", data.recordId)
                  .single()
              : table === "risk_assessments"
                ? await context.supabase
                    .from("risk_assessments")
                    .select("status")
                    .eq("id", data.recordId)
                    .single()
                : table === "audits"
                  ? await context.supabase
                      .from("audits")
                      .select("status")
                      .eq("id", data.recordId)
                      .single()
                  : await context.supabase
                      .from("actions")
                      .select("status")
                      .eq("id", data.recordId)
                      .single();
    if (currentRecord.error || currentRecord.data?.status !== data.fromStatus)
      throw new Error(
        "This record is no longer in the expected workflow state. Refresh and try again.",
      );
    const result =
      table === "incidents"
        ? await context.supabase
            .from("incidents")
            .update({ status: data.toStatus })
            .eq("id", data.recordId)
        : table === "hazards"
          ? await context.supabase
              .from("hazards")
              .update({ status: data.toStatus })
              .eq("id", data.recordId)
          : table === "safety_observations"
            ? await context.supabase
                .from("safety_observations")
                .update({ status: data.toStatus })
                .eq("id", data.recordId)
            : table === "near_misses"
              ? await context.supabase
                  .from("near_misses")
                  .update({ status: data.toStatus })
                  .eq("id", data.recordId)
              : table === "risk_assessments"
                ? await context.supabase
                    .from("risk_assessments")
                    .update({ status: data.toStatus })
                    .eq("id", data.recordId)
                : table === "audits"
                  ? await context.supabase
                      .from("audits")
                      .update({ status: data.toStatus })
                      .eq("id", data.recordId)
                  : await context.supabase
                      .from("actions")
                      .update({ status: data.toStatus })
                      .eq("id", data.recordId);
    if (result.error) {
      console.error("[workflow] transition failed", result.error.message);
      throw new Error("The workflow could not be updated. Please refresh and try again.");
    }
    await context.supabase.from("workflow_events").insert({
      module:
        data.module === "observations"
          ? "observation"
          : data.module === "incidents"
            ? "incident"
            : data.module === "hazards"
              ? "hazard"
              : data.module === "near_misses"
                ? "near_miss"
                : data.module === "risks"
                  ? "risk"
                  : data.module === "audits"
                    ? "audit"
                    : "capa",
      record_id: data.recordId,
      from_status: data.fromStatus,
      to_status: data.toStatus,
      event_type:
        data.toStatus === "closed"
          ? "closure"
          : data.toStatus === "verified"
            ? "verification"
            : data.toStatus === "approved"
              ? "approval"
              : "status_change",
      note: data.note || null,
      actor_id: context.userId,
    });

    // Auto-email on closure: notify reporter and responsible person (when known).
    if (data.toStatus === "closed") {
      try {
        await sendClosureEmail({
          module: data.module,
          table,
          recordId: data.recordId,
          actorId: context.userId,
          supabase: context.supabase,
        });
      } catch (cause) {
        console.error("[workflow] closure email failed", cause);
        // Closure must succeed even if email queueing fails.
      }
    }

    return { ok: true };
  });

async function sendClosureEmail(args: {
  module: string;
  table: string;
  recordId: string;
  actorId: string;
  supabase: import("@supabase/supabase-js").SupabaseClient;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Pre-flight deliverability check — abort if the sender domain is
  // misconfigured rather than silently bouncing every closure notice.
  const { verifyDeliverability } = await import("./email-deliverability.server");
  const deliverability = await verifyDeliverability("notify.prosellimited.com", "notify.prosellimited.com");
  if (!deliverability.ok) {
    console.error("[closure-email] skipped — deliverability check failed", deliverability.issues);
    return;
  }
  const { data: row } = await args.supabase
    .from(args.table)
    .select("*")
    .eq("id", args.recordId)
    .single();
  if (!row) return;
  const recipientIds = new Set<string>();
  for (const key of ["reported_by", "observed_by", "responsible_person_id", "owner_id", "created_by"]) {
    const v = row[key as keyof typeof row];
    if (typeof v === "string" && v) recipientIds.add(v);
  }
  if (recipientIds.size === 0) return;
  const { data: users } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emails = new Set<string>();
  for (const u of users?.users ?? []) {
    if (recipientIds.has(u.id) && u.email) emails.add(u.email.toLowerCase());
  }
  if (emails.size === 0) return;
  const title =
    String(row.title ?? row.activity ?? row.description ?? row.reference ?? `${args.module} record`).slice(0, 120);
  const reference = String(row.reference ?? row.audit_number ?? row.id);
  for (const recipientEmail of emails) {
    const messageId = crypto.randomUUID();
    let unsubscribeToken: string | null = null;
    const existing = await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", recipientEmail)
      .is("used_at", null)
      .maybeSingle();
    if (existing.data?.token) {
      unsubscribeToken = existing.data.token;
    } else {
      const newToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const ins = await supabaseAdmin
        .from("email_unsubscribe_tokens")
        .insert({ token: newToken, email: recipientEmail })
        .select("token")
        .single();
      unsubscribeToken = ins.data?.token ?? newToken;
    }
    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: "workflow-closure",
      recipient_email: recipientEmail,
      status: "pending",
    });
    const subject = `Record closed · ${reference} · ${title}`;
    const html = `<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
        <p style="font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#64748b">Prosel Limited · HSE360</p>
        <h1 style="font-size:22px;margin:0 0 12px">Record closed</h1>
        <p><strong>${reference}</strong> — ${title}</p>
        <p>The record above has been moved to <strong>Closed</strong> in the HSE management system. No further action is required from you on this record.</p>
        <p style="font-size:12px;color:#64748b;margin-top:24px">Sign in to Afrinet HSE360 to review the full record and audit trail.</p>
      </div>`;
    const text = `Record closed: ${reference} — ${title}\n\nThe record has been moved to Closed in the HSE management system. Sign in to Afrinet HSE360 to review.`;
    await supabaseAdmin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: recipientEmail,
        from: "prosel-safety-hub <noreply@notify.prosellimited.com>",
        sender_domain: "notify.prosellimited.com",
        subject,
        html,
        text,
        purpose: "transactional",
        label: "workflow-closure",
        idempotency_key: `closure-${args.recordId}`,
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
      },
    });
  }
}
