import { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ReportActions } from "@/components/report-actions";
import type { HseKpiSnapshot } from "@/lib/hse-kpis.functions";

export type KpiSection = "safety" | "incidents" | "capa" | "objectives" | "training" | "environment";

const TITLES: Record<KpiSection, string> = {
  safety: "Safety performance — detailed profile",
  incidents: "Incident trend — detailed profile",
  capa: "CAPA closure — detailed profile",
  objectives: "HSE objectives — detailed profile",
  training: "Training compliance — detailed profile",
  environment: "Environmental intensity — detailed profile",
};

function fmtMonth(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", year: "numeric" });
}


function SectionBody({ section, snap }: { section: KpiSection; snap: HseKpiSnapshot }) {
  switch (section) {
    case "safety":
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="LTIFR" value={snap.safety.ltifr} unit="per 1M hrs" />
            <Metric label="TRIR" value={snap.safety.trir} unit="per 200k hrs" />
            <Metric label="Severity rate" value={snap.safety.severityRate} unit="per 200k hrs" />
            <Metric label="Critical events" value={snap.safety.fatalitiesProxy} />
            <Metric label="Lost-time injuries" value={snap.safety.lostTimeInjuries} />
            <Metric label="Recordable injuries" value={snap.safety.recordableInjuries} />
            <Metric label="Total incidents" value={snap.safety.incidentsTotal} />
            <Metric label="Near-misses" value={snap.nearMissRatio.nearMisses} />
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium">How it's calculated</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>LTIFR = lost-time injuries × 1,000,000 ÷ hours worked</li>
              <li>TRIR = recordable injuries × 200,000 ÷ hours worked</li>
              <li>Severity rate = LTI × 200,000 ÷ hours worked (proxy)</li>
              <li>
                Hours worked = {snap.workforce.activeEmployees} active employees × 2,000 hrs/yr ×{" "}
                {snap.windowMonths / 12} yr = {snap.workforce.estimatedHoursWorked.toLocaleString()} hrs
              </li>
            </ul>
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium">What good looks like</p>
            <p className="mt-1 text-muted-foreground">
              Benchmark targets: LTIFR &lt; 1, TRIR &lt; 1, near-miss ratio ≥ 10:1. Investigate any
              critical-severity event individually.
            </p>
          </div>
        </div>
      );
    case "incidents":
      return (
        <div className="space-y-3">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-2 py-1.5">Month</th>
                <th className="px-2 py-1.5 text-right">Total</th>
                <th className="px-2 py-1.5 text-right">Low</th>
                <th className="px-2 py-1.5 text-right">Moderate</th>
                <th className="px-2 py-1.5 text-right">High</th>
                <th className="px-2 py-1.5 text-right">Critical</th>
                <th className="px-2 py-1.5 text-right">Near-miss</th>
              </tr>
            </thead>
            <tbody>
              {snap.incidentTrend.map((m) => (
                <tr key={m.month} className="border-t">
                  <td className="px-2 py-1.5">{fmtMonth(m.month)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{m.total}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{m.low}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{m.moderate}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{m.high}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{m.critical}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{m.nearMiss}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground">
            Severity drift — a rising share of High/Critical relative to Low/Moderate is an early warning even if
            totals stay flat.
          </p>
        </div>
      );
    case "capa":
      return (
        <div className="space-y-4">
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-muted-foreground">On-time closure</span>
              <span className="font-bold">{snap.capa.onTimePercent}%</span>
            </div>
            <Progress value={snap.capa.onTimePercent} />
            <p className="mt-1 text-xs text-muted-foreground">
              {snap.capa.onTimeCompleted} of {snap.capa.completedInWindow} actions closed on time in window.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Open" value={snap.capa.openTotal} />
            <Metric label="Overdue" value={snap.capa.overdueOpen} />
            <Metric label="Closed in window" value={snap.capa.completedInWindow} />
            <Metric label="Avg days to close" value={snap.capa.avgDaysToClose ?? "—"} />
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            Target: ≥ 90% on-time closure and 0 overdue. Overdue actions weaken every other KPI — assign owners and
            escalate weekly.
          </div>
        </div>
      );
    case "objectives":
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Green {snap.objectives.green}</Badge>
            <Badge className="bg-amber-500 text-white hover:bg-amber-500">Amber {snap.objectives.amber}</Badge>
            <Badge className="bg-rose-600 text-white hover:bg-rose-600">Red {snap.objectives.red}</Badge>
            <Badge variant="outline">Unrated {snap.objectives.unrated}</Badge>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-muted-foreground">On-track (of rated)</span>
              <span className="font-bold">{snap.objectives.onTrackPercent}%</span>
            </div>
            <Progress value={snap.objectives.onTrackPercent} />
          </div>
          <p className="text-xs text-muted-foreground">
            Drill into individual objectives in the Objectives module to review monthly progress, owners, and
            corrective actions for any Red or Unrated items.
          </p>
        </div>
      );
    case "training":
      return (
        <div className="space-y-4">
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-muted-foreground">Compliance</span>
              <span className="font-bold">{snap.training.compliancePercent}%</span>
            </div>
            <Progress value={snap.training.compliancePercent} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Active records" value={snap.training.activeRecords} />
            <Metric label="Valid" value={snap.training.valid} />
            <Metric label="Expiring ≤30d" value={snap.training.expiring30d} />
            <Metric label="Expired" value={snap.training.expired} />
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            Target: ≥ 95% valid, 0 expired. Address expiring-soon records before they tip into Expired.
          </div>
        </div>
      );
    case "environment":
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label={`Waste (${snap.environment.waste.unit})`} value={snap.environment.waste.total} />
            <Metric label={`Hazardous`} value={snap.environment.waste.hazardous} />
            <Metric label={`Non-haz`} value={snap.environment.waste.nonHazardous} />
            <Metric label={`Water (${snap.environment.water.unit})`} value={snap.environment.water.total} />
            <Metric label={`Energy (${snap.environment.energy.unit})`} value={snap.environment.energy.total} />
            <Metric label={`GHG (${snap.environment.emissions.unit})`} value={snap.environment.emissions.total} />
            <Metric label="Scope 1" value={snap.environment.emissions.scope1} />
            <Metric label="Scope 2" value={snap.environment.emissions.scope2} />
            <Metric label="Scope 3" value={snap.environment.emissions.scope3} />
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium">Per-employee intensity</p>
            <p className="mt-1 text-muted-foreground">
              Waste {snap.environment.intensityPerEmployee.wastePerEmployee} {snap.environment.waste.unit}/employee
              · Emissions {snap.environment.intensityPerEmployee.emissionsPerEmployee}{" "}
              {snap.environment.emissions.unit}/employee
            </p>
          </div>
        </div>
      );
  }
}

function Metric({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">
        {value}
        {unit ? <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span> : null}
      </p>
    </div>
  );
}

export function HseKpiDetailDialog({
  open,
  onOpenChange,
  section,
  snapshot,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  section: KpiSection | null;
  snapshot: HseKpiSnapshot;
}) {
  const ref = useRef<HTMLDivElement>(null);

  if (!section) return null;
  const title = TITLES[section];
  const fileBase = `hse-kpi-${section}`;
  const subtitle = `Window: last ${snapshot.windowMonths} months · Generated ${new Date(
    snapshot.generatedAt,
  ).toLocaleString()}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>
        <div ref={ref} data-pdf-section className="max-h-[60vh] overflow-y-auto">
          <SectionBody section={section} snap={snapshot} />
        </div>
        <div className="border-t pt-3" data-export-hide>
          <ReportActions
            targetRef={ref}
            fileName={fileBase}
            title={title}
            subtitle={subtitle}
            module={`hse_kpi_${section}`}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

