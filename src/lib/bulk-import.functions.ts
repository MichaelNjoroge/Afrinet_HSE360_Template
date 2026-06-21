/* eslint-disable prettier/prettier */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  bulkImportFields,
  employeeNameFieldMap,
  type BulkImportModule,
} from "@/lib/bulk-import-config";
import { assertCreateOrEditPermission } from "@/lib/permissions.functions";

const tables: Record<BulkImportModule, string> = {
  employees: "employees",
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
};

const inputSchema = z.object({
  module: z.enum(Object.keys(bulkImportFields) as [BulkImportModule, ...BulkImportModule[]]),
  rows: z
    .array(z.record(z.string().min(1).max(80), z.string().max(8000)))
    .min(1)
    .max(1000),
});
const numericFields = new Set([
  "likelihood",
  "severity",
  "residual_likelihood",
  "residual_severity",
  "required_level",
  "current_level",
  "baseline",
  "target",
  "current_performance",
  "hse_score",
  "quantity",
  "approval_level",
]);
const prefixes: Partial<Record<BulkImportModule, string>> = {
  incidents: "INC",
  hazards: "HAZ",
  observations: "OBS",
  near_misses: "NM",
  risks: "RSK",
  inspections: "INSP",
  objectives: "OBJ",
  legal: "LEG",
  contractors: "CON",
  environment: "ENV",
  ppe: "PPE",
  reviews: "MR",
};

const valueAliases: Partial<Record<string, Record<string, string>>> = {
  "employees.employment_status": {
    active: "active",
    inactive: "inactive",
    contractor: "contractor",
  },
  "incidents.incident_type": {
    injury: "injury",
    environmental: "environmental",
    "property damage": "property_damage",
    property_damage: "property_damage",
    "near miss": "near_miss",
    near_miss: "near_miss",
    security: "security",
    "occupational illness": "occupational_illness",
    occupational_illness: "occupational_illness",
  },
  "incidents.severity": { low: "low", medium: "moderate", moderate: "moderate", high: "high", critical: "critical" },
  "observations.observation_type": {
    "safe act": "positive_behaviour",
    "positive behaviour": "positive_behaviour",
    positive_behaviour: "positive_behaviour",
    "unsafe act": "unsafe_act",
    unsafe_act: "unsafe_act",
    "unsafe condition": "unsafe_condition",
    unsafe_condition: "unsafe_condition",
  },
  "near_misses.potential_severity": { low: "low", medium: "moderate", moderate: "moderate", high: "high", critical: "critical" },
  "audits.audit_type": { internal: "internal", external: "external", regulatory: "regulatory", inspection: "inspection", supplier: "supplier", compliance: "regulatory" },
  "capa.action_type": { corrective: "corrective", preventive: "preventive" },
  "capa.source_type": { incident: "incident", hazard: "hazard", observation: "observation", "near miss": "near_miss", near_miss: "near_miss", risk: "risk", audit: "audit", inspection: "inspection", "management review": "management_review", management_review: "management_review", other: "other" },
  "capa.priority": { low: "low", medium: "medium", high: "high", critical: "critical" },
  "inspections.inspection_type": { workplace: "workplace", vehicle: "vehicle", warehouse: "warehouse", office: "office", ppe: "ppe", "fire safety": "fire_safety", fire_safety: "fire_safety" },
  "training.status": { planned: "planned", "in progress": "in_progress", in_progress: "in_progress", valid: "valid", expiring: "expiring", expired: "expired", "not required": "not_required", not_required: "not_required" },
  "objectives.direction": { increase: "increase", decrease: "decrease" },
  "legal.category": { "osha kenya": "osha_kenya", osha_kenya: "osha_kenya", nema: "nema", "fire safety": "fire_safety", fire_safety: "fire_safety", "county government": "county_government", county_government: "county_government", other: "other" },
  "legal.compliance_status": { compliant: "compliant", partial: "partially_compliant", "partially compliant": "partially_compliant", partially_compliant: "partially_compliant", "non-compliant": "non_compliant", "non compliant": "non_compliant", non_compliant: "non_compliant", "under review": "under_review", under_review: "under_review" },
  "contractors.approval_status": { pending: "pending", "under review": "under_review", under_review: "under_review", approved: "approved", suspended: "suspended", expired: "expired", rejected: "rejected" },
  "environment.condition": { normal: "normal", abnormal: "abnormal", emergency: "emergency" },
  "ppe.condition": { new: "new", good: "serviceable", serviceable: "serviceable", fair: "due_replacement", "due replacement": "due_replacement", due_replacement: "due_replacement", damaged: "damaged", lost: "lost", replaced: "replaced" },
  "documents.document_type": { policy: "policy", sop: "sop", procedure: "procedure", form: "form", "work instruction": "work_instruction", work_instruction: "work_instruction", other: "other" },
};

const requiredFields: Record<BulkImportModule, readonly string[]> = {
  employees: ["full_name"],
  incidents: ["title", "incident_type", "location", "occurred_at", "severity", "description"],
  hazards: ["department", "location", "description", "likelihood", "severity"],
  observations: ["observation_type", "department", "location", "description", "observed_at"],
  near_misses: ["title", "department", "location", "occurred_at", "description", "potential_severity"],
  risks: ["activity", "hazard", "people_exposed", "existing_controls", "likelihood", "severity", "residual_likelihood", "residual_severity", "review_date"],
  audits: ["title", "audit_type", "area", "lead_auditor", "scheduled_on"],
  capa: ["title", "source_type", "due_date", "priority"],
  inspections: ["title", "inspection_type", "department", "area", "scheduled_on"],
  training: ["employee_name", "course_name"],
  competencies: ["employee_name", "competency_name", "required_level", "current_level"],
  objectives: ["objective", "kpi", "baseline", "target", "current_performance", "review_date"],
  legal: ["legal_obligation", "authority", "category", "review_date"],
  contractors: ["company_name", "contact_person", "scope_of_work"],
  environment: ["activity", "aspect", "impact", "likelihood", "severity", "review_date"],
  ppe: ["employee_name", "ppe_item", "issued_on"],
  documents: ["document_number", "title", "document_type", "review_date"],
  reviews: ["period_start", "period_end", "meeting_date"],
};

function normalizeValue(module: BulkImportModule, field: string, value: string, rowNumber: number) {
  const aliases = valueAliases[`${module}.${field}`];
  if (!aliases || value === "") return value;
  const normalized = aliases[value.toLowerCase().replaceAll("–", "-").trim()];
  if (!normalized)
    throw new Error(`Row ${rowNumber}: invalid ${field.replaceAll("_", " ")} value "${value}".`);
  return normalized;
}

function reference(prefix: string) {
  return `${prefix}-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export const bulkImportRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCreateOrEditPermission(context, data.module);
    const allowed = new Set<string>(bulkImportFields[data.module]);

    // Collect employee names used across the batch so we can resolve to IDs
    // with a single lookup against the employees directory.
    const nameLookupSet = new Set<string>();
    for (const source of data.rows) {
      for (const key of Object.keys(source)) {
        if (key in employeeNameFieldMap) {
          const value = (source[key] ?? "").trim();
          if (value) nameLookupSet.add(value);
        }
      }
    }
    const nameToId = new Map<string, string>();
    if (nameLookupSet.size) {
      const { data: emps, error: lookupError } = await context.supabase
        .from("employees")
        .select("id,full_name")
        .in("full_name", Array.from(nameLookupSet));
      if (lookupError) {
        console.error("[bulk-import] employee name lookup failed", lookupError.message);
        throw new Error("Could not look up employee names. Please try again.");
      }
      for (const emp of (emps ?? []) as Array<{ id: string; full_name: string }>) {
        nameToId.set(emp.full_name.trim().toLowerCase(), emp.id);
      }
    }

    const rows = data.rows.map((source, index) => {
      const row: Record<string, string | number | null> = {};
      for (const [key, raw] of Object.entries(source)) {
        if (!allowed.has(key)) continue;
        // Translate friendly *_name columns into the underlying *_id UUID.
        if (key in employeeNameFieldMap) {
          const trimmed = raw.trim();
          if (!trimmed) continue;
          const id = nameToId.get(trimmed.toLowerCase());
          if (!id)
            throw new Error(
              `Row ${index + 2}: employee "${trimmed}" was not found in the Employee Directory. Add the employee first, then re-run the import.`,
            );
          row[employeeNameFieldMap[key]] = id;
          continue;
        }
        const value = normalizeValue(data.module, key, raw.trim(), index + 2);
        row[key] = value === "" ? null : numericFields.has(key) ? Number(value) : value;
        if (numericFields.has(key) && value !== "" && !Number.isFinite(row[key]))
          throw new Error(`Row ${index + 2}: ${key.replaceAll("_", " ")} must be a number.`);
      }
      const missing = requiredFields[data.module].filter((field) => {
        const target = employeeNameFieldMap[field] ?? field;
        return row[target] == null;
      });
      if (missing.length)
        throw new Error(
          `Row ${index + 2}: required ${missing.map((field) => field.replaceAll("_", " ")).join(", ")} ${missing.length === 1 ? "is" : "are"} missing.`,
        );
      if (data.module === "employees" && row.approval_level != null) {
        const approvalLevel = Number(row.approval_level);
        if (!Number.isInteger(approvalLevel) || approvalLevel < 1 || approvalLevel > 5)
          throw new Error(`Row ${index + 2}: approval level must be a whole number from 1 to 5.`);
      }
      const prefix = prefixes[data.module];
      if (prefix) row.reference = reference(prefix);
      if (data.module === "audits") row.audit_number = reference("AUD");
      if (data.module === "incidents" || data.module === "hazards" || data.module === "near_misses")
        row.reported_by = context.userId;
      else if (data.module === "observations") row.observed_by = context.userId;
      else if (data.module !== "employees") row.created_by = context.userId;
      if (data.module === "competencies")
        row.status = Number(row.current_level) >= Number(row.required_level) ? "competent" : "gap";
      if (data.module === "employees" && typeof row.email === "string")
        row.email = row.email.toLowerCase();
      return row;
    });
    const { error } = await context.supabase
      .from(tables[data.module] as never)
      .insert(rows as never);
    if (error) {
      console.error("[bulk-import] insert failed", error.message);
      throw new Error("The import could not be completed. Check the file and try again.");
    }
    await context.supabase.from("user_activity_logs").insert({
      actor_id: context.userId,
      action: "bulk_import",
      module: data.module,
      context: { record_count: rows.length },
    });
    return { imported: rows.length };
  });
