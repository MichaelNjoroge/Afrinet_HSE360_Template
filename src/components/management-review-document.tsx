import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReportActions } from "@/components/report-actions";
import { EvidencePanel } from "@/components/evidence-panel";
import { getReportBranding } from "@/lib/report-branding.functions";
import { useEmployeeNames } from "@/lib/employee-display";
import { draftManagementReviewMinutes } from "@/lib/management-review.functions";

type Row = Record<string, unknown>;

const fmtDate = (value: unknown) => {
  if (!value || typeof value !== "string") return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
};

const fmtLines = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return ["—"];
  return value
    .split(/\r?\n|•/)
    .map((s) => s.trim())
    .filter(Boolean);
};

function SignatureBlock({ label, name }: { label: string; name?: string | null }) {
  return (
    <div className="flex h-full flex-col rounded-md border-2 border-foreground/20 bg-muted/30 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-primary">{label}</p>
      <div className="mt-auto pt-6">
        <div className="h-12 border-b-2 border-foreground/60" />
        <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">Signature</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Name</p>
          <p className="font-medium">{name ?? "____________________"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Date</p>
          <p className="font-medium">____________________</p>
        </div>
      </div>
    </div>
  );
}


export function ManagementReviewDocumentDialog({
  review,
  open,
  onOpenChange,
  canDraft,
  canReupload,
}: {
  review: Row;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canDraft: boolean;
  canReupload: boolean;
}) {
  const queryClient = useQueryClient();
  const targetRef = useRef<HTMLDivElement>(null);
  const fetchBranding = useServerFn(getReportBranding);
  const draftMinutes = useServerFn(draftManagementReviewMinutes);
  const { data: branding } = useQuery({
    queryKey: ["report-branding"],
    queryFn: () => fetchBranding({}),
    staleTime: 5 * 60 * 1000,
  });
  const { resolve } = useEmployeeNames();
  const [drafting, setDrafting] = useState(false);
  const [aiError, setAiError] = useState("");

  const reference = String(review.reference ?? "");
  const title = `Management Review — ${reference}`;
  const fileName = `management-review-${reference || "draft"}`;
  const chair = resolve(review.chairperson_id) ?? null;




  async function handleDraft() {
    setAiError("");
    setDrafting(true);
    try {
      await draftMinutes({ data: { reviewId: String(review.id) } });
      await queryClient.invalidateQueries({ queryKey: ["module-packs-3-4"] });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Could not generate minutes.");
    } finally {
      setDrafting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Letterhead minutes for the management review. Export as PDF, print, or email the secure
            link. Re-upload the signed scan to attach it to this record.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 border-b pb-3">
          <ReportActions
            targetRef={targetRef}
            fileName={fileName}
            title={title}
            subtitle={`Meeting: ${fmtDate(review.meeting_date)} · Status: ${String(review.status ?? "")}`}
            module="reviews"
          />
          {canDraft && (
            <Button variant="safety" onClick={handleDraft} disabled={drafting}>
              {drafting ? <Loader2 className="animate-spin" /> : <FileText />}
              {drafting ? "Generating…" : "Generate Minutes"}
            </Button>
          )}

        </div>
        {aiError && (
          <p className="text-xs font-medium text-destructive">{aiError}</p>
        )}

        <div ref={targetRef} className="doc space-y-5 bg-card p-2 text-sm">
          <header className="flex items-end justify-between border-b-2 border-foreground pb-3">
            <div>
              <h2 className="text-xl font-bold">{branding?.companyName ?? "Company"}</h2>
              <p className="text-xs text-muted-foreground">MANAGEMENT REVIEW MINUTES</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-base font-bold">{reference}</p>
              <p className="text-xs uppercase text-muted-foreground">
                Status: {String(review.status ?? "—")}
              </p>
            </div>
          </header>

          <table className="w-full border-collapse text-sm">
            <tbody>
              <tr>
                <th className="w-1/4 border bg-muted/40 px-3 py-2 text-left">Meeting date</th>
                <td className="border px-3 py-2">{fmtDate(review.meeting_date)}</td>
                <th className="w-1/4 border bg-muted/40 px-3 py-2 text-left">Chairperson</th>
                <td className="border px-3 py-2">{chair ?? "—"}</td>
              </tr>
              <tr>
                <th className="border bg-muted/40 px-3 py-2 text-left">Period start</th>
                <td className="border px-3 py-2">{fmtDate(review.period_start)}</td>
                <th className="border bg-muted/40 px-3 py-2 text-left">Period end</th>
                <td className="border px-3 py-2">{fmtDate(review.period_end)}</td>
              </tr>
            </tbody>
          </table>

          <section>
            <h3 className="mb-1 text-sm font-bold uppercase tracking-wide">1. Attendees</h3>
            <ul className="list-disc border bg-background p-3 pl-8">
              {fmtLines(review.attendees).map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-1 text-sm font-bold uppercase tracking-wide">2. Executive summary</h3>
            <div className="whitespace-pre-wrap border bg-background p-3">
              {String(review.executive_summary ?? "—")}
            </div>
          </section>

          <section>
            <h3 className="mb-1 text-sm font-bold uppercase tracking-wide">
              3. Performance metrics
            </h3>
            <pre className="overflow-x-auto border bg-background p-3 text-xs">
              {JSON.stringify(review.metrics_snapshot ?? {}, null, 2)}
            </pre>
          </section>

          <section>
            <h3 className="mb-1 text-sm font-bold uppercase tracking-wide">
              4. Decisions &amp; actions
            </h3>
            <div className="whitespace-pre-wrap border bg-background p-3">
              {String(review.decisions ?? "—")}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide">5. Signatories</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SignatureBlock label="Chairperson" name={chair} />
              <SignatureBlock label="Secretary" name={fmtLines(review.attendees)[0] ?? null} />
              <SignatureBlock label="Member" name={fmtLines(review.attendees)[1] ?? null} />
              <SignatureBlock label="Member" name={fmtLines(review.attendees)[2] ?? null} />
            </div>
          </section>


        </div>

        {canReupload && (
          <div className="border-t pt-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Signed minutes &amp; supporting evidence
            </p>
            <EvidencePanel module="reviews" recordId={String(review.id)} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
