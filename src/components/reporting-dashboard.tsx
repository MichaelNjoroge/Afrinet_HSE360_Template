import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Trophy, TrendingUp, Award, Sparkles, Flame, Target, Lightbulb, Users } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  getReportingIndex,
  getEmployeeReportingHistory,
  type ReportingIndexRow,
} from "@/lib/reporting-index.functions";
import { HseKpiDashboard } from "@/components/hse-kpi-dashboard";

const MODULE_LABELS: Record<string, string> = {
  incidents: "Incidents",
  near_misses: "Near-misses",
  observations: "Observations",
  hazards: "Hazards",
  ppe_inspections: "PPE inspections",
  inspections: "Inspections",
  audits: "Audits",
  capa: "CAPA",
  emergency_response: "Emergency Response",
  safety_committee: "Safety Committee",
};

function monthLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", year: "2-digit" });
}

type AggUser = {
  user_id: string;
  full_name: string;
  department: string | null;
  total: number;
  rank: number;
  perModule: Record<string, number>;
  perMonth: Record<string, number>;
};

function aggregateByUser(rows: ReportingIndexRow[]): AggUser[] {
  const map = new Map<string, AggUser>();
  for (const r of rows) {
    if (!map.has(r.user_id)) {
      map.set(r.user_id, {
        user_id: r.user_id,
        full_name: r.full_name ?? "Unknown",
        department: r.department,
        total: r.user_total,
        rank: r.user_rank,
        perModule: {},
        perMonth: {},
      });
    }
    const agg = map.get(r.user_id)!;
    agg.perModule[r.module] = (agg.perModule[r.module] ?? 0) + r.reports_count;
    agg.perMonth[r.month] = (agg.perMonth[r.month] ?? 0) + r.reports_count;
  }
  return [...map.values()].sort((a, b) => a.rank - b.rank);
}
function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    let raf = 0;
    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

const REPORTING_STRATEGIES = [
  { icon: Target, title: "Daily safety walk", text: "Spend 5 minutes scanning your workspace for hazards or unsafe acts." },
  { icon: Lightbulb, title: "See it, log it", text: "Capture observations on the spot — your phone takes 3 taps." },
  { icon: Users, title: "Coach a peer", text: "Help a colleague file their first near-miss this week." },
  { icon: Flame, title: "Beat last month", text: "Aim for one more report than your previous month — small steps add up." },
];


export function ReportingDashboard({ isAdminView = false, showKpis = true }: { isAdminView?: boolean; showKpis?: boolean }) {
  const fetchIndex = useServerFn(getReportingIndex);
  const fetchHistory = useServerFn(getEmployeeReportingHistory);
  const { data, isLoading } = useQuery({
    queryKey: ["reporting-index", 12],
    queryFn: () => fetchIndex({ data: { windowMonths: 12 } }),
    staleTime: 5 * 60 * 1000,
  });

  const [drawerUser, setDrawerUser] = useState<AggUser | null>(null);
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["employee-history", drawerUser?.user_id],
    queryFn: () => fetchHistory({ data: { userId: drawerUser!.user_id, windowMonths: 12 } }),
    enabled: !!drawerUser,
    staleTime: 5 * 60 * 1000,
  });

  const aggregated = useMemo(() => aggregateByUser(data?.rows ?? []), [data]);
  const me = aggregated.find((u) => u.user_id === data?.myUserId);
  const leaderboard = aggregated.slice(0, 10);
  const bottom = aggregated.slice(-10).reverse();
  const totalReporters = aggregated.length;

  // company per-module totals
  const companyPerModule = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const r of data?.rows ?? []) {
      acc[r.module] = (acc[r.module] ?? 0) + r.reports_count;
    }
    return acc;
  }, [data]);

  // 12-month series (company-wide and mine)
  const monthlySeries = useMemo(() => {
    const months: Record<string, { month: string; company: number; mine: number }> = {};
    for (const r of data?.rows ?? []) {
      const m = (months[r.month] ??= { month: r.month, company: 0, mine: 0 });
      m.company += r.reports_count;
      if (r.user_id === data?.myUserId) m.mine += r.reports_count;
    }
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reporting Index</CardTitle>
          <CardDescription>Loading the latest leaderboard…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data || aggregated.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reporting Index</CardTitle>
          <CardDescription>
            No reports submitted yet in the last 12 months. Be the first — log an incident, near-miss, or
            safety observation and earn your place on the leaderboard.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const leaderboardData = leaderboard.map((u) => ({
    name: u.full_name.split(" ")[0],
    fullName: u.full_name,
    total: u.total,
    user_id: u.user_id,
    isMe: u.user_id === data.myUserId,
  }));

  return (
    <div className="space-y-6">
      {/* HSE PERFORMANCE KPIs */}
      {isAdminView && showKpis && <HseKpiDashboard windowMonths={12} />}

      {/* MY INDEX */}
      {me && <MyReportingIndexCard me={me} totalReporters={totalReporters} monthlySeries={monthlySeries} onOpen={() => setDrawerUser(me)} />}




      {/* LEADERBOARD */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="size-5 text-amber-500" /> Reporting Leaderboard
          </CardTitle>
          <CardDescription>
            Top 10 reporters across the company over the last 12 months. Click any bar to see that
            colleague's reporting history. Healthy competition — keep the reports flowing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leaderboardData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))" }}
                  formatter={(value: number) => [`${value} reports`, "Total"]}
                  labelFormatter={(_label: string, payload) => {
                    const p = payload?.[0]?.payload as { fullName?: string } | undefined;
                    return p?.fullName ?? "";
                  }}
                />
                <Bar
                  dataKey="total"
                  radius={[6, 6, 0, 0]}
                  onClick={(payload) => {
                    const entry = payload as { user_id?: string; payload?: { user_id?: string } };
                    const uid = entry?.user_id ?? entry?.payload?.user_id;
                    if (!uid) return;
                    const user = aggregated.find((u) => u.user_id === uid);
                    if (user) setDrawerUser(user);
                  }}
                  cursor="pointer"
                >
                  {leaderboardData.map((entry) => (
                    <Cell
                      key={entry.user_id}
                      fill={entry.isMe ? "hsl(var(--primary))" : "hsl(var(--chart-1, 217 91% 60%))"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ADMIN-ONLY BI ROLL-UP */}
      {isAdminView && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-5 text-primary" /> Business Intelligence
            </CardTitle>
            <CardDescription>Company-wide HSE reporting health (last 12 months).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(MODULE_LABELS).map(([key, label]) => (
                <div key={key} className="rounded-md border bg-card p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold tabular-nums">{companyPerModule[key] ?? 0}</p>
                </div>
              ))}
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={monthlySeries.map((m) => ({
                    month: monthLabel(m.month),
                    Company: m.company,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="Company" stroke="hsl(var(--primary))" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="mb-2 font-semibold text-success">Top 10 reporters</h4>
                <ol className="space-y-1 text-sm">
                  {leaderboard.map((u) => (
                    <li
                      key={u.user_id}
                      className="flex items-center justify-between rounded-md border bg-card px-3 py-2"
                    >
                      <span>
                        <Badge variant="outline" className="mr-2">#{u.rank}</Badge>
                        <button
                          className="font-medium hover:underline"
                          onClick={() => setDrawerUser(u)}
                        >
                          {u.full_name}
                        </button>
                        {u.department && (
                          <span className="ml-2 text-xs text-muted-foreground">{u.department}</span>
                        )}
                      </span>
                      <span className="font-bold tabular-nums">{u.total}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <h4 className="mb-2 font-semibold text-amber-600">Encourage to report</h4>
                <p className="mb-2 text-xs text-muted-foreground">
                  Lowest 10 reporters — coach and motivate them, recognise progress.
                </p>
                <ol className="space-y-1 text-sm">
                  {bottom.map((u) => (
                    <li
                      key={u.user_id}
                      className="flex items-center justify-between rounded-md border bg-card px-3 py-2"
                    >
                      <span>
                        <Badge variant="outline" className="mr-2">#{u.rank}</Badge>
                        <button
                          className="font-medium hover:underline"
                          onClick={() => setDrawerUser(u)}
                        >
                          {u.full_name}
                        </button>
                      </span>
                      <span className="font-bold tabular-nums">{u.total}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Sheet open={!!drawerUser} onOpenChange={(open) => !open && setDrawerUser(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{drawerUser?.full_name}</SheetTitle>
            <SheetDescription>
              Reporting history · Rank #{drawerUser?.rank} of {totalReporters} · Total {drawerUser?.total}
            </SheetDescription>
          </SheetHeader>
          {drawerUser && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Object.entries(MODULE_LABELS).map(([key, label]) => (
                  <div key={key} className="rounded-md border bg-card p-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="text-xl font-bold tabular-nums">{drawerUser.perModule[key] ?? 0}</p>
                  </div>
                ))}
              </div>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(history ?? []).reduce<Array<{ month: string; count: number }>>((acc, row) => {
                      const label = monthLabel(row.month);
                      const existing = acc.find((x) => x.month === label);
                      if (existing) existing.count += row.reports_count;
                      else acc.push({ month: label, count: row.reports_count });
                      return acc;
                    }, [])}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {historyLoading && (
                <p className="text-xs text-muted-foreground">Loading history…</p>
              )}
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setDrawerUser(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MyReportingIndexCard({
  me,
  totalReporters,
  monthlySeries,
  onOpen,
}: {
  me: AggUser;
  totalReporters: number;
  monthlySeries: Array<{ month: string; company: number; mine: number }>;
  onOpen: () => void;
}) {
  const animatedRank = useCountUp(me.rank);
  const animatedTotal = useCountUp(me.total);
  const isChampion = me.rank === 1;
  const isTop3 = me.rank <= 3;

  // streak: count consecutive months ending at latest with > 0 reports
  const sorted = [...monthlySeries].sort((a, b) => a.month.localeCompare(b.month));
  let streak = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].mine > 0) streak += 1;
    else break;
  }

  const headline = isChampion
    ? "🏆 You're #1 — keep leading the way!"
    : isTop3
    ? "You're on the podium — push for #1!"
    : me.rank <= 10
    ? "Top 10! A few more reports and you climb higher."
    : "Every report counts — climb the ranks this month.";

  return (
    <Card
      className={`group cursor-pointer overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent transition hover:border-primary hover:shadow-lg ${
        isChampion ? "ring-2 ring-amber-400/60" : ""
      }`}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary animate-pulse" /> My Reporting Index
          </CardTitle>
          <CardDescription className="mt-1 font-medium text-foreground/80">{headline}</CardDescription>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-2">
            <Trophy
              className={`size-7 text-amber-500 transition-transform group-hover:scale-110 ${
                isChampion ? "animate-bounce" : isTop3 ? "animate-pulse" : ""
              }`}
            />
            <span className="bg-gradient-to-br from-amber-500 to-primary bg-clip-text text-4xl font-extrabold tabular-nums text-transparent">
              #{animatedRank}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">of {totalReporters} active reporters</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="size-3" /> {animatedTotal} reports (12 mo)
          </Badge>
          {streak > 0 && (
            <Badge className="gap-1 bg-orange-500 text-white hover:bg-orange-600">
              <Flame className="size-3" /> {streak}-month streak
            </Badge>
          )}
          {isTop3 && (
            <Badge className="gap-1 bg-amber-500 text-white hover:bg-amber-600">
              <Award className="size-3" /> Podium reporter
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Object.entries(MODULE_LABELS).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              className="rounded-md border bg-card p-3 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-sm"
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold tabular-nums">{me.perModule[key] ?? 0}</p>
            </button>
          ))}
        </div>
        <div className="h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlySeries.map((m) => ({ month: monthLabel(m.month), mine: m.mine }))}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="mine" stroke="hsl(var(--primary))" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Strategies to climb the leaderboard
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {REPORTING_STRATEGIES.map((s) => (
              <div
                key={s.title}
                className="flex items-start gap-2 rounded-md border bg-card/60 p-2 text-sm"
              >
                <s.icon className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

