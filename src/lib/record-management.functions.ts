import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { assertPermission } from "@/lib/permissions.functions";

const moduleTables = {
  incidents: "incidents",
  hazards: "hazards",
  observations: "safety_observations",
  near_misses: "near_misses",
  risks: "risk_assessments",
  audits: "audits",
  capa: "actions",
  inspections: "inspections",
  training: "training_records",
  competencies: "competency_records",
  objectives: "hse_objectives",
  legal: "legal_requirements",
  contractors: "contractors",
  environment: "environmental_aspects",
  ppe: "ppe_issuances",
  documents: "hse_documents",
  reviews: "management_reviews",
} as const;

type ManagedModule = keyof typeof moduleTables;

const ownerColumns: Record<ManagedModule, "created_by" | "reported_by" | "observed_by"> = {
  incidents: "reported_by",
  hazards: "reported_by",
  observations: "observed_by",
  near_misses: "reported_by",
  risks: "created_by",
  audits: "created_by",
  capa: "created_by",
  inspections: "created_by",
  training: "created_by",
  competencies: "created_by",
  objectives: "created_by",
  legal: "created_by",
  contractors: "created_by",
  environment: "created_by",
  ppe: "created_by",
  documents: "created_by",
  reviews: "created_by",
};

const editableFields: Record<ManagedModule, ReadonlySet<string>> = {
  incidents: new Set([
    "title",
    "incident_type",
    "site",
    "department",
    "location",
    "occurred_at",
    "severity",
    "description",
    "immediate_action",
    "persons_involved",
    "responsible_person_id",
    "action_due_date",
  ]),
  hazards: new Set([
    "site",
    "department",
    "location",
    "description",
    "likelihood",
    "severity",
    "existing_controls",
    "additional_controls",
    "owner_id",
  ]),
  observations: new Set([
    "observation_type",
    "site",
    "department",
    "location",
    "description",
    "immediate_response",
    "observed_at",
    "supervisor_id",
  ]),
  near_misses: new Set([
    "title",
    "site",
    "department",
    "location",
    "occurred_at",
    "description",
    "potential_severity",
    "immediate_controls",
    "owner_id",
    "action_due_date",
  ]),
  risks: new Set([
    "activity",
    "site",
    "department",
    "category",
    "hazard",
    "consequence",
    "people_exposed",
    "existing_controls",
    "additional_controls",
    "likelihood",
    "severity",
    "residual_likelihood",
    "residual_severity",
    "owner_id",
    "review_date",
  ]),
  audits: new Set([
    "title",
    "audit_type",
    "site",
    "department",
    "area",
    "scope",
    "lead_auditor",
    "audit_team",
    "scheduled_on",
  ]),
  capa: new Set([
    "title",
    "action_type",
    "source_type",
    "source_reference",
    "owner_id",
    "due_date",
    "priority",
    "preventive_action",
  ]),
  inspections: new Set([
    "title",
    "inspection_type",
    "site",
    "department",
    "area",
    "scheduled_on",
    "inspector_id",
    "summary",
  ]),
  training: new Set([
    "employee_id",
    "course_name",
    "provider",
    "completed_on",
    "expires_on",
    "certificate_reference",
    "notes",
  ]),
  competencies: new Set([
    "employee_id",
    "competency_name",
    "required_level",
    "current_level",
    "assessor",
    "assessed_on",
    "expires_on",
    "evidence",
  ]),
  objectives: new Set([
    "objective",
    "kpi",
    "baseline",
    "target",
    "current_performance",
    "direction",
    "owner_id",
    "review_date",
    "notes",
  ]),
  legal: new Set([
    "legal_obligation",
    "authority",
    "category",
    "compliance_status",
    "review_date",
    "evidence",
    "owner_id",
  ]),
  contractors: new Set([
    "company_name",
    "contact_person",
    "contact_email",
    "contact_phone",
    "scope_of_work",
    "insurance_provider",
    "insurance_expiry",
    "permit_reference",
    "permit_expiry",
    "hse_score",
    "owner_id",
  ]),
  environment: new Set([
    "activity",
    "aspect",
    "impact",
    "condition",
    "likelihood",
    "severity",
    "existing_controls",
    "additional_controls",
    "review_date",
    "owner_id",
  ]),
  ppe: new Set([
    "employee_id",
    "ppe_item",
    "serial_number",
    "quantity",
    "issued_on",
    "expected_replacement_on",
    "condition",
    "issued_by",
    "notes",
  ]),
  documents: new Set([
    "document_number",
    "title",
    "document_type",
    "current_version",
    "review_date",
    "owner_id",
  ]),
  reviews: new Set([
    "period_start",
    "period_end",
    "meeting_date",
    "attendees",
    "executive_summary",
    "decisions",
    "chairperson_id",
  ]),
};

const lockedStatuses = new Set(["approved", "verified", "closed"]);

async function isManager(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const checks = await Promise.all(
    (["admin", "hr_manager", "hse_manager"] as const).map((assignedRole) =>
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: assignedRole }),
    ),
  );
  return checks.some((result) => result.data === true);
}

async function canDeleteAnyRecord(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const checks = await Promise.all(
    (["admin", "hr_manager"] as const).map((assignedRole) =>
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: assignedRole }),
    ),
  );
  return checks.some((result) => result.data === true);
}

const mutationSchema = z.object({
  module: z.enum(Object.keys(moduleTables) as [ManagedModule, ...ManagedModule[]]),
  recordId: z.string().uuid(),
  changes: z
    .record(
      z.string().min(1).max(80),
      z.union([z.string().max(8000), z.number().finite(), z.boolean(), z.null()]),
    )
    .optional()
    .default({}),
});

export const updateManagedRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => mutationSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertPermission(context, data.module, "edit");
    const allowed = editableFields[data.module];
    const changes = Object.fromEntries(
      Object.entries(data.changes).filter(([key]) => allowed.has(key)),
    );
    if (!Object.keys(changes).length) throw new Error("No editable changes were supplied.");
    const { data: current, error: lookupError } = await context.supabase
      .from(moduleTables[data.module] as never)
      .select("*")
      .eq("id", data.recordId)
      .maybeSingle();
    if (lookupError) {
      console.error("[records] lookup failed", lookupError.message);
      throw new Error("The record could not be loaded. Please try again.");
    }
    if (!current) throw new Error("The record could not be found or you do not have access to it.");
    const row = current as Record<string, unknown>;
    const workflowStatus = String(row.status ?? row.approval_status ?? "").toLowerCase();
    if (lockedStatuses.has(workflowStatus) && !(await isManager(context)))
      throw new Error(
        "Approved, verified, or closed records can only be changed by an authorized manager.",
      );
    const { error } = await context.supabase
      .from(moduleTables[data.module] as never)
      .update(changes as never)
      .eq("id", data.recordId);
    if (error) {
      console.error("[records] update failed", error.message);
      throw new Error("The record could not be updated. Please try again.");
    }
    await context.supabase.from("user_activity_logs").insert({
      actor_id: context.userId,
      action: "update",
      module: data.module,
      context: { record_id: data.recordId },
    });
    return { ok: true };
  });

export const deleteManagedRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => mutationSchema.pick({ module: true, recordId: true }).parse(input))
  .handler(async ({ data, context }) => {
    await assertPermission(context, data.module, "delete");
    const canDeleteAny = await canDeleteAnyRecord(context);
    if (!canDeleteAny) {
      const ownerColumn = ownerColumns[data.module];
      const { data: latest, error: latestError } = await context.supabase
        .from(moduleTables[data.module] as never)
        .select("id")
        .eq(ownerColumn, context.userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestError || String((latest as { id?: string } | null)?.id ?? "") !== data.recordId) {
        throw new Error("You can only delete your own most recent entry.");
      }
    }
    const { data: deleted, error } = await context.supabase
      .from(moduleTables[data.module] as never)
      .delete()
      .eq("id", data.recordId)
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("[records] delete failed", error.message);
      throw new Error("The record could not be deleted. Please try again.");
    }
    if (!deleted)
      throw new Error(
        "You can only delete your most recently entered record. Administrators and HR Managers can delete any record.",
      );
    await context.supabase.from("user_activity_logs").insert({
      actor_id: context.userId,
      action: "delete",
      module: data.module,
      context: { record_id: data.recordId },
    });
    return { ok: true };
  });
