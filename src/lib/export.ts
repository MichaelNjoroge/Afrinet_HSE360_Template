export type ExportRow = Record<string, unknown>;

export type ExportOptions = {
  /** Optional id → human name lookup (employees, users). Any cell whose
   *  value matches a key here is replaced with the resolved name so CSV
   *  exports display real names instead of UUIDs. */
  nameLookup?: Map<string, string> | Record<string, string>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveLookup(lookup: ExportOptions["nameLookup"]) {
  if (!lookup) return null;
  if (lookup instanceof Map) return (id: string) => lookup.get(id) ?? null;
  return (id: string) => lookup[id] ?? null;
}

const clean = (value: unknown, resolve: ((id: string) => string | null) | null) => {
  if (value == null) return "";
  if (typeof value === "string" && resolve && UUID_RE.test(value)) {
    const name = resolve(value);
    if (name) return name;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export function exportRowsToCsv(
  fileName: string,
  rows: ExportRow[],
  options: ExportOptions = {},
) {
  if (!rows.length) return false;
  const resolve = resolveLookup(options.nameLookup);
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const escape = (value: unknown) => `"${clean(value, resolve).replaceAll('"', '""')}"`;
  const csv = [
    columns.map((c) => `"${c}"`).join(","),
    ...rows.map((row) => columns.map((key) => escape(row[key])).join(",")),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

export const downloadCSV = exportRowsToCsv;
