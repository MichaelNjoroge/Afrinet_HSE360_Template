/* eslint-disable prettier/prettier */
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { Download, Upload } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { bulkImportRecords } from "@/lib/bulk-import.functions";
import { bulkImportFields, type BulkImportModule } from "@/lib/bulk-import-config";

const optionGuidance: Partial<Record<string, string>> = {
  "employees.employment_status": "active | inactive | contractor",
  "employees.approval_level": "Whole number from 1 to 5",
  "incidents.incident_type":
    "injury | near_miss | property_damage | environmental | security | occupational_illness",
  "incidents.severity": "low | moderate | high | critical",
  "observations.observation_type": "positive_behaviour | unsafe_act | unsafe_condition",
  "near_misses.potential_severity": "low | moderate | high | critical",
  "audits.audit_type": "internal | external | regulatory | inspection | supplier",
  "capa.action_type": "corrective | preventive",
  "capa.source_type":
    "incident | hazard | observation | near_miss | risk | audit | inspection | management_review | other",
  "capa.priority": "low | medium | high | critical",
  "inspections.inspection_type": "workplace | vehicle | warehouse | office | ppe | fire_safety",
  "training.status": "planned | in_progress | valid | expiring | expired | not_required",
  "objectives.direction": "increase | decrease",
  "legal.category": "osha_kenya | nema | fire_safety | county_government | other",
  "legal.compliance_status":
    "compliant | partially_compliant | non_compliant | under_review",
  "contractors.approval_status":
    "pending | under_review | approved | suspended | expired | rejected",
  "environment.condition": "normal | abnormal | emergency",
  "ppe.condition": "new | serviceable | due_replacement | damaged | lost | replaced",
  "documents.document_type": "policy | sop | procedure | form | work_instruction | other",
};

const requiredFields: Partial<Record<BulkImportModule, readonly string[]>> = {
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

function fieldGuidance(module: BulkImportModule, field: string) {
  const specific = optionGuidance[`${module}.${field}`];
  const required = requiredFields[module]?.includes(field) ? "Required — " : "";
  if (specific) return `${required}${specific}`;
  if (field.endsWith("_name") &&
    ["manager_name", "responsible_person_name", "owner_name", "supervisor_name",
     "inspector_name", "employee_name", "issued_by_name", "chairperson_name"].includes(field))
    return `${required}Full name of employee exactly as recorded in the Employee Directory`;
  if (field.endsWith("_id")) return `${required}Record UUID; leave blank if not assigned`;
  if (field.endsWith("_on") || field.endsWith("_date")) return `${required}YYYY-MM-DD`;
  if (field.endsWith("_at")) return `${required}YYYY-MM-DD HH:MM`;
  if (["likelihood", "severity", "residual_likelihood", "residual_severity"].includes(field))
    return `${required}Whole number from 1 to 5`;
  if (["baseline", "target", "current_performance", "hse_score", "quantity"].includes(field))
    return `${required}Number only`;
  if (field.includes("email")) return `${required}Valid work email address`;
  if (field.includes("phone")) return `${required}Include country code, e.g. +254…`;
  return `${required}Enter ${field.replaceAll("_", " ")}`;
}

function parseCsv(text: string) {
  const output: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) output.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) output.push(row);
  return output;
}

export function BulkImportButton({
  module,
  onComplete,
}: {
  module: BulkImportModule;
  onComplete: (count: number) => Promise<void>;
}) {
  const importRecords = useServerFn(bulkImportRecords);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fields = useMemo(() => [...bulkImportFields[module]], [module]);
  function downloadTemplate() {
    const link = document.createElement("a");
    const escapeCell = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const guidance = fields.map((field, index) =>
      escapeCell(`${index === 0 ? "# GUIDANCE: " : ""}${fieldGuidance(module, field)}`),
    );
    const content = `${fields.join(",")}\n${guidance.join(",")}\n`;
    link.href = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
    link.download = `${module}-import-template.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    if (file.size > 10 * 1024 * 1024) {
      setError("CSV files must be 10 MB or smaller.");
      return;
    }
    const data = parseCsv(await file.text());
    const headers =
      data[0]
        ?.map((value) => value.trim().replace(/^\uFEFF/, ""))
        .filter((header) => header.length > 0) ?? [];
    const unknown = headers.filter((header) => !fields.includes(header as never));
    if (!headers.length || unknown.length) {
      setError(unknown.length ? `Unknown columns: ${unknown.join(", ")}` : "The CSV is empty.");
      return;
    }
    const parsed = data
      .slice(1)
      .filter((values) => !values[0]?.trim().startsWith("# GUIDANCE:"))
      .map((values) =>
        Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
      );
    if (!parsed.length) {
      setError("Add at least one data row below the header.");
      return;
    }
    if (parsed.length > 1000) {
      setError("Import up to 1,000 records at a time.");
      return;
    }
    setRows(parsed);
  }
  return (
    <>
      <Button
        variant="outline"
        size="lg"
        onClick={() => {
          setRows([]);
          setError("");
          setOpen(true);
        }}
      >
        <Upload /> Import CSV
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Import {module.replaceAll("_", " ")} records</DialogTitle>
            <DialogDescription>
              Upload up to 1,000 records in one CSV. The template includes accepted values, date
              formats and ID guidance beneath every column. Keep the guidance row—it is ignored
              automatically during import.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Button type="button" variant="outline" onClick={downloadTemplate}>
              <Download /> Download CSV template
            </Button>
            <input
              ref={input}
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              onChange={chooseFile}
            />
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => input.current?.click()}
            >
              <Upload /> Choose CSV file
            </Button>
            {rows.length > 0 && (
              <p className="rounded-md bg-muted p-3 text-sm font-medium">
                {rows.length} records ready to import
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!rows.length || busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const result = await importRecords({ data: { module, rows } });
                    setOpen(false);
                    await onComplete(result.imported);
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : "Import failed.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Importing…" : `Import ${rows.length || ""} records`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
