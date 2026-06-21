import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermission } from "@/lib/permissions.functions";
import { buildAuditReportDraft } from "@/lib/iso-report-fallback.server";

const reportOutput = z.object({
  executiveSummary: z.string().min(50).max(12000),
  findings: z.string().min(20).max(20000),
  recommendations: z.string().min(20).max(20000),
});
const reportInput = z.object({ auditId: z.string().uuid() });

export const getAuditReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => reportInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertPermission(context, "audits", "view");
    const { data: reports, error } = await context.supabase
      .from("audit_reports")
      .select("*")
      .eq("audit_id", data.auditId)
      .order("version", { ascending: false });
    if (error) throw new Error("Audit reports could not be loaded.");
    return reports ?? [];
  });

export const generateAuditReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => reportInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertPermission(context, "audits", "create");
    const [audit, evidence, versions] = await Promise.all([
      context.supabase.from("audits").select("*").eq("id", data.auditId).single(),
      context.supabase
        .from("evidence_attachments")
        .select("file_name,caption,mime_type")
        .eq("module", "audits")
        .eq("record_id", data.auditId),
      context.supabase
        .from("audit_reports")
        .select("version")
        .eq("audit_id", data.auditId)
        .order("version", { ascending: false })
        .limit(1),
    ]);
    if (audit.error || !audit.data) throw new Error("Audit could not be found.");
    const fallbackDraft = () => buildAuditReportDraft({ audit: audit.data, evidence: evidence.data ?? [] });
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
            "You are a senior HSE lead auditor drafting a formal internal audit report that fully complies with ISO 19011:2018 audit principles and the requirements of ISO 9001:2015 (Quality), ISO 14001:2015 (Environmental) and ISO 45001:2018 (OH&S) management systems — in particular ISO 45001 clauses 9.2 Internal audit, 9.3 Management review, 10.2 Incident, nonconformity and corrective action, 10.3 Continual improvement; ISO 14001 clauses 9.2, 9.3, 10.2; and ISO 9001 clauses 9.2, 9.3, 10.2, 10.3. Use formal, neutral, professional language. Use only the supplied data — never invent names, dates, measurements, or compliance claims. Do not mention or hint that the content is AI- or computer-generated. Each output field must be a vertically stacked bullet list with one item per line, each line starting with '• ' (or numbered '1. '). Never use inline comma-separated lists. Do not use Markdown asterisks or code fences.",
          prompt: `Draft a reviewable internal audit report from this structured record. Output three fields:\n\nexecutiveSummary — a concise narrative including: site/area/department, audit type and scope, scheduled and completion dates, lead auditor and team, overall conformance rating, and a bullet summary of the most material findings and opportunities for improvement.\n\nfindings — a numbered list (1., 2., 3.) where each finding is on its own line in the form: 'Finding | Evidence reference | ISO clause (9001/14001/45001) | Classification (Major NC / Minor NC / Observation / OFI)'. Reference the supplied non-conformities and opportunities explicitly.\n\nrecommendations — a numbered list (1., 2., 3.) where each item is on its own line in the form: 'Corrective / Preventive Action | Responsible Owner (use role if name unknown) | Target Completion Date | Linked ISO clause'. Conclude with bullet points titled 'Lessons Learned' and 'ISO Compliance Notes' tying findings to the relevant ISO 9001 / 14001 / 45001 / 19011 clauses.\n\nStructured audit record:\n${JSON.stringify({ audit: audit.data, evidence: evidence.data ?? [] })}`,
        });
        output = result.output ?? output;
      } catch {
        output = fallbackDraft();
      }
    }
    const parsed = reportOutput.parse(output);
    const version = Number(versions.data?.[0]?.version ?? 0) + 1;
    const { data: saved, error } = await context.supabase
      .from("audit_reports")
      .insert({
        audit_id: data.auditId,
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

export const reviewAuditReport = createServerFn({ method: "POST" })
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
    await assertPermission(context, "audits", data.approve ? "approve" : "edit");
    const values = {
      executive_summary: data.executiveSummary,
      findings: data.findings,
      recommendations: data.recommendations,
      ...(data.approve
        ? { status: "approved", approved_by: context.userId, approved_at: new Date().toISOString() }
        : {}),
    };
    const { error } = await context.supabase
      .from("audit_reports")
      .update(values)
      .eq("id", data.reportId)
      .eq("status", "draft");
    if (error) throw new Error("The report review could not be saved.");
    return { ok: true };
  });
