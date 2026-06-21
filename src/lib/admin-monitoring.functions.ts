import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

async function requireAdmin(context: {
  supabase: SupabaseClient<Database>;
  userId: string;
}) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Only administrators can view system monitoring.");
}

export type EmailLogRow = {
  id: string;
  message_id: string | null;
  template_name: string | null;
  recipient_email: string | null;
  status: string | null;
  error_message: string | null;
  created_at: string;
};

export type FailingSubscription = {
  id: string;
  module: string;
  cadence: string;
  recipients: string[] | null;
  failure_count: number;
  last_error: string | null;
  next_run_at: string | null;
  last_run_at: string | null;
};

export type VisitorRow = {
  user_id: string;
  display_name: string;
  email: string | null;
  visits: number;
  total_minutes: number;
  last_seen: string;
  is_active: boolean;
};

export type VisitorsBlock = {
  windowDays: number;
  totalRegisteredUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  totalVisits: number;
  uniqueVisitors: number;
  avgSessionMinutes: number;
  mostRecentVisit: string | null;
  dailyTrend: { date: string; visits: number; uniqueUsers: number }[];
  monthlyTrend: { month: string; visits: number; uniqueUsers: number }[];
  monthlyTopVisitors: { month: string; top: { user: string; visits: number }[] }[];
  topVisitors: VisitorRow[];
  recentVisits: { user: string; email: string | null; module: string; action: string; at: string }[];
  topModulesCumulative: { module: string; visits: number; uniqueUsers: number }[];
  topModulesPerUser: { user: string; email: string | null; modules: { module: string; visits: number }[] }[];
};

export type AdminMonitoringSnapshot = {
  generatedAt: string;
  email: {
    windowDays: number;
    totals: { sent: number; failed: number; suppressed: number; pending: number; total: number };
    recentFailures: EmailLogRow[];
    recentSuppressions: { email: string; reason: string | null; created_at: string }[];
  };
  reports: {
    failing: FailingSubscription[];
    activeCount: number;
  };
  visitors: VisitorsBlock;
};

export const getAdminMonitoringSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminMonitoringSnapshot> => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Pull recent rows; dedupe in memory by message_id (latest by created_at).
    const { data: logRows } = await supabaseAdmin
      .from("email_send_log")
      .select("id,message_id,template_name,recipient_email,status,error_message,created_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(2000);

    const seen = new Set<string>();
    const latest: EmailLogRow[] = [];
    for (const row of (logRows ?? []) as EmailLogRow[]) {
      const key = row.message_id ?? `row:${row.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      latest.push(row);
    }

    const totals = { sent: 0, failed: 0, suppressed: 0, pending: 0, total: latest.length };
    for (const row of latest) {
      const s = (row.status ?? "").toLowerCase();
      if (s === "sent") totals.sent += 1;
      else if (s === "dlq" || s === "failed" || s === "bounced" || s === "complained")
        totals.failed += 1;
      else if (s === "suppressed") totals.suppressed += 1;
      else if (s === "pending") totals.pending += 1;
    }

    const recentFailures = latest
      .filter((row) => {
        const s = (row.status ?? "").toLowerCase();
        return s === "dlq" || s === "failed" || s === "bounced";
      })
      .slice(0, 25);

    const { data: suppressedRows } = await supabaseAdmin
      .from("suppressed_emails")
      .select("email,reason,created_at")
      .order("created_at", { ascending: false })
      .limit(15);

    const { data: failingSubs } = await supabaseAdmin
      .from("report_subscriptions")
      .select(
        "id,module,cadence,recipients,failure_count,last_error,next_run_at,last_run_at,is_active",
      )
      .eq("is_active", true)
      .gt("failure_count", 0)
      .order("failure_count", { ascending: false })
      .limit(25);

    const { count: activeCount } = await supabaseAdmin
      .from("report_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);

    // ===== Visitor analytics =====
    const VISITOR_WINDOW_DAYS = 180;
    const ACTIVE_WINDOW_DAYS = 7;
    const SESSION_GAP_MIN = 30;
    const visitorSinceIso = new Date(
      Date.now() - VISITOR_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const activeSinceMs = Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

    const { data: activityRows } = await supabaseAdmin
      .from("user_activity_logs")
      .select("actor_id,module,action,created_at")
      .gte("created_at", visitorSinceIso)
      .order("created_at", { ascending: true })
      .limit(10000);

    const acts = (activityRows ?? []) as Array<{
      actor_id: string;
      module: string;
      action: string;
      created_at: string;
    }>;

    const { data: profileRows } = await supabaseAdmin
      .from("profiles")
      .select("id,full_name,email");
    const profileMap = new Map<string, { name: string; email: string | null }>();
    for (const p of (profileRows ?? []) as Array<{
      id: string;
      full_name: string | null;
      email: string | null;
    }>) {
      profileMap.set(p.id, { name: p.full_name ?? p.email ?? "Unknown user", email: p.email });
    }

    const { count: totalRegisteredUsers } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true });

    // Group by user → sessions (gap > 30 min = new session)
    const byUser = new Map<string, string[]>();
    for (const a of acts) {
      if (!byUser.has(a.actor_id)) byUser.set(a.actor_id, []);
      byUser.get(a.actor_id)!.push(a.created_at);
    }

    let totalSessions = 0;
    let totalSessionMinutes = 0;
    const topVisitors: VisitorRow[] = [];
    let mostRecentVisitMs = 0;

    for (const [userId, timesIso] of byUser.entries()) {
      const times = timesIso.map((t) => new Date(t).getTime()).sort((a, b) => a - b);
      let userSessions = 0;
      let userMinutes = 0;
      let sessionStart = times[0];
      let prev = times[0];
      for (let i = 1; i < times.length; i++) {
        if (times[i] - prev > SESSION_GAP_MIN * 60 * 1000) {
          userSessions += 1;
          userMinutes += (prev - sessionStart) / 60000;
          sessionStart = times[i];
        }
        prev = times[i];
      }
      userSessions += 1;
      userMinutes += (prev - sessionStart) / 60000;
      // Minimum 1 min per session (single-event session)
      userMinutes = Math.max(userMinutes, userSessions);

      const lastMs = times[times.length - 1];
      if (lastMs > mostRecentVisitMs) mostRecentVisitMs = lastMs;
      totalSessions += userSessions;
      totalSessionMinutes += userMinutes;

      const profile = profileMap.get(userId);
      topVisitors.push({
        user_id: userId,
        display_name: profile?.name ?? "Unknown user",
        email: profile?.email ?? null,
        visits: userSessions,
        total_minutes: Math.round(userMinutes),
        last_seen: new Date(lastMs).toISOString(),
        is_active: lastMs >= activeSinceMs,
      });
    }
    topVisitors.sort((a, b) => b.visits - a.visits);

    const activeUsers = topVisitors.filter((v) => v.is_active).length;
    const inactiveUsers = Math.max((totalRegisteredUsers ?? 0) - activeUsers, 0);

    // Daily trend (last 14 days)
    const TREND_DAYS = 14;
    const dayBuckets = new Map<string, { visits: number; users: Set<string> }>();
    for (let d = TREND_DAYS - 1; d >= 0; d--) {
      const key = new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      dayBuckets.set(key, { visits: 0, users: new Set() });
    }
    for (const a of acts) {
      const key = a.created_at.slice(0, 10);
      const b = dayBuckets.get(key);
      if (b) {
        b.visits += 1;
        b.users.add(a.actor_id);
      }
    }
    const dailyTrend = Array.from(dayBuckets.entries()).map(([date, b]) => ({
      date,
      visits: b.visits,
      uniqueUsers: b.users.size,
    }));

    const recentVisits = acts
      .slice(-25)
      .reverse()
      .map((a) => {
        const p = profileMap.get(a.actor_id);
        return {
          user: p?.name ?? "Unknown user",
          email: p?.email ?? null,
          module: a.module,
          action: a.action,
          at: a.created_at,
        };
      });

    // Monthly trend (last 6 months)
    const MONTH_COUNT = 6;
    const monthKeys: string[] = [];
    const now = new Date();
    for (let i = MONTH_COUNT - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const monthBuckets = new Map<string, { visits: number; users: Set<string>; perUser: Map<string, number> }>();
    monthKeys.forEach((k) => monthBuckets.set(k, { visits: 0, users: new Set(), perUser: new Map() }));
    for (const a of acts) {
      const key = a.created_at.slice(0, 7);
      const b = monthBuckets.get(key);
      if (b) {
        b.visits += 1;
        b.users.add(a.actor_id);
        b.perUser.set(a.actor_id, (b.perUser.get(a.actor_id) ?? 0) + 1);
      }
    }
    const monthlyTrend = monthKeys.map((m) => {
      const b = monthBuckets.get(m)!;
      return { month: m, visits: b.visits, uniqueUsers: b.users.size };
    });
    const monthlyTopVisitors = monthKeys.map((m) => {
      const b = monthBuckets.get(m)!;
      const top = [...b.perUser.entries()]
        .map(([uid, count]) => ({
          user: profileMap.get(uid)?.name ?? "Unknown user",
          visits: count,
        }))
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 5);
      return { month: m, top };
    });

    // Module statistics
    const moduleAgg = new Map<string, { visits: number; users: Set<string> }>();
    const userModuleAgg = new Map<string, Map<string, number>>();
    for (const a of acts) {
      const m = a.module || "unknown";
      if (!moduleAgg.has(m)) moduleAgg.set(m, { visits: 0, users: new Set() });
      const mod = moduleAgg.get(m)!;
      mod.visits += 1;
      mod.users.add(a.actor_id);

      if (!userModuleAgg.has(a.actor_id)) userModuleAgg.set(a.actor_id, new Map());
      const um = userModuleAgg.get(a.actor_id)!;
      um.set(m, (um.get(m) ?? 0) + 1);
    }
    const topModulesCumulative = [...moduleAgg.entries()]
      .map(([module, v]) => ({ module, visits: v.visits, uniqueUsers: v.users.size }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 12);

    const topModulesPerUser = [...userModuleAgg.entries()]
      .map(([uid, modules]) => {
        const p = profileMap.get(uid);
        const sorted = [...modules.entries()]
          .map(([module, visits]) => ({ module, visits }))
          .sort((a, b) => b.visits - a.visits)
          .slice(0, 5);
        const total = sorted.reduce((s, x) => s + x.visits, 0);
        return {
          user: p?.name ?? "Unknown user",
          email: p?.email ?? null,
          modules: sorted,
          _total: total,
        };
      })
      .sort((a, b) => b._total - a._total)
      .slice(0, 10)
      .map(({ _total, ...rest }) => rest);

    return {
      generatedAt: new Date().toISOString(),
      email: {
        windowDays: 7,
        totals,
        recentFailures,
        recentSuppressions: (suppressedRows ?? []) as Array<{
          email: string;
          reason: string | null;
          created_at: string;
        }>,
      },
      reports: {
        failing: (failingSubs ?? []) as FailingSubscription[],
        activeCount: activeCount ?? 0,
      },
      visitors: {
        windowDays: VISITOR_WINDOW_DAYS,
        totalRegisteredUsers: totalRegisteredUsers ?? 0,
        activeUsers,
        inactiveUsers,
        totalVisits: totalSessions,
        uniqueVisitors: byUser.size,
        avgSessionMinutes:
          totalSessions > 0 ? Math.round((totalSessionMinutes / totalSessions) * 10) / 10 : 0,
        mostRecentVisit: mostRecentVisitMs ? new Date(mostRecentVisitMs).toISOString() : null,
        dailyTrend,
        monthlyTrend,
        monthlyTopVisitors,
        topVisitors: topVisitors.slice(0, 15),
        recentVisits,
        topModulesCumulative,
        topModulesPerUser,
      },
    };
  });
