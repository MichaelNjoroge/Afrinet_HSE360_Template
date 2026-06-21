import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCreateOrEditPermission, assertPermission } from "@/lib/permissions.functions";

const required = (max = 500) => z.string().trim().min(2).max(max);
const optional = (max = 2000) => z.string().trim().max(max).optional().default("");
const uuid = z.string().uuid().optional().or(z.literal(""));
const date = z.string().min(10).max(10);

const recordSchema = z.discriminatedUnion("module", [
  z.object({
    module: z.literal("legal"),
    obligation: required(2000),
    authority: required(200),
    category: z.enum(["osha_kenya", "nema", "fire_safety", "county_government", "other"]),
    status: z.enum(["compliant", "partially_compliant", "non_compliant", "under_review"]),
    reviewDate: date,
    evidence: optional(),
    ownerId: uuid,
  }),
  z.object({
    module: z.literal("contractors"),
    companyName: required(240),
    contactPerson: required(160),
    email: z.string().trim().email().max(255).optional().or(z.literal("")),
    phone: optional(60),
    scope: required(2000),
    status: z.enum(["pending", "under_review", "approved", "suspended", "expired", "rejected"]),
    insuranceProvider: optional(200),
    insuranceExpiry: z.string().max(10).optional().default(""),
    permitReference: optional(200),
    permitExpiry: z.string().max(10).optional().default(""),
    hseScore: z.coerce.number().min(0).max(100).optional(),
    ownerId: uuid,
  }),
  z.object({
    module: z.literal("environment"),
    activity: required(500),
    aspect: required(1000),
    impact: required(1000),
    condition: z.enum(["normal", "abnormal", "emergency"]),
    likelihood: z.coerce.number().int().min(1).max(5),
    severity: z.coerce.number().int().min(1).max(5),
    controls: optional(),
    additionalControls: optional(),
    reviewDate: date,
    ownerId: uuid,
  }),
  z.object({
    module: z.literal("ppe"),
    employeeId: z.string().uuid(),
    item: required(200),
    serialNumber: optional(200),
    quantity: z.coerce.number().int().min(1).max(1000),
    issuedOn: date,
    replacementOn: z.string().max(10).optional().default(""),
    condition: z.enum(["new", "serviceable", "due_replacement", "damaged", "lost", "replaced"]),
    issuedBy: uuid,
    notes: optional(),
  }),
  z.object({
    module: z.literal("documents"),
    number: required(80),
    title: required(300),
    documentType: z.enum(["policy", "sop", "procedure", "form", "work_instruction", "other"]),
    version: required(30),
    reviewDate: date,
    ownerId: uuid,
  }),
  z.object({
    module: z.literal("reviews"),
    periodStart: date,
    periodEnd: date,
    meetingDate: date,
    attendees: optional(),
    summary: optional(8000),
    decisions: optional(8000),
    chairpersonId: uuid,
  }),
]);

function ref(prefix: string) {
  return `${prefix}-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export const getModulePacksThreeFour = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const permissionChecks = await Promise.all(
      (
        [
          "legal",
          "contractors",
          "environment",
          "ppe",
          "documents",
          "reviews",
          "notifications",
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
      legal,
      contractors,
      aspects,
      waste,
      resources,
      emissions,
      ppe,
      ppeInspections,
      documents,
      versions,
      reviews,
      sites,
      departments,
      notifications,
    ] = await Promise.all([
      canView.legal
        ? db.from("legal_requirements").select("*").order("review_date").limit(500)
        : Promise.resolve({ data: [], error: null }),
      canView.contractors
        ? db.from("contractors").select("*").order("created_at", { ascending: false }).limit(500)
        : Promise.resolve({ data: [], error: null }),
      canView.environment
        ? db
            .from("environmental_aspects")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(500)
        : Promise.resolve({ data: [], error: null }),
      canView.environment
        ? db
            .from("environmental_waste_records")
            .select("*")
            .order("recorded_on", { ascending: false })
            .limit(500)
        : Promise.resolve({ data: [], error: null }),
      canView.environment
        ? db
            .from("environmental_resource_records")
            .select("*")
            .order("period_start", { ascending: false })
            .limit(500)
        : Promise.resolve({ data: [], error: null }),
      canView.environment
        ? db
            .from("environmental_emission_records")
            .select("*")
            .order("period_start", { ascending: false })
            .limit(500)
        : Promise.resolve({ data: [], error: null }),
      canView.ppe
        ? db.from("ppe_issuances").select("*").order("issued_on", { ascending: false }).limit(500)
        : Promise.resolve({ data: [], error: null }),
      canView.ppe
        ? db
            .from("ppe_inspections")
            .select("*")
            .order("inspected_on", { ascending: false })
            .limit(500)
        : Promise.resolve({ data: [], error: null }),
      canView.documents
        ? db.from("hse_documents").select("*").order("updated_at", { ascending: false }).limit(500)
        : Promise.resolve({ data: [], error: null }),
      canView.documents
        ? db
            .from("hse_document_versions")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(1000)
        : Promise.resolve({ data: [], error: null }),
      canView.reviews
        ? db
            .from("management_reviews")
            .select("*")
            .order("meeting_date", { ascending: false })
            .limit(250)
        : Promise.resolve({ data: [], error: null }),
      db.from("sites").select("*").order("name"),
      db.from("departments").select("*").order("name"),
      canView.notifications
        ? db.from("notifications").select("*").is("read_at", null).order("due_date").limit(100)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const results = [
      legal,
      contractors,
      aspects,
      waste,
      resources,
      emissions,
      ppe,
      ppeInspections,
      documents,
      versions,
      reviews,
      sites,
      departments,
      notifications,
    ];
    if (results.some((result) => result.error))
      throw new Error("Unable to load Module Packs 3 and 4.");
    return {
      legal: legal.data ?? [],
      contractors: contractors.data ?? [],
      environment: aspects.data ?? [],
      waste: waste.data ?? [],
      resources: resources.data ?? [],
      emissions: emissions.data ?? [],
      ppe: ppe.data ?? [],
      ppeInspections: ppeInspections.data ?? [],
      documents: documents.data ?? [],
      versions: versions.data ?? [],
      reviews: reviews.data ?? [],
      sites: sites.data ?? [],
      departments: departments.data ?? [],
      notifications: notifications.data ?? [],
    };
  });

export const createModulePacksThreeFourRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => recordSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCreateOrEditPermission(context, data.module);
    const db = context.supabase;
    let result: { error: { message: string } | null };
    if (data.module === "legal")
      result = await db.from("legal_requirements").insert({
        reference: ref("LEG"),
        legal_obligation: data.obligation,
        authority: data.authority,
        category: data.category,
        compliance_status: data.status,
        review_date: data.reviewDate,
        evidence: data.evidence || null,
        owner_id: data.ownerId || null,
        created_by: context.userId,
      });
    else if (data.module === "contractors")
      result = await db.from("contractors").insert({
        reference: ref("CON"),
        company_name: data.companyName,
        contact_person: data.contactPerson,
        contact_email: data.email || null,
        contact_phone: data.phone || null,
        scope_of_work: data.scope,
        approval_status: data.status,
        insurance_provider: data.insuranceProvider || null,
        insurance_expiry: data.insuranceExpiry || null,
        permit_reference: data.permitReference || null,
        permit_expiry: data.permitExpiry || null,
        hse_score: data.hseScore ?? null,
        owner_id: data.ownerId || null,
        created_by: context.userId,
      });
    else if (data.module === "environment")
      result = await db.from("environmental_aspects").insert({
        reference: ref("ENV"),
        activity: data.activity,
        aspect: data.aspect,
        impact: data.impact,
        condition: data.condition,
        likelihood: data.likelihood,
        severity: data.severity,
        existing_controls: data.controls || null,
        additional_controls: data.additionalControls || null,
        review_date: data.reviewDate,
        owner_id: data.ownerId || null,
        created_by: context.userId,
      });
    else if (data.module === "ppe")
      result = await db.from("ppe_issuances").insert({
        reference: ref("PPE"),
        employee_id: data.employeeId,
        ppe_item: data.item,
        serial_number: data.serialNumber || null,
        quantity: data.quantity,
        issued_on: data.issuedOn,
        expected_replacement_on: data.replacementOn || null,
        condition: data.condition,
        issued_by: data.issuedBy || null,
        notes: data.notes || null,
        created_by: context.userId,
      });
    else if (data.module === "documents")
      result = await db.from("hse_documents").insert({
        document_number: data.number,
        title: data.title,
        document_type: data.documentType,
        current_version: data.version,
        review_date: data.reviewDate,
        owner_id: data.ownerId || null,
        created_by: context.userId,
      });
    else {
      if (data.periodEnd < data.periodStart)
        throw new Error("Review period end must be after its start.");
      result = await db.from("management_reviews").insert({
        reference: ref("MR"),
        period_start: data.periodStart,
        period_end: data.periodEnd,
        meeting_date: data.meetingDate,
        attendees: data.attendees || null,
        executive_summary: data.summary || null,
        decisions: data.decisions || null,
        chairperson_id: data.chairpersonId || null,
        created_by: context.userId,
      });
    }
    if (result.error) {
      console.error("[module-packs-three-four] create failed", result.error.message);
      throw new Error("The record could not be saved. Please try again.");
    }
    await db.from("user_activity_logs").insert({
      actor_id: context.userId,
      action: "create",
      module: data.module,
      context: { source: "workspace" },
    });
    return { ok: true };
  });

export const quickUploadDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        module: z.enum(["documents", "legal"]),
        title: z.string().trim().min(2).max(300),
        notes: z.string().trim().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCreateOrEditPermission(context, data.module);
    const db = context.supabase;
    const reviewDate = new Date();
    reviewDate.setFullYear(reviewDate.getFullYear() + 1);
    const reviewIso = reviewDate.toISOString().slice(0, 10);
    if (data.module === "documents") {
      const { data: row, error } = await db
        .from("hse_documents")
        .insert({
          document_number: ref("DOC"),
          title: data.title,
          document_type: "other",
          current_version: "1.0",
          review_date: reviewIso,
          owner_id: context.userId,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (error) throw new Error("The document could not be created.");
      return { id: row.id as string, module: "documents" as const };
    }
    const { data: row, error } = await db
      .from("legal_requirements")
      .insert({
        reference: ref("LEG"),
        legal_obligation: data.title,
        authority: "—",
        category: "other",
        compliance_status: "under_review",
        review_date: reviewIso,
        evidence: data.notes ?? null,
        owner_id: context.userId,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error("The legal obligation could not be created.");
    return { id: row.id as string, module: "legal" as const };
  });


export const getGlobalSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        query: z
          .string()
          .trim()
          .min(2)
          .max(100)
          .regex(
            /^[\p{L}\p{N}\s'-]+$/u,
            "Search may only contain letters, numbers, spaces, apostrophes, and hyphens.",
          ),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const term = `%${data.query}%`;
    const db = context.supabase;
    await assertPermission(context, "global_search", "view");
    const checks = await Promise.all(
      (["incidents", "audits", "risks", "employees", "contractors"] as const).map(
        async (module) => {
          const { data: allowed } = await db.rpc("has_module_permission", {
            _user_id: context.userId,
            _module: module,
            _action: "view",
          });
          return [module, allowed === true] as const;
        },
      ),
    );
    const canView = Object.fromEntries(checks) as Record<(typeof checks)[number][0], boolean>;
    const [incidents, audits, risks, employees, contractors, departments] = await Promise.all([
      canView.incidents
        ? db
            .from("incidents")
            .select("id,reference,title,status")
            .or(`reference.ilike.${term},title.ilike.${term}`)
            .limit(10)
        : Promise.resolve({ data: [], error: null }),
      canView.audits
        ? db
            .from("audits")
            .select("id,audit_number,title,status")
            .or(`audit_number.ilike.${term},title.ilike.${term}`)
            .limit(10)
        : Promise.resolve({ data: [], error: null }),
      canView.risks
        ? db
            .from("risk_assessments")
            .select("id,reference,activity,status")
            .or(`reference.ilike.${term},activity.ilike.${term}`)
            .limit(10)
        : Promise.resolve({ data: [], error: null }),
      canView.employees
        ? db
            .from("employees")
            .select("id,full_name,department,employment_status")
            .or(`full_name.ilike.${term},department.ilike.${term}`)
            .limit(10)
        : Promise.resolve({ data: [], error: null }),
      canView.contractors
        ? db
            .from("contractors")
            .select("id,reference,company_name,approval_status")
            .or(`reference.ilike.${term},company_name.ilike.${term}`)
            .limit(10)
        : Promise.resolve({ data: [], error: null }),
      db
        .from("departments")
        .select("id,code,name,is_active")
        .or(`code.ilike.${term},name.ilike.${term}`)
        .limit(10),
    ]);
    return {
      incidents: incidents.data ?? [],
      audits: audits.data ?? [],
      risks: risks.data ?? [],
      employees: employees.data ?? [],
      contractors: contractors.data ?? [],
      departments: departments.data ?? [],
    };
  });
