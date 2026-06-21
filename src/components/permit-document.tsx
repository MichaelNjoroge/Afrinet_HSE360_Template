import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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

type Row = Record<string, unknown>;

const formatDateTime = (value: unknown) => {
  if (!value || typeof value !== "string") return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
};

const formatLines = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return ["—"];
  return value
    .split(/\r?\n|•/)
    .map((line) => line.trim())
    .filter(Boolean);
};

function SignatureBlock({
  label,
  signedBy,
  signedAt,
  reference,
}: {
  label: string;
  signedBy?: string | null;
  signedAt?: string | null;
  reference?: string | null;
}) {
  return (
    <div className="border bg-muted/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-6 h-10 border-b border-dashed border-foreground/40" />
      <p className="mt-1 text-xs text-muted-foreground">Signature</p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Name</p>
          <p className="font-medium">{signedBy ?? "____________________"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Date &amp; time</p>
          <p className="font-medium">{signedAt ? formatDateTime(signedAt) : "____________________"}</p>
        </div>
        {reference && (
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground">Reference</p>
            <p className="font-medium">{reference}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function PermitDocumentDialog({
  permit,
  contractorName,
  open,
  onOpenChange,
  canReupload,
}: {
  permit: Row;
  contractorName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canReupload: boolean;
}) {
  const targetRef = useRef<HTMLDivElement>(null);
  const fetchBranding = useServerFn(getReportBranding);
  const { data: branding } = useQuery({
    queryKey: ["report-branding"],
    queryFn: () => fetchBranding({}),
    staleTime: 5 * 60 * 1000,
  });
  const { resolve } = useEmployeeNames();

  const permitNumber = String(permit.permit_number ?? "");
  const title = `Permit to Work — ${permitNumber}`;
  const fileName = `permit-to-work-${permitNumber || "draft"}`;

  const issuedByName = resolve(permit.issued_by) ?? (permit.issued_by ? String(permit.issued_by) : null);
  const approvedByName =
    resolve(permit.approved_by) ?? (permit.approved_by ? String(permit.approved_by) : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Issued on company letterhead. Export as PDF, print, or send the secure download by
            email. Re-upload the signed scan to attach it to this permit record.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 border-b pb-3">
          <ReportActions
            targetRef={targetRef}
            fileName={fileName}
            title={title}
            subtitle={`Contractor: ${contractorName} · Status: ${String(permit.status ?? "")}`}
            module="contractors"
          />
        </div>

        <div ref={targetRef} className="permit-doc space-y-5 bg-card p-2 text-sm">
          <header data-pdf-section className="flex items-end justify-between border-b-2 border-foreground pb-3">
            <div>
              <h2 className="text-xl font-bold">{branding?.companyName ?? "Company"}</h2>
              <p className="text-xs text-muted-foreground">PERMIT TO WORK</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-base font-bold">{permitNumber}</p>
              <p className="text-xs uppercase text-muted-foreground">Status: {String(permit.status ?? "—")}</p>
            </div>
          </header>

          <table data-pdf-section className="w-full border-collapse text-sm">
            <tbody>
              <tr>
                <th className="w-1/4 border bg-muted/40 px-3 py-2 text-left">Contractor</th>
                <td className="border px-3 py-2">{contractorName}</td>
                <th className="w-1/4 border bg-muted/40 px-3 py-2 text-left">Work location</th>
                <td className="border px-3 py-2">{String(permit.work_location ?? "—")}</td>
              </tr>
              <tr>
                <th className="border bg-muted/40 px-3 py-2 text-left">Valid from</th>
                <td className="border px-3 py-2">{formatDateTime(permit.valid_from)}</td>
                <th className="border bg-muted/40 px-3 py-2 text-left">Valid until</th>
                <td className="border px-3 py-2">{formatDateTime(permit.valid_until)}</td>
              </tr>
              <tr>
                <th className="border bg-muted/40 px-3 py-2 text-left">Issued by</th>
                <td className="border px-3 py-2">
                  {issuedByName ?? "—"}
                  {permit.issued_at ? ` · ${formatDateTime(permit.issued_at)}` : ""}
                </td>
                <th className="border bg-muted/40 px-3 py-2 text-left">Approved by</th>
                <td className="border px-3 py-2">
                  {approvedByName ?? "—"}
                  {permit.approved_at ? ` · ${formatDateTime(permit.approved_at)}` : ""}
                </td>
              </tr>
            </tbody>
          </table>

          <section data-pdf-section>
            <h3 className="mb-1 text-sm font-bold uppercase tracking-wide">1. Scope of work</h3>
            <p className="border bg-background p-3">{String(permit.work_scope ?? "—")}</p>
          </section>

          <section data-pdf-section>
            <h3 className="mb-1 text-sm font-bold uppercase tracking-wide">2. Workers authorised</h3>
            <ul className="list-disc border bg-background p-3 pl-8">
              {formatLines(permit.workers).map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
            </ul>
          </section>

          <section data-pdf-section>
            <h3 className="mb-1 text-sm font-bold uppercase tracking-wide">3. Hazards identified</h3>
            <ul className="list-disc border bg-background p-3 pl-8">
              {formatLines(permit.hazards).map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
            </ul>
          </section>

          <section data-pdf-section>
            <h3 className="mb-1 text-sm font-bold uppercase tracking-wide">4. Control measures</h3>
            <ul className="list-disc border bg-background p-3 pl-8">
              {formatLines(permit.controls).map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
            </ul>
          </section>

          <section data-pdf-section>
            <h3 className="mb-1 text-sm font-bold uppercase tracking-wide">5. Declarations</h3>
            <ol className="list-decimal space-y-1 border bg-background p-3 pl-8">
              <li>
                The contractor representative confirms that all workers listed have been briefed on
                the hazards and controls above and possess the required competencies.
              </li>
              <li>
                The company representative authorises the work for the period stated and confirms
                that prerequisite isolations and barriers are in place.
              </li>
              <li>
                Work shall stop immediately if conditions change. Any incident shall be reported
                without delay through the Incident Management module.
              </li>
              <li>
                On completion, both parties shall sign the closure section and the signed scan
                shall be re-uploaded to this record.
              </li>
            </ol>
          </section>

          <section data-pdf-section className="grid gap-3 sm:grid-cols-2">
            <SignatureBlock
              label="Company representative"
              signedBy={approvedByName}
              signedAt={permit.approved_at as string | null}
              reference={permit.approval_notes ? String(permit.approval_notes) : null}
            />
            <SignatureBlock
              label="Contractor representative"
              signedBy={null}
              signedAt={null}
              reference={contractorName}
            />
          </section>

          {permit.status === "closed" && (
            <section data-pdf-section>
              <h3 className="mb-1 text-sm font-bold uppercase tracking-wide">6. Closure</h3>
              <p className="border bg-background p-3">
                {String(permit.closure_notes ?? "Closed.")}
              </p>
            </section>
          )}
        </div>

        {canReupload && (
          <div className="border-t pt-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Signed copy &amp; supporting evidence
            </p>
            <EvidencePanel module="contractors" recordId={String(permit.id)} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
