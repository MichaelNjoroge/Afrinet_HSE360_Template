import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildEmergencyReport, buildSafetyCommitteeMinutes } from "@/lib/iso-report-fallback.server";

type Signatory = {
  signatory_position: number;
  full_name: string;
  role_title?: string | null;
  signed_at?: string | null;
  signature_note?: string | null;
};

type EmergencySignatory = {
  full_name: string;
  role_title?: string | null;
  signed_at?: string | null;
};

async function runLovableAi(prompt: string, system: string, fallback: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return fallback;
  const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
  const gateway = createLovableAiGatewayProvider(key);
  const model = gateway("google/gemini-2.5-flash");
  try {
    const { text } = await generateText({ model, system, prompt });
    return text.trim();
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg.includes("429") || msg.includes("402") || /payment|credit|billing/i.test(msg)) return fallback;
    return fallback;
  }
}

export const listSafetyCommittee = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [meetings, signatories, employees] = await Promise.all([
      supabase
        .from("safety_committee_meetings")
        .select("*")
        .order("meeting_date", { ascending: false }),
      supabase
        .from("safety_committee_signatories")
        .select("*")
        .order("signatory_position", { ascending: true }),
      supabase
        .from("employees")
        .select("id, full_name, job_title")
        .order("full_name", { ascending: true }),
    ]);
    if (meetings.error) throw new Error(meetings.error.message);
    if (signatories.error) throw new Error(signatories.error.message);
    return {
      meetings: meetings.data ?? [],
      signatories: signatories.data ?? [],
      employees: employees.data ?? [],
    };
  });

export const saveSafetyMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      meeting_number?: string;
      title: string;
      meeting_date: string;
      location?: string;
      chairperson?: string;
      secretary?: string;
      agenda?: string;
      minutes?: string;
      decisions?: string;
      next_meeting_at?: string;
      status?: string;
      signatories?: Signatory[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, signatories = [], ...rest } = data;
    const payload = {
      ...rest,
      meeting_number: rest.meeting_number || `SC-${Date.now()}`,
      status: rest.status || "planned",
      created_by: userId,
    };
    let meetingId = id;
    if (id) {
      const { error } = await supabase
        .from("safety_committee_meetings")
        .update(payload)
        .eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await supabase
        .from("safety_committee_meetings")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      meetingId = row!.id;
    }
    // Replace signatories
    if (meetingId) {
      await supabase.from("safety_committee_signatories").delete().eq("meeting_id", meetingId);
      const rows = signatories
        .filter((s) => s.full_name?.trim())
        .slice(0, 10)
        .map((s, idx) => ({
          meeting_id: meetingId,
          signatory_position: s.signatory_position || idx + 1,
          full_name: s.full_name.trim(),
          role_title: s.role_title || null,
          signed_at: s.signed_at || null,
          signature_note: s.signature_note || null,
        }));
      if (rows.length) {
        const { error: insErr } = await supabase
          .from("safety_committee_signatories")
          .insert(rows);
        if (insErr) throw new Error(insErr.message);
      }
    }
    return { id: meetingId };
  });

export const deleteSafetyMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("safety_committee_meetings")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listEmergencyResponse = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [records, employees] = await Promise.all([
      context.supabase
        .from("emergency_response_records")
        .select("*")
        .order("occurred_at", { ascending: false }),
      context.supabase
        .from("employees")
        .select("id, full_name, job_title")
        .order("full_name", { ascending: true }),
    ]);
    if (records.error) throw new Error(records.error.message);
    return { records: records.data ?? [], employees: employees.data ?? [] };
  });

export const saveEmergencyRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      reference?: string;
      record_type: string;
      scenario: string;
      location?: string;
      occurred_at: string;
      participants?: number;
      response_time_minutes?: number;
      outcome?: string;
      lessons_learned?: string;
      performance_rating?: string;
      status?: string;
      signatories?: EmergencySignatory[];
      report_content?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, signatories, ...rest } = data;
    const payload: Record<string, any> = {
      ...rest,
      reference: rest.reference || `ER-${Date.now()}`,
      status: rest.status || "open",
      created_by: userId,
    };
    if (signatories) {
      payload.signatories = signatories
        .filter((s) => s.full_name?.trim())
        .slice(0, 10)
        .map((s) => ({
          full_name: s.full_name.trim(),
          role_title: s.role_title || null,
          signed_at: s.signed_at || null,
        }));
    }
    if (id) {
      const { error } = await supabase
        .from("emergency_response_records")
        .update(payload as never)
        .eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await supabase
      .from("emergency_response_records")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });

export const deleteEmergencyRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("emergency_response_records")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const generateSafetyMeetingMinutes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: meeting, error } = await supabase
      .from("safety_committee_meetings")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !meeting) throw new Error(error?.message ?? "Meeting not found");
    const { data: sigs } = await supabase
      .from("safety_committee_signatories")
      .select("*")
      .eq("meeting_id", data.id)
      .order("signatory_position", { ascending: true });
    const m: any = meeting;
    const sigList = (sigs ?? [])
      .map((s: any, i: number) => `${i + 1}. ${s.full_name}${s.role_title ? ` — ${s.role_title}` : ""}`)
      .join("\n") || "None recorded";
    const system = `You are an experienced HSE (Health, Safety and Environment) committee secretary preparing formal meeting minutes that fully comply with ISO 45001:2018 Occupational Health and Safety Management Systems requirements (particularly clauses 5.4 Consultation and participation of workers, 9.3 Management review and 10 Improvement). Produce professional, detailed, neutrally worded minutes. Do not mention or hint that the content is AI-generated or computer-generated. Use plain prose with clear numbered section headings. Within each section, present lists (attendees, apologies, agenda items, decisions, action items, risks, signatures) as vertically stacked bullet points ("• ") or numbered lines — never inline comma-separated. Keep each bullet on its own line so the document reads neatly. Do not use code fences or Markdown asterisks.`;
    const prompt = `Draft formal, detailed minutes of the following Safety Committee meeting. Use these numbered section headings: 1. Meeting Particulars, 2. Attendance & Apologies (bullet list, one name per line with role), 3. Confirmation of Previous Minutes, 4. Matters Arising (numbered), 5. Agenda Items Discussed (expand each agenda point into substantive discussion paragraphs reflecting worker consultation, hazard reviews, incident trends, corrective actions, training, audits and legal compliance as relevant to ISO 45001; key highlights inside each item shown as bullet points on separate lines), 6. Decisions & Resolutions (numbered, one per line), 7. Action Items (numbered list — Action | Responsible Person | Target Date, each on its own line), 8. Risks & Opportunities Identified (bullet points), 9. ISO 45001 Compliance Notes (bullet points referencing relevant clauses), 10. Date and Venue of Next Meeting, 11. Closure, 12. Signatures (numbered list with one signatory per line followed by a signature placeholder line). Ensure at least 5 signature lines are provided even if fewer signatories are listed.

Meeting details:
- Reference: ${m.meeting_number ?? "—"}
- Title: ${m.title ?? ""}
- Date/Time: ${m.meeting_date ?? ""}
- Location: ${m.location ?? "—"}
- Chairperson: ${m.chairperson ?? "—"}
- Secretary: ${m.secretary ?? "—"}
- Status: ${m.status ?? "—"}
- Next meeting: ${m.next_meeting_at ?? "—"}
- Agenda:\n${m.agenda ?? "(not supplied)"}
- Existing notes / minutes draft:\n${m.minutes ?? "(none)"}
- Decisions noted:\n${m.decisions ?? "(none)"}
- Signatories:\n${sigList}`;
    const minutes = await runLovableAi(prompt, system, buildSafetyCommitteeMinutes({ meeting: m, signatories: sigs ?? [] }));
    const { error: upErr } = await supabase
      .from("safety_committee_meetings")
      .update({ minutes } as never)
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);
    return { minutes };
  });

export const generateEmergencyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rec, error } = await supabase
      .from("emergency_response_records")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !rec) throw new Error(error?.message ?? "Record not found");
    const r: any = rec;
    const sigs: EmergencySignatory[] = Array.isArray(r.signatories) ? r.signatories : [];
    const sigList = sigs.length
      ? sigs.map((s, i) => `${i + 1}. ${s.full_name}${s.role_title ? ` — ${s.role_title}` : ""}`).join("\n")
      : "None recorded";
    const system = `You are a senior HSE professional drafting an official post-event report for a fire drill / emergency response exercise. The report must comply with ISO 45001:2018 (especially clause 8.2 Emergency preparedness and response, 9.1 Monitoring & measurement, 9.3 Management review, and 10 Improvement). Write in formal, neutral, professional language. Do not mention or hint that the content is AI-generated. Use plain prose with numbered section headings. Within each section, present lists (participants, observations, findings, lessons, actions, signatures) as vertically stacked bullet points ("• ") or numbered lines — one item per line — never inline comma-separated. Keep the document neat and easy to scan. Do not use code fences or Markdown asterisks.`;
    const prompt = `Produce a detailed, professional Emergency Response / Fire Drill Report with the following numbered sections: 1. Executive Summary, 2. Objectives of the Exercise (bullet points), 3. Scope & Scenario Description, 4. Participants and Roles (bullet list, one person per line), 5. Sequence of Events (numbered timeline with timings where available, one event per line), 6. Response Performance Analysis (bullet points covering response time, evacuation effectiveness, communication, command and control), 7. Observations and Findings (numbered, one per line), 8. Non-conformities and Hazards Identified (bullet points), 9. Lessons Learned (bullet points), 10. Corrective and Preventive Actions (numbered — Action | Responsible Owner | Target Completion, each on its own line), 11. Recommendations for Improvement (bullet points), 12. ISO 45001:2018 Compliance Assessment (bullet points explicitly linking findings to relevant clauses, especially 8.2), 13. Conclusion, 14. Sign-off / Verification Panel (numbered list with at least 5 signature lines, each showing Name | Designation | Signature | Date, one signatory per line, even if fewer signatories are listed).

Record details:
- Reference: ${r.reference ?? "—"}
- Type: ${r.record_type ?? "—"}
- Scenario: ${r.scenario ?? "—"}
- Date/Time: ${r.occurred_at ?? "—"}
- Location: ${r.location ?? "—"}
- Participants: ${r.participants ?? "—"}
- Response time (minutes): ${r.response_time_minutes ?? "—"}
- Performance rating: ${r.performance_rating ?? "—"}
- Status: ${r.status ?? "—"}
- Outcome notes:\n${r.outcome ?? "(none)"}
- Lessons learned (raw notes):\n${r.lessons_learned ?? "(none)"}
- Signatories:\n${sigList}`;
    const report = await runLovableAi(prompt, system, buildEmergencyReport(r));
    const { error: upErr } = await supabase
      .from("emergency_response_records")
      .update({ report_content: report } as never)
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);
    return { report };
  });

