import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  Mail,
  CalendarClock,
  Users,
  ChevronDown,
  Activity,
  Clock,
  UserCheck,
  UserX,
} from "lucide-react";
import {
  getAdminMonitoringSnapshot,
  type AdminMonitoringSnapshot,
  type VisitorsBlock,
  type VisitorRow,
  type EmailLogRow,
  type FailingSubscription,
} from "@/lib/admin-monitoring.functions";
import { StorageUsagePanel } from "@/components/storage-usage-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin-monitoring")({
  component: AdminMonitoringPage,
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-2xl space-y-3 p-8 text-sm">
      <p className="font-medium text-destructive">Monitoring view unavailable</p>
      <p className="text-muted-foreground">{error.message}</p>
      <Button onClick={reset} variant="outline" size="sm">
        Try again
      </Button>
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm">Page not found.</div>,
});

type DetailPayload = {
  title: string;
  description?: string;
  content: ReactNode;
} | null;

function formatDate(value: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function statusVariant(
  status: string | null,
): "default" | "secondary" | "destructive" | "outline" {
  const s = (status ?? "").toLowerCase();
  if (s === "sent") return "secondary";
  if (s === "pending") return "outline";
  if (s === "suppressed") return "outline";
  return "destructive";
}

function formatRelative(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatMinutes(min: number) {
  if (!min) return "0m";
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m}m`;
}

function AdminMonitoringPage() {
  const fetchSnapshot = useServerFn(getAdminMonitoringSnapshot);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-monitoring"],
    queryFn: () => fetchSnapshot({ data: undefined as never }),
    refetchInterval: 60_000,
  });

  const [detail, setDetail] = useState<DetailPayload>(null);
  const openDetail = (d: DetailPayload) => setDetail(d);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/dashboard" className="inline-flex items-center gap-1 hover:underline">
              <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
            </Link>
          </div>
          <h1 className="text-2xl font-semibold">System monitoring</h1>
          <p className="text-sm text-muted-foreground">
            Every card is clickable for a detailed profile. Long sections are collapsible.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-4 text-sm text-destructive">
            {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <EmailStatCards data={data} onOpenDetail={openDetail} />

          <StorageUsagePanel />

          <VisitorsPanel data={data.visitors} onOpenDetail={openDetail} />


          <CollapsibleCard
            id="failures"
            icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
            title="Recent email failures"
            subtitle={`${data.email.recentFailures.length} failure(s) in the last 7 days`}
            defaultOpen
          >
            {data.email.recentFailures.length === 0 ? (
              <p className="text-sm text-muted-foreground">No failures in the last 7 days.</p>
            ) : (
              <ScrollArea className="max-h-[420px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.email.recentFailures.map((row) => (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() =>
                          openDetail({
                            title: `Email failure · ${row.template_name ?? "unknown template"}`,
                            description: formatDate(row.created_at),
                            content: <EmailLogDetail row={row} />,
                          })
                        }
                      >
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDate(row.created_at)}
                        </TableCell>
                        <TableCell className="text-xs">{row.template_name ?? "—"}</TableCell>
                        <TableCell className="text-xs">{row.recipient_email ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(row.status)}>{row.status ?? "—"}</Badge>
                        </TableCell>
                        <TableCell
                          className="max-w-md truncate text-xs text-muted-foreground"
                          title={row.error_message ?? undefined}
                        >
                          {row.error_message ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CollapsibleCard>

          <CollapsibleCard
            id="suppressions"
            icon={<Mail className="h-4 w-4" />}
            title="Suppressed recipients"
            subtitle={`${data.email.recentSuppressions.length} suppressed (latest 15)`}
          >
            {data.email.recentSuppressions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No suppressed recipients.</p>
            ) : (
              <ScrollArea className="max-h-[420px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.email.recentSuppressions.map((row) => (
                      <TableRow
                        key={`${row.email}-${row.created_at}`}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() =>
                          openDetail({
                            title: `Suppressed · ${row.email}`,
                            description: formatDate(row.created_at),
                            content: (
                              <div className="space-y-2 text-sm">
                                <KV k="Email" v={row.email} />
                                <KV k="Reason" v={row.reason ?? "Not specified"} />
                                <KV k="Suppressed at" v={formatDate(row.created_at)} />
                                <p className="pt-2 text-xs text-muted-foreground">
                                  Future emails to this recipient are blocked until the suppression is lifted.
                                </p>
                              </div>
                            ),
                          })
                        }
                      >
                        <TableCell className="text-xs">{row.email}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.reason ?? "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDate(row.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CollapsibleCard>

          <CollapsibleCard
            id="reports"
            icon={<CalendarClock className="h-4 w-4" />}
            title="Failing scheduled reports"
            subtitle={`${data.reports.activeCount} active subscription(s) · ${data.reports.failing.length} failing`}
            defaultOpen
          >
            {data.reports.failing.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                All scheduled report subscriptions are healthy.
              </p>
            ) : (
              <ScrollArea className="max-h-[420px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Module</TableHead>
                      <TableHead>Cadence</TableHead>
                      <TableHead>Recipients</TableHead>
                      <TableHead>Failures</TableHead>
                      <TableHead>Next run</TableHead>
                      <TableHead>Last error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.reports.failing.map((sub) => (
                      <TableRow
                        key={sub.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() =>
                          openDetail({
                            title: `Scheduled report · ${sub.module}`,
                            description: `${sub.cadence} · ${sub.recipients?.length ?? 0} recipient(s)`,
                            content: <SubscriptionDetail sub={sub} />,
                          })
                        }
                      >
                        <TableCell className="text-xs font-medium">{sub.module}</TableCell>
                        <TableCell className="text-xs">{sub.cadence}</TableCell>
                        <TableCell className="text-xs">{sub.recipients?.length ?? 0}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">{sub.failure_count}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDate(sub.next_run_at)}
                        </TableCell>
                        <TableCell
                          className="max-w-md truncate text-xs text-muted-foreground"
                          title={sub.last_error ?? undefined}
                        >
                          {sub.last_error ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CollapsibleCard>

          <p className="text-xs text-muted-foreground">
            Snapshot generated {formatDate(data.generatedAt)}. Auto-refreshes every 60 seconds.
          </p>
        </>
      )}

      <Dialog open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>{detail?.title}</DialogTitle>
            {detail?.description && (
              <DialogDescription>{detail.description}</DialogDescription>
            )}
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-3">{detail?.content}</ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium break-words">{v}</span>
    </div>
  );
}

function EmailLogDetail({ row }: { row: EmailLogRow }) {
  return (
    <div className="space-y-2">
      <KV k="Template" v={row.template_name ?? "—"} />
      <KV k="Recipient" v={row.recipient_email ?? "—"} />
      <KV k="Status" v={<Badge variant={statusVariant(row.status)}>{row.status ?? "—"}</Badge>} />
      <KV k="Message ID" v={row.message_id ?? "—"} />
      <KV k="Created" v={formatDate(row.created_at)} />
      <KV k="Error" v={row.error_message ?? "None"} />
    </div>
  );
}

function SubscriptionDetail({ sub }: { sub: FailingSubscription }) {
  return (
    <div className="space-y-3">
      <KV k="Module" v={sub.module} />
      <KV k="Cadence" v={sub.cadence} />
      <KV k="Failure count" v={<Badge variant="destructive">{sub.failure_count}</Badge>} />
      <KV k="Last run" v={formatDate(sub.last_run_at)} />
      <KV k="Next run" v={formatDate(sub.next_run_at)} />
      <KV k="Last error" v={sub.last_error ?? "—"} />
      <div className="pt-2">
        <div className="mb-1 text-xs text-muted-foreground">Recipients</div>
        <div className="flex flex-wrap gap-1.5">
          {(sub.recipients ?? []).length === 0 && (
            <span className="text-xs text-muted-foreground">None</span>
          )}
          {(sub.recipients ?? []).map((r) => (
            <Badge key={r} variant="outline" className="text-[10px]">
              {r}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmailStatCards({
  data,
  onOpenDetail,
}: {
  data: AdminMonitoringSnapshot;
  onOpenDetail: (d: DetailPayload) => void;
}) {
  const t = data.email.totals;
  const totalsBreakdown = (
    <div className="space-y-2">
      <KV k="Total" v={t.total} />
      <KV k="Sent" v={t.sent} />
      <KV k="Failed / DLQ" v={t.failed} />
      <KV k="Pending" v={t.pending} />
      <KV k="Suppressed" v={t.suppressed} />
      <p className="pt-2 text-xs text-muted-foreground">
        Window: last {data.email.windowDays} days.
      </p>
    </div>
  );

  const recentList = (rows: EmailLogRow[], emptyMsg: string) =>
    rows.length === 0 ? (
      <p className="text-sm text-muted-foreground">{emptyMsg}</p>
    ) : (
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-md border p-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium">{r.template_name ?? "—"}</span>
              <Badge variant={statusVariant(r.status)}>{r.status ?? "—"}</Badge>
            </div>
            <div className="text-muted-foreground">{r.recipient_email ?? "—"}</div>
            <div className="text-[10px] text-muted-foreground">{formatDate(r.created_at)}</div>
            {r.error_message && (
              <div className="mt-1 text-[11px] text-destructive">{r.error_message}</div>
            )}
          </div>
        ))}
      </div>
    );

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <StatCard
        label="Total emails"
        value={t.total}
        icon={<Mail />}
        onClick={() =>
          onOpenDetail({
            title: "Email totals breakdown",
            description: `Last ${data.email.windowDays} days`,
            content: totalsBreakdown,
          })
        }
      />
      <StatCard
        label="Sent"
        value={t.sent}
        tone="success"
        onClick={() =>
          onOpenDetail({
            title: "Sent emails",
            description: `${t.sent} delivered in the last ${data.email.windowDays} days`,
            content: (
              <div className="space-y-2 text-sm">
                <KV k="Delivered" v={t.sent} />
                <KV
                  k="Share of total"
                  v={t.total > 0 ? `${Math.round((t.sent / t.total) * 100)}%` : "—"}
                />
                <p className="pt-2 text-xs text-muted-foreground">
                  Detailed per-message logs are retained for failed and suppressed deliveries only.
                </p>
              </div>
            ),
          })
        }
      />
      <StatCard
        label="Failed / DLQ"
        value={t.failed}
        tone="danger"
        onClick={() =>
          onOpenDetail({
            title: "Failed deliveries",
            description: `${data.email.recentFailures.length} recent failure(s)`,
            content: recentList(data.email.recentFailures, "No failures."),
          })
        }
      />
      <StatCard
        label="Pending"
        value={t.pending}
        tone="muted"
        onClick={() =>
          onOpenDetail({
            title: "Pending emails",
            description: "Queued for delivery",
            content: (
              <div className="space-y-2 text-sm">
                <KV k="Currently queued" v={t.pending} />
                <p className="pt-2 text-xs text-muted-foreground">
                  Items remain pending until the next send worker pass. Persistent pending entries
                  indicate a worker issue.
                </p>
              </div>
            ),
          })
        }
      />
      <StatCard
        label="Suppressed"
        value={t.suppressed}
        tone="muted"
        onClick={() =>
          onOpenDetail({
            title: "Suppressed recipients",
            description: `${data.email.recentSuppressions.length} latest suppression(s)`,
            content:
              data.email.recentSuppressions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No suppressed recipients.</p>
              ) : (
                <div className="space-y-2">
                  {data.email.recentSuppressions.map((s) => (
                    <div key={`${s.email}-${s.created_at}`} className="rounded-md border p-2 text-xs">
                      <div className="font-medium">{s.email}</div>
                      <div className="text-muted-foreground">{s.reason ?? "—"}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {formatDate(s.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              ),
          })
        }
      />
    </section>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon,
  onClick,
}: {
  label: string;
  value: number;
  tone?: "success" | "danger" | "muted";
  icon?: ReactNode;
  onClick?: () => void;
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "danger"
        ? "text-destructive"
        : tone === "muted"
          ? "text-muted-foreground"
          : "";
  const interactive = onClick
    ? "cursor-pointer transition-all hover:shadow-md hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring"
    : "";
  
  const inner = (
    <CardContent className="space-y-1 pt-4">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        {icon && <span className="opacity-60">{icon}</span>}
      </div>
      <div className={`text-2xl font-semibold ${toneClass}`}>{value}</div>
    </CardContent>
  );
  if (onClick) {
    return (
      <Card className={interactive}>
        <button type="button" onClick={onClick} className="block w-full text-left">
          {inner}
        </button>
      </Card>
    );
  }
  return <Card>{inner}</Card>;
}

function CollapsibleCard({
  id: _id,
  icon,
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  id: string;
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/40"
          >
            <div className="flex items-center gap-2">
              {icon}
              <div>
                <div className="text-base font-semibold">{title}</div>
                {subtitle && (
                  <div className="text-xs text-muted-foreground">{subtitle}</div>
                )}
              </div>
            </div>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function CollapsibleSection({
  title,
  count,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number | string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/40"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            {icon}
            {title}
            {count !== undefined && (
              <Badge variant="outline" className="ml-1 text-[10px]">
                {count}
              </Badge>
            )}
          </div>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t p-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function VisitorProfileDetail({ v }: { v: VisitorRow }) {
  return (
    <div className="space-y-2">
      <KV k="Name" v={v.display_name} />
      <KV k="Email" v={v.email ?? "—"} />
      <KV
        k="Status"
        v={
          <Badge variant={v.is_active ? "secondary" : "outline"}>
            {v.is_active ? "Active" : "Inactive"}
          </Badge>
        }
      />
      <KV k="Total visits" v={v.visits} />
      <KV k="Time on app" v={formatMinutes(v.total_minutes)} />
      <KV k="Last seen" v={`${formatRelative(v.last_seen)} (${formatDate(v.last_seen)})`} />
      <KV k="User ID" v={<span className="font-mono text-[10px]">{v.user_id}</span>} />
    </div>
  );
}

function VisitorsPanel({
  data,
  onOpenDetail,
}: {
  data: VisitorsBlock;
  onOpenDetail: (d: DetailPayload) => void;
}) {
  const [open, setOpen] = useState(true);
  const activePct =
    data.totalRegisteredUsers > 0
      ? Math.round((data.activeUsers / data.totalRegisteredUsers) * 100)
      : 0;
  const maxTrend = Math.max(1, ...data.dailyTrend.map((d) => d.visits));

  const activeList = data.topVisitors.filter((v) => v.is_active);
  const inactiveList = data.topVisitors.filter((v) => !v.is_active);

  const visitorList = (rows: VisitorRow[], empty: string) =>
    rows.length === 0 ? (
      <p className="text-sm text-muted-foreground">{empty}</p>
    ) : (
      <div className="space-y-1.5">
        {rows.map((v) => (
          <button
            key={v.user_id}
            type="button"
            className="flex w-full items-center justify-between rounded-md border p-2 text-left text-xs hover:bg-muted/50"
            onClick={() =>
              onOpenDetail({
                title: v.display_name,
                description: v.email ?? undefined,
                content: <VisitorProfileDetail v={v} />,
              })
            }
          >
            <div>
              <div className="font-medium">{v.display_name}</div>
              {v.email && <div className="text-muted-foreground">{v.email}</div>}
            </div>
            <div className="text-right text-muted-foreground">
              <div>{v.visits} visits</div>
              <div>{formatMinutes(v.total_minutes)}</div>
            </div>
          </button>
        ))}
      </div>
    );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/40"
          >
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <div className="text-base font-semibold">Visitor analytics</div>
                <div className="text-xs text-muted-foreground">
                  Last {data.windowDays} days · {data.totalVisits} visits ·{" "}
                  {data.uniqueVisitors} unique · most recent{" "}
                  {formatRelative(data.mostRecentVisit)}
                </div>
              </div>
            </div>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Clickable headline stats */}
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Registered users"
                value={data.totalRegisteredUsers}
                icon={<Users />}
                onClick={() =>
                  onOpenDetail({
                    title: "Registered users",
                    description: `${data.totalRegisteredUsers} total · ${data.activeUsers} active · ${data.inactiveUsers} inactive`,
                    content: visitorList(data.topVisitors, "No users."),
                  })
                }
              />
              <StatCard
                label="Active (last 7d)"
                value={data.activeUsers}
                tone="success"
                icon={<UserCheck />}
                onClick={() =>
                  onOpenDetail({
                    title: "Active users",
                    description: `${data.activeUsers} active in the last 7 days`,
                    content: visitorList(activeList, "No active users."),
                  })
                }
              />
              <StatCard
                label="Inactive"
                value={data.inactiveUsers}
                tone="muted"
                icon={<UserX />}
                onClick={() =>
                  onOpenDetail({
                    title: "Inactive users",
                    description: "Have not visited in the last 7 days",
                    content: visitorList(inactiveList, "No inactive users."),
                  })
                }
              />
              <StatCard
                label="Avg session"
                value={data.avgSessionMinutes}
                tone="muted"
                icon={<Clock />}
                onClick={() =>
                  onOpenDetail({
                    title: "Session duration",
                    description: `Average session: ${formatMinutes(data.avgSessionMinutes)}`,
                    content: (
                      <div className="space-y-2 text-sm">
                        <KV k="Average minutes" v={data.avgSessionMinutes} />
                        <KV k="Total visits" v={data.totalVisits} />
                        <KV k="Unique visitors" v={data.uniqueVisitors} />
                        <p className="pt-2 text-xs text-muted-foreground">
                          A session ends after 30 minutes of inactivity.
                        </p>
                      </div>
                    ),
                  })
                }
              />
            </section>

            {/* Active vs inactive bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Active vs inactive users</span>
                <span>{activePct}% active</span>
              </div>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="bg-emerald-500"
                  style={{ width: `${activePct}%` }}
                  title={`${data.activeUsers} active`}
                />
                <div
                  className="bg-muted-foreground/30"
                  style={{ width: `${100 - activePct}%` }}
                  title={`${data.inactiveUsers} inactive`}
                />
              </div>
            </div>

            <CollapsibleSection
              title="Daily visits (last 14 days)"
              icon={<Activity className="h-4 w-4" />}
              defaultOpen
            >
              <div className="flex h-24 items-end gap-1">
                {data.dailyTrend.map((d) => (
                  <div
                    key={d.date}
                    className="group relative flex-1"
                    title={`${d.date} · ${d.visits} visits · ${d.uniqueUsers} users`}
                  >
                    <div
                      className="w-full rounded-t bg-primary/70 transition-colors group-hover:bg-primary"
                      style={{
                        height: `${(d.visits / maxTrend) * 100}%`,
                        minHeight: d.visits > 0 ? "2px" : "0",
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>{data.dailyTrend[0]?.date}</span>
                <span>{data.dailyTrend[data.dailyTrend.length - 1]?.date}</span>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Frequent visitors per month (last 6 months)"
              icon={<Activity className="h-4 w-4" />}
            >
              {(() => {
                const maxM = Math.max(1, ...data.monthlyTrend.map((m) => m.visits));
                return (
                  <div className="grid gap-2 sm:grid-cols-6">
                    {data.monthlyTrend.map((m, idx) => {
                      const top = data.monthlyTopVisitors[idx]?.top ?? [];
                      return (
                        <button
                          key={m.month}
                          type="button"
                          className="space-y-1 rounded-md border bg-card/50 p-2 text-left hover:border-primary/50 hover:shadow-sm"
                          onClick={() =>
                            onOpenDetail({
                              title: `Month · ${m.month}`,
                              description: `${m.visits} visits · ${m.uniqueUsers} unique users`,
                              content: (
                                <div className="space-y-2 text-sm">
                                  <KV k="Visits" v={m.visits} />
                                  <KV k="Unique users" v={m.uniqueUsers} />
                                  <div className="pt-2">
                                    <div className="mb-1 text-xs text-muted-foreground">
                                      Top visitors
                                    </div>
                                    {top.length === 0 ? (
                                      <p className="text-xs text-muted-foreground">None.</p>
                                    ) : (
                                      <div className="space-y-1">
                                        {top.map((t) => (
                                          <div
                                            key={t.user}
                                            className="flex items-center justify-between rounded border p-1.5 text-xs"
                                          >
                                            <span>{t.user}</span>
                                            <Badge variant="outline">{t.visits}</Badge>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ),
                            })
                          }
                        >
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {m.month}
                          </div>
                          <div className="flex h-16 items-end">
                            <div
                              className="w-full rounded-t bg-primary"
                              style={{
                                height: `${(m.visits / maxM) * 100}%`,
                                minHeight: m.visits > 0 ? "2px" : "0",
                              }}
                            />
                          </div>
                          <div className="text-xs font-semibold">{m.visits}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {m.uniqueUsers} users
                          </div>
                          {top.length > 0 && (
                            <div className="space-y-0.5 border-t pt-1">
                              {top.map((t) => (
                                <div
                                  key={t.user}
                                  className="flex items-center justify-between text-[10px]"
                                >
                                  <span className="truncate" title={t.user}>
                                    {t.user}
                                  </span>
                                  <span className="text-muted-foreground">{t.visits}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </CollapsibleSection>

            <CollapsibleSection
              title="Most visited modules (cumulative)"
              count={data.topModulesCumulative.length}
            >
              {data.topModulesCumulative.length === 0 ? (
                <p className="text-sm text-muted-foreground">No module activity recorded.</p>
              ) : (
                (() => {
                  const maxV = Math.max(1, ...data.topModulesCumulative.map((m) => m.visits));
                  return (
                    <div className="space-y-1.5">
                      {data.topModulesCumulative.map((m) => {
                        const users = data.topModulesPerUser
                          .map((u) => {
                            const hit = u.modules.find((x) => x.module === m.module);
                            return hit ? { user: u.user, email: u.email, visits: hit.visits } : null;
                          })
                          .filter((x): x is { user: string; email: string | null; visits: number } => !!x)
                          .sort((a, b) => b.visits - a.visits);
                        return (
                          <button
                            key={m.module}
                            type="button"
                            className="w-full space-y-1 rounded-md p-2 text-left hover:bg-muted/50"
                            onClick={() =>
                              onOpenDetail({
                                title: `Module · ${m.module}`,
                                description: `${m.visits} visits · ${m.uniqueUsers} unique users`,
                                content: (
                                  <div className="space-y-3 text-sm">
                                    <KV k="Total visits" v={m.visits} />
                                    <KV k="Unique users" v={m.uniqueUsers} />
                                    <div>
                                      <div className="mb-1 text-xs text-muted-foreground">
                                        Users who visited
                                      </div>
                                      {users.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">None.</p>
                                      ) : (
                                        <div className="space-y-1">
                                          {users.map((u) => (
                                            <div
                                              key={u.user}
                                              className="flex items-center justify-between rounded border p-1.5 text-xs"
                                            >
                                              <div>
                                                <div className="font-medium">{u.user}</div>
                                                {u.email && (
                                                  <div className="text-muted-foreground">
                                                    {u.email}
                                                  </div>
                                                )}
                                              </div>
                                              <Badge variant="outline">{u.visits}</Badge>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ),
                              })
                            }
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium">{m.module}</span>
                              <span className="text-muted-foreground">
                                {m.visits} visits · {m.uniqueUsers} users
                              </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${(m.visits / maxV) * 100}%` }}
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </CollapsibleSection>

            <CollapsibleSection
              title="Most visited modules per employee"
              count={data.topModulesPerUser.length}
            >
              {data.topModulesPerUser.length === 0 ? (
                <p className="text-sm text-muted-foreground">No employee activity recorded.</p>
              ) : (
                <ScrollArea className="max-h-[360px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Top modules</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.topModulesPerUser.map((u) => (
                        <TableRow
                          key={`${u.user}-${u.email ?? ""}`}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() =>
                            onOpenDetail({
                              title: u.user,
                              description: u.email ?? undefined,
                              content: (
                                <div className="space-y-3 text-sm">
                                  <div className="text-xs text-muted-foreground">
                                    Module activity for this employee
                                  </div>
                                  <div className="space-y-1">
                                    {u.modules.map((m) => (
                                      <div
                                        key={m.module}
                                        className="flex items-center justify-between rounded border p-1.5 text-xs"
                                      >
                                        <span className="font-medium">{m.module}</span>
                                        <Badge variant="outline">{m.visits} visits</Badge>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ),
                            })
                          }
                        >
                          <TableCell className="text-xs align-top">
                            <div className="font-medium">{u.user}</div>
                            {u.email && (
                              <div className="text-muted-foreground">{u.email}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1.5">
                              {u.modules.map((m) => (
                                <Badge key={m.module} variant="outline" className="text-[10px]">
                                  {m.module} · {m.visits}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CollapsibleSection>

            <CollapsibleSection
              title="Top visitors"
              count={data.topVisitors.length}
              defaultOpen
            >
              {data.topVisitors.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No activity recorded in this window yet.
                </p>
              ) : (
                <ScrollArea className="max-h-[360px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Visits</TableHead>
                        <TableHead className="text-right">Time spent</TableHead>
                        <TableHead>Last seen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.topVisitors.map((v) => (
                        <TableRow
                          key={v.user_id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() =>
                            onOpenDetail({
                              title: v.display_name,
                              description: v.email ?? undefined,
                              content: <VisitorProfileDetail v={v} />,
                            })
                          }
                        >
                          <TableCell className="text-xs">
                            <div className="font-medium">{v.display_name}</div>
                            {v.email && (
                              <div className="text-muted-foreground">{v.email}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={v.is_active ? "secondary" : "outline"}>
                              {v.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs">{v.visits}</TableCell>
                          <TableCell className="text-right text-xs">
                            {formatMinutes(v.total_minutes)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {formatRelative(v.last_seen)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CollapsibleSection>

            <CollapsibleSection
              title="Most recent visits"
              count={data.recentVisits.length}
            >
              {data.recentVisits.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent activity.</p>
              ) : (
                <ScrollArea className="max-h-[360px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Module</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recentVisits.map((r, idx) => (
                        <TableRow
                          key={`${r.at}-${idx}`}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() =>
                            onOpenDetail({
                              title: `Visit · ${r.user}`,
                              description: formatDate(r.at),
                              content: (
                                <div className="space-y-2 text-sm">
                                  <KV k="User" v={r.user} />
                                  <KV k="Email" v={r.email ?? "—"} />
                                  <KV k="Module" v={r.module} />
                                  <KV k="Action" v={r.action} />
                                  <KV k="When" v={`${formatRelative(r.at)} (${formatDate(r.at)})`} />
                                </div>
                              ),
                            })
                          }
                        >
                          <TableCell className="whitespace-nowrap text-xs">
                            {formatRelative(r.at)}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="font-medium">{r.user}</div>
                            {r.email && (
                              <div className="text-muted-foreground">{r.email}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{r.module}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.action}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CollapsibleSection>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
