import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermission } from "@/lib/permissions.functions";
import { buildInspectionReportDraft } from "@/lib/iso-report-fallback.server";

const reportOutput = z.object({
  executiveSummary: z.string().min(50).max(12000),
  findings: z.string().min(20).max(20000),
  recommendations: z.string().min(20).max(20000),
});
const reportInput = z.object({ inspectionId: z.string().uuid() });

export const getInspectionReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => reportInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertPermission(context, "inspections", "view");
    const { data: reports, error } = await context.supabase
      .from("inspection_reports")
      .select("*")
      .eq("inspection_id", data.inspectionId)
      .order("version", { ascending: false });
    if (error) throw new Error("Inspection reports could not be loaded.");
    return reports ?? [];
  });

export const generateInspectionReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => reportInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertPermission(context, "inspections", "create");
    const [inspection, checklist, evidence, versions] = await Promise.all([
      context.supabase.from("inspections").select("*").eq("id", data.inspectionId).single(),
      context.supabase
        .from("inspection_checklist_items")
        .select("requirement,result,observation")
        .eq("inspection_id", data.inspectionId)
        .order("item_order"),
      context.supabase
        .from("evidence_attachments")
        .select("file_name,caption,mime_type")
        .eq("module", "inspections")
        .eq("record_id", data.inspectionId),
      context.supabase
        .from("inspection_reports")
        .select("version")
        .eq("inspection_id", data.inspectionId)
        .order("version", { ascending: false })
        .limit(1),
    ]);
    if (inspection.error || !inspection.data) throw new Error("Inspection could not be found.");
    const fallbackDraft = () => buildInspectionReportDraft({ inspection: inspection.data, checklist: checklist.data ?? [], evidence: evidence.data ?? [] });
    let output = fallbackDraft();
    const key = process.env.LOVABLE_API_KEY;
    if (key) {
      const gateway = createOpenAICompatible({
        name: "lovable",
        baseURL: "https://ai.gateway.lovable.dev/v1",
        headers: { "Lovable-API-Key": key },
      });
      try {
        const result = await generateText({
          model: gateway("google/gemini-2.5-flash"),
          output: Output.object({ schema: reportOutput }),
          system:
            "You are a senior HSE professional drafting a formal HSE inspection report that fully complies with ISO 9001:2015 (Quality), ISO 14001:2015 (Environmental) and ISO 45001:2018 (OH&S) management system requirements — in particular ISO 45001 clauses 8.1 Operational planning and control, 9.1 Monitoring measurement analysis and evaluation, 9.2 Internal audit/inspection, 10 Improvement; ISO 14001 clauses 6.1.2 Environmental aspects, 8.1, 9.1; and ISO 9001 clauses 9.1, 9.2, 10.2 Nonconformity and corrective action. Use formal, neutral, professional language. Use only the supplied data — never invent names, dates, measurements, or compliance claims. Do not mention or hint that the content is AI- or computer-generated. Each output field must be a vertically stacked bullet list with one item per line, each line starting with '• ' (or numbered '1. '). Never use inline comma-separated lists. Do not use Markdown asterisks or code fences.",
          prompt: `Draft a reviewable inspection report from this structured record. Output three fields:\n\nexecutiveSummary — a concise narrative including: site/area/department, inspection type, date, inspector, overall conformance status, and a bullet summary of the most material findings.\n\nfindings — a numbered list (1., 2., 3.) where each finding is on its own line in the form: 'Finding | Evidence/Checklist reference | ISO clause (9001/14001/45001) | Severity (minor / major / observation)'. Reference each non-conforming checklist item explicitly.\n\nrecommendations — a numbered list (1., 2., 3.) where each item is on its own line in the form: 'Corrective / Preventive Action | Responsible Owner (use role if name unknown) | Target Completion Date | Linked ISO clause'. Conclude with bullet points titled 'Lessons Learned' and 'ISO Compliance Notes' tying findings to the relevant ISO 9001 / 14001 / 45001 clauses.\n\nStructured inspection record:\n${JSON.stringify({ inspection: inspection.data, checklist: checklist.data ?? [], evidence: evidence.data ?? [] })}`,
        });
        output = result.output ?? output;
      } catch {
        output = fallbackDraft();
      }
    }
    const parsed = reportOutput.parse(output);
    const version = Number(versions.data?.[0]?.version ?? 0) + 1;
    const { data: saved, error } = await context.supabase
      .from("inspection_reports")
      .insert({
        inspection_id: data.inspectionId,
        version,
        executive_summary: parsed.executiveSummary,
        findings: parsed.findings,
        recommendations: parsed.recommendations,
        generated_by: context.userId,
        status: "draft",
      })
      .select("*")
      .single();
    if (error || !saved) throw new Error("The generated draft could not be saved.");
    return saved;
  });

export const reviewInspectionReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        reportId: z.string().uuid(),
        executiveSummary: z.string().trim().min(20).max(12000),
        findings: z.string().trim().min(20).max(20000),
        recommendations: z.string().trim().min(20).max(20000),
        approve: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertPermission(context, "inspections", data.approve ? "approve" : "edit");
    const values = {
      executive_summary: data.executiveSummary,
      findings: data.findings,
      recommendations: data.recommendations,
      ...(data.approve
        ? { status: "approved", approved_by: context.userId, approved_at: new Date().toISOString() }
        : {}),
    };
    const { error } = await context.supabase
      .from("inspection_reports")
      .update(values)
      .eq("id", data.reportId)
      .eq("status", "draft");
    if (error) throw new Error("The report review could not be saved.");
    return { ok: true };
  });
