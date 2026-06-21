import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Camera, CheckCircle2, Download, Plus, Search, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compress";
import { saveEvidenceMetadata } from "@/lib/evidence.functions";
import { Button } from "@/components/ui/button";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BulletTextarea } from "@/components/ui/bullet-textarea";
import {
  createModulePacksThreeFourRecord,
  getGlobalSearch,
  getModulePacksThreeFour,
  quickUploadDocument,
} from "@/lib/module-packs-three-four.functions";
import { deleteManagedRecord, updateManagedRecord } from "@/lib/record-management.functions";
import {
  EditRecordDialog,
  RecordDetailDialog,
  RowActions,
  SortControls,
  SortableHeader,
  StatusFilter,
  useSortedRows,
} from "@/components/record-management";
import { BulkImportButton } from "@/components/bulk-import";
import { downloadCSV } from "@/lib/export";
import { getMyModulePermissions } from "@/lib/permissions.functions";
import { ContractorWorkflows, ReportingAdministration } from "@/components/enterprise-workflows";
import { EvidencePanel } from "@/components/evidence-panel";
import { ReportActions } from "@/components/report-actions";
import { ManagementReviewDocumentDialog } from "@/components/management-review-document";
import { ReportingDashboard } from "@/components/reporting-dashboard";
import { HseKpiDashboard } from "@/components/hse-kpi-dashboard";
import { NotificationsView } from "@/components/notifications-view";
import { useEmployeeNames } from "@/lib/employee-display";
import { getAuthLevel, MIN_LEVEL_TO_ONBOARD_CONTRACTOR } from "@/lib/auth-levels";
import { SafetyCommitteePanel, EmergencyResponsePanel } from "@/components/governance-panels";
import { EnvironmentalWorkflowDialog } from "@/components/environmental-workflow-dialog";

export type EnterpriseModule =
  | "legal"
  | "contractors"
  | "environment"
  | "ppe"
  | "documents"
  | "reviews"
  | "safety_committee"
  | "emergency_response"
  | "reporting"
  | "intelligence"
  | "global_search"
  | "notifications";
type Row = Record<string, unknown>;
const definitions: Record<
  EnterpriseModule,
  { title: string; description: string; action?: string }
> = {
  legal: {
    title: "Legal compliance register",
    description:
      "Control OSHA Kenya, NEMA, fire and county obligations with evidence and review dates.",
    action: "Add obligation",
  },
  contractors: {
    title: "Contractor management",
    description: "Manage onboarding, approvals, insurance, permits and HSE performance.",
    action: "Add contractor",
  },
  environment: {
    title: "Environmental management",
    description:
      "Assess environmental aspects and impacts, with waste, resource and emissions oversight.",
    action: "Add aspect",
  },
  ppe: {
    title: "PPE management",
    description: "Track PPE issue, condition, replacement and inspection readiness.",
    action: "Issue PPE",
  },
  documents: {
    title: "Document control",
    description:
      "Control HSE policies, SOPs, procedures, forms and work instructions by version and review cycle.",
    action: "Add document",
  },
  reviews: {
    title: "Management review",
    description:
      "Prepare executive HSE reviews with decisions, summaries and controlled reporting periods.",
    action: "Plan review",
  },
  reporting: {
    title: "Reporting centre",
    description: "Export audit-ready registers and executive summaries for analysis and assurance.",
  },
  intelligence: {
    title: "Business intelligence",
    description:
      "Executive trends, scorecards and compliance exceptions across the integrated HSE system.",
  },
  global_search: {
    title: "Global search",
    description: "Search incidents, audits, risks, employees, contractors and departments.",
  },
  safety_committee: {
    title: "Safety Committee management",
    description:
      "Plan committee meetings, capture minutes with up to 10 signatories and share the schedule.",
    action: "Plan meeting",
  },
  emergency_response: {
    title: "Emergency Response management",
    description:
      "Drills, response readiness, mobilisation logs and post-event reviews across all sites.",
    action: "Log drill",
  },
  notifications: {
    title: "Notifications",
    description: "Monitor upcoming and overdue actions, reviews, expiries and deadlines.",
  },
};

export function ModulePacksThreeFour({
  active,
  employees,
  roles,
  currentUserId,
}: {
  active: EnterpriseModule;
  employees: Row[];
  roles: string[];
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const fetchPack = useServerFn(getModulePacksThreeFour);
  const createRecord = useServerFn(createModulePacksThreeFourRecord);
  const searchFn = useServerFn(getGlobalSearch);
  const updateRecord = useServerFn(updateManagedRecord);
  const deleteRecord = useServerFn(deleteManagedRecord);
  const fetchPermissions = useServerFn(getMyModulePermissions);
  const { data: permissions } = useQuery({
    queryKey: ["module-permissions"],
    queryFn: () => fetchPermissions(),
  });
  const stubModule = active === "safety_committee" || active === "emergency_response";
  const permission = stubModule ? undefined : (permissions as Record<string, { create?: boolean; edit?: boolean; export?: boolean; delete?: boolean; approve?: boolean }> | undefined)?.[active];
  const { data, isLoading, error } = useQuery({
    queryKey: ["module-packs-3-4"],
    queryFn: () => fetchPack(),
  });
  const [dialog, setDialog] = useState(false);
  const [quickUploadOpen, setQuickUploadOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [results, setResults] = useState<Record<string, Row[]>>({});
  const [versionDoc, setVersionDoc] = useState<Row | null>(null);
  const [reviewDoc, setReviewDoc] = useState<Row | null>(null);
  const [envWorkflowId, setEnvWorkflowId] = useState<string | null>(null);
  const [docCategory, setDocCategory] = useState<string>("all");
  const isAdmin = roles.includes("admin");
  const authLevel = getAuthLevel(roles);
  const canOnboardContractor = authLevel >= MIN_LEVEL_TO_ONBOARD_CONTRACTOR;
  const baseCanAdd = isAdmin || permission?.create === true || permission?.edit === true;
  const canAdd = active === "contractors" ? baseCanAdd && canOnboardContractor : baseCanAdd;
  const canExport = isAdmin || permission?.export !== false;
  const { names: employeeNameLookup } = useEmployeeNames();
  const reportRef = useRef<HTMLDivElement | null>(null);
  const finish = async () => {
    await queryClient.invalidateQueries({ queryKey: ["module-packs-3-4"] });
    setDialog(false);
    setNotice("Record saved");
    window.setTimeout(() => setNotice(""), 2500);
  };
  if (active === "global_search")
    return (
      <GlobalSearch
        query={search}
        setQuery={setSearch}
        results={results}
        run={async () =>
          setResults((await searchFn({ data: { query: search } })) as Record<string, Row[]>)
        }
        canExport={canExport}
      />
    );
  if (active === "reporting")
    return (
      <Reporting
        data={data}
        roles={roles}
        canExport={canExport}
        isAdmin={isAdmin}
        employeeNameLookup={employeeNameLookup}
      />
    );
  if (active === "intelligence") return <Intelligence data={data} canExport={canExport} />;
  if (active === "notifications")
    return <NotificationsView rows={(data?.notifications ?? []) as Row[]} />;
  if (active === "safety_committee") return <SafetyCommitteePanel isAdmin={isAdmin} />;
  if (active === "emergency_response") return <EmergencyResponsePanel isAdmin={isAdmin} />;
  const rawRows = ((data as Record<string, Row[]> | undefined)?.[active] ?? []) as Row[];
  const myEmployeeId = currentUserId
    ? (employees.find((e) => String(e.user_id ?? "") === currentUserId)?.id as string | undefined)
    : undefined;
  const isAdminLike = roles.some((r) =>
    ["admin", "director", "hse_manager", "hr_manager", "hse_coordinator", "supervisor", "auditor"].includes(r),
  );
  const scopedRows =
    active === "ppe" && !isAdminLike && myEmployeeId
      ? rawRows.filter(
          (r) => String(r.employee_id ?? "") === myEmployeeId || String(r.issued_to ?? "") === myEmployeeId,
        )
      : rawRows;
  const ppeRows =
    active === "ppe"
      ? scopedRows.map((r) => ({
          ...r,
          employee_name:
            employeeNameLookup.get(String(r.employee_id ?? "")) ??
            employeeNameLookup.get(String(r.issued_to ?? "")) ??
            r.employee_id ??
            "—",
        }))
      : scopedRows;
  const rows = ppeRows;
  const columns =
    active === "legal"
      ? ["legal_obligation", "authority", "category", "compliance_status", "review_date"]
      : active === "contractors"
        ? ["company_name", "scope_of_work", "approval_status", "insurance_expiry", "permit_expiry"]
        : active === "environment"
          ? ["activity", "aspect", "impact", "significance_rating", "review_date"]
          : active === "ppe"
            ? ["ppe_item", "employee_name", "issued_on", "expected_replacement_on", "condition"]
            : active === "documents"
              ? [
                  "document_number",
                  "title",
                  "document_type",
                  "current_version",
                  "status",
                  "review_date",
                ]
              : ["reference", "period_start", "period_end", "meeting_date", "status"];
  return (
    <>
      <section className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-primary">
            {["legal", "contractors", "environment", "ppe"].includes(active)
              ? "Module Pack 3"
              : "Module Pack 4"}
          </p>
          <p className="max-w-2xl text-muted-foreground">{definitions[active].description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canExport && (
            <>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => downloadCSV(active, rows, { nameLookup: employeeNameLookup })}
                disabled={!rows.length}
              >
                <Download /> Export CSV
              </Button>
              <ReportActions
                targetRef={reportRef}
                fileName={`${active}-register`}
                title={definitions[active].title}
                subtitle={new Date().toLocaleDateString()}
                module={active}
              />
            </>
          )}
          {definitions[active].action && canAdd && (
            <>
              <BulkImportButton
                module={
                  active as
                    | "legal"
                    | "contractors"
                    | "environment"
                    | "ppe"
                    | "documents"
                    | "reviews"
                }
                onComplete={async (count) => {
                  await finish();
                  setNotice(`${count} records imported`);
                }}
              />
              {(active === "documents" || active === "legal") && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setQuickUploadOpen(true)}
                >
                  <Upload />
                  Upload document
                </Button>
              )}
              <Button variant="safety" size="lg" onClick={() => setDialog(true)}>
                <Plus />
                Create new entry
              </Button>
            </>
          )}
        </div>
      </section>
      {active === "documents" && rows.length > 0 && (
        <section className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Categories
          </span>
          {(["all", "policy", "sop", "procedure", "form", "work_instruction", "other"] as const).map(
            (type) => {
              const count =
                type === "all"
                  ? rows.length
                  : rows.filter((row) => String(row.document_type ?? "") === type).length;
              const isActive = docCategory === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setDocCategory(type)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize transition ${
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {type.replaceAll("_", " ")} ({count})
                </button>
              );
            },
          )}
        </section>
      )}
      {error ? (
        <Empty text="This module could not be loaded." />
      ) : (
        <div ref={reportRef}>
          <Register
            title={definitions[active].title}
            evidenceModule={
              active === "contractors" ||
              active === "environment" ||
              active === "documents" ||
              active === "reviews" ||
              active === "legal"
                ? active
                : undefined
            }
            rows={
              active === "documents" && docCategory !== "all"
                ? rows.filter((row) => String(row.document_type ?? "") === docCategory)
                : rows
            }
            search={search}
            setSearch={setSearch}
            columns={columns}
            loading={isLoading}
            manage={{
              update: async (row, changes) => {
                await updateRecord({
                  data: { module: active as never, recordId: String(row.id), changes },
                });
                await finish();
              },
              remove: async (row) => {
                await deleteRecord({ data: { module: active as never, recordId: String(row.id) } });
                await finish();
              },
              canEdit: permission?.edit !== false,
              canDelete: permission?.delete === true,
              canExport,
            }}
            rowExtra={
              active === "documents"
                ? (row) => (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setVersionDoc(row)}
                    >
                      History
                    </Button>
                  )
                : active === "reviews"
                  ? (row) => (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setReviewDoc(row)}
                      >
                        Open minutes
                      </Button>
                    )
                  : active === "environment"
                    ? (row) => (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setEnvWorkflowId(String(row.id))}
                        >
                          Workflow
                        </Button>
                      )
                    : undefined
            }
          />
        </div>
      )}
      <DocumentVersionsDialog
        document={active === "documents" ? versionDoc : null}
        versions={(data?.versions ?? []) as Row[]}
        onClose={() => setVersionDoc(null)}
      />
      {active === "reviews" && reviewDoc && (
        <ManagementReviewDocumentDialog
          review={reviewDoc}
          open={reviewDoc !== null}
          onOpenChange={(open) => !open && setReviewDoc(null)}
          canDraft={permission?.create === true || permission?.edit === true || isAdmin}
          canReupload={permission?.edit !== false}
        />
      )}
      {active === "environment" && (
        <EnvironmentalWorkflowDialog
          recordId={envWorkflowId}
          open={envWorkflowId !== null}
          onOpenChange={(open) => !open && setEnvWorkflowId(null)}
          employees={employees as { id: string; full_name: string }[]}
          canApprove={permission?.approve === true || isAdmin}
        />
      )}
      {active === "contractors" && (
        <ContractorWorkflows
          contractors={rows}
          canCreate={canAdd}
          canApprove={permission?.approve === true}
        />
      )}
      <RecordDialog
        active={active}
        open={dialog}
        setOpen={setDialog}
        employees={employees}
        save={async (payload) => {
          await createRecord({ data: payload as never });
          await finish();
        }}
      />
      {(active === "documents" || active === "legal") && (
        <QuickUploadDocumentDialog
          open={quickUploadOpen}
          onOpenChange={setQuickUploadOpen}
          module={active}
          onComplete={async () => {
            await queryClient.invalidateQueries({ queryKey: ["module-packs-3-4"] });
            setQuickUploadOpen(false);
            setNotice("Document uploaded");
            window.setTimeout(() => setNotice(""), 2500);
          }}
        />
      )}
      {notice && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-xl"
        >
          <CheckCircle2 />
          {notice}
        </div>
      )}
    </>
  );
}

function DocumentVersionsDialog({
  document,
  versions,
  onClose,
}: {
  document: Row | null;
  versions: Row[];
  onClose: () => void;
}) {
  const open = document !== null;
  const docVersions = document
    ? versions
        .filter((v) => String(v.document_id) === String(document.id))
        .sort((a, b) =>
          String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
        )
    : [];
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Version history{document ? ` · ${String(document.title ?? document.document_number ?? "")}` : ""}
          </DialogTitle>
          <DialogDescription>
            Every controlled version of this document with approval and effective dates.
          </DialogDescription>
        </DialogHeader>
        {docVersions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No prior versions recorded for this document.
          </p>
        ) : (
          <ol className="space-y-3">
            {docVersions.map((v) => (
              <li key={String(v.id)} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">
                    Version {String(v.version_number ?? "—")}
                    <span className="ml-2 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      {String(v.status ?? "draft").replaceAll("_", " ")}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {v.created_at ? new Date(String(v.created_at)).toLocaleString() : ""}
                  </p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{String(v.file_name ?? "")}</p>
                {v.change_summary ? (
                  <p className="mt-2 text-sm">{String(v.change_summary)}</p>
                ) : null}
                <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  {v.effective_date ? (
                    <span>
                      Effective {new Date(String(v.effective_date)).toLocaleDateString()}
                    </span>
                  ) : null}
                  {v.approved_at ? (
                    <span>
                      Approved {new Date(String(v.approved_at)).toLocaleDateString()}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Register({
  title,
  evidenceModule,
  rows,
  search,
  setSearch,
  columns,
  loading,
  manage,
  rowExtra,
}: {
  title: string;
  evidenceModule?: "contractors" | "environment" | "documents" | "reviews" | "legal";
  rows: Row[];
  search: string;
  setSearch: (value: string) => void;
  columns: string[];
  loading?: boolean;
  manage?: {
    update: (row: Row, changes: Row) => Promise<void>;
    remove: (row: Row) => Promise<void>;
    canEdit: boolean;
    canDelete: boolean;
    canExport: boolean;
  };
  rowExtra?: (row: Row) => ReactNode;
}) {
  const sorted = useSortedRows(rows, search);
  const [editing, setEditing] = useState<Row | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const [evidence, setEvidence] = useState<Row | null>(null);
  const { format, names: employeeNameLookup } = useEmployeeNames();
  return (
    <>
      <div className="border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${title.toLowerCase()}…`}
            />
          </div>
          <StatusFilter
            value={sorted.statusFilter}
            options={sorted.statusOptions}
            onChange={sorted.setStatusFilter}
          />
          <SortControls
            keys={sorted.keys}
            sortKey={sorted.sortKey}
            setSortKey={sorted.setSortKey}
            direction={sorted.direction}
            toggleDirection={sorted.toggleDirection}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCSV(title, sorted.filtered, { nameLookup: employeeNameLookup })}
            disabled={!sorted.filtered.length || manage?.canExport === false}
          >
            <Download /> Export
          </Button>
          <p className="text-sm text-muted-foreground">{sorted.filtered.length} records</p>
        </div>
        {loading ? (
          <div className="p-14 text-center text-muted-foreground">Loading register…</div>
        ) : sorted.filtered.length ? (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-muted text-xs uppercase tracking-wider text-muted-foreground shadow-sm">

                <tr>
                  {columns.map((column) => (
                    <SortableHeader
                      key={column}
                      column={column}
                      sortKey={sorted.sortKey}
                      direction={sorted.direction}
                      onSort={sorted.toggleSort}
                    />
                  ))}
                  {evidenceModule && (
                    <th className="px-5 py-3">
                      {evidenceModule === "documents"
                        ? "File"
                        : evidenceModule === "reviews"
                          ? "Minutes"
                          : "Photos"}
                    </th>
                  )}
                  {manage && <th className="px-5 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.filtered.map((row) => (
                  <tr
                    key={String(row.id)}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => setDetail(row)}
                  >
                    {columns.map((column) => (
                      <td key={column} className="max-w-sm px-5 py-4">
                        <span
                          className={
                            column.includes("status") ||
                            column.includes("rating") ||
                            column === "condition"
                              ? "inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold capitalize text-primary"
                              : ""
                          }
                        >
                          {String(format(row[column] ?? "—") ?? "—").replaceAll("_", " ")}
                        </span>
                      </td>
                    ))}
                    {evidenceModule && (
                      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                        <Button type="button" size="sm" variant="safety" onClick={() => setEvidence(row)}>
                          <Camera />
                          {evidenceModule === "documents"
                            ? "File"
                            : evidenceModule === "reviews"
                              ? "Signed minutes"
                              : "Photos"}
                        </Button>
                      </td>
                    )}
                    {manage && (
                      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {rowExtra?.(row)}
                          <RowActions
                            row={row}
                            onEdit={setEditing}
                            onDelete={manage.remove}
                            canEdit={manage.canEdit}
                            canDelete={manage.canDelete}
                          />

                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="No records match this view.">
            {evidenceModule === "environment" && (
              <Button type="button" size="sm" variant="outline" disabled>
                <Camera />
                Photos available on each saved environmental record
              </Button>
            )}
          </Empty>
        )}
      </div>
      {manage && (
        <EditRecordDialog
          row={editing}
          open={!!editing}
          setOpen={(open) => !open && setEditing(null)}
          save={async (changes) => {
            if (editing) await manage.update(editing, changes);
          }}
        />
      )}
      <RecordDetailDialog
        row={detail}
        open={!!detail}
        setOpen={(open) => !open && setDetail(null)}
        title={`${title} · record profile`}
      />
      <Dialog open={evidence !== null} onOpenChange={(open) => !open && setEvidence(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {evidenceModule === "contractors"
                ? "Contractor work-in-progress evidence"
                : evidenceModule === "documents"
                  ? "Controlled document file"
                  : evidenceModule === "reviews"
                    ? "Signed management review minutes"
                    : evidenceModule === "legal"
                      ? "Legal compliance proof"
                      : "Supporting evidence"}
            </DialogTitle>
            <DialogDescription>
              {evidenceModule === "environment"
                ? "Upload, preview, or delete private photographic evidence for this environmental record."
                : evidenceModule === "contractors"
                  ? "Capture or upload photographs of work in progress, completed installations, PPE, permits on display and other supporting files for this contractor."
                  : evidenceModule === "documents"
                    ? "Upload the signed PDF (or scan) of this policy, procedure, SOP, form or work instruction. Each upload is kept private and tied to this controlled document."
                    : evidenceModule === "reviews"
                      ? "Upload the signed minutes (PDF or scan) and any supporting evidence considered during this management review."
                      : evidenceModule === "legal"
                        ? "Upload photographs or signed PDFs as proof of compliance with this legal/regulatory requirement."
                        : "Private files attached to this record."}
            </DialogDescription>
          </DialogHeader>
          {evidence && evidenceModule && (
            <EvidencePanel
              module={evidenceModule}
              recordId={String(evidence.id)}
              canAdd={manage?.canEdit}
              canDelete={manage?.canEdit || manage?.canDelete}
              photosOnly={evidenceModule === "environment" || evidenceModule === "legal"}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function RecordDialog({
  active,
  open,
  setOpen,
  employees,
  save,
}: {
  active: EnterpriseModule;
  open: boolean;
  setOpen: (value: boolean) => void;
  employees: Row[];
  save: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const v = (name: string) => String(form.get(name) ?? "").trim();
    let payload: Record<string, unknown> = { module: active };
    if (active === "legal")
      payload = {
        module: active,
        obligation: v("primary"),
        authority: v("secondary"),
        category: v("type"),
        status: v("status"),
        reviewDate: v("date"),
        evidence: v("notes"),
        ownerId: v("owner"),
      };
    if (active === "contractors")
      payload = {
        module: active,
        companyName: v("primary"),
        contactPerson: v("secondary"),
        email: v("email"),
        phone: v("phone"),
        scope: v("notes"),
        status: v("status"),
        insuranceProvider: v("provider"),
        insuranceExpiry: v("date"),
        permitReference: v("permit"),
        permitExpiry: v("secondDate"),
        hseScore: Number(v("score") || 0),
        ownerId: v("owner"),
      };
    if (active === "environment")
      payload = {
        module: active,
        activity: v("primary"),
        aspect: v("secondary"),
        impact: v("impact"),
        condition: v("type"),
        likelihood: Number(v("likelihood")),
        severity: Number(v("severity")),
        controls: v("controls"),
        additionalControls: v("additional"),
        reviewDate: v("date"),
        ownerId: v("owner"),
      };
    if (active === "ppe")
      payload = {
        module: active,
        employeeId: v("employee"),
        item: v("primary"),
        serialNumber: v("secondary"),
        quantity: Number(v("quantity")),
        issuedOn: v("date"),
        replacementOn: v("secondDate"),
        condition: v("status"),
        issuedBy: v("owner"),
        notes: v("notes"),
      };
    if (active === "documents")
      payload = {
        module: active,
        number: v("secondary"),
        title: v("primary"),
        documentType: v("type"),
        version: v("version"),
        reviewDate: v("date"),
        ownerId: v("owner"),
      };
    if (active === "reviews")
      payload = {
        module: active,
        periodStart: v("date"),
        periodEnd: v("secondDate"),
        meetingDate: v("meetingDate"),
        attendees: v("secondary"),
        summary: v("primary"),
        decisions: v("notes"),
        chairpersonId: v("owner"),
      };
    try {
      await save(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Record could not be saved.");
    } finally {
      setSaving(false);
    }
  }
  if (!["legal", "contractors", "environment", "ppe", "documents", "reviews"].includes(active))
    return null;
  const people = employees.map((item) => ({
    value: String(item.id),
    label: String(item.full_name),
  }));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{definitions[active].action}</DialogTitle>
          <DialogDescription>
            Complete the governance record. Required fields are marked.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field
            label={
              active === "reviews"
                ? "Executive summary"
                : active === "legal"
                  ? "Legal obligation"
                  : active === "environment"
                    ? "Activity"
                    : active === "ppe"
                      ? "PPE item"
                      : active === "documents"
                        ? "Document title"
                        : "Company name"
            }
            name="primary"
            required
            wide={active === "reviews"}
          />
          {active === "reviews" ? (
            <Text label="Attendees" name="secondary" />
          ) : (
            <Field
              label={
                active === "legal"
                  ? "Authority"
                  : active === "environment"
                    ? "Aspect"
                    : active === "ppe"
                      ? "Serial number"
                      : active === "documents"
                        ? "Document number"
                        : "Contact person"
              }
              name="secondary"
              required={active !== "ppe"}
            />
          )}
          {active === "legal" && (
            <>
              <Select
                label="Category"
                name="type"
                options={["osha_kenya", "nema", "fire_safety", "county_government", "other"]}
              />
              <Select
                label="Compliance status"
                name="status"
                options={["under_review", "compliant", "partially_compliant", "non_compliant"]}
              />
            </>
          )}
          {active === "contractors" && (
            <>
              <Field label="Email" name="email" type="email" />
              <Field label="Phone" name="phone" />
              <Select
                label="Approval status"
                name="status"
                options={[
                  "pending",
                  "under_review",
                  "approved",
                  "suspended",
                  "expired",
                  "rejected",
                ]}
              />
              <Field label="Insurance provider" name="provider" />
              <Field label="Permit reference" name="permit" />
              <Field label="HSE score (%)" name="score" type="number" />
            </>
          )}
          {active === "environment" && (
            <>
              <Select
                label="Operating condition"
                name="type"
                options={["normal", "abnormal", "emergency"]}
              />
              <Select label="Likelihood" name="likelihood" options={["1", "2", "3", "4", "5"]} />
              <Select label="Severity" name="severity" options={["1", "2", "3", "4", "5"]} />
              <Text label="Environmental impact (required)" name="impact" />
              <Text label="Existing controls" name="controls" />
              <Text label="Additional controls" name="additional" />
            </>
          )}
          {active === "ppe" && (
            <>
              <Select label="Employee" name="employee" options={people} />
              <Field label="Quantity" name="quantity" type="number" />
              <Select
                label="Condition"
                name="status"
                options={["new", "serviceable", "due_replacement", "damaged", "lost", "replaced"]}
              />
            </>
          )}
          {active === "documents" && (
            <>
              <Select
                label="Document type"
                name="type"
                options={["policy", "sop", "procedure", "form", "work_instruction", "other"]}
              />
              <Field label="Version" name="version" />
            </>
          )}
          <Field
            label={
              active === "reviews"
                ? "Period start"
                : active === "ppe"
                  ? "Issued on"
                  : active === "contractors"
                    ? "Insurance expiry"
                    : "Review date"
            }
            name="date"
            type="date"
            required
          />
          {["contractors", "ppe", "reviews"].includes(active) && (
            <Field
              label={
                active === "reviews"
                  ? "Period end"
                  : active === "ppe"
                    ? "Replacement due"
                    : "Permit expiry"
              }
              name="secondDate"
              type="date"
              required={active === "reviews"}
            />
          )}
          {active === "reviews" && (
            <Field label="Meeting date" name="meetingDate" type="date" required />
          )}
          <Select
            label={active === "reviews" ? "Chairperson" : active === "ppe" ? "Issued by" : "Owner"}
            name="owner"
            options={people}
          />
          {!["environment", "documents"].includes(active) && (
            <Text
              label={
                active === "contractors"
                  ? "Scope of work"
                  : active === "reviews"
                    ? "Decisions and actions"
                    : "Evidence / notes"
              }
              name="notes"
              required={active === "contractors"}
            />
          )}
          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save record"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GlobalSearch({
  query,
  setQuery,
  results,
  run,
  canExport,
}: {
  query: string;
  setQuery: (value: string) => void;
  results: Record<string, Row[]>;
  run: () => Promise<void>;
  canExport: boolean;
}) {
  const { format, names: employeeNameLookup } = useEmployeeNames();
  const exportRows = Object.entries(results).flatMap(([module, rows]) =>
    rows.map((row) => ({ module, ...row })),
  );
  return (
    <div>
      <section className="mb-7">
        <p className="max-w-2xl text-muted-foreground">{definitions.global_search.description}</p>
      </section>
      <form
        className="flex max-w-3xl flex-wrap gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          if (query.trim().length >= 2) await run();
        }}
      >
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search references, people, contractors and departments…"
          minLength={2}
        />
        <Button type="submit">
          <Search />
          Search
        </Button>
        {canExport && (
          <Button
            type="button"
            variant="outline"
            disabled={!exportRows.length}
            onClick={() => downloadCSV("global-search-results", exportRows, { nameLookup: employeeNameLookup })}
          >
            <Download /> Export results
          </Button>
        )}
      </form>
      <div className="mt-6 space-y-5">
        {Object.entries(results).map(([group, rows]) =>
          rows.length ? (
            <section key={group} className="border bg-card">
              <h3 className="border-b px-5 py-3 font-bold capitalize">{group}</h3>
              <div className="divide-y">
                {rows.map((row) => (
                  <div key={String(row.id)} className="px-5 py-4 text-sm">
                    {Object.entries(row)
                      .filter(([key]) => key !== "id")
                      .map(([, value]) => String(format(value) ?? ""))
                      .join(" · ")}
                  </div>
                ))}
              </div>
            </section>
          ) : null,
        )}
      </div>
    </div>
  );
}
function Reporting({
  data,
  roles,
  canExport,
  isAdmin,
  employeeNameLookup,
}: {
  data?: Awaited<ReturnType<typeof getModulePacksThreeFour>>;
  roles: string[];
  canExport: boolean;
  isAdmin: boolean;
  employeeNameLookup: Map<string, string>;
}) {
  const queryClient = useQueryClient();
  const deleteRecord = useServerFn(deleteManagedRecord);
  const categories = [
    { name: "Legal compliance", module: "legal" as const, rows: (data?.legal ?? []) as Row[] },
    { name: "Contractors", module: "contractors" as const, rows: (data?.contractors ?? []) as Row[] },
    { name: "Environmental aspects", module: "environment" as const, rows: (data?.environment ?? []) as Row[] },
    { name: "PPE register", module: "ppe" as const, rows: (data?.ppe ?? []) as Row[] },
    { name: "Document register", module: "documents" as const, rows: (data?.documents ?? []) as Row[] },
  ];
  const moduleVolumes = categories.map((c) => ({ name: c.name, records: c.rows.length }));
  const trendRows = categories
    .flatMap((c) =>
      c.rows.map((source) => {
        const row = source as Row;
        return {
          module: c.name,
          date: String(
            row.created_at ?? row.updated_at ?? row.review_date ?? row.issued_on ?? "",
          ).slice(0, 7),
        };
      }),
    )
    .filter((row) => /^\d{4}-\d{2}$/.test(row.date));
  const months = Array.from(new Set(trendRows.map((row) => row.date))).sort().slice(-12);
  const activityTrend = months.map((month) => ({
    month,
    records: trendRows.filter((row) => row.date === month).length,
  }));

  const volumeChartRef = useRef<HTMLDivElement>(null);
  const trendChartRef = useRef<HTMLDivElement>(null);
  const exportChart = async (container: HTMLDivElement | null, fileName: string) => {
    const svg = container?.querySelector("svg");
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const styles = getComputedStyle(document.documentElement);
    clone.querySelectorAll<SVGElement>("*").forEach((element) => {
      for (const attribute of ["fill", "stroke"] as const) {
        const value = element.getAttribute(attribute);
        const token = value?.match(/^var\((--[^)]+)\)$/)?.[1];
        if (token) element.setAttribute(attribute, styles.getPropertyValue(token).trim());
      }
    });
    const bounds = svg.getBoundingClientRect();
    clone.setAttribute("width", String(bounds.width));
    clone.setAttribute("height", String(bounds.height));
    const source = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();
    image.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(bounds.width * scale);
      canvas.height = Math.ceil(bounds.height * scale);
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        return;
      }
      context.scale(scale, scale);
      context.fillStyle = styles.getPropertyValue("--card").trim() || "white";
      context.fillRect(0, 0, bounds.width, bounds.height);
      context.drawImage(image, 0, 0, bounds.width, bounds.height);
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
      URL.revokeObjectURL(url);
    };
    image.src = url;
  };
  const download = (name: string, rows: readonly Row[]) => {
    const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    const csv = [
      keys.join(","),
      ...rows.map((row) => keys.map((key) => JSON.stringify(row[key] ?? "")).join(",")),
    ].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = `${name.toLowerCase().replaceAll(" ", "-")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const sectionDefs = [
    { key: "volume", label: "Records by module (chart)" },
    { key: "trend", label: "12-month activity trend (chart)" },
    ...categories.map((c) => ({ key: `export:${c.name}`, label: `${c.name} (CSV export)` })),
  ];
  const STORAGE_KEY = "reporting-visible-sections";
  const [visible, setVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sectionDefs.map((section) => [section.key, true])),
  );
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, boolean>;
        setVisible((current) => ({ ...current, ...parsed }));
      }
    } catch {
      /* ignore */
    }
  }, []);
  function toggle(key: string) {
    setVisible((current) => {
      const next = { ...current, [key]: !current[key] };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }
  function showAll(value: boolean) {
    const next = Object.fromEntries(sectionDefs.map((section) => [section.key, value]));
    setVisible(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  // Filter / sort across categories
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<"name-asc" | "name-desc" | "records-desc" | "records-asc">(
    "records-desc",
  );
  const [selectedCats, setSelectedCats] = useState<Record<string, boolean>>({});
  const filteredCats = categories
    .filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()))
    .filter((c) => visible[`export:${c.name}`] !== false)
    .sort((a, b) => {
      if (sort === "name-asc") return a.name.localeCompare(b.name);
      if (sort === "name-desc") return b.name.localeCompare(a.name);
      if (sort === "records-asc") return a.rows.length - b.rows.length;
      return b.rows.length - a.rows.length;
    });
  const allSelected =
    filteredCats.length > 0 && filteredCats.every((c) => selectedCats[c.name]);
  function toggleSelectAll(value: boolean) {
    const next: Record<string, boolean> = {};
    filteredCats.forEach((c) => (next[c.name] = value));
    setSelectedCats(next);
  }
  async function bulkExportSelected() {
    filteredCats
      .filter((c) => selectedCats[c.name])
      .forEach((c) => download(c.name, c.rows));
  }

  const [detailCategory, setDetailCategory] = useState<typeof categories[number] | null>(null);

  return (
    <div>
      <p className="mb-4 max-w-2xl text-muted-foreground">{definitions.reporting.description}</p>
      <details className="mb-5 border bg-card p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          Customize reports — choose which sections to display
        </summary>
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => showAll(true)}>
            Show all
          </Button>
          <Button size="sm" variant="outline" onClick={() => showAll(false)}>
            Hide all
          </Button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sectionDefs.map((section) => (
            <label key={section.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={visible[section.key] !== false}
                onChange={() => toggle(section.key)}
              />
              {section.label}
            </label>
          ))}
        </div>
      </details>

      {(visible.volume || visible.trend) && (
        <div className="mb-6 grid gap-5 xl:grid-cols-2">
          {visible.volume && (
            <section className="border bg-card p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">Records by module</h3>
                  <p className="text-xs text-muted-foreground">
                    Current reporting volume across registers
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!canExport}
                  onClick={() => exportChart(volumeChartRef.current, "records-by-module")}
                >
                  <Download /> Export chart
                </Button>
              </div>
              <div
                ref={volumeChartRef}
                className="h-72"
                aria-label="Bar chart showing records by module"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={moduleVolumes} margin={{ left: 0, right: 8, top: 8, bottom: 42 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} height={68} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="records" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
          {visible.trend && (
            <section className="border bg-card p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">12-month activity trend</h3>
                  <p className="text-xs text-muted-foreground">
                    Entries created or reviewed per month
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!canExport || !activityTrend.length}
                  onClick={() => exportChart(trendChartRef.current, "12-month-activity-trend")}
                >
                  <Download /> Export trend
                </Button>
              </div>
              <div
                ref={trendChartRef}
                className="h-72"
                aria-label="Line chart showing monthly record activity"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={activityTrend}
                    margin={{ left: 0, right: 12, top: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="records"
                      stroke="var(--chart-2)"
                      strokeWidth={3}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Toolbar: Filter / Sort / Select all / Bulk actions */}
      <div className="mb-3 flex flex-wrap items-center gap-3 border bg-card p-3">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(event) => toggleSelectAll(event.target.checked)}
          />
          Select all
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Filter report categories…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="h-9 w-64 pl-8"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sort:</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as typeof sort)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="records-desc">Most records</option>
            <option value="records-asc">Fewest records</option>
            <option value="name-asc">Name A → Z</option>
            <option value="name-desc">Name Z → A</option>
          </select>
        </label>
        <Button
          size="sm"
          variant="outline"
          disabled={!canExport || !Object.values(selectedCats).some(Boolean)}
          onClick={bulkExportSelected}
        >
          <Download /> Export selected
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          {filteredCats.length} categor{filteredCats.length === 1 ? "y" : "ies"}
        </span>
      </div>

      {/* Lively category cards — click to view detail with chart */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredCats.map((c) => {
          const trend = buildMonthlyTrend(c.rows);
          return (
            <article
              key={c.name}
              className="group border bg-card p-4 transition hover:border-primary hover:shadow-md"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <label
                  className="flex items-center gap-2"
                  onClick={(event) => event.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={!!selectedCats[c.name]}
                    onChange={(event) =>
                      setSelectedCats((current) => ({
                        ...current,
                        [c.name]: event.target.checked,
                      }))
                    }
                  />
                  <span className="text-sm font-bold">{c.name}</span>
                </label>
                <span className="text-xs font-semibold text-muted-foreground">
                  {c.rows.length} records
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDetailCategory(c)}
                className="block w-full text-left"
              >
                <div className="h-20">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
                      <Line
                        type="monotone"
                        dataKey="records"
                        stroke="var(--chart-2)"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Tooltip cursor={{ stroke: "var(--muted-foreground)" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-xs text-primary opacity-0 transition group-hover:opacity-100">
                  View profile & records →
                </p>
              </button>
              <div className="mt-3 flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canExport}
                  onClick={() => download(c.name, c.rows)}
                >
                  <Download /> CSV
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      <ReportingCategoryDialog
        category={detailCategory}
        open={detailCategory !== null}
        setOpen={(open) => !open && setDetailCategory(null)}
        canDelete={isAdmin}
        onDelete={async (recordId, module) => {
          await deleteRecord({ data: { module, recordId } });
          await queryClient.invalidateQueries({ queryKey: ["module-packs-3-4"] });
        }}
        employeeNameLookup={employeeNameLookup}
      />

      <ReportingAdministration isAdmin={roles.includes("admin")} />
    </div>
  );
}

function buildMonthlyTrend(rows: Row[]) {
  const counts: Record<string, number> = {};
  rows.forEach((row) => {
    const date = String(
      row.created_at ?? row.updated_at ?? row.review_date ?? row.issued_on ?? "",
    ).slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(date)) counts[date] = (counts[date] ?? 0) + 1;
  });
  return Object.keys(counts)
    .sort()
    .slice(-12)
    .map((month) => ({ month, records: counts[month] }));
}

function ReportingCategoryDialog({
  category,
  open,
  setOpen,
  canDelete,
  onDelete,
  employeeNameLookup,
}: {
  category: { name: string; module: "legal" | "contractors" | "environment" | "ppe" | "documents"; rows: Row[] } | null;
  open: boolean;
  setOpen: (value: boolean) => void;
  canDelete: boolean;
  onDelete: (recordId: string, module: "legal" | "contractors" | "environment" | "ppe" | "documents") => Promise<void>;
  employeeNameLookup: Map<string, string>;
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [detailRow, setDetailRow] = useState<Row | null>(null);
  const printableRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSelected({});
    setSearch("");
    setError("");
  }, [category?.name]);

  if (!category) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent />
      </Dialog>
    );
  }
  const trend = buildMonthlyTrend(category.rows);
  const filtered = category.rows.filter((row) =>
    JSON.stringify(row).toLowerCase().includes(search.toLowerCase()),
  );
  const sorted = [...filtered].sort((a, b) => {
    const av = String(a[sortKey] ?? "");
    const bv = String(b[sortKey] ?? "");
    return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
  });
  const allChecked = sorted.length > 0 && sorted.every((row) => selected[String(row.id)]);
  const selectedIds = Object.entries(selected)
    .filter(([, value]) => value)
    .map(([id]) => id);

  function toggleAll(value: boolean) {
    const next: Record<string, boolean> = {};
    sorted.forEach((row) => (next[String(row.id)] = value));
    setSelected(next);
  }
  async function bulkDelete() {
    if (!selectedIds.length) return;
    if (!window.confirm(`Delete ${selectedIds.length} record(s)? This cannot be undone.`)) return;
    setBusy(true);
    setError("");
    try {
      for (const id of selectedIds) {
        await onDelete(id, category!.module);
      }
      setSelected({});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Some records could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  const columns = Array.from(
    new Set(
      sorted
        .flatMap((row) => Object.keys(row))
        .filter((key) => !["id", "created_by", "updated_by"].includes(key)),
    ),
  ).slice(0, 6);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>{category.name}</DialogTitle>
            <DialogDescription>
              {category.rows.length} record{category.rows.length === 1 ? "" : "s"} · 12-month activity trend below.
              Click any row to view the full profile.
            </DialogDescription>
          </DialogHeader>

          <div className="mb-3 flex flex-wrap justify-end gap-2">
            <ReportActions
              targetRef={printableRef}
              fileName={`${category.name.toLowerCase().replaceAll(" ", "-")}-report`}
              title={category.name}
              subtitle={`${category.rows.length} records · ${new Date().toLocaleDateString()}`}
              module={category.module}
            />
          </div>

          <div ref={printableRef}>
          <section className="mb-4 border bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold">12-month activity trend</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="records"
                    stroke="var(--chart-2)"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="mb-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={(event) => toggleAll(event.target.checked)}
              />
              Select all
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Filter records…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-9 w-64 pl-8"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Sort:</span>
              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value)}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                {columns.map((col) => (
                  <option key={col} value={col}>
                    {col.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              <select
                value={sortDir}
                onChange={(event) => setSortDir(event.target.value as "asc" | "desc")}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="desc">↓ Desc</option>
                <option value="asc">↑ Asc</option>
              </select>
            </label>
            {canDelete && (
              <Button
                size="sm"
                variant="destructive"
                disabled={busy || !selectedIds.length}
                onClick={bulkDelete}
              >
                {busy ? "Deleting…" : `Delete selected (${selectedIds.length})`}
              </Button>
            )}
            <span className="ml-auto text-xs text-muted-foreground">{sorted.length} shown</span>
          </div>
          {error && <p className="mb-2 text-sm text-destructive">{error}</p>}

          <div className="max-h-[70vh] overflow-auto border bg-card">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-muted text-xs uppercase tracking-wider text-muted-foreground shadow-sm">

                <tr>
                  <th className="px-3 py-2"></th>
                  {columns.map((col) => (
                    <th key={col} className="px-3 py-2">
                      {col.replaceAll("_", " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map((row) => {
                  const id = String(row.id);
                  return (
                    <tr
                      key={id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setDetailRow(row)}
                    >
                      <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={!!selected[id]}
                          onChange={(event) =>
                            setSelected((current) => ({ ...current, [id]: event.target.checked }))
                          }
                        />
                      </td>
                      {columns.map((col) => {
                        const value = row[col];
                        const display =
                          typeof value === "string" && employeeNameLookup.get(value)
                            ? employeeNameLookup.get(value)
                            : value === null || value === undefined
                              ? "—"
                              : typeof value === "object"
                                ? JSON.stringify(value)
                                : String(value);
                        return (
                          <td key={col} className="px-3 py-2 align-top">
                            <span className="line-clamp-2 break-words">{String(display ?? "—").slice(0, 120)}</span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {!sorted.length && (
                  <tr>
                    <td colSpan={columns.length + 1} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      No records match this view.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </div>
        </DialogContent>
      </Dialog>
      <RecordDetailDialog
        row={detailRow as never}
        open={detailRow !== null}
        setOpen={(value) => !value && setDetailRow(null)}
        title={`${category.name} — record profile`}
      />
    </>
  );
}

function Intelligence({
  data,
  canExport,
}: {
  data?: Awaited<ReturnType<typeof getModulePacksThreeFour>>;
  canExport: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const legalAll = data?.legal ?? [];
  const legalCompliant = legalAll.filter((r) => r.compliance_status === "compliant");
  const contractorsApproved = (data?.contractors ?? []).filter(
    (r) => r.approval_status === "approved",
  );
  const envSignificant = (data?.environment ?? []).filter((r) =>
    ["high", "extreme"].includes(String(r.significance_rating)),
  );
  const ppeDue = (data?.ppe ?? []).filter(
    (r) =>
      r.expected_replacement_on &&
      r.expected_replacement_on <= today &&
      r.condition !== "replaced",
  );
  const docsDue = (data?.documents ?? []).filter(
    (r) => r.review_date <= today && r.status !== "archived",
  );

  const cards: Array<{
    label: string;
    value: string | number;
    summary: string;
    rows: Array<Record<string, unknown>>;
    columns: Array<{ key: string; label: string }>;
  }> = [
    {
      label: "Legal compliance",
      value: `${Math.round((legalCompliant.length / Math.max(1, legalAll.length)) * 100)}%`,
      summary: `${legalCompliant.length} of ${legalAll.length} legal obligations marked compliant.`,
      rows: legalAll as Array<Record<string, unknown>>,
      columns: [
        { key: "title", label: "Obligation" },
        { key: "regulation_reference", label: "Reference" },
        { key: "compliance_status", label: "Status" },
        { key: "next_review_date", label: "Next review" },
      ],
    },
    {
      label: "Approved contractors",
      value: contractorsApproved.length,
      summary: `${contractorsApproved.length} contractors currently approved to operate on site.`,
      rows: contractorsApproved as Array<Record<string, unknown>>,
      columns: [
        { key: "company_name", label: "Company" },
        { key: "scope_of_work", label: "Scope" },
        { key: "approval_status", label: "Approval" },
        { key: "expiry_date", label: "Expires" },
      ],
    },
    {
      label: "Significant aspects",
      value: envSignificant.length,
      summary: `Environmental aspects rated high or extreme significance.`,
      rows: envSignificant as Array<Record<string, unknown>>,
      columns: [
        { key: "aspect", label: "Aspect" },
        { key: "impact", label: "Impact" },
        { key: "significance_rating", label: "Significance" },
        { key: "control_measures", label: "Controls" },
      ],
    },
    {
      label: "PPE replacement due",
      value: ppeDue.length,
      summary: `PPE items whose expected replacement date has passed and have not been replaced.`,
      rows: ppeDue as Array<Record<string, unknown>>,
      columns: [
        { key: "item_name", label: "Item" },
        { key: "assigned_to_name", label: "Holder" },
        { key: "condition", label: "Condition" },
        { key: "expected_replacement_on", label: "Replace by" },
      ],
    },
    {
      label: "Document reviews due",
      value: docsDue.length,
      summary: `Controlled documents whose review date has elapsed.`,
      rows: docsDue as Array<Record<string, unknown>>,
      columns: [
        { key: "title", label: "Document" },
        { key: "document_type", label: "Type" },
        { key: "owner", label: "Owner" },
        { key: "review_date", label: "Review due" },
      ],
    },
  ];

  const [selected, setSelected] = useState<number | null>(null);
  const active = selected !== null ? cards[selected] : null;

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <p className="max-w-2xl text-muted-foreground">{definitions.intelligence.description}</p>
        {canExport && (
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              downloadCSV(
                "business-intelligence-scorecard",
                cards.map((c) => ({ label: c.label, value: c.value })),
              )
            }
          >
            <Download /> Export
          </Button>
        )}
      </div>
      <div className="mt-6">
        <HseKpiDashboard windowMonths={12} />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">

        {cards.map((card, idx) => (
          <button
            key={card.label}
            type="button"
            onClick={() => setSelected(idx)}
            className="group border bg-card p-5 text-left transition hover:border-primary hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label={`Open ${card.label} details`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {card.label}
            </p>
            <p className="mt-3 font-display text-3xl font-bold">{card.value}</p>
            <p className="mt-2 text-xs text-muted-foreground group-hover:text-primary">
              Click to view details →
            </p>
          </button>
        ))}
      </div>
      <div className="mt-6 border bg-card p-6">
        <h3 className="font-bold">Prosel HSE scorecard</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Live compliance exceptions and assurance indicators across Module Packs 3 and 4.
        </p>
      </div>
      <div className="mt-6">
        <ReportingDashboard isAdminView={true} showKpis={false} />
      </div>
      <Dialog open={active !== null} onOpenChange={(value) => !value && setSelected(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{active?.label}</DialogTitle>
            <DialogDescription>{active?.summary}</DialogDescription>
          </DialogHeader>
          {active && (
            <div className="max-h-[60vh] overflow-auto">
              {active.rows.length === 0 ? (
                <Empty text="No contributing records." />
              ) : (
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 bg-muted/60">
                    <tr>
                      {active.columns.map((c) => (
                        <th key={c.key} className="border-b px-3 py-2 text-left font-semibold">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {active.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="border-b last:border-0 hover:bg-muted/30">
                        {active.columns.map((c) => {
                          const v = row[c.key];
                          return (
                            <td key={c.key} className="px-3 py-2 align-top">
                              {v === null || v === undefined || v === ""
                                ? "—"
                                : String(v).replaceAll("_", " ")}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function Field({
  label,
  name,
  type = "text",
  required = false,
  wide = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={`space-y-2 ${wide ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={`p34-${name}`}>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input
        id={`p34-${name}`}
        name={name}
        type={type}
        required={required}
        maxLength={type === "text" ? 500 : undefined}
      />
    </div>
  );
}
function Text({
  label,
  name,
  required = false,
}: {
  label: string;
  name: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2 sm:col-span-2">
      <Label htmlFor={`p34-${name}`}>
        {label}
        {required ? " *" : ""}
      </Label>
      <BulletTextarea id={`p34-${name}`} name={name} required={required} maxLength={8000} />
    </div>
  );
}
function Select({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: Array<string | { value: string; label: string }>;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`p34-${name}`}>{label} *</Label>
      <select
        id={`p34-${name}`}
        name={name}
        required
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">Select…</option>
        {options.map((option) => {
          const item =
            typeof option === "string"
              ? { value: option, label: option.replaceAll("_", " ") }
              : option;
          return (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          );
        })}
      </select>
    </div>
  );
}
function Empty({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="p-12 text-center">
      <BarChart3 className="mx-auto mb-3 size-9 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{text}</p>
      {children && <div className="mt-4 flex justify-center">{children}</div>}
    </div>
  );
}

function ComingSoonModule({ active }: { active: "safety_committee" | "emergency_response" }) {
  const isCommittee = active === "safety_committee";
  const title = isCommittee ? "Safety Committee management" : "Emergency Response management";
  const description = isCommittee
    ? "Plan committee meetings, capture minutes with up to 10 signatories, share the meeting schedule and export PDF/print/email."
    : "Drills, response readiness, mobilisation logs and post-event reviews integrated with HSE Reports to top management.";
  const upcoming = isCommittee
    ? [
        "Meeting agenda and minutes editor",
        "Up to 10 employee signatories per meeting",
        "Recurring meeting schedule with calendar reminders",
        "Export PDF · Print · Send via email",
        "Visibility restricted to Level 4 and Level 5 users",
      ]
    : [
        "Drill log with location, scenario and participants",
        "Response performance metrics and lessons learned",
        "Roll-up into HSE Reports to top management",
        "Export PDF · Print · Send via email",
      ];
  return (
    <div className="rounded-3xl border border-dashed border-primary/30 bg-primary/5 p-8">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">
          Rolling out
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {upcoming.map((item) => (
            <li key={item} className="rounded-xl bg-background/70 px-4 py-3 text-sm shadow-sm">
              • {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function QuickUploadDocumentDialog({
  open,
  onOpenChange,
  module,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  module: "documents" | "legal";
  onComplete: () => void | Promise<void>;
}) {
  const upload = useServerFn(quickUploadDocument);
  const saveMeta = useServerFn(saveEvidenceMetadata);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim() || undefined;
    const fileInput = e.currentTarget.querySelector<HTMLInputElement>('input[name="file"]');
    const file = fileInput?.files?.[0];
    if (!title || !file) {
      setError("Please provide a title and select a file.");
      return;
    }
    const okType = ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type);
    if (!okType) {
      setError("Use a JPG, PNG, WebP or PDF file.");
      return;
    }
    if (file.size > 10_485_760) {
      setError("File must be 10 MB or smaller.");
      return;
    }
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Please sign in again.");
      const created = await upload({ data: { module, title, notes } });
      const recordId = created.id;
      const prepared = file.type.startsWith("image/") ? await compressImage(file) : file;
      const extension = prepared.name.split(".").pop()?.toLowerCase() ?? "pdf";
      const path = `${auth.user.id}/${module}/${recordId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadErr } = await supabase.storage
        .from("hse-evidence")
        .upload(path, prepared, { contentType: prepared.type, upsert: false });
      if (uploadErr) throw new Error("File upload failed. The record was created without the file.");
      try {
        await saveMeta({
          data: {
            module,
            recordId,
            storagePath: path,
            fileName: prepared.name,
            mimeType: prepared.type as "image/jpeg" | "image/png" | "image/webp" | "application/pdf",
            fileSize: prepared.size,
          },
        });
      } catch (cause) {
        await supabase.storage.from("hse-evidence").remove([path]);
        throw cause;
      }
      await onComplete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {module === "documents" ? "Upload document" : "Upload legal document"}
          </DialogTitle>
          <DialogDescription>
            {module === "documents"
              ? "Quickly add a document and attach the file. You can refine the metadata afterwards."
              : "Quickly register a legal document and attach the file. You can refine the obligation details afterwards."}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="quick-upload-title">
              {module === "documents" ? "Document title *" : "Obligation / document title *"}
            </Label>
            <Input id="quick-upload-title" name="title" required maxLength={300} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick-upload-file">File *</Label>
            <Input
              id="quick-upload-file"
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              required
            />
            <p className="text-xs text-muted-foreground">JPG, PNG, WebP or PDF up to 10 MB.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick-upload-notes">Notes (optional)</Label>
            <Input id="quick-upload-notes" name="notes" maxLength={2000} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="safety" disabled={busy}>
              {busy ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
