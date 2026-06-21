import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  getObjectiveMonthlyProgress,
  upsertObjectiveMonthlyProgress,
} from "@/lib/objective-progress.functions";
import { ReportActions } from "@/components/report-actions";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

type ProgressRow = {
  id: string;
  objective_id: string;
  year: number;
  month: number;
  target_value: number | null;
  actual_value: number | null;
  notes: string | null;
};

type ObjectiveRow = Record<string, unknown> & { id: string };

export function ObjectiveDetailDialog({
  objective,
  open,
  setOpen,
  canEdit,
}: {
  objective: ObjectiveRow | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const fetchProgress = useServerFn(getObjectiveMonthlyProgress);
  const saveProgress = useServerFn(upsertObjectiveMonthlyProgress);
  const [year, setYear] = useState(new Date().getFullYear());
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  const exportRef = useRef<HTMLDivElement>(null);

  const objectiveId = objective?.id ?? "";
  const queryKey = ["objective-progress", objectiveId, year];
  const { data } = useQuery({
    queryKey,
    enabled: Boolean(objectiveId) && open,
    queryFn: () => fetchProgress({ data: { objectiveId, year } }) as Promise<ProgressRow[]>,
  });
  const rows = useMemo<ProgressRow[]>(() => data ?? [], [data]);

  const defaultTarget = Number(objective?.target ?? 0);
  const monthly = useMemo(() => {
    return MONTHS.map((label, index) => {
      const month = index + 1;
      const row = rows.find((entry) => entry.month === month);
      return {
        month,
        label,
        target: row?.target_value ?? defaultTarget,
        actual: row?.actual_value ?? null,
      };
    });
  }, [rows, defaultTarget]);

  const totals = useMemo(() => {
    const totalTarget = monthly.reduce((sum, row) => sum + (row.target ?? 0), 0);
    const actualValues = monthly
      .map((row) => row.actual)
      .filter((value): value is number => value !== null);
    const totalActual = actualValues.reduce((sum, value) => sum + value, 0);
    const avgTarget = totalTarget / 12;
    const avgActual = actualValues.length ? totalActual / actualValues.length : 0;
    const achievement = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;
    return { totalTarget, totalActual, avgTarget, avgActual, achievement };
  }, [monthly]);

  // Local form draft for editing
  const [draft, setDraft] = useState<Record<number, { target: string; actual: string }>>({});
  useEffect(() => {
    const next: Record<number, { target: string; actual: string }> = {};
    monthly.forEach((row) => {
      next[row.month] = {
        target: row.target === null || row.target === undefined ? "" : String(row.target),
        actual: row.actual === null || row.actual === undefined ? "" : String(row.actual),
      };
    });
    setDraft(next);
  }, [rows, year, defaultTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  async function commitMonth(month: number) {
    if (!objectiveId) return;
    setBusy(month);
    setError("");
    try {
      const entry = draft[month] ?? { target: "", actual: "" };
      const targetValue = entry.target === "" ? null : Number(entry.target);
      const actualValue = entry.actual === "" ? null : Number(entry.actual);
      if (
        (targetValue !== null && !Number.isFinite(targetValue)) ||
        (actualValue !== null && !Number.isFinite(actualValue))
      ) {
        throw new Error("Enter valid numbers.");
      }
      await saveProgress({
        data: { objectiveId, year, month, targetValue, actualValue },
      });
      await queryClient.invalidateQueries({ queryKey });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{String(objective?.objective ?? "Objective")}</DialogTitle>
          <DialogDescription>
            Trend chart, monthly targets vs actual performance, totals and averages for the year.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Year</label>
              <Input
                type="number"
                value={year}
                onChange={(event) => setYear(Number(event.target.value) || year)}
                className="h-9 w-28"
                min={2000}
                max={2100}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              KPI: <strong className="text-foreground">{String(objective?.kpi ?? "—")}</strong>
            </div>
          </div>
          <ReportActions
            targetRef={exportRef}
            fileName={`objective-${String(objective?.reference ?? objective?.id ?? "report")}`}
            title={String(objective?.objective ?? "Objective trend")}
            subtitle={`Year ${year} · Generated ${new Date().toLocaleDateString()}`}
            module="objectives"
          />
        </div>

        <div ref={exportRef} className="mx-auto w-full max-w-[820px] space-y-5 bg-background p-4">
          <section data-pdf-section className="rounded-md border bg-card p-4">

            <h3 className="mb-3 font-semibold">Target vs actual — {year}</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthly} margin={{ left: 0, right: 12, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="target" name="Target" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name="Actual"
                    stroke="var(--chart-2)"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section data-pdf-section className="rounded-md border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Month</th>
                    <th className="px-2 py-2 text-center">Target</th>
                    <th className="px-2 py-2 text-center">Actual</th>
                    <th className="px-3 py-2">Variance</th>
                    <th className="px-3 py-2">Achievement</th>
                    {canEdit && <th className="px-3 py-2 text-right">Save</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {monthly.map((row) => {
                    const entry = draft[row.month] ?? { target: "", actual: "" };
                    const variance =
                      row.actual !== null && row.target !== null
                        ? Number(row.actual) - Number(row.target)
                        : null;
                    const achievement =
                      row.actual !== null && row.target !== null && row.target !== 0
                        ? Math.round((Number(row.actual) / Number(row.target)) * 100)
                        : null;
                    return (
                      <tr key={row.month}>
                        <td className="px-3 py-2 font-semibold">{row.label}</td>
                        <td className="px-2 py-2 text-center">
                          {canEdit ? (
                            <Input
                              type="number"
                              step="any"
                              value={entry.target}
                              onChange={(event) =>
                                setDraft((current) => ({
                                  ...current,
                                  [row.month]: { ...entry, target: event.target.value },
                                }))
                              }
                              className="h-8 w-28 text-center text-[11px] tabular-nums"
                            />
                          ) : (
                            <span className="text-[11px] tabular-nums">{row.target ?? "—"}</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center">
                          {canEdit ? (
                            <Input
                              type="number"
                              step="any"
                              value={entry.actual}
                              onChange={(event) =>
                                setDraft((current) => ({
                                  ...current,
                                  [row.month]: { ...entry, actual: event.target.value },
                                }))
                              }
                              className="h-8 w-28 text-center text-[11px] tabular-nums"
                            />
                          ) : (
                            <span className="text-[11px] tabular-nums">{row.actual ?? "—"}</span>
                          )}
                        </td>
                        <td
                          className={`px-3 py-2 ${
                            variance !== null && variance < 0 ? "text-destructive" : ""
                          }`}
                        >
                          {variance === null ? "—" : variance.toFixed(2)}
                        </td>
                        <td className="px-3 py-2">{achievement === null ? "—" : `${achievement}%`}</td>
                        {canEdit && (
                          <td className="px-3 py-2 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy === row.month}
                              onClick={() => commitMonth(row.month)}
                            >
                              {busy === row.month ? "Saving…" : "Save"}
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-muted/40 text-sm font-semibold">
                  <tr>
                    <td className="px-3 py-2">Total</td>
                    <td className="px-2 py-2 text-center text-[11px] tabular-nums">{totals.totalTarget.toFixed(2)}</td>
                    <td className="px-2 py-2 text-center text-[11px] tabular-nums">{totals.totalActual.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      {(totals.totalActual - totals.totalTarget).toFixed(2)}
                    </td>
                    <td className="px-3 py-2">{totals.achievement}%</td>
                    {canEdit && <td />}
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Average</td>
                    <td className="px-2 py-2 text-center text-[11px] tabular-nums">{totals.avgTarget.toFixed(2)}</td>
                    <td className="px-2 py-2 text-center text-[11px] tabular-nums">{totals.avgActual.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      {(totals.avgActual - totals.avgTarget).toFixed(2)}
                    </td>
                    <td className="px-3 py-2">—</td>
                    {canEdit && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
