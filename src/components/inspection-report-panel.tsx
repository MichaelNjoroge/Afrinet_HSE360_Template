import { useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BrainCircuit, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BulletTextarea } from "@/components/ui/bullet-textarea";
import { EvidencePanel } from "@/components/evidence-panel";
import { ReportActions } from "@/components/report-actions";
import {
  generateInspectionReport,
  getInspectionReports,
  reviewInspectionReport,
} from "@/lib/inspection-reports.functions";


export function InspectionReportPanel({
  inspectionId,
  canEdit,
  canApprove,
  showEvidence = true,
}: {
  inspectionId: string;
  canEdit: boolean;
  canApprove: boolean;
  showEvidence?: boolean;
}) {
  const queryClient = useQueryClient();
  const load = useServerFn(getInspectionReports);
  const generate = useServerFn(generateInspectionReport);
  const review = useServerFn(reviewInspectionReport);
  const queryKey = ["inspection-reports", inspectionId];
  const { data = [] } = useQuery({ queryKey, queryFn: () => load({ data: { inspectionId } }) });
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
          module="inspections"
          recordId={inspectionId}
          canAdd={canEdit}
          canDelete={canEdit}
          photosOnly
        />
      )}
      <section className="space-y-4 border-t pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">AI-assisted inspection report</p>
            <p className="text-xs text-muted-foreground">
              Generated content remains a draft until an authorised reviewer approves it.
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
                  await generate({ data: { inspectionId } });
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
            <div
              ref={printRef}
              className="mx-auto w-full max-w-[180mm] space-y-4 border bg-card p-5 text-[12pt] leading-relaxed"
            >
              <header data-pdf-section className="space-y-1 border-b pb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  HSE Inspection Report · Version {latest.version} · {latest.status}
                </p>
                <h3 className="text-lg font-bold">Inspection Report</h3>
              </header>
              <section data-pdf-section>
                <h4 className="text-sm font-semibold uppercase tracking-wider">Executive summary</h4>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{latest.executive_summary}</p>
              </section>
              <section data-pdf-section>
                <h4 className="text-sm font-semibold uppercase tracking-wider">Findings</h4>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{latest.findings}</p>
              </section>
              <section data-pdf-section>
                <h4 className="text-sm font-semibold uppercase tracking-wider">Recommendations</h4>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{latest.recommendations}</p>
              </section>
              <section data-pdf-section className="pt-4">
                <h4 className="text-sm font-semibold uppercase tracking-wider">Signatories</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Report status: {latest.status}
                  {latest.approved_at
                    ? ` · Approved on ${new Date(latest.approved_at).toLocaleDateString()}`
                    : ""}
                </p>
                <div className="mt-4 grid gap-6 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider">Prepared by (Inspector)</p>
                    <div className="mt-8 border-b border-foreground/60" />
                    <p className="text-xs text-muted-foreground">Name &amp; Signature</p>
                    <div className="mt-4 border-b border-foreground/60" />
                    <p className="text-xs text-muted-foreground">Date</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider">Reviewed &amp; Approved by</p>
                    <div className="mt-8 border-b border-foreground/60" />
                    <p className="text-xs text-muted-foreground">Name &amp; Signature (HSE Manager / Authorised Reviewer)</p>
                    <div className="mt-4 border-b border-foreground/60" />
                    <p className="text-xs text-muted-foreground">Date</p>
                  </div>
                </div>
              </section>
            </div>
            <ReportActions
              targetRef={printRef}
              fileName={`inspection-report-v${latest.version}`}
              title="HSE Inspection Report"
              subtitle={`Version ${latest.version} · ${latest.status}`}
              module="inspections"
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
            No report draft has been generated yet.
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
