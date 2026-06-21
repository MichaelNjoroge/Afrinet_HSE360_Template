// Minimal client-side CSV export — no extra dependency.

export type CsvColumn<Row> = {
  key: keyof Row | string;
  label: string;
  format?: (row: Row) => string | number | null | undefined;
};

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "string" ? value : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function rowsToCsv<Row extends Record<string, unknown>>(
  rows: Row[],
  columns: CsvColumn<Row>[],
): string {
  const header = columns.map((c) => escapeCell(c.label)).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((c) => escapeCell(c.format ? c.format(row) : (row as Record<string, unknown>)[c.key as string]))
        .join(","),
    )
    .join("\n");
  // BOM so Excel opens UTF-8 correctly
  return `\uFEFF${header}\n${body}`;
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
