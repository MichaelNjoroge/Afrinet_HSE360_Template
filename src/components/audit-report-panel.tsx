import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BrainCircuit, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BulletTextarea } from "@/components/ui/bullet-textarea";
import { EvidencePanel } from "@/components/evidence-panel";
import { ReportActions } from "@/components/report-actions";
import {
  generateAuditReport,
  getAuditReports,
  reviewAuditReport,
} from "@/lib/audit-reports.functions";

export function AuditReportPanel({
  auditId,
  canEdit,
  canApprove,
  showEvidence = true,
}: {
  auditId: string;
  canEdit: boolean;
  canApprove: boolean;
  showEvidence?: boolean;
}) {
  const queryClient = useQueryClient();
  const load = useServerFn(getAuditReports);
  const generate = useServerFn(generateAuditReport);
  const review = useServerFn(reviewAuditReport);
  const queryKey = ["audit-reports", auditId];
  const { data = [] } = useQuery({ queryKey, queryFn: () => load({ data: { auditId } }) });
  const latest = data[0];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const printRef = useRef<HTMLDivElement | null>(null);

  async function saveForm(formElement: HTMLFormElement, approve: boolean) {
    if (!latest) return;
    setBusy(true);
    setError("");
    const form = new FormData(formElement);
    try {
      await review({
        data: {
          reportId: latest.id,
          executiveSummary: String(form.get("summary") ?? ""),
          findings: String(form.get("findings") ?? ""),
          recommendations: String(form.get("recommendations") ?? ""),
          approve,
        },
      });
      await queryClient.invalidateQueries({ queryKey });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Report review failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {showEvidence && (
        <EvidencePanel
          module="audits"
          recordId={auditId}
          canAdd={canEdit}
          canDelete={canEdit}
          title="Audit evidence and signed reports"
          description="Upload audit photographs, supporting PDFs, and final signed audit reports. JPG, PNG, WebP or PDF; 10 MB per file."
          uploadLabel="Upload signed report"
          emptyText="No audit evidence or signed reports attached yet."
        />
      )}
      <section className="space-y-4 border-t pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">AI-assisted audit report</p>
            <p className="text-xs text-muted-foreground">
              ISO 9001 / 14001 / 45001 aligned. Drafts stay editable until an authorised reviewer approves them.
            </p>
          </div>
          {canEdit && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await generate({ data: { auditId } });
                  await queryClient.invalidateQueries({ queryKey });
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : "Draft generation failed.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <BrainCircuit />
              {busy ? "Working…" : "Generate draft"}
            </Button>
          )}
        </div>
        {latest ? (
          <>
            <div ref={printRef} className="space-y-4 border bg-card p-5">
              <header className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  HSE Internal Audit Report · Version {latest.version} · {latest.status}
                </p>
                <h3 className="text-lg font-bold">Audit Report</h3>
              </header>
              <section>
                <h4 className="text-sm font-semibold uppercase tracking-wider">Executive summary</h4>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{latest.executive_summary}</p>
              </section>
              <section>
                <h4 className="text-sm font-semibold uppercase tracking-wider">Findings</h4>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{latest.findings}</p>
              </section>
              <section>
                <h4 className="text-sm font-semibold uppercase tracking-wider">Recommendations</h4>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{latest.recommendations}</p>
              </section>
            </div>
            <ReportActions
              targetRef={printRef}
              fileName={`audit-report-v${latest.version}`}
              title="HSE Internal Audit Report"
              subtitle={`Version ${latest.version} · ${latest.status}`}
              module="audits"
            />
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void saveForm(event.currentTarget, false);
              }}
            >
              <BulletTextarea
                name="summary"
                defaultValue={latest.executive_summary}
                rows={5}
                aria-label="Executive summary"
                disabled={latest.status === "approved"}
              />
              <BulletTextarea
                name="findings"
                defaultValue={latest.findings}
                rows={7}
                aria-label="Findings"
                disabled={latest.status === "approved"}
              />
              <BulletTextarea
                name="recommendations"
                defaultValue={latest.recommendations}
                rows={7}
                aria-label="Recommendations"
                disabled={latest.status === "approved"}
              />
              {latest.status === "draft" && (
                <div className="flex justify-end gap-2">
                  <Button type="submit" variant="outline" disabled={busy}>
                    Save review
                  </Button>
                  {canApprove && (
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={(event) => {
                        const form = event.currentTarget.form;
                        if (form) void saveForm(form, true);
                      }}
                    >
                      <CheckCircle2 />
                      Approve official report
                    </Button>
                  )}
                </div>
              )}
            </form>
          </>
        ) : (
          <p className="border border-dashed p-4 text-sm text-muted-foreground">
            No audit report draft has been generated yet.
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
