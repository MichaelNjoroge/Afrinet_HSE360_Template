import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  BarChart3,
  Camera,
  CheckCircle2,
  ChevronRight,
  Eye,
  Plus,
  Search,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  createModulePackTwoRecord,
  getModulePackTwo,
  transitionModulePackTwoRecord,
} from "@/lib/module-pack-two.functions";
import { deleteManagedRecord, updateManagedRecord } from "@/lib/record-management.functions";
import {
  EditRecordDialog,
  RecordDetailDialog,
  RowActions,
  SortControls,
  useSortedRows,
} from "@/components/record-management";
import { BulkImportButton } from "@/components/bulk-import";
import { downloadCSV } from "@/lib/export";
import { useEmployeeNames } from "@/lib/employee-display";
import { getMyModulePermissions } from "@/lib/permissions.functions";
import { InspectionReportPanel } from "@/components/inspection-report-panel";
import { EvidencePanel } from "@/components/evidence-panel";
import { ObjectiveDetailDialog } from "@/components/objective-detail-dialog";
import { ReportActions } from "@/components/report-actions";

export type PackTwoModule = "inspections" | "training" | "competencies" | "objectives";
type Row = Record<string, unknown>;

const definitions = {
  inspections: {
    title: "Inspection management",
    description:
      "Schedule structured inspections, complete checklists and escalate non-conformances.",
    action: "Schedule inspection",
  },
  training: {
    title: "Training management",
    description: "Monitor employee training, certificates and 90/60/30-day expiry windows.",
    action: "Add training record",
  },
  competencies: {
    title: "Competency matrix",
    description: "Compare required capability with assessed employee competency levels.",
    action: "Assess competency",
  },
  objectives: {
    title: "Objectives & targets",
    description:
      "Track HSE objectives with calculated achievement, monthly progress and RAG status.",
    action: "Add objective",
  },
} as const;

const inspectionFlow = ["scheduled", "in_progress", "completed", "closed"];
const objectiveFlow = ["draft", "active", "completed", "closed"];

export function ModulePackTwo({
  active,
  employees,
  roles = [],
  currentUserId,
}: {
  active: PackTwoModule;
  employees: Row[];
  roles?: string[];
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const fetchPack = useServerFn(getModulePackTwo);
  const createRecord = useServerFn(createModulePackTwoRecord);
  const transition = useServerFn(transitionModulePackTwoRecord);
  const updateRecord = useServerFn(updateManagedRecord);
  const deleteRecord = useServerFn(deleteManagedRecord);
  const fetchPermissions = useServerFn(getMyModulePermissions);
  const { data: permissions } = useQuery({
    queryKey: ["module-permissions"],
    queryFn: () => fetchPermissions(),
  });
  const permission = permissions?.[active];
  const { data, isLoading, error } = useQuery({
    queryKey: ["module-pack-2"],
    queryFn: () => fetchPack(),
  });
  const [dialog, setDialog] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const rows = (data?.[active] ?? []) as Row[];
  const isAdmin = roles.includes("admin");
  const canAdd = isAdmin || permission?.create === true || permission?.edit === true;
  const canExport = isAdmin || permission?.export !== false;
  const employeeNameLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const emp of employees) {
      const id = emp?.id;
      const name = emp?.full_name;
      if (typeof id === "string" && typeof name === "string") map.set(id, name);
      const uid = emp?.user_id;
      if (typeof uid === "string" && typeof name === "string") map.set(uid, name);
    }
    return map;
  }, [employees]);
  const finish = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ["module-pack-2"] });
    setDialog(false);
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  };

  return (
    <>
      <section className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-primary">
            Module Pack 2
          </p>
          <p className="max-w-2xl text-muted-foreground">{definitions[active].description}</p>
          {active === "training" && (
            <p className="mt-2 text-xs font-semibold text-muted-foreground">
              Automated monitoring windows · 90 days · 60 days · 30 days
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canAdd && (
            <BulkImportButton
              module={active}
              onComplete={async (count) => finish(`${count} records imported`)}
            />
          )}
          {canExport && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => downloadCSV(active, rows, { nameLookup: employeeNameLookup })}
              disabled={!rows.length}
            >
              <FileDown />
              Export CSV
            </Button>
          )}
          {canAdd && (
            <Button variant="safety" size="lg" onClick={() => setDialog(true)}>
              <Plus />
              Create new entry
            </Button>
          )}
        </div>
      </section>
      {error ? (
        <Empty text="Module Pack 2 could not be loaded. Please refresh." />
      ) : active === "training" ? (
        <TrainingRegister
          rows={rows}
          employees={employees}
          loading={isLoading}
          search={search}
          setSearch={setSearch}
          canEdit={isAdmin || permission?.edit !== false}
        />
      ) : active === "competencies" ? (
        <CompetencyMatrix
          rows={rows}
          employees={employees}
          loading={isLoading}
          search={search}
          setSearch={setSearch}
          canEdit={isAdmin || permission?.edit !== false}
        />
      ) : active === "objectives" ? (
        <ObjectivesRegister
          rows={rows}
          loading={isLoading}
          search={search}
          setSearch={setSearch}
          canEdit={isAdmin || permission?.edit !== false}
          advance={async (row, next) => {
            await transition({
              data: {
                module: "objectives",
                recordId: String(row.id),
                fromStatus: String(row.status),
                toStatus: next,
              },
            });
            await finish(`Objective moved to ${next}`);
          }}
        />
      ) : (
        <InspectionRegister
          rows={rows}
          checklist={(data?.checklist ?? []) as Row[]}
          loading={isLoading}
          search={search}
          setSearch={setSearch}
          advance={async (row, next) => {
            await transition({
              data: {
                module: "inspections",
                recordId: String(row.id),
                fromStatus: String(row.status),
                toStatus: next,
              },
            });
            await finish(`Inspection moved to ${next.replaceAll("_", " ")}`);
          }}
          canEdit={permission?.edit !== false}
          canDelete={permission?.edit !== false || permission?.delete === true}
          canApprove={permission?.approve === true}
        />
      )}
      <ManagePackTwo
        module={active}
        rows={rows}
        search={search}
        update={async (row, changes) => {
          await updateRecord({ data: { module: active, recordId: String(row.id), changes } });
          await finish("Record updated");
        }}
        remove={async (row) => {
          await deleteRecord({ data: { module: active, recordId: String(row.id) } });
          await finish("Record deleted");
        }}
        canEdit={permission?.edit !== false}
        canDelete={permission?.delete === true}
      />
      <PackTwoDialog
        active={active}
        open={dialog}
        setOpen={setDialog}
        employees={employees}
        save={async (payload) => {
          await createRecord({ data: payload as never });
          await finish(`${definitions[active].title} record saved`);
        }}
      />
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

function ManagePackTwo({
  module,
  rows,
  search,
  update,
  remove,
  canEdit,
  canDelete,
}: {
  module: PackTwoModule;
  rows: Row[];
  search: string;
  update: (row: Row, changes: Row) => Promise<void>;
  remove: (row: Row) => Promise<void>;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const sorted = useSortedRows(rows, search);
  const [editing, setEditing] = useState<Row | null>(null);
  return (
    <section className="mt-4 border bg-card">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-muted-foreground">
          Manage and sort all {sorted.filtered.length} visible {module.replaceAll("_", " ")} records
        </p>
        <SortControls
          keys={sorted.keys}
          sortKey={sorted.sortKey}
          setSortKey={sorted.setSortKey}
          direction={sorted.direction}
          toggleDirection={sorted.toggleDirection}
        />
      </div>
      <div className="max-h-[70vh] divide-y overflow-y-auto">

        {sorted.filtered.map((row) => (
          <div key={String(row.id)} className="flex items-center gap-3 px-4 py-3">
            <p className="min-w-0 flex-1 truncate text-sm font-medium">
              {String(
                row.title ??
                  row.course_name ??
                  row.competency_name ??
                  row.objective ??
                  row.reference ??
                  "Record",
              )}
            </p>
            <RowActions
              row={row}
              onEdit={setEditing}
              onDelete={remove}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          </div>
        ))}
      </div>
      <EditRecordDialog
        row={editing}
        open={!!editing}
        setOpen={(open) => !open && setEditing(null)}
        save={async (changes) => {
          if (editing) await update(editing, changes);
        }}
      />
    </section>
  );
}

function Toolbar({
  search,
  setSearch,
  count,
  placeholder,
}: {
  search: string;
  setSearch: (value: string) => void;
  count: number;
  placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center">
      <div className="relative max-w-md flex-1">
        <Search className="absolute left-3 top-2.5 text-muted-foreground" />
        <Input
          className="pl-9"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={placeholder}
        />
      </div>
      <p className="text-sm text-muted-foreground">{count} records</p>
    </div>
  );
}

function FilterSortBar({
  statusFilter,
  setStatusFilter,
  statusOptions,
  sortBy,
  setSortBy,
  sortOptions,
  onReset,
  statusLabel = "Status",
}: {
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  statusOptions: string[];
  sortBy: string;
  setSortBy: (value: string) => void;
  sortOptions: Array<{ value: string; label: string }>;
  onReset: () => void;
  statusLabel?: string;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-3 text-sm"
      data-export-hide
    >
      <label className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {statusLabel}
        </span>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm capitalize"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">All</option>
          {statusOptions.map((option) => (
            <option key={option} value={option} className="capitalize">
              {option.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sort by
        </span>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <Button size="sm" variant="ghost" onClick={onReset}>
        Reset
      </Button>
    </div>
  );
}



function InspectionRegister({
  rows,
  checklist,
  loading,
  search,
  setSearch,
  advance,
  canEdit,
  canDelete,
  canApprove,
}: {
  rows: Row[];
  checklist: Row[];
  loading: boolean;
  search: string;
  setSearch: (value: string) => void;
  advance: (row: Row, next: string) => Promise<void>;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date-desc");
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = rows.filter((row) => {
      if (q && !JSON.stringify(row).toLowerCase().includes(q)) return false;
      if (statusFilter !== "all" && String(row.status) !== statusFilter) return false;
      return true;
    });
    const flowOrder = (s: string) => inspectionFlow.indexOf(s);
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case "date-desc":
          return String(b.scheduled_on ?? "").localeCompare(String(a.scheduled_on ?? ""));
        case "date-asc":
          return String(a.scheduled_on ?? "").localeCompare(String(b.scheduled_on ?? ""));
        case "title-asc":
          return String(a.title ?? "").localeCompare(String(b.title ?? ""));
        case "title-desc":
          return String(b.title ?? "").localeCompare(String(a.title ?? ""));
        case "status":
          return flowOrder(String(a.status)) - flowOrder(String(b.status));
        default:
          return 0;
      }
    });
  }, [rows, search, statusFilter, sortBy]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [evidence, setEvidence] = useState<Row | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={exportRef} className="border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
        <p className="text-sm text-muted-foreground">
          Inspection register · {filtered.length} records
        </p>
        <ReportActions
          targetRef={exportRef}
          fileName="inspections-register"
          title="Inspection register"
          subtitle={`${filtered.length} inspections · Generated ${new Date().toLocaleDateString()}`}
          module="inspections"
        />
      </div>
      <Toolbar
        search={search}
        setSearch={setSearch}
        count={filtered.length}
        placeholder="Search inspections…"
      />
      <FilterSortBar
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        statusOptions={inspectionFlow}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortOptions={[
          { value: "date-desc", label: "Scheduled (newest)" },
          { value: "date-asc", label: "Scheduled (oldest)" },
          { value: "title-asc", label: "Title (A–Z)" },
          { value: "title-desc", label: "Title (Z–A)" },
          { value: "status", label: "Workflow status" },
        ]}
        onReset={() => {
          setStatusFilter("all");
          setSortBy("date-desc");
        }}
      />
      {loading ? (
        <Loading />
      ) : filtered.length ? (
        <div className="divide-y">

          {filtered.map((row) => {
            const items = checklist.filter((item) => item.inspection_id === row.id);
            const fails = items.filter((item) => item.result === "fail").length;
            const next = inspectionFlow[inspectionFlow.indexOf(String(row.status)) + 1];
            return (
              <div
                key={String(row.id)}
                role="button"
                tabIndex={0}
                onClick={() => setDetail(row)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setDetail(row);
                  }
                }}
                className="grid cursor-pointer gap-4 px-5 py-5 transition hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary lg:grid-cols-[minmax(0,1fr)_160px_150px_minmax(280px,max-content)] lg:items-center"
              >
                <div>
                  <p className="font-semibold">{String(row.title)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {String(row.reference)} · {String(row.inspection_type).replaceAll("_", " ")} ·{" "}
                    {String(row.area)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold">{items.length} checklist items</p>
                  <p className={`text-xs ${fails ? "text-destructive" : "text-muted-foreground"}`}>
                    {fails} non-conformances
                  </p>
                </div>
                <div>
                  <p className="text-sm">{String(row.scheduled_on)}</p>
                  <Status value={String(row.status)} />
                </div>
                <div className="text-right" onClick={(event) => event.stopPropagation()}>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button size="sm" variant="safety" className="shrink-0" onClick={() => setEvidence(row)}>
                      <Eye />
                      Photos
                    </Button>
                    <Button size="sm" variant="ghost" className="shrink-0" onClick={() => setSelected(row)}>
                      <Eye />
                      Review
                    </Button>
                    {next && canApprove ? (
                      <Button size="sm" variant="outline" className="shrink-0" onClick={() => advance(row, next)}>
                        Move to {next.replaceAll("_", " ")}
                        <ChevronRight />
                      </Button>
                    ) : !next ? (
                      <span className="text-xs font-semibold text-success">Inspection closed</span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty text="No inspections match this view.">
          <Button type="button" size="sm" variant="outline" disabled>
            <Eye />
            Photos available on each saved inspection
          </Button>
        </Empty>
      )}
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{String(selected?.title ?? "Inspection review")}</DialogTitle>
            <DialogDescription>
              Review evidence, generate a draft, and approve the official inspection report.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              <EvidencePanel
                module="inspections"
                recordId={String(selected.id)}
                canAdd={canEdit}
                canDelete={canDelete}
                photosOnly
              />
              <InspectionReportPanel
                inspectionId={String(selected.id)}
                canEdit={canEdit}
                canApprove={canApprove}
                showEvidence={false}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={evidence !== null} onOpenChange={(open) => !open && setEvidence(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Inspection photographs</DialogTitle>
            <DialogDescription>
              Upload, preview, or delete private photographic evidence for this inspection.
            </DialogDescription>
          </DialogHeader>
          {evidence && (
            <EvidencePanel
              module="inspections"
              recordId={String(evidence.id)}
              canAdd={canEdit}
              canDelete={canDelete}
              photosOnly
            />
          )}
        </DialogContent>
      </Dialog>
      <RecordDetailDialog
        row={detail}
        open={detail !== null}
        setOpen={(open) => !open && setDetail(null)}
        title="Inspection profile"
        description="Full inspection record. Use Review for evidence or Photos to manage uploads."
      />
    </div>
  );
}

function TrainingRegister({
  rows,
  employees,
  loading,
  search,
  setSearch,
  canEdit,
}: {
  rows: Row[];
  employees: Row[];
  loading: boolean;
  search: string;
  setSearch: (value: string) => void;
  canEdit: boolean;
}) {
  const today = new Date();
  const employee = (id: unknown): string =>
    String(employees.find((item) => item.id === id)?.full_name ?? "Unassigned");

  const enriched: Array<Row & { days: number | null }> = rows.map((row) => {
    const days = row.expires_on
      ? Math.ceil((new Date(String(row.expires_on)).getTime() - today.getTime()) / 86400000)
      : null;
    return { ...row, days };
  });
  const [complianceFilter, setComplianceFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("expires-asc");
  const complianceOf = (days: number | null) => {
    if (days === null) return "no_expiry";
    if (days < 0) return "expired";
    if (days <= 30) return "due_30";
    if (days <= 60) return "due_60";
    if (days <= 90) return "due_90";
    return "compliant";
  };
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = enriched.filter((row) => {
      if (
        q &&
        !JSON.stringify({ ...row, employee: employee(row.employee_id) })
          .toLowerCase()
          .includes(q)
      )
        return false;
      if (complianceFilter !== "all" && complianceOf(row.days) !== complianceFilter) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case "expires-asc":
          return (a.days ?? 9e9) - (b.days ?? 9e9);
        case "expires-desc":
          return (b.days ?? -9e9) - (a.days ?? -9e9);
        case "employee-asc":
          return String(employee(a.employee_id)).localeCompare(String(employee(b.employee_id)));
        case "course-asc":
          return String(a.course_name ?? "").localeCompare(String(b.course_name ?? ""));
        default:
          return 0;
      }
    });
  }, [enriched, search, complianceFilter, sortBy, employees]);
  const exportRef = useRef<HTMLDivElement>(null);
  const [evidence, setEvidence] = useState<Row | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const [bucket, setBucket] = useState<
    | { label: string; rows: Array<Row & { days: number | null }>; description: string }
    | null
  >(null);
  const rowsInRange = (limit: number, lower: number) =>
    enriched.filter((row) => typeof row.days === "number" && row.days <= limit && row.days > lower);
  const buckets = [
    {
      label: "Expired",
      description: "Training that has already passed its expiry date and requires immediate renewal.",
      lower: -100000,
      limit: 0,
    },
    {
      label: "Due in 30 days",
      description: "Training expiring within the next 30 days — schedule refreshers now.",
      lower: 0,
      limit: 30,
    },
    {
      label: "Due in 60 days",
      description: "Training expiring between 31 and 60 days — plan upcoming sessions.",
      lower: 30,
      limit: 60,
    },
    {
      label: "Due in 90 days",
      description: "Training expiring between 61 and 90 days — pipeline visibility.",
      lower: 60,
      limit: 90,
    },
  ];
  return (
    <div ref={exportRef}>
      <div className="mb-3 flex justify-end">
        <ReportActions
          targetRef={exportRef}
          fileName="training-register"
          title="Training & certificates register"
          subtitle={`${filtered.length} records · Generated ${new Date().toLocaleDateString()}`}
          module="training"
        />
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        {buckets.map((item) => {
          const matched = rowsInRange(item.limit, item.lower);
          return (
            <button
              key={item.label}
              type="button"
              className="cursor-pointer border bg-card p-4 text-left transition hover:border-primary hover:shadow-sm"
              onClick={() =>
                setBucket({ label: item.label, rows: matched, description: item.description })
              }
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-2 font-display text-3xl font-bold">{matched.length}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Click to view affected employees</p>
            </button>
          );
        })}
      </div>
      <TrainingExpiryDialog
        bucket={bucket}
        onClose={() => setBucket(null)}
        employee={employee}
      />
      <div className="border bg-card">
        <Toolbar
          search={search}
          setSearch={setSearch}
          count={filtered.length}
          placeholder="Search training and certificates…"
        />
        <FilterSortBar
          statusFilter={complianceFilter}
          setStatusFilter={setComplianceFilter}
          statusOptions={["compliant", "due_90", "due_60", "due_30", "expired", "no_expiry"]}
          sortBy={sortBy}
          setSortBy={setSortBy}
          sortOptions={[
            { value: "expires-asc", label: "Expires (soonest)" },
            { value: "expires-desc", label: "Expires (latest)" },
            { value: "employee-asc", label: "Employee (A–Z)" },
            { value: "course-asc", label: "Course (A–Z)" },
          ]}
          onReset={() => {
            setComplianceFilter("all");
            setSortBy("expires-asc");
          }}
          statusLabel="Compliance"
        />
        {loading ? (
          <Loading />
        ) : (
          <SimpleTable
            headers={["Employee", "Course / provider", "Completed", "Expires", "Compliance", "Proof"]}
            onRowClick={(index) => setDetail(filtered[index])}
            rows={filtered.map((row) => [
              String(employee(row.employee_id)),
              `${String(row.course_name)} · ${String(row.provider ?? "Internal")}`,
              String(row.completed_on ?? "—"),
              String(row.expires_on ?? "No expiry"),
              <Expiry key="expiry" days={row.days as number | null} status={String(row.status)} />,
              <Button
                key="photo"
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setEvidence(row);
                }}
              >
                <Camera /> Photos
              </Button>,
            ])}
          />
        )}
      </div>
      <RecordDetailDialog
        row={detail}
        open={detail !== null}
        setOpen={(open) => !open && setDetail(null)}
        title="Training record profile"
        description="Complete training record. Use Export PDF, Print or Send by email to share on company letterhead."
        exportConfig={{
          module: "training",
          fileName: `training-${String(detail?.id ?? "record")}`,
          title: `Training record — ${String(detail?.course_name ?? "")}`,
          subtitle: `Employee: ${detail ? employee(detail.employee_id) : ""}`,
        }}
      />
      <Dialog open={evidence !== null} onOpenChange={(open) => !open && setEvidence(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Training proof of compliance</DialogTitle>
            <DialogDescription>
              Upload certificates, attendance photos or signed PDFs as proof of training compliance.
            </DialogDescription>
          </DialogHeader>
          {evidence && (
            <EvidencePanel
              module="training"
              recordId={String(evidence.id)}
              canAdd={canEdit}
              canDelete={canEdit}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CompetencyMatrix({
  rows,
  employees,
  loading,
  search,
  setSearch,
  canEdit,
}: {
  rows: Row[];
  employees: Row[];
  loading: boolean;
  search: string;
  setSearch: (value: string) => void;
  canEdit: boolean;
}) {
  const employee = (id: unknown) =>
    employees.find((item) => item.id === id)?.full_name ?? "Unassigned";
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("employee-asc");
  const statusOptions = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((row) => (typeof row.status === "string" ? row.status : ""))
            .filter(Boolean),
        ),
      ).sort(),
    [rows],
  );
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = rows.filter((row) => {
      if (
        q &&
        !JSON.stringify({ ...row, employee: employee(row.employee_id) })
          .toLowerCase()
          .includes(q)
      )
        return false;
      if (statusFilter !== "all" && String(row.status) !== statusFilter) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case "employee-asc":
          return String(employee(a.employee_id)).localeCompare(String(employee(b.employee_id)));
        case "competency-asc":
          return String(a.competency_name ?? "").localeCompare(String(b.competency_name ?? ""));
        case "gap-desc": {
          const gap = (r: Row) =>
            (Number(r.required_level) || 0) - (Number(r.current_level) || 0);
          return gap(b) - gap(a);
        }
        case "status":
          return String(a.status ?? "").localeCompare(String(b.status ?? ""));
        default:
          return 0;
      }
    });
  }, [rows, search, statusFilter, sortBy, employees]);
  const exportRef = useRef<HTMLDivElement>(null);
  const [evidence, setEvidence] = useState<Row | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  return (
    <div ref={exportRef} className="border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <p className="text-sm text-muted-foreground">
          Competency matrix comparing required vs assessed levels.
        </p>
        <ReportActions
          targetRef={exportRef}
          fileName="competency-matrix"
          title="Competency matrix"
          subtitle={`${filtered.length} assessments · Generated ${new Date().toLocaleDateString()}`}
          module="competencies"
        />
      </div>
      <Toolbar
        search={search}
        setSearch={setSearch}
        count={filtered.length}
        placeholder="Search competency matrix…"
      />
      <FilterSortBar
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        statusOptions={statusOptions}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortOptions={[
          { value: "employee-asc", label: "Employee (A–Z)" },
          { value: "competency-asc", label: "Competency (A–Z)" },
          { value: "gap-desc", label: "Largest gap first" },
          { value: "status", label: "Gap status" },
        ]}
        onReset={() => {
          setStatusFilter("all");
          setSortBy("employee-asc");
        }}
        statusLabel="Gap status"
      />
      {loading ? (
        <Loading />
      ) : (
        <SimpleTable
          headers={["Employee", "Competency", "Required", "Current", "Gap status", "Proof"]}
          onRowClick={(index) => setDetail(filtered[index])}
          rows={filtered.map((row) => [
            String(employee(row.employee_id)),
            String(row.competency_name),
            `Level ${String(row.required_level)}`,
            `Level ${String(row.current_level)}`,
            <Status key="status" value={String(row.status)} />,
            <Button
              key="photo"
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setEvidence(row);
              }}
            >
              <Camera /> Photos
            </Button>,
          ])}
        />
      )}
      <RecordDetailDialog
        row={detail}
        open={detail !== null}
        setOpen={(open) => !open && setDetail(null)}
        title="Competency assessment profile"
        description="Complete competency record. Use Export PDF, Print or Send by email to share on company letterhead."
        exportConfig={{
          module: "competencies",
          fileName: `competency-${String(detail?.id ?? "record")}`,
          title: `Competency — ${String(detail?.competency_name ?? "")}`,
          subtitle: `Employee: ${detail ? employee(detail.employee_id) : ""}`,
        }}
      />
      <Dialog open={evidence !== null} onOpenChange={(open) => !open && setEvidence(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Competency proof of compliance</DialogTitle>
            <DialogDescription>
              Upload assessment photos, certificates or signed PDFs as proof of competency.
            </DialogDescription>
          </DialogHeader>
          {evidence && (
            <EvidencePanel
              module="competency"
              recordId={String(evidence.id)}
              canAdd={canEdit}
              canDelete={canEdit}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ObjectivesRegister({
  rows,
  loading,
  search,
  setSearch,
  advance,
  canEdit,
}: {
  rows: Row[];
  loading: boolean;
  search: string;
  setSearch: (value: string) => void;
  advance: (row: Row, next: string) => Promise<void>;
  canEdit: boolean;
}) {
  const [detail, setDetail] = useState<Row | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ragFilter, setRagFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("objective-asc");
  const exportRef = useRef<HTMLDivElement>(null);

  const ragOf = (row: Row) => {
    const a = Number(row.achievement_percent) || 0;
    return a >= 90 ? "green" : a >= 70 ? "amber" : "red";
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = rows.filter((row) => {
      if (q && !JSON.stringify(row).toLowerCase().includes(q)) return false;
      if (statusFilter !== "all" && String(row.status) !== statusFilter) return false;
      if (ragFilter !== "all" && ragOf(row) !== ragFilter) return false;
      return true;
    });
    const ragOrder: Record<string, number> = { red: 0, amber: 1, green: 2 };
    const statusOrder: Record<string, number> = {
      draft: 0,
      active: 1,
      completed: 2,
      closed: 3,
    };
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "objective-asc":
          return String(a.objective ?? "").localeCompare(String(b.objective ?? ""));
        case "objective-desc":
          return String(b.objective ?? "").localeCompare(String(a.objective ?? ""));
        case "achievement-desc":
          return (Number(b.achievement_percent) || 0) - (Number(a.achievement_percent) || 0);
        case "achievement-asc":
          return (Number(a.achievement_percent) || 0) - (Number(b.achievement_percent) || 0);
        case "rag":
          return (ragOrder[ragOf(a)] ?? 9) - (ragOrder[ragOf(b)] ?? 9);
        case "status":
          return (
            (statusOrder[String(a.status)] ?? 9) - (statusOrder[String(b.status)] ?? 9)
          );
        default:
          return 0;
      }
    });
    return sorted;
  }, [rows, search, statusFilter, ragFilter, sortBy]);

  return (
    <div ref={exportRef} id="objectives-targets-dashboard" className="border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <p className="text-sm text-muted-foreground">
          Click an objective to view its trend chart, edit monthly targets and export a PDF report.
        </p>
        <ReportActions
          targetRef={exportRef}
          fileName="objectives-and-targets"
          title="Objectives & Targets dashboard"
          subtitle={`${filtered.length} objectives · Generated ${new Date().toLocaleDateString()}`}
          module="objectives"
        />
      </div>
      <Toolbar
        search={search}
        setSearch={setSearch}
        count={filtered.length}
        placeholder="Search objectives and KPIs…"
      />
      <div
        className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-3 text-sm"
        data-export-hide
      >
        <label className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Status
          </span>
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            RAG
          </span>
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={ragFilter}
            onChange={(e) => setRagFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="green">Green (≥90%)</option>
            <option value="amber">Amber (70–89%)</option>
            <option value="red">Red (&lt;70%)</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Sort by
          </span>
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="objective-asc">Objective (A–Z)</option>
            <option value="objective-desc">Objective (Z–A)</option>
            <option value="achievement-desc">Achievement (high → low)</option>
            <option value="achievement-asc">Achievement (low → high)</option>
            <option value="rag">RAG status (red first)</option>
            <option value="status">Workflow status</option>
          </select>
        </label>
        {(statusFilter !== "all" || ragFilter !== "all" || sortBy !== "objective-asc") && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setStatusFilter("all");
              setRagFilter("all");
              setSortBy("objective-asc");
            }}
          >
            Reset
          </Button>
        )}
      </div>
      <div className="bg-card">

        {loading ? (
          <Loading />
        ) : filtered.length ? (
          <div className="divide-y">
            {filtered.map((row) => {
              const achievement = Number(row.achievement_percent) || 0;
              const derivedRag = ragOf(row);
              const next = objectiveFlow[objectiveFlow.indexOf(String(row.status)) + 1];
              return (
                <div
                  key={String(row.id)}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetail(row)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setDetail(row);
                    }
                  }}
                  className="grid cursor-pointer gap-4 px-5 py-5 transition hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary lg:grid-cols-[1fr_190px_130px_210px] lg:items-center"
                >
                  <div>
                    <p className="font-semibold">{String(row.objective)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {String(row.reference)} · KPI: {String(row.kpi)}
                    </p>
                  </div>
                  <div>
                    <div className="mb-2 flex justify-between text-xs">
                      <span>Achievement</span>
                      <strong>{achievement}%</strong>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full ${derivedRag === "green" ? "bg-success" : derivedRag === "amber" ? "bg-safety" : "bg-destructive"}`}
                        style={{ width: `${Math.max(0, Math.min(100, achievement))}%` }}
                      />
                    </div>
                  </div>
                  <Rag value={derivedRag} />
                  <div className="text-right" onClick={(event) => event.stopPropagation()}>
                    {next ? (
                      <Button size="sm" variant="outline" onClick={() => advance(row, next)}>
                        Move to {next}
                        <ChevronRight />
                      </Button>
                    ) : (
                      <Status value="closed" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty text="No objectives match this view." />
        )}
      </div>
      <ObjectiveDetailDialog
        objective={detail as (Record<string, unknown> & { id: string }) | null}
        open={detail !== null}
        setOpen={(open) => !open && setDetail(null)}
        canEdit={canEdit}
      />
    </div>
  );
}

function PackTwoDialog({
  active,
  open,
  setOpen,
  employees,
  save,
}: {
  active: PackTwoModule;
  open: boolean;
  setOpen: (value: boolean) => void;
  employees: Row[];
  save: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const employeeOptions = employees.map((row) => ({
    value: String(row.id),
    label: String(row.full_name),
  }));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    let payload: Record<string, unknown>;
    if (active === "inspections") {
      const inspectionType = value("type");
      const otherDetails = value("otherTypeDetails");
      const baseSummary = value("notes");
      const mergedSummary =
        inspectionType === "other" && otherDetails
          ? `Other inspection type — specified:\n${otherDetails}${baseSummary ? `\n\n${baseSummary}` : ""}`
          : baseSummary;
      payload = {
        module: active,
        title: value("title"),
        inspectionType,
        site: value("site"),
        department: value("department"),
        area: value("area"),
        scheduledOn: value("date"),
        visitDate: value("visitDate"),
        attendees: value("attendees"),
        findings: value("findings"),
        requiredActions: value("requiredActions"),
        completionNotes: value("completionNotes"),
        inspectorId: value("employee"),
        summary: mergedSummary,
        checklist: value("checklist")
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
      };
    }
    else if (active === "training")
      payload = {
        module: active,
        employeeId: value("employee"),
        courseName: value("title"),
        provider: value("provider"),
        completedOn: value("completed"),
        expiresOn: value("expires"),
        certificateReference: value("certificate"),
        status: value("status"),
        notes: value("notes"),
      };
    else if (active === "competencies")
      payload = {
        module: active,
        employeeId: value("employee"),
        competencyName: value("title"),
        requiredLevel: Number(value("required")),
        currentLevel: Number(value("current")),
        assessor: value("assessor"),
        assessedOn: value("completed"),
        expiresOn: value("expires"),
        evidence: value("notes"),
      };
    else
      payload = {
        module: active,
        objective: value("title"),
        kpi: value("kpi"),
        baseline: Number(value("baseline")),
        target: Number(value("target")),
        currentPerformance: Number(value("current")),
        direction: value("direction"),
        ownerId: value("employee"),
        reviewDate: value("date"),
        notes: value("notes"),
      };
    try {
      await save(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The record could not be saved.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{definitions[active].action}</DialogTitle>
          <DialogDescription>
            Complete the required fields to add this Module Pack 2 record.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field
            label={
              active === "objectives"
                ? "Objective"
                : active === "competencies"
                  ? "Competency"
                  : active === "training"
                    ? "Course name"
                    : "Inspection title"
            }
            name="title"
            required
            wide
          />
          {active === "inspections" && (
            <>
              <SelectField
                label="Inspection type"
                name="type"
                options={["workplace", "field_site", "vehicle", "warehouse", "office", "ppe", "fire_safety", "other"]}

                required
              />
              <TextField
                label="Specify inspection type & scope (required only if 'Other' selected — use bullet points)"
                name="otherTypeDetails"
              />

              <Field label="Scheduled date" name="date" type="date" required />
              <Field label="Visit date" name="visitDate" type="date" />
              <Field label="Site" name="site" defaultValue="Thika" required />
              <Field label="Department" name="department" required />
              <Field label="Area" name="area" required />
              <TextField label="Attendees" name="attendees" />
              <TextField label="Visit findings" name="findings" />
              <TextField label="Required actions" name="requiredActions" />
              <TextField label="Completion notes" name="completionNotes" />
            </>
          )}
          {active !== "inspections" && (
            <SelectField
              label={active === "objectives" ? "Owner" : "Employee"}
              name="employee"
              options={employeeOptions}
              required={active !== "objectives"}
            />
          )}
          {active === "inspections" && (
            <SelectField label="Inspector" name="employee" options={employeeOptions} />
          )}
          {active === "training" && (
            <>
              <Field label="Provider" name="provider" />
              <SelectField
                label="Status"
                name="status"
                options={["planned", "scheduled", "completed"]}
                required
              />
              <Field label="Completed on" name="completed" type="date" />
              <Field label="Expires on" name="expires" type="date" />
              <Field label="Certificate reference" name="certificate" />
            </>
          )}
          {active === "competencies" && (
            <>
              <SelectField
                label="Required level"
                name="required"
                options={["1", "2", "3", "4", "5"]}
                required
              />
              <SelectField
                label="Current level"
                name="current"
                options={["1", "2", "3", "4", "5"]}
                required
              />
              <SelectField label="Assessor" name="assessor" options={employeeOptions} />
              <Field label="Assessed on" name="completed" type="date" />
              <Field label="Expires on" name="expires" type="date" />
            </>
          )}
          {active === "objectives" && (
            <>
              <Field label="KPI" name="kpi" required />
              <SelectField
                label="Improvement direction"
                name="direction"
                options={["increase", "decrease"]}
                required
              />
              <Field label="Baseline" name="baseline" type="number" required />
              <Field label="Target" name="target" type="number" required />
              <Field label="Current performance" name="current" type="number" required />
              <Field label="Review date" name="date" type="date" required />
            </>
          )}
          {active === "inspections" && (
            <TextField label="Checklist items (one per line)" name="checklist" required />
          )}
          <TextField
            label={
              active === "competencies"
                ? "Evidence"
                : active === "inspections"
                  ? "Inspection scope / summary"
                  : "Notes"
            }
            name="notes"
          />
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

function SimpleTable({
  headers,
  rows,
  onRowClick,
}: {
  headers: string[];
  rows: Array<Array<string | ReactNode>>;
  onRowClick?: (index: number) => void;
}) {
  return rows.length ? (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">


          <tr>
            {headers.map((header) => (
              <th key={header} className="px-5 py-3">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, index) => (
            <tr
              key={index}
              onClick={onRowClick ? () => onRowClick(index) : undefined}
              className={onRowClick ? "cursor-pointer transition hover:bg-muted/40" : undefined}
            >
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-5 py-4">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty text="No records match this view." />
  );
}
function Field({
  label,
  name,
  type = "text",
  required = false,
  wide = false,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  wide?: boolean;
  defaultValue?: string;
}) {
  return (
    <div className={`space-y-2 ${wide ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={`p2-${name}`}>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input
        id={`p2-${name}`}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        maxLength={type === "text" ? 500 : undefined}
      />
    </div>
  );
}
function TextField({
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
      <Label htmlFor={`p2-${name}`}>
        {label}
        {required ? " *" : ""}
      </Label>
      <BulletTextarea id={`p2-${name}`} name={name} required={required} maxLength={4000} />
    </div>
  );
}
function SelectField({
  label,
  name,
  options,
  required = false,
}: {
  label: string;
  name: string;
  options: Array<string | { value: string; label: string }>;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`p2-${name}`}>
        {label}
        {required ? " *" : ""}
      </Label>
      <select
        id={`p2-${name}`}
        name={name}
        required={required}
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
function Status({ value }: { value: string }) {
  const good = ["closed", "completed", "competent", "active"].includes(value);
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${good ? "bg-success/15 text-success" : value === "gap" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}
function Rag({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase ${value === "green" ? "bg-success/15 text-success" : value === "amber" ? "bg-safety/25 text-safety-foreground" : "bg-destructive/10 text-destructive"}`}
    >
      <span className="size-2 rounded-full bg-current" />
      {value}
    </span>
  );
}
function Expiry({ days, status }: { days: number | null; status: string }) {
  if (days === null) return <Status value={status} />;
  if (days < 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive">
        <AlertTriangle />
        Expired
      </span>
    );
  if (days <= 90)
    return (
      <span className={`text-xs font-semibold ${days <= 30 ? "text-destructive" : "text-warning"}`}>
        {days} days remaining
      </span>
    );
  return <span className="text-xs font-semibold text-success">Valid · {days} days</span>;
}
function Loading() {
  return <div className="p-14 text-center text-muted-foreground">Loading Module Pack 2…</div>;
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

function TrainingExpiryDialog({
  bucket,
  onClose,
  employee,
}: {
  bucket: { label: string; rows: Array<Row & { days: number | null }>; description: string } | null;
  onClose: () => void;
  employee: (id: unknown) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  if (!bucket) return null;
  return (
    <Dialog open={bucket !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{bucket.label} — affected employees ({bucket.rows.length})</DialogTitle>
          <DialogDescription>{bucket.description}</DialogDescription>
        </DialogHeader>
        <div className="mb-3 flex justify-end" data-export-hide>
          <ReportActions
            targetRef={ref}
            fileName={`training-${bucket.label.toLowerCase().replace(/\s+/g, "-")}`}
            title={`Training — ${bucket.label}`}
            subtitle={`${bucket.rows.length} record(s) · Generated ${new Date().toLocaleDateString()}`}
            module="training"
          />
        </div>
        <div ref={ref} className="space-y-3 text-sm">
          {bucket.rows.length === 0 ? (
            <p className="text-muted-foreground">No employees in this bucket. Nothing to action.</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3">Employee</th>
                  <th className="py-2 pr-3">Course</th>
                  <th className="py-2 pr-3">Provider</th>
                  <th className="py-2 pr-3">Expires</th>
                  <th className="py-2">Days</th>
                </tr>
              </thead>
              <tbody>
                {bucket.rows.map((row) => (
                  <tr key={String(row.id)} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{employee(row.employee_id)}</td>
                    <td className="py-2 pr-3">{String(row.course_name ?? "—")}</td>
                    <td className="py-2 pr-3">{String(row.provider ?? "Internal")}</td>
                    <td className="py-2 pr-3">{String(row.expires_on ?? "—")}</td>
                    <td className="py-2">
                      {row.days === null
                        ? "—"
                        : row.days < 0
                          ? `${Math.abs(row.days)} overdue`
                          : `${row.days} left`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
