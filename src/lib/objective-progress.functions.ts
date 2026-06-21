import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermission } from "@/lib/permissions.functions";

const upsertSchema = z.object({
  objectiveId: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  targetValue: z.number().finite().nullable().optional(),
  actualValue: z.number().finite().nullable().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const getObjectiveMonthlyProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ objectiveId: z.string().uuid(), year: z.number().int().min(2000).max(2100) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertPermission(context, "objectives", "view");
    const { data: rows, error } = await context.supabase
      .from("hse_objective_monthly_progress")
      .select("*")
      .eq("objective_id", data.objectiveId)
      .eq("year", data.year)
      .order("month", { ascending: true });
    if (error) throw new Error("Monthly progress could not be loaded.");
    return rows ?? [];
  });

export const upsertObjectiveMonthlyProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => upsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertPermission(context, "objectives", "edit");
    const payload = {
      objective_id: data.objectiveId,
      year: data.year,
      month: data.month,
      target_value: data.targetValue ?? null,
      actual_value: data.actualValue ?? null,
      notes: data.notes ?? null,
      updated_by: context.userId,
    };
    const { error } = await context.supabase
      .from("hse_objective_monthly_progress")
      .upsert(payload as never, { onConflict: "objective_id,year,month" });
    if (error) throw new Error("Monthly progress could not be saved.");

    // Refresh the parent objective's current_performance so the generated
    // achievement_percent and rag_status columns reflect the latest entry.
    // We use the most recent non-null actual value across all recorded months.
    const { data: latest } = await context.supabase
      .from("hse_objective_monthly_progress")
      .select("year, month, actual_value")
      .eq("objective_id", data.objectiveId)
      .not("actual_value", "is", null)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(1);
    const latestActual = latest?.[0]?.actual_value;
    if (latestActual !== undefined && latestActual !== null) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("hse_objectives")
        .update({ current_performance: latestActual } as never)
        .eq("id", data.objectiveId);
    }

    return { ok: true };
  });

