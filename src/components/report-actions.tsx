import { useEffect, useState, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileDown, Mail, Loader2, Printer, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { elementToPdfBase64, exportElementToPdf } from "@/lib/pdf-export";
import { exportElementToWord } from "@/lib/word-export";
import {
  emailReportLink,
  getReportBranding,
} from "@/lib/report-branding.functions";
import { humanizeError } from "@/lib/humanize-error";
import { supabase } from "@/integrations/supabase/client";
import { rowsToCsv, downloadCsv, type CsvColumn } from "@/lib/csv-export";

/**
 * Combined toolbar: Export PDF (branded letterhead), Print, Download CSV,
 * and Email Report. Recipients pre-fill with the signed-in user's email.
 */
export function ReportActions<Row extends Record<string, unknown> = Record<string, unknown>>({
  targetRef,
  fileName,
  title,
  subtitle,
  module,
  className,
  csvRows,
  csvColumns,
}: {
  targetRef: RefObject<HTMLElement | null>;
  fileName: string;
  title: string;
  subtitle?: string;
  module: string;
  className?: string;
  csvRows?: Row[];
  csvColumns?: CsvColumn<Row>[];
}) {
  const fetchBranding = useServerFn(getReportBranding);
  const sendEmail = useServerFn(emailReportLink);
  const { data: branding } = useQuery({
    queryKey: ["report-branding"],
    queryFn: () => fetchBranding({}),
    staleTime: 5 * 60 * 1000,
  });

  const [busy, setBusy] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [recipients, setRecipients] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [selfEmail, setSelfEmail] = useState("");

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const email = data.session?.user?.email ?? "";
      if (email) setSelfEmail(email);
    });
    return () => {
      active = false;
    };
  }, []);

  function openEmailDialog() {
    setRecipients((current) => current || selfEmail);
    setEmailOpen(true);
  }

  async function handlePrint() {
    const el = targetRef.current;
    if (!el) {
      toast.error("Nothing to print yet — please wait for the report to load.");
      return;
    }
    setBusy(true);
    try {
      // Build the same branded A4 PDF the Export button produces, then
      // open it in a new tab and trigger the browser print dialog. This
      // guarantees the printed copy uses the company letterhead and
      // respects A4 margins/pagination instead of the raw on-screen HTML.
      const { buildBrandedPdf } = await import("@/lib/pdf-export");
      const pdf = await buildBrandedPdf(el, {
        fileName,
        title,
        subtitle,
        branding: branding ?? null,
      });
      if (!pdf) return;
      const blobUrl = URL.createObjectURL(pdf.output("blob"));
      const win = window.open(blobUrl, "_blank");
      if (!win) {
        toast.error("Allow pop-ups for this site to use Print.");
        return;
      }
      setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch {
          /* user can still print from the opened tab */
        }
      }, 600);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    if (!targetRef.current) return;
    setBusy(true);
    try {
      await exportElementToPdf(targetRef.current, {
        fileName,
        title,
        subtitle,
        branding: branding ?? null,
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleEmail() {
    if (!targetRef.current) return;
    const list = recipients
      .split(/[,;\s]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (list.length === 0) {
      toast.error("Add at least one recipient email.");
      return;
    }
    setSending(true);
    try {
      const result = await elementToPdfBase64(targetRef.current, {
        fileName,
        title,
        subtitle,
        branding: branding ?? null,
      });
      if (!result) return;
      const response = await sendEmail({
        data: {
          module,
          title,
          recipients: list,
          message: note,
          fileName,
          pdfBase64: result.base64,
        },
      });
      const queued = response.delivery?.queued?.length ?? response.recipientCount ?? 0;
      const suppressed = response.delivery?.suppressed?.length ?? 0;
      const failed = response.delivery?.failed?.length ?? 0;
      if (queued > 0 && suppressed + failed === 0) {
        toast.success(`Message sent successfully to ${queued} recipient(s).`);
      } else if (queued > 0) {
        toast.success(`Message sent successfully to ${queued} recipient(s).`);
        const reasons = [
          suppressed ? `${suppressed} suppressed` : "",
          failed ? `${failed} failed` : "",
        ].filter(Boolean).join(", ");
        toast.warning(`Some messages were not sent because ${reasons}.`);
      } else {
        toast.error("Message was not sent. No recipients could be queued for delivery.");
      }
      setEmailOpen(false);
      setRecipients("");
      setNote("");
    } catch (cause) {
      toast.error(`Message was not sent because ${humanizeError(cause)}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={className ?? "flex flex-wrap gap-2"} data-export-hide>
      <Button variant="outline" onClick={handleExport} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <FileDown />}
        Export PDF
      </Button>
      <Button
        variant="outline"
        onClick={async () => {
          if (!targetRef.current) return;
          setBusy(true);
          try {
            await exportElementToWord(targetRef.current, {
              fileName,
              title,
              subtitle,
              branding: branding ?? null,
            });
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
      >
        <FileText />
        Export to Word
      </Button>
      <Button variant="outline" onClick={handlePrint}>
        <Printer />
        Print
      </Button>
      {csvRows && csvColumns && csvColumns.length > 0 && (
        <Button
          variant="outline"
          onClick={() => {
            if (!csvRows.length) {
              toast.info("Nothing to export yet — no rows are visible.");
              return;
            }
            downloadCsv(fileName, rowsToCsv(csvRows, csvColumns));
          }}
        >
          <FileSpreadsheet />
          Download CSV
        </Button>
      )}
      {branding?.canEmailReports && (
        <Button variant="safety" onClick={openEmailDialog}>
          <Mail />
          Send by email
        </Button>
      )}

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email this report</DialogTitle>
            <DialogDescription>
              The PDF will be generated on company letterhead and a secure download link will be
              emailed to each recipient. The link expires in 7 days.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="report-recipients">Recipients</Label>
              <Input
                id="report-recipients"
                placeholder="name@example.com, other@example.com"
                value={recipients}
                onChange={(event) => setRecipients(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple addresses with commas or spaces. Up to 20.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="report-note">Message (optional)</Label>
              <Textarea
                id="report-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                maxLength={2000}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={handleEmail} disabled={sending}>
              {sending ? <Loader2 className="animate-spin" /> : <Mail />}
              Send report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
