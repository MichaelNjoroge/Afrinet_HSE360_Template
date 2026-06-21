import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermission } from "@/lib/permissions.functions";
import { buildManagementReviewMinutes } from "@/lib/iso-report-fallback.server";

const minutesOutput = z.object({
  executiveSummary: z.string().min(50).max(8000),
  decisions: z.string().min(20).max(8000),
});

const input = z.object({ reviewId: z.string().uuid() });

export const draftManagementReviewMinutes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => input.parse(value))
  .handler(async ({ data, context }) => {
    await assertPermission(context, "reviews", "create");
    const { data: review, error } = await context.supabase
      .from("management_reviews")
      .select("*")
      .eq("id", data.reviewId)
      .single();
    if (error || !review) throw new Error("Management review could not be found.");

    const since = review.period_start;
    const until = review.period_end;

    const [incidents, audits, hazards, objectives, actions] = await Promise.all([
      context.supabase
        .from("incidents")
        .select("severity,status,occurred_at")
        .gte("occurred_at", since)
        .lte("occurred_at", until),
      context.supabase
        .from("audits")
        .select("audit_type,status,planned_date")
        .gte("planned_date", since)
        .lte("planned_date", until),
      context.supabase
        .from("hazards")
        .select("risk_rating,status,reported_at")
        .gte("reported_at", since)
        .lte("reported_at", until),
      context.supabase
        .from("hse_objectives")
        .select("title,achievement_percent,rag_status"),
      context.supabase
        .from("actions")
        .select("status,priority,due_date")
        .gte("due_date", since)
        .lte("due_date", until),
    ]);

    const fallbackDraft = () => buildManagementReviewMinutes({
      review,
      incidents: incidents.data ?? [],
      audits: audits.data ?? [],
      hazards: hazards.data ?? [],
      objectives: objectives.data ?? [],
      actions: actions.data ?? [],
    });
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
          output: Output.object({ schema: minutesOutput }),
          system:
            "You are an HSE management review secretary. Draft factual, professional minutes from the supplied structured data only. Do not invent names, dates, figures, or compliance claims. Use concise bullet points where appropriate.",
          prompt: `Draft the executive summary and the decisions/actions for an ISO 45001 management review meeting.\n\nReview metadata: ${JSON.stringify({
            reference: review.reference,
            meeting_date: review.meeting_date,
            period_start: review.period_start,
            period_end: review.period_end,
            attendees: review.attendees,
          })}\n\nPeriod performance data: ${JSON.stringify({
            incidents: incidents.data ?? [],
            audits: audits.data ?? [],
            hazards: hazards.data ?? [],
            objectives: objectives.data ?? [],
            actions: actions.data ?? [],
            metrics_snapshot: review.metrics_snapshot ?? {},
          })}\n\nReturn JSON with executiveSummary and decisions. Decisions must be a numbered list of clear, assignable actions.`,
        });
        output = result.output ?? output;
      } catch {
        output = fallbackDraft();
      }
    }
    const parsed = minutesOutput.parse(output);

    const { error: updateError } = await context.supabase
      .from("management_reviews")
      .update({
        executive_summary: parsed.executiveSummary,
        decisions: parsed.decisions,
      })
      .eq("id", data.reviewId);
    if (updateError) throw new Error("Draft minutes could not be saved.");

    return parsed;
  });
