import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCreateOrEditPermission, assertPermission } from "@/lib/permissions.functions";

const text = (max = 200) => z.string().trim().min(2).max(max);
const optionalText = (max = 2000) => z.string().trim().max(max).optional().default("");
const employeeId = z.string().uuid();

const recordSchema = z.discriminatedUnion("module", [
  z.object({
    module: z.literal("inspections"),
    title: text(),
    inspectionType: z.enum(["workplace", "field_site", "vehicle", "warehouse", "office", "ppe", "fire_safety", "other"]),
    site: text(120),
    department: text(120),
    area: text(),
    scheduledOn: z.string().min(10).max(10),
    visitDate: z.string().max(10).optional().default(""),
    attendees: optionalText(4000),
    findings: optionalText(8000),
    requiredActions: optionalText(8000),
    completionNotes: optionalText(8000),
    inspectorId: employeeId.optional().or(z.literal("")),
    summary: optionalText(4000),
    checklist: z.array(text(1000)).min(1).max(100),
  }),
  z.object({
    module: z.literal("training"),
    employeeId,
    courseName: text(),
    provider: optionalText(200),
    completedOn: z.string().max(10).optional().default(""),
    expiresOn: z.string().max(10).optional().default(""),
    certificateReference: optionalText(200),
    status: z.enum(["planned", "scheduled", "completed"]),
    notes: optionalText(),
  }),
  z.object({
    module: z.literal("competencies"),
    employeeId,
    competencyName: text(),
    requiredLevel: z.coerce.number().int().min(1).max(5),
    currentLevel: z.coerce.number().int().min(1).max(5),
    assessor: optionalText(200),
    assessedOn: z.string().max(10).optional().default(""),
    expiresOn: z.string().max(10).optional().default(""),
    evidence: optionalText(),
  }),
  z.object({
    module: z.literal("objectives"),
    objective: text(500),
    kpi: text(300),
    baseline: z.coerce.number().finite(),
    target: z.coerce.number().finite(),
    currentPerformance: z.coerce.number().finite(),
    direction: z.enum(["increase", "decrease"]),
    ownerId: employeeId.optional().or(z.literal("")),
    reviewDate: z.string().min(10).max(10),
    notes: optionalText(),
  }),
]);

const transitionSchema = z.object({
  module: z.enum(["inspections", "objectives"]),
  recordId: z.string().uuid(),
  fromStatus: z.string().min(2).max(40),
  toStatus: z.string().min(2).max(40),
});

const flows = {
  inspections: ["scheduled", "in_progress", "completed", "closed"],
  objectives: ["draft", "active", "completed", "closed"],
} as const;

function reference(prefix: string) {
  return `${prefix}-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export const getModulePackTwo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const permissionChecks = await Promise.all(
      (["inspections", "training", "competencies", "objectives"] as const).map(async (module) => {
        const { data } = await db.rpc("has_module_permission", {
          _user_id: context.userId,
          _module: module,
          _action: "view",
        });
        return [module, data === true] as const;
      }),
    );
    const canView = Object.fromEntries(permissionChecks) as Record<
      (typeof permissionChecks)[number][0],
      boolean
    >;
    const [inspections, checklist, training, competencies, objectives] = await Promise.all([
      canView.inspections
        ? db.from("inspections").select("*").order("scheduled_on", { ascending: false }).limit(250)
        : Promise.resolve({ data: [], error: null }),
      canView.inspections
        ? db.from("inspection_checklist_items").select("*").order("item_order").limit(1000)
        : Promise.resolve({ data: [], error: null }),
      canView.training
        ? db
            .from("training_records")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(500)
        : Promise.resolve({ data: [], error: null }),
      canView.competencies
        ? db
            .from("competency_records")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(500)
        : Promise.resolve({ data: [], error: null }),
      canView.objectives
        ? db.from("hse_objectives").select("*").order("created_at", { ascending: false }).limit(250)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const failure = [inspections, checklist, training, competencies, objectives].find(
      (result) => result.error,
    );
    if (failure?.error) throw new Error("Unable to load Module Pack 2 records.");
    return {
      inspections: inspections.data ?? [],
      checklist: checklist.data ?? [],
      training: training.data ?? [],
      competencies: competencies.data ?? [],
      objectives: objectives.data ?? [],
    };
  });

export const createModulePackTwoRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => recordSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCreateOrEditPermission(context, data.module);
    const db = context.supabase;
    if (data.module === "inspections") {
      const { data: inspection, error } = await db
        .from("inspections")
        .insert({
          reference: reference("INSP"),
          title: data.title,
          inspection_type: data.inspectionType,
          site: data.site,
          department: data.department,
          area: data.area,
          scheduled_on: data.scheduledOn,
          visit_date: data.visitDate || null,
          attendees: data.attendees || null,
          findings: data.findings || null,
          required_actions: data.requiredActions || null,
          completion_notes: data.completionNotes || null,
          inspector_id: data.inspectorId || null,
          summary: data.summary || null,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (error || !inspection) {
        if (error) console.error("[inspections] create failed", error.message);
        throw new Error("The inspection could not be scheduled. Please try again.");
      }
      const { error: itemError } = await db.from("inspection_checklist_items").insert(
        data.checklist.map((requirement, index) => ({
          inspection_id: inspection.id,
          item_order: index + 1,
          requirement,
          created_by: context.userId,
        })),
      );
      if (itemError) {
        console.error("[inspections] checklist create failed", itemError.message);
        throw new Error("The inspection checklist could not be saved. Please try again.");
      }
      await db.from("workflow_events").insert({
        module: "inspection",
        record_id: inspection.id,
        to_status: "scheduled",
        event_type: "created",
        actor_id: context.userId,
      });
    } else if (data.module === "training") {
      const { error } = await db.from("training_records").insert({
        employee_id: data.employeeId,
        course_name: data.courseName,
        provider: data.provider || null,
        completed_on: data.completedOn || null,
        expires_on: data.expiresOn || null,
        certificate_reference: data.certificateReference || null,
        status: data.status,
        notes: data.notes || null,
        created_by: context.userId,
      });
      if (error) {
        console.error("[training] create failed", error.message);
        throw new Error("The training record could not be saved. Please try again.");
      }
    } else if (data.module === "competencies") {
      const { error } = await db.from("competency_records").insert({
        employee_id: data.employeeId,
        competency_name: data.competencyName,
        required_level: data.requiredLevel,
        current_level: data.currentLevel,
        assessor: data.assessor || null,
        assessed_on: data.assessedOn || null,
        expires_on: data.expiresOn || null,
        evidence: data.evidence || null,
        status: data.currentLevel >= data.requiredLevel ? "competent" : "gap",
        created_by: context.userId,
      });
      if (error) {
        console.error("[competencies] create failed", error.message);
        throw new Error("The competency record could not be saved. Please try again.");
      }
    } else {
      const { error } = await db.from("hse_objectives").insert({
        reference: reference("OBJ"),
        objective: data.objective,
        kpi: data.kpi,
        baseline: data.baseline,
        target: data.target,
        current_performance: data.currentPerformance,
        direction: data.direction,
        owner_id: data.ownerId || null,
        review_date: data.reviewDate,
        notes: data.notes || null,
        created_by: context.userId,
      });
      if (error) {
        console.error("[objectives] create failed", error.message);
        throw new Error("The objective could not be saved. Please try again.");
      }
    }
    return { ok: true };
  });

export const transitionModulePackTwoRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => transitionSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertPermission(context, data.module, "approve");
    const flow = flows[data.module];
    const current = flow.indexOf(data.fromStatus as never);
    if (current < 0 || flow[current + 1] !== data.toStatus)
      throw new Error("This workflow transition is not permitted.");
    const [admin, manager, supervisor] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "hse_manager" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "supervisor" }),
    ]);
    if (!admin.data && !manager.data && !supervisor.data)
      throw new Error("Only authorised HSE workflow owners can advance records.");
    if (data.toStatus === "closed") {
      if (!admin.data && !manager.data) throw new Error("Only the HSE team can close this record.");
    }
    const currentRecord =
      data.module === "inspections"
        ? await context.supabase
            .from("inspections")
            .select("status")
            .eq("id", data.recordId)
            .single()
        : await context.supabase
            .from("hse_objectives")
            .select("status")
            .eq("id", data.recordId)
            .single();
    if (currentRecord.error || currentRecord.data?.status !== data.fromStatus)
      throw new Error(
        "This record is no longer in the expected workflow state. Refresh and try again.",
      );
    const result =
      data.module === "inspections"
        ? await context.supabase
            .from("inspections")
            .update({ status: data.toStatus })
            .eq("id", data.recordId)
        : await context.supabase
            .from("hse_objectives")
            .update({ status: data.toStatus })
            .eq("id", data.recordId);
    if (result.error) {
      console.error("[module-pack-two] transition failed", result.error.message);
      throw new Error("The workflow could not be updated. Please refresh and try again.");
    }
    await context.supabase.from("workflow_events").insert({
      module: data.module === "inspections" ? "inspection" : "objective",
      record_id: data.recordId,
      from_status: data.fromStatus,
      to_status: data.toStatus,
      event_type: data.toStatus === "closed" ? "closure" : "status_change",
      actor_id: context.userId,
    });
    return { ok: true };
  });
