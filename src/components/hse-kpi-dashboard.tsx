import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Droplets,
  Flame,
  GraduationCap,
  Leaf,
  ListChecks,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getHseKpis, type HseKpiSnapshot } from "@/lib/hse-kpis.functions";
import { HseKpiDetailDialog, type KpiSection } from "@/components/hse-kpi-detail-dialog";

function monthLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", year: "2-digit" });
}

function StatTile({
  icon: Icon,
  label,
  value,
  unit,
  caption,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  unit?: string;
  caption?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const ringTone =
    tone === "good"
      ? "border-emerald-500/40 bg-emerald-500/5"
      : tone === "warn"
      ? "border-amber-500/40 bg-amber-500/5"
      : tone === "bad"
      ? "border-rose-500/40 bg-rose-500/5"
      : "border-border bg-card";
  const iconTone =
    tone === "good"
      ? "text-emerald-600"
      : tone === "warn"
      ? "text-amber-600"
      : tone === "bad"
      ? "text-rose-600"
      : "text-primary";
  return (
    <div className={`rounded-md border p-4 ${ringTone}`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className={`size-4 ${iconTone}`} />
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">
        {value}
        {unit ? <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span> : null}
      </p>
      {caption && <p className="mt-1 text-xs text-muted-foreground">{caption}</p>}
    </div>
  );
}

function pickTone(value: number, good: number, warn: number, inverse = false) {
  if (inverse) {
    if (value <= good) return "good" as const;
    if (value <= warn) return "warn" as const;
    return "bad" as const;
  }
  if (value >= good) return "good" as const;
  if (value >= warn) return "warn" as const;
  return "bad" as const;
}

export function HseKpiDashboard({ windowMonths = 12 }: { windowMonths?: number }) {
  const fetchKpis = useServerFn(getHseKpis);
  const { data, isLoading, error } = useQuery({
    queryKey: ["hse-kpis", windowMonths],
    queryFn: () => fetchKpis({ data: { windowMonths } }),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>HSE Performance KPIs</CardTitle>
          <CardDescription>Loading lagging and leading indicators…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>HSE Performance KPIs</CardTitle>
          <CardDescription className="text-rose-600">
            Could not load KPIs. Please try again.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return <HseKpiView snapshot={data} />;
}

function HseKpiView({ snapshot }: { snapshot: HseKpiSnapshot }) {
  const [openSection, setOpenSection] = useState<KpiSection | null>(null);
  const cardClass =
    "cursor-pointer transition hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const openWith = (s: KpiSection) => setOpenSection(s);
  const onKey = (s: KpiSection) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openWith(s);
    }
  };
  const { safety, capa, objectives, training, environment, nearMissRatio, incidentTrend, workforce, windowMonths } = snapshot;

  return (
    <div className="space-y-6">
      {/* SAFETY HEADLINE RATES */}
      <Card className={cardClass} role="button" tabIndex={0} onClick={() => openWith("safety")} onKeyDown={onKey("safety")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-5 text-primary" /> Safety performance (last {windowMonths} months)
          </CardTitle>
          <CardDescription>
            Lagging rate indicators. Hours-worked estimated from {workforce.activeEmployees} active employees ×
            2,000 hrs/yr ({workforce.estimatedHoursWorked.toLocaleString()} hrs). Replace with actuals when
            timesheet data is available.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              icon={TrendingDown}
              label="LTIFR"
              value={safety.ltifr}
              unit="per 1M hrs"
              caption={`${safety.lostTimeInjuries} lost-time injuries`}
              tone={pickTone(safety.ltifr, 1, 3, true)}
            />
            <StatTile
              icon={AlertTriangle}
              label="TRIR"
              value={safety.trir}
              unit="per 200k hrs"
              caption={`${safety.recordableInjuries} recordable injuries`}
              tone={pickTone(safety.trir, 1, 3, true)}
            />
            <StatTile
              icon={Flame}
              label="Severity rate"
              value={safety.severityRate}
              unit="per 200k hrs"
              caption={`${safety.fatalitiesProxy} critical-severity events`}
              tone={pickTone(safety.severityRate, 1, 3, true)}
            />
            <StatTile
              icon={TrendingUp}
              label="Near-miss ratio"
              value={`${nearMissRatio.ratio}:1`}
              caption={`${nearMissRatio.nearMisses} near-misses vs ${nearMissRatio.incidents} incidents`}
              tone={pickTone(nearMissRatio.ratio, 10, 3)}
            />
          </div>
        </CardContent>
      </Card>

      {/* INCIDENT TREND */}
      <Card className={cardClass} role="button" tabIndex={0} onClick={() => openWith("incidents")} onKeyDown={onKey("incidents")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5 text-primary" /> Incident trend by severity
          </CardTitle>
          <CardDescription>
            Monthly incidents stacked by severity, with near-misses overlay — watch for spikes and severity drift.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incidentTrend.map((m) => ({ ...m, label: monthLabel(m.month) }))}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="low" stackId="sev" fill="hsl(142 70% 45%)" name="Low" />
                <Bar dataKey="moderate" stackId="sev" fill="hsl(48 96% 53%)" name="Moderate" />
                <Bar dataKey="high" stackId="sev" fill="hsl(25 95% 53%)" name="High" />
                <Bar dataKey="critical" stackId="sev" fill="hsl(0 84% 60%)" name="Critical" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={incidentTrend.map((m) => ({ label: monthLabel(m.month), nearMiss: m.nearMiss }))}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="nearMiss" stroke="hsl(217 91% 60%)" strokeWidth={2} name="Near-misses" dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* CAPA */}
        <Card className={cardClass} role="button" tabIndex={0} onClick={() => openWith("capa")} onKeyDown={onKey("capa")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="size-5 text-primary" /> CAPA closure
            </CardTitle>
            <CardDescription>On-time corrective & preventive action closure rate.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">On-time closure</span>
                <span className="text-2xl font-bold tabular-nums">{capa.onTimePercent}%</span>
              </div>
              <Progress value={capa.onTimePercent} />
              <p className="mt-1 text-xs text-muted-foreground">
                {capa.onTimeCompleted} of {capa.completedInWindow} actions closed on time in window.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatTile icon={ListChecks} label="Open" value={capa.openTotal} />
              <StatTile
                icon={AlertTriangle}
                label="Overdue"
                value={capa.overdueOpen}
                tone={capa.overdueOpen > 0 ? "bad" : "good"}
              />
              <StatTile
                icon={CheckCircle2}
                label="Avg days to close"
                value={capa.avgDaysToClose ?? "—"}
              />
            </div>
          </CardContent>
        </Card>

        {/* OBJECTIVES */}
        <Card className={cardClass} role="button" tabIndex={0} onClick={() => openWith("objectives")} onKeyDown={onKey("objectives")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="size-5 text-primary" /> HSE objectives RAG
            </CardTitle>
            <CardDescription>{objectives.total} objectives — rolled up from monthly progress.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-[1fr_180px] items-center gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Green</Badge>
                  <span className="font-bold tabular-nums">{objectives.green}</span>
                </div>
                <div className="flex items-center justify-between">
                  <Badge className="bg-amber-500 text-white hover:bg-amber-500">Amber</Badge>
                  <span className="font-bold tabular-nums">{objectives.amber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <Badge className="bg-rose-600 text-white hover:bg-rose-600">Red</Badge>
                  <span className="font-bold tabular-nums">{objectives.red}</span>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Unrated</Badge>
                  <span className="font-bold tabular-nums">{objectives.unrated}</span>
                </div>
                <p className="pt-2 text-xs text-muted-foreground">
                  {objectives.onTrackPercent}% of rated objectives are on track.
                </p>
              </div>
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Green", value: objectives.green, fill: "hsl(142 70% 45%)" },
                        { name: "Amber", value: objectives.amber, fill: "hsl(43 96% 56%)" },
                        { name: "Red", value: objectives.red, fill: "hsl(0 84% 60%)" },
                        { name: "Unrated", value: objectives.unrated, fill: "hsl(215 16% 70%)" },
                      ].filter((s) => s.value > 0)}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={40}
                      outerRadius={70}
                    >
                      {["a", "b", "c", "d"].map((k) => (
                        <Cell key={k} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* TRAINING */}
        <Card className={cardClass} role="button" tabIndex={0} onClick={() => openWith("training")} onKeyDown={onKey("training")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="size-5 text-primary" /> Training compliance
            </CardTitle>
            <CardDescription>Valid certifications across the active workforce.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Compliance</span>
                <span className="text-2xl font-bold tabular-nums">{training.compliancePercent}%</span>
              </div>
              <Progress value={training.compliancePercent} />
              <p className="mt-1 text-xs text-muted-foreground">
                {training.valid} valid of {training.activeRecords} required records.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatTile icon={CheckCircle2} label="Valid" value={training.valid} tone="good" />
              <StatTile
                icon={AlertTriangle}
                label="Expiring 30d"
                value={training.expiring30d}
                tone={training.expiring30d > 0 ? "warn" : "good"}
              />
              <StatTile
                icon={AlertTriangle}
                label="Expired"
                value={training.expired}
                tone={training.expired > 0 ? "bad" : "good"}
              />
            </div>
          </CardContent>
        </Card>

        {/* ENVIRONMENT */}
        <Card className={cardClass} role="button" tabIndex={0} onClick={() => openWith("environment")} onKeyDown={onKey("environment")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Leaf className="size-5 text-primary" /> Environmental intensity
            </CardTitle>
            <CardDescription>Resource use and emissions over the window.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <StatTile
                icon={Leaf}
                label="Waste"
                value={environment.waste.total.toLocaleString()}
                unit={environment.waste.unit}
                caption={`Haz ${environment.waste.hazardous} · Non-haz ${environment.waste.nonHazardous}`}
              />
              <StatTile
                icon={Flame}
                label="GHG emissions"
                value={environment.emissions.total.toLocaleString()}
                unit={environment.emissions.unit}
                caption={`S1 ${environment.emissions.scope1} · S2 ${environment.emissions.scope2} · S3 ${environment.emissions.scope3}`}
              />
              <StatTile
                icon={Droplets}
                label="Water"
                value={environment.water.total.toLocaleString()}
                unit={environment.water.unit}
              />
              <StatTile
                icon={Zap}
                label="Energy"
                value={environment.energy.total.toLocaleString()}
                unit={environment.energy.unit}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Per-employee intensity: {environment.intensityPerEmployee.wastePerEmployee} {environment.waste.unit} waste ·{" "}
              {environment.intensityPerEmployee.emissionsPerEmployee} {environment.emissions.unit} emissions.
            </p>
          </CardContent>
        </Card>
      </div>
      <HseKpiDetailDialog
        open={openSection !== null}
        onOpenChange={(v) => !v && setOpenSection(null)}
        section={openSection}
        snapshot={snapshot}
      />
    </div>
  );
}
