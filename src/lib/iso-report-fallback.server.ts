type RecordLike = Record<string, any>;

const text = (value: unknown, fallback = "Not recorded") => {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
};

const dateText = (value: unknown) => {
  const raw = text(value, "Not recorded");
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString("en-GB");
};

const lines = (value: unknown) =>
  text(value, "")
    .split(/\r?\n|•/)
    .map((line) => line.trim())
    .filter(Boolean);

const bullet = (items: string[]) => items.filter(Boolean).map((item) => `• ${item}`).join("\n");
const numbered = (items: string[]) => items.filter(Boolean).map((item, index) => `${index + 1}. ${item}`).join("\n");

const evidenceSummary = (evidence: RecordLike[] = []) =>
  evidence.length
    ? bullet(evidence.map((item) => `${text(item.file_name)}${item.caption ? ` — ${item.caption}` : ""}`))
    : "• No supporting evidence files were attached at the time of generation.";

export function buildInspectionReportDraft({
  inspection,
  checklist = [],
  evidence = [],
}: {
  inspection: RecordLike;
  checklist?: RecordLike[];
  evidence?: RecordLike[];
}) {
  const failed = checklist.filter((item) => String(item.result ?? "").toLowerCase() === "fail");
  const passed = checklist.filter((item) => String(item.result ?? "").toLowerCase() === "pass");
  const observations = checklist.filter((item) => String(item.result ?? "").toLowerCase() === "observation");
  const status = failed.length ? "requires corrective action" : "acceptable with routine monitoring";
  return {
    executiveSummary: bullet([
      `Inspection reference ${text(inspection.reference)} covering ${text(inspection.area)} was conducted for ${text(inspection.inspection_type).replaceAll("_", " ")} on ${dateText(inspection.scheduled_on)} by ${text(inspection.inspector_name ?? inspection.inspector_id)}.`,
      `Overall inspection outcome is ${status}; ${checklist.length} checklist item(s) were reviewed, with ${passed.length} conforming item(s), ${failed.length} non-conformance(s), and ${observations.length} observation(s).`,
      `The review supports ISO 45001:2018 clauses 8.1, 9.1 and 10.2 by documenting operational controls, monitoring results, and improvement actions.`,
      `Evidence reviewed:\n${evidenceSummary(evidence)}`,
    ]),
    findings: failed.length || observations.length
      ? numbered([
          ...failed.map((item) => `${text(item.requirement)} | ${text(item.observation)} | ISO 45001:2018 clauses 8.1, 9.1 and 10.2 | Classification: Non-conformance requiring corrective action`),
          ...observations.map((item) => `${text(item.requirement)} | ${text(item.observation)} | ISO 45001:2018 clauses 6.1 and 9.1 | Classification: Observation / opportunity for improvement`),
        ])
      : numbered([
          `No failed checklist items were recorded | Inspection checklist and evidence register | ISO 45001:2018 clauses 8.1 and 9.1 | Classification: Conforming with continued monitoring`,
        ]),
    recommendations: numbered([
      failed.length
        ? `Assign owners for all failed checklist items, define root cause, corrective action, due date, and effectiveness review | Inspection owner / area supervisor | Within 30 days | ISO 45001:2018 clause 10.2`
        : `Maintain existing operational controls and continue routine inspections at the planned frequency | Area supervisor | Next planned inspection cycle | ISO 45001:2018 clauses 8.1 and 9.1`,
      `Verify closure evidence for every action before changing the inspection status to closed | HSE manager / responsible supervisor | Before closure | ISO 45001:2018 clauses 9.1 and 10.2`,
      `Communicate significant findings and lessons learned to affected workers and contractors | HSE coordinator | Within 7 days | ISO 45001:2018 clauses 5.4 and 7.4`,
      `Lessons Learned: inspection data should be trended with incidents, hazards, audits and corrective actions to strengthen preventive controls.`,
      `ISO Compliance Notes: this report supports documented information, monitoring and improvement expectations under ISO 45001 clauses 7.5, 8.1, 9.1 and 10.2.`,
    ]),
  };
}

export function buildAuditReportDraft({ audit, evidence = [] }: { audit: RecordLike; evidence?: RecordLike[] }) {
  const scope = text(audit.scope ?? audit.audit_scope, "Scope not recorded");
  const status = text(audit.status).replaceAll("_", " ");
  return {
    executiveSummary: bullet([
      `Internal audit reference ${text(audit.reference)} was planned for ${dateText(audit.planned_date)} and covers ${scope}.`,
      `Audit type: ${text(audit.audit_type).replaceAll("_", " ")}; lead auditor: ${text(audit.lead_auditor ?? audit.auditor_name ?? audit.auditor_id)}; current workflow status: ${status}.`,
      `The report is structured against ISO 19011:2018 audit principles and ISO 45001:2018 clauses 9.2, 10.2 and 10.3, with alignment to ISO 9001/14001 where integrated management system controls apply.`,
      `Evidence reviewed:\n${evidenceSummary(evidence)}`,
    ]),
    findings: numbered([
      `${text(audit.objectives ?? audit.audit_objectives, "Audit objectives were not fully documented in the record")} | Audit programme and record metadata | ISO 45001:2018 clause 9.2 | Classification: Observation requiring management attention`,
      `${text(audit.findings ?? audit.summary ?? audit.description, "No detailed finding narrative was captured before report generation")} | Auditor notes / uploaded evidence | ISO 45001:2018 clauses 9.2 and 10.2 | Classification: Reviewable audit finding`,
      `Documented evidence should be retained for each conclusion and action | Evidence register | ISO 19011:2018 and ISO 45001:2018 clause 7.5 | Classification: Opportunity for improvement`,
    ]),
    recommendations: numbered([
      `Confirm audit criteria, scope, objective evidence and sampled records before final approval | Lead auditor | Before audit closure | ISO 19011:2018 and ISO 45001:2018 clause 9.2`,
      `Raise corrective actions for each confirmed non-conformity, including root cause, responsible owner and effectiveness review | Process owner / HSE manager | Within 30 days | ISO 45001:2018 clause 10.2`,
      `Present audit trends and overdue actions to management review | HSE manager | Next management review | ISO 45001:2018 clauses 9.3 and 10.3`,
      `Lessons Learned: audit evidence must be factual, traceable and sufficient to support every conclusion.`,
      `ISO Compliance Notes: the audit workflow supports ISO 45001 internal audit and continual improvement requirements when findings are closed with verified evidence.`,
    ]),
  };
}

export function buildManagementReviewMinutes({
  review,
  incidents = [],
  audits = [],
  hazards = [],
  objectives = [],
  actions = [],
}: {
  review: RecordLike;
  incidents?: RecordLike[];
  audits?: RecordLike[];
  hazards?: RecordLike[];
  objectives?: RecordLike[];
  actions?: RecordLike[];
}) {
  const summary = bullet([
    `Management review ${text(review.reference)} was held on ${dateText(review.meeting_date)} for the period ${dateText(review.period_start)} to ${dateText(review.period_end)}.`,
    `Inputs reviewed included ${incidents.length} incident(s), ${hazards.length} hazard report(s), ${audits.length} audit(s), ${objectives.length} HSE objective(s), and ${actions.length} action(s).`,
    `The review considered OH&S performance, consultation and participation, legal compliance, audit outcomes, objectives, resource needs, risks and opportunities, and continual improvement as required by ISO 45001:2018 clause 9.3.`,
    `Attendees recorded: ${lines(review.attendees).join("; ") || "Not recorded"}.`,
  ]);
  const decisions = numbered([
    `Review all open high-priority actions and assign clear owners with target dates | Management team / HSE manager | Immediate follow-up | ISO 45001 clauses 9.3 and 10.2`,
    `Trend incidents, hazards and audit findings to identify recurring control weaknesses | HSE coordinator | Monthly | ISO 45001 clauses 6.1, 9.1 and 10.3`,
    `Update objectives and improvement plans where achievement is below target or RAG status is amber/red | Department heads | Next reporting cycle | ISO 45001 clauses 6.2 and 9.3`,
    `Communicate management review outputs to relevant workers and interested parties | Chairperson / HSE manager | Within 7 days | ISO 45001 clauses 5.4 and 7.4`,
    `Retain signed minutes and supporting evidence as controlled documented information | Document controller | On approval | ISO 45001 clause 7.5`,
  ]);
  return { executiveSummary: summary, decisions };
}

export function buildSafetyCommitteeMinutes({ meeting, signatories = [] }: { meeting: RecordLike; signatories?: RecordLike[] }) {
  const sigLines = signatories.length
    ? signatories.map((s, index) => `${index + 1}. ${text(s.full_name)} | ${text(s.role_title, "Role not recorded")} | Signature: __________________ | Date: __________________`)
    : Array.from({ length: 5 }, (_, index) => `${index + 1}. Name: __________________ | Designation: __________________ | Signature: __________________ | Date: __________________`);
  return [
    `1. Meeting Particulars\n${bullet([`Reference: ${text(meeting.meeting_number)}`, `Title: ${text(meeting.title)}`, `Date/Time: ${dateText(meeting.meeting_date)}`, `Location: ${text(meeting.location)}`, `Chairperson: ${text(meeting.chairperson)}`, `Secretary: ${text(meeting.secretary)}`])}`,
    `2. Attendance & Apologies\n${signatories.length ? bullet(signatories.map((s) => `${text(s.full_name)} — ${text(s.role_title, "Member")}`)) : "• Attendance list not recorded; update before final approval."}`,
    `3. Agenda Items Discussed\n${lines(meeting.agenda).length ? numbered(lines(meeting.agenda).map((item) => `${item} — discussed with reference to worker consultation, hazard controls, corrective actions, training needs and legal compliance.`)) : "1. Standing HSE performance agenda discussed; detailed agenda was not recorded before generation."}`,
    `4. Decisions & Resolutions\n${lines(meeting.decisions).length ? numbered(lines(meeting.decisions)) : numbered(["Management to verify closure of open HSE actions and communicate decisions to affected workers.", "Committee to monitor incident, hazard, audit and inspection trends at the next meeting."])}`,
    `5. Action Items\n${numbered(["Review overdue corrective actions | HSE manager | Before next meeting", "Communicate agreed controls to workers and supervisors | Chairperson | 7 days", "Upload signed minutes and supporting evidence | Secretary | After approval"])}`,
    `6. ISO 45001 Compliance Notes\n${bullet(["Minutes demonstrate consultation and participation of workers under ISO 45001 clause 5.4.", "Actions and decisions support performance evaluation and improvement under clauses 9.1, 9.3 and 10.3.", "Signed minutes must be retained as documented information under clause 7.5."])}`,
    `7. Date and Venue of Next Meeting\n${bullet([`Next meeting: ${dateText(meeting.next_meeting_at)}`, `Venue: ${text(meeting.location)}`])}`,
    `8. Signatures\n${sigLines.join("\n")}`,
  ].join("\n\n");
}

export function buildEmergencyReport(record: RecordLike) {
  const sigs: RecordLike[] = Array.isArray(record.signatories) ? record.signatories : [];
  const signatureRows: RecordLike[] = sigs.length ? sigs : Array.from({ length: 5 }, () => ({}));
  const signatureLines = signatureRows.map(
    (s, index) => `${index + 1}. ${text(s.full_name, "Name: __________________")} | ${text(s.role_title, "Designation: __________________")} | Signature: __________________ | Date: __________________`,
  );
  return [
    `1. Executive Summary\n${bullet([`Emergency response record ${text(record.reference)} relates to ${text(record.record_type).replaceAll("_", " ")} scenario: ${text(record.scenario)}.`, `The exercise/event occurred on ${dateText(record.occurred_at)} at ${text(record.location)} with ${text(record.participants)} participant(s).`, `Recorded response time was ${text(record.response_time_minutes)} minute(s), and performance rating was ${text(record.performance_rating).replaceAll("_", " ")}.`])}`,
    `2. Objectives of the Exercise\n${bullet(["Verify emergency preparedness and response arrangements.", "Assess evacuation, communication, command and control effectiveness.", "Identify lessons learned and improvement actions in line with ISO 45001:2018 clause 8.2."])}`,
    `3. Outcome and Observations\n${bullet(lines(record.outcome).length ? lines(record.outcome) : ["No detailed outcome notes were recorded before report generation; responsible persons should update the record before approval."])}`,
    `4. Lessons Learned\n${bullet(lines(record.lessons_learned).length ? lines(record.lessons_learned) : ["Capture lessons learned from participants, wardens, supervisors and observers before closing the record."])}`,
    `5. Corrective and Preventive Actions\n${numbered(["Review communication, alarm and evacuation effectiveness | Emergency coordinator | Within 14 days", "Close gaps identified during the drill/event with evidence | Responsible department owner | Within 30 days", "Include significant outcomes in management review and emergency planning updates | HSE manager | Next review cycle"])}`,
    `6. ISO 45001:2018 Compliance Assessment\n${bullet(["Clause 8.2 requires planned response to emergency situations and periodic testing where practicable.", "Clause 9.1 requires monitoring and evaluation of response performance.", "Clause 10.2 requires action on nonconformities and improvement opportunities identified during drills or actual events."])}`,
    `7. Conclusion\n${bullet(["The record provides a basis for verifying emergency preparedness when supporting evidence, participant feedback and corrective-action closure are retained.", "Final approval should confirm that actions are assigned, tracked and verified for effectiveness."])}`,
    `8. Sign-off / Verification Panel\n${signatureLines.join("\n")}`,
  ].join("\n\n");
}