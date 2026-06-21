import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermission } from "@/lib/permissions.functions";

const optional = (max = 8000) => z.string().trim().max(max).optional().default("");

const investigationSchema = z.object({
  recordId: z.string().uuid(),
  investigationFindings: optional(),
  rootCause: optional(),
  immediateAction: optional(),
  correctiveActions: optional(),
  preventiveActions: optional(),
  responsiblePersonId: z.string().uuid().optional().or(z.literal("")),
  actionDueDate: z.string().max(10).optional().default(""),
  lessonsLearned: optional(),
  closureEvidence: optional(),
});

export const submitEnvironmentalInvestigation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => investigationSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertPermission(context, "environment", "edit");
    const update = {
      investigation_findings: data.investigationFindings || null,
      root_cause: data.rootCause || null,
      immediate_action: data.immediateAction || null,
      corrective_actions: data.correctiveActions || null,
      preventive_actions: data.preventiveActions || null,
      responsible_person_id: data.responsiblePersonId || null,
      action_due_date: data.actionDueDate || null,
      lessons_learned: data.lessonsLearned || null,
      closure_evidence: data.closureEvidence || null,
    };
    const { error } = await context.supabase
      .from("environmental_aspects")
      .update(update)
      .eq("id", data.recordId);
    if (error) throw new Error("Investigation details could not be saved.");
    return { ok: true };
  });

export const approveEnvironmentalRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ recordId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertPermission(context, "environment", "approve");
    const { error } = await context.supabase
      .from("environmental_aspects")
      .update({
        approval_status: "approved",
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", data.recordId);
    if (error) throw new Error("The record could not be approved.");
    return { ok: true };
  });

export const verifyEnvironmentalClosure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ recordId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertPermission(context, "environment", "approve");
    const { error } = await context.supabase
      .from("environmental_aspects")
      .update({
        verified_by: context.userId,
        verified_at: new Date().toISOString(),
        status: "closed",
      })
      .eq("id", data.recordId);
    if (error) throw new Error("Closure verification could not be saved.");
    return { ok: true };
  });

export const getEnvironmentalRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ recordId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertPermission(context, "environment", "view");
    const { data: row, error } = await context.supabase
      .from("environmental_aspects")
      .select("*")
      .eq("id", data.recordId)
      .single();
    if (error || !row) throw new Error("Record could not be loaded.");
    return row;
  });
