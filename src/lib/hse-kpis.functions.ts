import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type HseKpiSnapshot = {
  windowMonths: number;
  generatedAt: string;
  workforce: {
    activeEmployees: number;
    estimatedHoursWorked: number;
  };
  safety: {
    incidentsTotal: number;
    lostTimeInjuries: number;
    recordableInjuries: number;
    ltifr: number; // per 1,000,000 hours
    trir: number; // per 200,000 hours
    severityRate: number; // lost-time injuries per 200,000 hours (proxy)
    fatalitiesProxy: number;
  };
  nearMissRatio: {
    nearMisses: number;
    incidents: number;
    ratio: number; // near-miss / incidents
  };
  incidentTrend: Array<{
    month: string; // YYYY-MM-01
    total: number;
    low: number;
    moderate: number;
    high: number;
    critical: number;
    nearMiss: number;
  }>;
  capa: {
    openTotal: number;
    overdueOpen: number;
    completedInWindow: number;
    onTimeCompleted: number;
    onTimePercent: number; // 0..100
    avgDaysToClose: number | null;
  };
  objectives: {
    total: number;
    green: number;
    amber: number;
    red: number;
    unrated: number;
    onTrackPercent: number; // green / rated
  };
  training: {
    activeRecords: number;
    valid: number;
    expiring30d: number;
    expired: number;
    compliancePercent: number; // valid / activeRecords
  };
  environment: {
    waste: { total: number; unit: string; hazardous: number; nonHazardous: number };
    water: { total: number; unit: string };
    energy: { total: number; unit: string };
    emissions: { total: number; unit: string; scope1: number; scope2: number; scope3: number };
    intensityPerEmployee: {
      wastePerEmployee: number;
      emissionsPerEmployee: number;
    };
  };
};

function pctSafe(n: number, d: number) {
  if (d <= 0) return 0;
  return Math.round((n / d) * 1000) / 10;
}

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export const getHseKpis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ windowMonths: z.number().int().min(1).max(36).default(12) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<HseKpiSnapshot> => {
    const { supabase } = context;
    const windowMonths = data.windowMonths;
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (windowMonths - 1), 1));
    const startIso = start.toISOString();
    const todayStr = now.toISOString().slice(0, 10);
    const in30 = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const [
      employeesRes,
      incidentsRes,
      nearMissesRes,
      actionsRes,
      objectivesRes,
      trainingRes,
      wasteRes,
      resourceRes,
      emissionRes,
    ] = await Promise.all([
      supabase.from("employees").select("id", { count: "exact", head: true }).eq("employment_status", "active"),
      supabase
        .from("incidents")
        .select("id, incident_type, severity, occurred_at, status, approved_at, action_due_date, created_at")
        .gte("occurred_at", startIso),
      supabase
        .from("near_misses")
        .select("id, potential_severity, occurred_at")
        .gte("occurred_at", startIso),
      supabase
        .from("actions")
        .select("id, status, due_date, completed_on, created_at, updated_at"),
      supabase.from("hse_objectives").select("id, rag_status"),
      supabase.from("training_records").select("id, status, expires_on"),
      supabase
        .from("environmental_waste_records")
        .select("waste_category, quantity, unit, recorded_on")
        .gte("recorded_on", startIso.slice(0, 10)),
      supabase
        .from("environmental_resource_records")
        .select("resource_type, quantity, unit, period_start")
        .gte("period_start", startIso.slice(0, 10)),
      supabase
        .from("environmental_emission_records")
        .select("scope, quantity, unit, period_start")
        .gte("period_start", startIso.slice(0, 10)),
    ]);

    const activeEmployees = employeesRes.count ?? 0;
    const estimatedHoursWorked = Math.max(1, activeEmployees) * 2000 * (windowMonths / 12);

    const incidents = incidentsRes.data ?? [];
    const nearMisses = nearMissesRes.data ?? [];

    // Safety
    const injury = incidents.filter((r) => r.incident_type === "injury");
    const lostTimeInjuries = injury.filter((r) => r.severity === "high" || r.severity === "critical").length;
    const recordableInjuries = incidents.filter(
      (r) => r.incident_type === "injury" || r.incident_type === "occupational_illness",
    ).length;
    const fatalitiesProxy = injury.filter((r) => r.severity === "critical").length;
    const ltifr = Math.round((lostTimeInjuries * 1_000_000 / estimatedHoursWorked) * 100) / 100;
    const trir = Math.round((recordableInjuries * 200_000 / estimatedHoursWorked) * 100) / 100;
    const severityRate = Math.round((lostTimeInjuries * 200_000 / estimatedHoursWorked) * 100) / 100;

    // Incident trend
    const buckets = new Map<string, { month: string; total: number; low: number; moderate: number; high: number; critical: number; nearMiss: number }>();
    for (let i = 0; i < windowMonths; i++) {
      const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
      const key = monthKey(d);
      buckets.set(key, { month: key, total: 0, low: 0, moderate: 0, high: 0, critical: 0, nearMiss: 0 });
    }
    for (const r of incidents) {
      const d = new Date(r.occurred_at as string);
      const key = monthKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
      const b = buckets.get(key);
      if (!b) continue;
      b.total += 1;
      const sev = String(r.severity ?? "low") as "low" | "moderate" | "high" | "critical";
      if (sev === "low" || sev === "moderate" || sev === "high" || sev === "critical") b[sev] += 1;
    }
    for (const r of nearMisses) {
      const d = new Date(r.occurred_at as string);
      const key = monthKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
      const b = buckets.get(key);
      if (b) b.nearMiss += 1;
    }
    const incidentTrend = [...buckets.values()];

    // CAPA
    const actions = actionsRes.data ?? [];
    const openTotal = actions.filter((a) => !["completed", "closed"].includes(String(a.status))).length;
    const overdueOpen = actions.filter(
      (a) => !["completed", "closed"].includes(String(a.status)) && a.due_date && String(a.due_date) < todayStr,
    ).length;
    const completedInWindowList = actions.filter(
      (a) => ["completed", "closed"].includes(String(a.status)) && a.updated_at && (a.updated_at as string) >= startIso,
    );
    const completedInWindow = completedInWindowList.length;
    const onTimeCompleted = completedInWindowList.filter(
      (a) => a.completed_on && a.due_date && String(a.completed_on) <= String(a.due_date),
    ).length;
    const closureDays = completedInWindowList
      .map((a) => {
        if (!a.completed_on || !a.created_at) return null;
        const c = new Date(a.created_at as string).getTime();
        const f = new Date(a.completed_on as string).getTime();
        return (f - c) / (24 * 3600 * 1000);
      })
      .filter((n): n is number => n !== null && isFinite(n) && n >= 0);
    const avgDaysToClose = closureDays.length
      ? Math.round((closureDays.reduce((a, b) => a + b, 0) / closureDays.length) * 10) / 10
      : null;

    // Objectives
    const objectives = objectivesRes.data ?? [];
    const green = objectives.filter((o) => o.rag_status === "green").length;
    const amber = objectives.filter((o) => o.rag_status === "amber").length;
    const red = objectives.filter((o) => o.rag_status === "red").length;
    const unrated = objectives.length - green - amber - red;
    const rated = green + amber + red;

    // Training
    const tr = trainingRes.data ?? [];
    const active = tr.filter((r) => r.status !== "not_required");
    const valid = active.filter((r) => r.status === "valid").length;
    const expiring30d = active.filter(
      (r) => r.expires_on && (r.expires_on as string) >= todayStr && (r.expires_on as string) <= in30,
    ).length;
    const expired = active.filter((r) => r.status === "expired").length;

    // Environment
    const waste = wasteRes.data ?? [];
    const wasteTotal = waste.reduce((s, r) => s + Number(r.quantity ?? 0), 0);
    const hazardousWaste = waste
      .filter((r) => String(r.waste_category).toLowerCase().includes("hazard"))
      .reduce((s, r) => s + Number(r.quantity ?? 0), 0);
    const nonHazardousWaste = wasteTotal - hazardousWaste;
    const wasteUnit = waste[0]?.unit ?? "kg";

    const resource = resourceRes.data ?? [];
    const water = resource.filter((r) => String(r.resource_type).toLowerCase().includes("water"));
    const energy = resource.filter((r) => {
      const t = String(r.resource_type).toLowerCase();
      return t.includes("energy") || t.includes("electric") || t.includes("fuel") || t.includes("diesel") || t.includes("gas");
    });
    const waterTotal = water.reduce((s, r) => s + Number(r.quantity ?? 0), 0);
    const energyTotal = energy.reduce((s, r) => s + Number(r.quantity ?? 0), 0);

    const emissions = emissionRes.data ?? [];
    const emTotal = emissions.reduce((s, r) => s + Number(r.quantity ?? 0), 0);
    const scope1 = emissions.filter((r) => String(r.scope) === "scope_1" || String(r.scope) === "1").reduce((s, r) => s + Number(r.quantity ?? 0), 0);
    const scope2 = emissions.filter((r) => String(r.scope) === "scope_2" || String(r.scope) === "2").reduce((s, r) => s + Number(r.quantity ?? 0), 0);
    const scope3 = emissions.filter((r) => String(r.scope) === "scope_3" || String(r.scope) === "3").reduce((s, r) => s + Number(r.quantity ?? 0), 0);

    return {
      windowMonths,
      generatedAt: now.toISOString(),
      workforce: { activeEmployees, estimatedHoursWorked: Math.round(estimatedHoursWorked) },
      safety: {
        incidentsTotal: incidents.length,
        lostTimeInjuries,
        recordableInjuries,
        ltifr,
        trir,
        severityRate,
        fatalitiesProxy,
      },
      nearMissRatio: {
        nearMisses: nearMisses.length,
        incidents: incidents.length,
        ratio: Math.round((nearMisses.length / Math.max(1, incidents.length)) * 100) / 100,
      },
      incidentTrend,
      capa: {
        openTotal,
        overdueOpen,
        completedInWindow,
        onTimeCompleted,
        onTimePercent: pctSafe(onTimeCompleted, completedInWindow),
        avgDaysToClose,
      },
      objectives: {
        total: objectives.length,
        green,
        amber,
        red,
        unrated,
        onTrackPercent: pctSafe(green, rated),
      },
      training: {
        activeRecords: active.length,
        valid,
        expiring30d,
        expired,
        compliancePercent: pctSafe(valid, active.length),
      },
      environment: {
        waste: { total: Math.round(wasteTotal * 100) / 100, unit: wasteUnit, hazardous: Math.round(hazardousWaste * 100) / 100, nonHazardous: Math.round(nonHazardousWaste * 100) / 100 },
        water: { total: Math.round(waterTotal * 100) / 100, unit: water[0]?.unit ?? "m³" },
        energy: { total: Math.round(energyTotal * 100) / 100, unit: energy[0]?.unit ?? "kWh" },
        emissions: {
          total: Math.round(emTotal * 100) / 100,
          unit: emissions[0]?.unit ?? "tCO₂e",
          scope1: Math.round(scope1 * 100) / 100,
          scope2: Math.round(scope2 * 100) / 100,
          scope3: Math.round(scope3 * 100) / 100,
        },
        intensityPerEmployee: {
          wastePerEmployee: activeEmployees ? Math.round((wasteTotal / activeEmployees) * 100) / 100 : 0,
          emissionsPerEmployee: activeEmployees ? Math.round((emTotal / activeEmployees) * 100) / 100 : 0,
        },
      },
    };
  });
