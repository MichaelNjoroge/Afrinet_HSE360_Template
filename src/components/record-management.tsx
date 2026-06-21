import React, { useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowDownAZ, ArrowUpAZ, Camera, Pencil, Trash2 } from "lucide-react";
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
import { isUuid, useEmployeeNames } from "@/lib/employee-display";
import { ReportActions } from "@/components/report-actions";

export type ManagedRow = Record<string, unknown>;
const excluded = new Set([
  "id",
  "created_at",
  "updated_at",
  "created_by",
  "reported_by",
  "observed_by",
  "reference",
  "audit_number",
  "status",
  "risk_score",
  "risk_rating",
  "residual_score",
  "residual_rating",
  "significance_score",
  "significance_rating",
  "achievement_percent",
  "rag_status",
  "verified_by",
  "verified_at",
]);

export function useSortedRows(
  rows: ManagedRow[],
  search: string,
  options?: { statusKey?: string },
) {
  const statusKey = options?.statusKey ?? "status";
  const [sortKey, setSortKey] = useState("updated_at");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const statusOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const row of rows) {
      const value = row[statusKey];
      if (typeof value === "string" && value.trim()) seen.add(value);
    }
    return Array.from(seen).sort();
  }, [rows, statusKey]);
  const filtered = useMemo(
    () =>
      rows
        .filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()))
        .filter((row) => statusFilter === "all" || String(row[statusKey] ?? "") === statusFilter)
        .sort((a, b) => {
          const left = String(a[sortKey] ?? "");
          const right = String(b[sortKey] ?? "");
          return (
            left.localeCompare(right, undefined, { numeric: true }) * (direction === "asc" ? 1 : -1)
          );
        }),
    [rows, search, sortKey, direction, statusFilter, statusKey],
  );
  const keys = useMemo(
    () =>
      Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
        .filter((key) => !["id"].includes(key))
        .slice(0, 40),
    [rows],
  );
  return {
    filtered,
    sortKey,
    setSortKey,
    direction,
    toggleSort: (key: string) => {
      if (key === sortKey) setDirection((value) => (value === "asc" ? "desc" : "asc"));
      else {
        setSortKey(key);
        setDirection("asc");
      }
    },
    toggleDirection: () => setDirection((value) => (value === "asc" ? "desc" : "asc")),
    keys,
    statusFilter,
    setStatusFilter,
    statusOptions,
  };
}

export function StatusFilter({
  value,
  options,
  onChange,
  label = "Status",
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  label?: string;
}) {
  if (options.length === 0) return null;
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <select
        aria-label={`Filter by ${label.toLowerCase()}`}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm capitalize"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option} value={option} className="capitalize">
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SortableHeader({
  column,
  sortKey,
  direction,
  onSort,
}: {
  column: string;
  sortKey: string;
  direction: "asc" | "desc";
  onSort: (column: string) => void;
}) {
  const active = sortKey === column;
  return (
    <th
      className="px-5 py-3"
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 font-bold uppercase tracking-wider"
        onClick={() => onSort(column)}
        aria-label={`Sort by ${column.replaceAll("_", " ")}${active ? `, currently ${direction === "asc" ? "ascending" : "descending"}` : ""}`}
      >
        {column.replaceAll("_", " ")}
        {active && (direction === "asc" ? <ArrowUpAZ /> : <ArrowDownAZ />)}
      </Button>
    </th>
  );
}

export function SortControls({
  keys,
  sortKey,
  setSortKey,
  direction,
  toggleDirection,
}: {
  keys: string[];
  sortKey: string;
  setSortKey: (key: string) => void;
  direction: "asc" | "desc";
  toggleDirection: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Sort records by"
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        value={sortKey}
        onChange={(event) => setSortKey(event.target.value)}
      >
        <option value="updated_at">Last updated</option>
        {keys
          .filter((key) => key !== "updated_at")
          .map((key) => (
            <option key={key} value={key}>
              {key.replaceAll("_", " ")}
            </option>
          ))}
      </select>
      <Button
        size="icon"
        variant="outline"
        onClick={toggleDirection}
        aria-label={`Sort ${direction === "asc" ? "descending" : "ascending"}`}
      >
        {direction === "asc" ? <ArrowDownAZ /> : <ArrowUpAZ />}
      </Button>
    </div>
  );
}

export function RowActions({
  row,
  onEdit,
  onDelete,
  onEvidence,
  evidenceLabel = "Photos",
  canEdit = true,
  canDelete = true,
}: {
  row: ManagedRow;
  onEdit: (row: ManagedRow) => void;
  onDelete: (row: ManagedRow) => Promise<void>;
  onEvidence?: (row: ManagedRow) => void;
  evidenceLabel?: string;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {onEvidence && (
        <Button
          size="sm"
          variant="safety"
          onClick={() => onEvidence(row)}
          aria-label={`Open ${evidenceLabel.toLowerCase()}`}
        >
          <Camera />
          {evidenceLabel}
        </Button>
      )}
      {canEdit && (
        <Button size="icon" variant="ghost" onClick={() => onEdit(row)} aria-label="Edit record">
          <Pencil />
        </Button>
      )}
      {canDelete && (
        <Button
          size="icon"
          variant="ghost"
          className="text-destructive"
          disabled={busy}
          onClick={async () => {
            if (
              !window.confirm(
                "Delete this record permanently? Administrators and HR Managers may delete any record; other users may delete only their latest entry.",
              )
            )
              return;
            setBusy(true);
            try {
              await onDelete(row);
            } finally {
              setBusy(false);
            }
          }}
          aria-label="Delete record"
        >
          <Trash2 />
        </Button>
      )}
    </div>
  );
}

export function EditRecordDialog({
  row,
  open,
  setOpen,
  save,
}: {
  row: ManagedRow | null;
  open: boolean;
  setOpen: (value: boolean) => void;
  save: (changes: ManagedRow) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { resolve } = useEmployeeNames();
  const fields = row
    ? Object.entries(row)
        .filter(
          ([key, value]) =>
            !excluded.has(key) &&
            (typeof value === "string" ||
              typeof value === "number" ||
              typeof value === "boolean" ||
              value === null),
        )
        .slice(0, 36)
    : [];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!row) return;
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const changes: ManagedRow = {};
    fields.forEach(([key, original]) => {
      // Preserve UUID identifiers — the visible field shows a resolved name
      // but the form must save the original ID so foreign-key references stay valid.
      if (isUuid(original)) {
        changes[key] = original;
        return;
      }
      const raw = String(form.get(key) ?? "").trim();
      changes[key] =
        typeof original === "number"
          ? Number(raw)
          : typeof original === "boolean"
            ? raw === "true"
            : raw || null;
    });
    try {
      await save(changes);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The record could not be updated.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit record</DialogTitle>
          <DialogDescription>
            Update the operational details below. Workflow status remains controlled separately.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          {fields.map(([key, value]) => {
            const employeeName = resolve(value);
            const displayValue = employeeName ?? (value == null
              ? ""
              : String(value).slice(
                  0,
                  key.includes("date") || key.endsWith("_on") ? 10 : undefined,
                ));
            return (
            <div key={key} className="space-y-2">
              <Label htmlFor={`edit-${key}`}>
                {key.replaceAll("_", " ")}
                {employeeName && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    (employee name shown — original ID preserved on save)
                  </span>
                )}
              </Label>
              <Input
                id={`edit-${key}`}
                name={key}
                type={
                  employeeName
                    ? "text"
                    : typeof value === "number"
                    ? "number"
                    : key.includes("date") || key.endsWith("_on")
                      ? "date"
                      : "text"
                }
                readOnly={!!employeeName}
                defaultValue={displayValue}
                data-original-value={employeeName ? String(value ?? "") : undefined}
              />
            </div>
            );
          })}
          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const DETAIL_HIDDEN = new Set(["id", "created_by"]);

function formatDetailValue(key: string, value: unknown, resolve: (raw: unknown) => string | null) {
  if (value === null || value === undefined || value === "") return "—";
  const employeeName = resolve(value);
  if (employeeName) return employeeName;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return str.replace("T", " ").slice(0, 16);
  if (key.includes("date") || key.endsWith("_at") || key.endsWith("_on")) {
    return str.slice(0, 10);
  }
  return str.replaceAll("_", " ");
}

export function RecordDetailDialog({
  row,
  open,
  setOpen,
  title = "Record profile",
  description = "Complete profile of this record. Use Modify to make changes.",
  extra,
  exportConfig,
}: {
  row: ManagedRow | null;
  open: boolean;
  setOpen: (value: boolean) => void;
  title?: string;
  description?: string;
  extra?: React.ReactNode;
  exportConfig?: {
    module: string;
    fileName: string;
    title: string;
    subtitle?: string;
  };
}) {
  const { resolve } = useEmployeeNames();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const entries = row
    ? Object.entries(row).filter(([key]) => !DETAIL_HIDDEN.has(key))
    : [];
  const headline =
    (row?.title as string) ??
    (row?.reference as string) ??
    (row?.audit_number as string) ??
    (row?.activity as string) ??
    (row?.description as string)?.slice(0, 80) ??
    "Record";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {row && (
          <div className="space-y-5">
            <div ref={contentRef} data-pdf-section className="space-y-5">
              <div className="border-l-4 border-primary bg-muted/40 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {String(row.reference ?? row.audit_number ?? row.status ?? "Profile")}
                </p>
                <p className="mt-1 text-lg font-semibold">{String(headline)}</p>
              </div>
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {entries.map(([key, value]) => (
                  <div key={key} className="min-w-0">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {key.replaceAll("_", " ")}
                    </dt>
                    <dd className="mt-1 break-words text-sm font-medium capitalize">
                      {formatDetailValue(key, value, resolve)}
                    </dd>
                  </div>
                ))}
              </dl>
              {extra}
            </div>
            {exportConfig && (
              <div className="border-t pt-3" data-export-hide>
                <ReportActions
                  targetRef={contentRef}
                  fileName={exportConfig.fileName}
                  title={exportConfig.title}
                  subtitle={exportConfig.subtitle}
                  module={exportConfig.module}
                />
              </div>
            )}
            <div className="flex justify-end border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
