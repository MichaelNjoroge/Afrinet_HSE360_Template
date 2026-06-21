import { useMemo, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  PauseCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { ReportActions } from "@/components/report-actions";
import { PermitDocumentDialog } from "@/components/permit-document";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BulletTextarea } from "@/components/ui/bullet-textarea";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  approveContractorAssessment,
  approveGeneratedReport,
  createContractorAssessment,
  createPermit,
  deleteGeneratedReports,
  generateBrandedReport,
  generatePermitContent,
  getEnterpriseWorkflows,
  saveReportSettings,
  saveReportSubscription,
  transitionPermit,
} from "@/lib/enterprise-workflows.functions";
import { moduleNames } from "@/lib/permissions.functions";

type Row = Record<string, unknown>;
const field = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const cadences = ["daily", "weekly", "monthly"] as const;
const letterheadTypes = ["image/png", "image/jpeg", "application/pdf"];
const moduleLabel = (module: string) =>
  module.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const reportData = (row: Row) =>
  row.report_data && typeof row.report_data === "object" ? (row.report_data as Row) : {};

export function ContractorWorkflows({
  contractors,
  canCreate,
  canApprove,
}: {
  contractors: Row[];
  canCreate: boolean;
  canApprove: boolean;
}) {
  const queryClient = useQueryClient();
  const load = useServerFn(getEnterpriseWorkflows);
  const createAssessment = useServerFn(createContractorAssessment);
  const approveAssessment = useServerFn(approveContractorAssessment);
  const issuePermit = useServerFn(createPermit);
  const movePermit = useServerFn(transitionPermit);
  const genPermit = useServerFn(generatePermitContent);
  const [generatingPermitId, setGeneratingPermitId] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ["enterprise-workflows"], queryFn: () => load() });
  const [mode, setMode] = useState<"assessment" | "permit" | null>(null);
  const [error, setError] = useState("");
  const [openPermit, setOpenPermit] = useState<Row | null>(null);
  const contractorNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of contractors) {
      if (row && typeof row.id === "string" && typeof row.company_name === "string") {
        map.set(row.id, row.company_name);
      }
    }
    return map;
  }, [contractors]);
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["enterprise-workflows"] });
    setMode(null);
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      if (mode === "assessment")
        await createAssessment({
          data: {
            contractorId: field(form, "contractor"),
            taskDescription: field(form, "task"),
            hazards: field(form, "hazards"),
            controls: field(form, "controls"),
            initialRiskScore: Number(field(form, "initial")),
            residualRiskScore: Number(field(form, "residual")),
            validUntil: field(form, "validUntil"),
          },
        });
      else
        await issuePermit({
          data: {
            contractorId: field(form, "contractor"),
            riskAssessmentId: field(form, "assessment"),
            workScope: field(form, "scope"),
            workLocation: field(form, "location"),
            hazards: field(form, "hazards"),
            controls: field(form, "controls"),
            workers: field(form, "workers"),
            validFrom: new Date(field(form, "validFrom")).toISOString(),
            validUntil: new Date(field(form, "validUntil")).toISOString(),
          },
        });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Workflow could not be saved.");
    }
  }
  const approvedContractors = contractors.filter((row) => row.approval_status === "approved");
  const approvedAssessments = (data?.assessments ?? []).filter((row) => row.status === "approved");
  return (
    <section className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">Permit-to-work control</h3>
          <p className="text-sm text-muted-foreground">
            Approved contractor → approved task assessment → issued permit.
          </p>
        </div>
        {canCreate && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setMode("assessment")}>
              <Plus />
              Task assessment
            </Button>
            {canApprove && (
              <Button onClick={() => setMode("permit")}>
                <FileText />
                Issue permit
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="border bg-card">
          <h4 className="border-b px-4 py-3 font-semibold">High-risk task assessments</h4>
          <div className="divide-y">
            {(data?.assessments ?? []).map((row) => (
              <div key={row.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {row.reference} · {row.task_description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Residual risk {row.residual_risk_score} · {row.status}
                  </p>
                </div>
                {canApprove && row.status === "draft" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await approveAssessment({ data: { assessmentId: row.id } });
                      await refresh();
                    }}
                  >
                    <CheckCircle2 />
                    Approve
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="border bg-card">
          <h4 className="border-b px-4 py-3 font-semibold">Permits</h4>
          <div className="divide-y">
            {(data?.permits ?? []).map((row) => (
              <div key={row.id} className="permit-print-sheet p-4">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {row.permit_number} · {row.work_scope}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.work_location} · {row.status}
                    </p>
                  </div>
                  {canApprove && row.status === "draft" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={generatingPermitId === String(row.id)}
                        onClick={async () => {
                          const pid = String(row.id);
                          setGeneratingPermitId(pid);
                          setError("");
                          try {
                            await genPermit({ data: { permitId: pid } });
                            await refresh();
                          } catch (cause) {
                            setError(cause instanceof Error ? cause.message : "Could not generate permit.");
                          } finally {
                            setGeneratingPermitId(null);
                          }
                        }}
                      >
                        <FileText />
                        {generatingPermitId === String(row.id) ? "Generating…" : "Generate Permit"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await movePermit({
                            data: {
                              permitId: row.id,
                              action: "issue",
                              note: "Permit issued after workflow review.",
                            },
                          });
                          await refresh();
                        }}
                      >
                        <FileText />
                        Issue
                      </Button>
                    </>
                  )}
                  {canApprove && row.status === "issued" && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        const note = window.prompt("Approval notes");
                        if (note) {
                          await movePermit({ data: { permitId: row.id, action: "approve", note } });
                          await refresh();
                        }
                      }}
                    >
                      <CheckCircle2 />
                      Approve
                    </Button>
                  )}
                  {canApprove && row.status === "approved" && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        await movePermit({
                          data: { permitId: row.id, action: "activate", note: "Work commenced." },
                        });
                        await refresh();
                      }}
                    >
                      <CheckCircle2 />
                      Start work
                    </Button>
                  )}
                  {canApprove && row.status === "active" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const note = window.prompt("Suspension reason");
                        if (note) {
                          await movePermit({ data: { permitId: row.id, action: "suspend", note } });
                          await refresh();
                        }
                      }}
                    >
                      <PauseCircle />
                      Suspend
                    </Button>
                  )}
                  {canApprove && ["active", "suspended"].includes(row.status) && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        const note = window.prompt("Closure notes");
                        if (note) {
                          await movePermit({ data: { permitId: row.id, action: "close", note } });
                          await refresh();
                        }
                      }}
                    >
                      <CheckCircle2 />
                      Close
                    </Button>
                  )}
                </div>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <span>
                    Valid: {String(row.valid_from).slice(0, 16).replace("T", " ")} –{" "}
                    {String(row.valid_until).slice(0, 16).replace("T", " ")}
                  </span>
                  <span>Workers: {row.workers || "Not specified"}</span>
                  <span>Hazards: {row.hazards}</span>
                  <span>Controls: {row.controls}</span>
                </div>
                <Button
                  className="mt-3"
                  size="sm"
                  variant="outline"
                  onClick={() => setOpenPermit(row)}
                >
                  <FileText />
                  View permit · PDF · Print · Email
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Dialog open={mode !== null} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mode === "assessment" ? "High-risk task assessment" : "Draft permit to work"}
            </DialogTitle>
            <DialogDescription>Workflow gates are validated again on the server.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={submit}>
            <Label>Contractor</Label>
            <select className="h-10 border bg-background px-3" name="contractor" required>
              {approvedContractors.map((row) => (
                <option key={String(row.id)} value={String(row.id)}>
                  {String(row.company_name)}
                </option>
              ))}
            </select>
            {mode === "assessment" ? (
              <>
                <Label>Task description</Label>
                <Input name="task" required maxLength={4000} />
                <Label>Initial risk score (1–25)</Label>
                <Input name="initial" type="number" min={1} max={25} required />
                <Label>Residual risk score (1–25)</Label>
                <Input name="residual" type="number" min={1} max={25} required />
                <Label>Valid until</Label>
                <Input name="validUntil" type="date" required />
              </>
            ) : (
              <>
                <Label>Approved assessment</Label>
                <select className="h-10 border bg-background px-3" name="assessment" required>
                  {approvedAssessments.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.reference}
                    </option>
                  ))}
                </select>
                <Label>Work scope</Label>
                <Input name="scope" required />
                <Label>Location</Label>
                <Input name="location" required />
                <Label>Workers</Label>
                <BulletTextarea name="workers" />
                <Label>Valid from</Label>
                <Input name="validFrom" type="datetime-local" required />
                <Label>Valid until</Label>
                <Input name="validUntil" type="datetime-local" required />
              </>
            )}
            <Label>Hazards</Label>
            <BulletTextarea name="hazards" required />
            <Label>Controls</Label>
            <BulletTextarea name="controls" required />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit">
              {mode === "permit" ? "Create permit draft" : "Save workflow"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      {openPermit && (
        <PermitDocumentDialog
          permit={openPermit}
          contractorName={
            contractorNameById.get(String(openPermit.contractor_id)) ?? "Contractor"
          }
          open={openPermit !== null}
          onOpenChange={(open) => !open && setOpenPermit(null)}
          canReupload={canApprove}
        />
      )}
    </section>
  );
}

export function ReportingAdministration({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const load = useServerFn(getEnterpriseWorkflows);
  const saveSettings = useServerFn(saveReportSettings);
  const saveSubscription = useServerFn(saveReportSubscription);
  const generateReport = useServerFn(generateBrandedReport);
  const approveReport = useServerFn(approveGeneratedReport);
  const deleteReports = useServerFn(deleteGeneratedReports);
  const { data } = useQuery({ queryKey: ["enterprise-workflows"], queryFn: () => load() });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<"branding" | "subscription" | "delete" | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const reports = useMemo(() => (data?.reports ?? []) as Row[], [data?.reports]);
  const deletableIds = useMemo(
    () => reports.filter((row) => row.status === "draft").map((row) => String(row.id)),
    [reports],
  );
  const allDeletableSelected =
    deletableIds.length > 0 && deletableIds.every((id) => selected.has(id));
  const toggleAllDeletable = () =>
    setSelected((current) => {
      if (allDeletableSelected) return new Set();
      return new Set(deletableIds);
    });
  const toggleOne = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const refresh = async (successMessage: string) => {
    await queryClient.invalidateQueries({ queryKey: ["enterprise-workflows"] });
    setMessage(successMessage);
    setSelected(new Set());
  };
  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      {isAdmin && (
        <form
          className="space-y-3 border bg-card p-5"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            setMessage("");
            setSaving("branding");
            const form = new FormData(event.currentTarget);
            try {
              let letterheadPath = String(data?.settings?.letterhead_path ?? "");
              const file = form.get("letterhead");
              if (file instanceof File && file.size) {
                if (!letterheadTypes.includes(file.type))
                  throw new Error("Letterhead must be a PNG, JPG, JPEG or PDF file.");
                if (file.size > 5 * 1024 * 1024)
                  throw new Error("Letterhead file must be 5 MB or smaller.");
                const { supabase } = await import("@/integrations/supabase/client");
                const auth = await supabase.auth.getUser();
                if (auth.data.user) {
                  letterheadPath = `letterhead/${auth.data.user.id}.${file.name.split(".").pop()?.toLowerCase()}`;
                  const uploaded = await supabase.storage
                    .from("company-letterheads")
                    .upload(letterheadPath, file, { upsert: true });
                  if (uploaded.error) throw uploaded.error;
                }
              }
              await saveSettings({
                data: {
                  companyName: field(form, "company"),
                  reportFooter: field(form, "footer"),
                  defaultTimezone: field(form, "timezone"),
                  letterheadPath,
                },
              });
              await refresh("Branding saved successfully.");
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Branding could not be saved.");
            } finally {
              setSaving(null);
            }
          }}
        >
          <h3 className="font-bold">Report branding</h3>
          <Label>Company name</Label>
          <Input
            name="company"
            defaultValue={data?.settings?.company_name ?? "Prosel Limited"}
            required
            maxLength={200}
            placeholder="Registered company name, e.g. Prosel Limited"
          />
          <p className="text-xs text-muted-foreground">Appears on generated report headings and scheduled report emails.</p>
          <Label>Footer</Label>
          <Input name="footer" defaultValue={data?.settings?.report_footer ?? ""} maxLength={1000} placeholder="Optional confidentiality, approval or document-control footer" />
          <p className="text-xs text-muted-foreground">Optional text shown at the bottom of printed and scheduled reports.</p>
          <Label>Timezone</Label>
          <Input
            name="timezone"
            defaultValue={data?.settings?.default_timezone ?? "Africa/Nairobi"}
            required
            placeholder="IANA timezone, e.g. Africa/Nairobi"
          />
          <p className="text-xs text-muted-foreground">Use a valid timezone name such as Africa/Nairobi, UTC or Europe/London.</p>
          <Label>Letterhead</Label>
          <Input name="letterhead" type="file" accept="image/png,image/jpeg,application/pdf" />
          <p className="text-xs text-muted-foreground">Allowed formats: PNG, JPG, JPEG or PDF. Maximum size: 5 MB.</p>
          <Button type="submit" disabled={saving !== null}>
            {saving === "branding" ? "Saving…" : "Save branding"}
          </Button>
        </form>
      )}
      {isAdmin && (
        <form
          className="space-y-3 border bg-card p-5"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            setMessage("");
            setSaving("subscription");
            const form = new FormData(event.currentTarget);
            const module = moduleNames.find((value) => value === field(form, "module"));
            const cadence = cadences.find((value) => value === field(form, "cadence"));
            try {
              if (!module || !cadence) throw new Error("Select a valid module and cadence.");
              await saveSubscription({
                data: {
                  module,
                  recipients: field(form, "recipients")
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                  cadence,
                  weekday: Number(field(form, "weekday")),
                  hourUtc: Number(field(form, "hour")),
                  timezone: field(form, "timezone"),
                  isActive: true,
                },
              });
              event.currentTarget.reset();
              await refresh("Report subscription added successfully.");
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Subscription could not be added.");
            } finally {
              setSaving(null);
            }
          }}
        >
          <h3 className="font-bold">Scheduled reports</h3>
          <Label>Module</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            name="module"
            defaultValue="inspections"
            required
          >
            {moduleNames.map((module) => (
              <option key={module} value={module}>
                {module.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Select the module that should be included in this scheduled report.</p>
          <Label>Recipients (comma-separated)</Label>
          <Textarea name="recipients" required placeholder="name@example.com, manager@example.com" />
          <p className="text-xs text-muted-foreground">Enter valid email addresses separated by commas. Example: hse@company.com, manager@company.com.</p>
          <Label>Cadence</Label>
          <select className="h-10 w-full border bg-background px-3" name="cadence">
            <option>weekly</option>
            <option>daily</option>
            <option>monthly</option>
          </select>
          <p className="text-xs text-muted-foreground">Choose how often the report draft should be generated.</p>
          <Label>Weekday (0 Sunday–6 Saturday)</Label>
          <Input name="weekday" type="number" min={0} max={6} defaultValue={1} />
          <p className="text-xs text-muted-foreground">Used for weekly schedules only: 0 = Sunday, 1 = Monday, up to 6 = Saturday.</p>
          <Label>UTC hour</Label>
          <Input name="hour" type="number" min={0} max={23} defaultValue={6} />
          <p className="text-xs text-muted-foreground">Use a 24-hour UTC value from 0 to 23; for example, 6 means 06:00 UTC.</p>
          <Label>Timezone</Label>
          <Input
            name="timezone"
            defaultValue={data?.settings?.default_timezone ?? "Africa/Nairobi"}
            required
            placeholder="Africa/Nairobi"
          />
          <p className="text-xs text-muted-foreground">Timezone used to calculate future run dates.</p>
          <Button type="submit" disabled={saving !== null}>
            {saving === "subscription" ? "Adding…" : "Add subscription"}
          </Button>
        </form>
      )}
      <section className="border bg-card lg:col-span-2">
        <button
          type="button"
          onClick={() => setShowHistory((value) => !value)}
          aria-expanded={showHistory}
          className="flex w-full items-center justify-between gap-3 border-b px-5 py-3 text-left"
        >
          <div>
            <h3 className="font-bold">Delivery history</h3>
            <p className="text-xs text-muted-foreground">
              {showHistory ? "Click to hide" : "Click to view recent email deliveries"} ·{" "}
              {(data?.delivery ?? []).length} records
            </p>
          </div>
          {showHistory ? <ChevronDown /> : <ChevronRight />}
        </button>
        {showHistory && (
          <div className="divide-y">
            {(data?.delivery ?? []).length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                No delivery records yet.
              </p>
            ) : (
              (data?.delivery ?? []).map((row) => (
                <div key={row.id} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-4">
                  <span>{row.template_name}</span>
                  <span>{row.recipient_email}</span>
                  <span className="capitalize">{row.status}</span>
                  <span className="text-muted-foreground">
                    {String(row.created_at).slice(0, 16).replace("T", " ")}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </section>
      <section className="border bg-card lg:col-span-2">
        <button
          type="button"
          onClick={() => setShowReports((value) => !value)}
          aria-expanded={showReports}
          className="flex w-full items-center justify-between gap-3 border-b px-5 py-3 text-left"
        >
          <div>
            <h3 className="font-bold">Controlled reports</h3>
            <p className="text-xs text-muted-foreground">
              {showReports ? "Click to hide" : "Click to view branded report drafts"} ·{" "}
              {reports.length} record{reports.length === 1 ? "" : "s"}
            </p>
          </div>
          {showReports ? <ChevronDown /> : <ChevronRight />}
        </button>
        {showReports && (
          <>
            <div className="flex flex-wrap items-center justify-end gap-2 border-b px-5 py-3">
              {deletableIds.length > 0 && (
                <label className="mr-auto flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={allDeletableSelected}
                    onCheckedChange={toggleAllDeletable}
                    aria-label="Select all deletable reports"
                  />
                  Select all drafts
                </label>
              )}
              {selected.size > 0 && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={saving === "delete"}
                  onClick={async () => {
                    if (
                      !window.confirm(
                        `Delete ${selected.size} draft report${selected.size === 1 ? "" : "s"}? This cannot be undone.`,
                      )
                    )
                      return;
                    setSaving("delete");
                    setError("");
                    try {
                      const result = await deleteReports({
                        data: { reportIds: Array.from(selected) },
                      });
                      await refresh(`${result.deleted} report${result.deleted === 1 ? "" : "s"} deleted.`);
                    } catch (cause) {
                      setError(cause instanceof Error ? cause.message : "Reports could not be deleted.");
                    } finally {
                      setSaving(null);
                    }
                  }}
                >
                  <Trash2 />
                  Delete selected ({selected.size})
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  await generateReport({
                    data: {
                      module: "reporting",
                      title: "HSE management report",
                      data: {
                        generatedAt: new Date().toISOString(),
                        summary: "Management report prepared from current reporting-centre data.",
                      },
                    },
                  });
                  await refresh("Report generated successfully.");
                }}
              >
                <FileText />
                Generate report
              </Button>
            </div>
            <div className="divide-y">
              {reports.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No controlled reports yet.
                </p>
              ) : (
                reports.map((row) => {
                  const id = String(row.id);
                  const isDraft = row.status === "draft";
                  return (
                    <div key={id} className="flex items-start gap-3 px-5">
                      {isDraft ? (
                        <Checkbox
                          className="mt-6"
                          checked={selected.has(id)}
                          onCheckedChange={() => toggleOne(id)}
                          aria-label={`Select report ${String(row.report_number ?? "")}`}
                        />
                      ) : (
                        <span className="mt-6 size-4" aria-hidden />
                      )}
                      <div className="flex-1">
                        <ReportRow
                          row={row}
                          data={data}
                          isAdmin={isAdmin}
                          approveReport={approveReport}
                          refresh={refresh}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </section>
      {message && <p className="text-sm text-success lg:col-span-2">{message}</p>}
      {error && <p className="text-sm text-destructive lg:col-span-2">{error}</p>}
    </div>
  );
}

function ReportRow({
  row,
  data,
  isAdmin,
  approveReport,
  refresh,
}: {
  row: Row;
  data: { settings?: Row | null; reports?: Row[] } | undefined;
  isAdmin: boolean;
  approveReport: (args: { data: { reportId: unknown } }) => Promise<unknown>;
  refresh: (message: string) => Promise<void>;
}) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const details = reportData(row);
  return (
    <div ref={rowRef} className="report-print-sheet px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">
            {String(details.company_name ?? data?.settings?.company_name ?? "Prosel Limited")}
          </p>
          <p className="font-medium">
            {String(row.report_number)} · {String(row.title)}
          </p>
          <p className="text-xs text-muted-foreground">
            {moduleLabel(String(row.module))} · {String(row.status)} ·{" "}
            {String(row.created_at).slice(0, 16).replace("T", " ")}
          </p>
        </div>
        {isAdmin && row.status === "draft" && (
          <Button
            size="sm"
            onClick={async () => {
              await approveReport({ data: { reportId: row.id } });
              await refresh("Report approved successfully.");
            }}
          >
            <CheckCircle2 />
            Approve
          </Button>
        )}
        <ReportActions
          targetRef={rowRef}
          fileName={String(row.report_number ?? "report")}
          title={String(row.title ?? "Report")}
          subtitle={moduleLabel(String(row.module))}
          module={String(row.module)}
          className="flex flex-wrap gap-2"
        />
      </div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Schedule</p>
          <p className="font-medium">{String(details.schedule ?? "Manual")}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Timezone</p>
          <p className="font-medium">
            {String(details.timezone ?? data?.settings?.default_timezone ?? "Africa/Nairobi")}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Recipients</p>
          <p className="font-medium">{String(details.recipient_count ?? "—")}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        {String(details.summary ?? "Management report prepared from current reporting-centre data.")}
      </p>
      {Boolean(details.report_footer || data?.settings?.report_footer) && (
        <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
          {String(details.report_footer ?? data?.settings?.report_footer)}
        </p>
      )}
    </div>
  );
}
