import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Pencil, Trash2, Users, ShieldAlert, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BulletTextarea } from "@/components/ui/bullet-textarea";
import { ReportActions } from "@/components/report-actions";
import { EvidencePanel } from "@/components/evidence-panel";
import {
  listSafetyCommittee,
  saveSafetyMeeting,
  deleteSafetyMeeting,
  listEmergencyResponse,
  saveEmergencyRecord,
  deleteEmergencyRecord,
  generateSafetyMeetingMinutes,
  generateEmergencyReport,
} from "@/lib/governance.functions";
import { FileText } from "lucide-react";

type Row = Record<string, any>;

function fmtDate(s?: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

export function SafetyCommitteePanel({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const fetchAll = useServerFn(listSafetyCommittee);
  const save = useServerFn(saveSafetyMeeting);
  const remove = useServerFn(deleteSafetyMeeting);
  const genMinutes = useServerFn(generateSafetyMeetingMinutes);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["safety-committee"],
    queryFn: () => fetchAll(),
  });
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const reportRef = useRef<HTMLDivElement | null>(null);

  const meetings = (data?.meetings ?? []) as Row[];
  const signatories = (data?.signatories ?? []) as Row[];
  const employees = (data?.employees ?? []) as Row[];
  const byMeeting = useMemo(() => {
    const map = new Map<string, Row[]>();
    signatories.forEach((s) => {
      const arr = map.get(String(s.meeting_id)) ?? [];
      arr.push(s);
      map.set(String(s.meeting_id), arr);
    });
    return map;
  }, [signatories]);

  const openNew = () => {
    setEditing(null);
    setDialog(true);
  };
  const openEdit = (m: Row) => {
    setEditing({ ...m, signatories: byMeeting.get(String(m.id)) ?? [] });
    setDialog(true);
  };
  const onDelete = async (id: string) => {
    if (!confirm("Delete this meeting?")) return;
    try {
      await remove({ data: { id } });
      await queryClient.invalidateQueries({ queryKey: ["safety-committee"] });
      toast.success("Meeting deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Users className="size-5 text-primary" /> Safety Committee
          </h2>
          <p className="text-sm text-muted-foreground">
            Plan meetings, record minutes with up to 10 signatories, share the schedule.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReportActions
            targetRef={reportRef}
            fileName="safety-committee"
            title="Safety Committee meetings & minutes"
            module="safety_committee"
            csvRows={meetings}
            csvColumns={[
              { key: "Number", label: "Number", format: (r: any) => String(r.meeting_number ?? "") },
              { key: "Title", label: "Title", format: (r: any) => String(r.title ?? "") },
              { key: "Date", label: "Date", format: (r: any) => String(r.meeting_date ?? "") },
              { key: "Location", label: "Location", format: (r: any) => String(r.location ?? "") },
              { key: "Chair", label: "Chair", format: (r: any) => String(r.chairperson ?? "") },
              { key: "Status", label: "Status", format: (r: any) => String(r.status ?? "") },
              { key: "Next meeting", label: "Next meeting", format: (r: any) => String(r.next_meeting_at ?? "") },
            ]}
          />
          <Button onClick={openNew}>
            <Plus className="size-4" /> New meeting
          </Button>
        </div>
      </div>

      <div ref={reportRef} className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : meetings.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No meetings yet. Click <strong>New meeting</strong> to plan one.
          </div>
        ) : (
          meetings.map((m) => (
            <MeetingCard
              key={String(m.id)}
              m={m}
              sigs={byMeeting.get(String(m.id)) ?? []}
              isAdmin={isAdmin}
              generatingId={generatingId}
              onGenerate={async () => {
                const mid = String(m.id);
                setGeneratingId(mid);
                try {
                  await genMinutes({ data: { id: mid } });
                  await queryClient.invalidateQueries({ queryKey: ["safety-committee"] });
                  toast.success("Minutes generated");
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setGeneratingId(null);
                }
              }}
              onEdit={() => openEdit(m)}
              onDelete={() => onDelete(String(m.id))}
            />
          ))
        )}
      </div>


      <MeetingDialog
        open={dialog}
        onOpenChange={setDialog}
        editing={editing}
        employees={employees}
        onSubmit={async (payload) => {
          try {
            await save({ data: payload as never });
            await queryClient.invalidateQueries({ queryKey: ["safety-committee"] });
            setDialog(false);
            toast.success("Meeting saved");
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
    </div>
  );
}

function MeetingCard({
  m,
  sigs,
  isAdmin,
  generatingId,
  onGenerate,
  onEdit,
  onDelete,
}: {
  m: Row;
  sigs: Row[];
  isAdmin: boolean;
  generatingId: string | null;
  onGenerate: () => void | Promise<void>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const ref = String(m.meeting_number ?? "meeting");
  const title = String(m.title ?? "Safety committee meeting");
  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <article className="rounded-2xl border bg-card p-5 shadow-sm">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <CollapsibleTrigger asChild>
            <button type="button" className="flex flex-1 items-start gap-3 text-left">
              {open ? (
                <ChevronDown className="mt-1 size-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="mt-1 size-4 text-muted-foreground" />
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">
                  {ref} · {String(m.status ?? "")}
                </p>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(m.meeting_date)} · {String(m.location ?? "—")}
                </p>
              </div>
            </button>
          </CollapsibleTrigger>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={generatingId === String(m.id)}
              onClick={onGenerate}
            >
              <FileText className="size-3" />
              {generatingId === String(m.id) ? "Generating…" : "Generate Minutes"}
            </Button>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="size-3" /> Edit
            </Button>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={onDelete}>
                <Trash2 className="size-3" /> Delete
              </Button>
            )}
          </div>
        </header>
        <CollapsibleContent>
          <div ref={contentRef} data-pdf-section className="mt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Chairperson</p>
                <p className="text-sm">{String(m.chairperson ?? "—")}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Secretary</p>
                <p className="text-sm">{String(m.secretary ?? "—")}</p>
              </div>
              {m.agenda && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold text-muted-foreground">Agenda</p>
                  <p className="whitespace-pre-wrap text-sm">{String(m.agenda)}</p>
                </div>
              )}
              {m.minutes && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold text-muted-foreground">Minutes</p>
                  <p className="whitespace-pre-wrap text-sm">{String(m.minutes)}</p>
                </div>
              )}
              {m.decisions && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold text-muted-foreground">Decisions</p>
                  <p className="whitespace-pre-wrap text-sm">{String(m.decisions)}</p>
                </div>
              )}
              {m.next_meeting_at && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold text-muted-foreground">Next meeting</p>
                  <p className="text-sm">{fmtDate(m.next_meeting_at)}</p>
                </div>
              )}
            </div>
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">
                Signatories ({sigs.length}/10)
              </p>
              {sigs.length === 0 ? (
                <p className="text-xs text-muted-foreground">No signatories recorded.</p>
              ) : (
                <ol className="grid gap-1 text-sm sm:grid-cols-2">
                  {sigs.map((s) => (
                    <li key={String(s.id)} className="rounded-md bg-muted/40 px-3 py-1.5">
                      <span className="font-semibold">{s.signatory_position}.</span>{" "}
                      {String(s.full_name)}
                      {s.role_title ? (
                        <span className="text-muted-foreground"> — {String(s.role_title)}</span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <div className="mt-4">
              <EvidencePanel
                module="safety_committee"
                recordId={String(m.id)}
                canAdd
                canDelete={isAdmin}
              />
            </div>
          </div>
          <div className="mt-4 border-t pt-3" data-export-hide>
            <ReportActions
              targetRef={contentRef}
              fileName={`safety-committee-${ref}`}
              title={`Safety Committee Minutes — ${ref}`}
              subtitle={`${title} · ${fmtDate(m.meeting_date)}`}
              module="safety_committee"
            />
          </div>
        </CollapsibleContent>
      </article>
    </Collapsible>
  );
}


function MeetingDialog({
  open,
  onOpenChange,
  editing,
  employees,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Row | null;
  employees: Row[];
  onSubmit: (data: Row) => void | Promise<void>;
}) {
  const initialSigs: Row[] = editing?.signatories ?? [];
  const [sigs, setSigs] = useState<Row[]>(initialSigs);
  // reset when editing changes
  const editingId = editing?.id ?? null;
  const lastId = useRef<string | null>(null);
  if (lastId.current !== editingId) {
    lastId.current = editingId as string | null;
    setSigs(initialSigs);
  }

  const updateSig = (idx: number, patch: Record<string, string | null>) => {
    setSigs((prev) => {
      const next = [...prev];
      next[idx] = { ...(next[idx] ?? {}), signatory_position: idx + 1, ...patch };
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload: Row = {
      id: editing?.id,
      meeting_number: String(form.get("meeting_number") ?? "").trim() || undefined,
      title: String(form.get("title") ?? "").trim(),
      meeting_date: String(form.get("meeting_date") ?? ""),
      location: String(form.get("location") ?? "").trim() || undefined,
      chairperson: String(form.get("chairperson") ?? "").trim() || undefined,
      secretary: String(form.get("secretary") ?? "").trim() || undefined,
      agenda: String(form.get("agenda") ?? "").trim() || undefined,
      minutes: String(form.get("minutes") ?? "").trim() || undefined,
      decisions: String(form.get("decisions") ?? "").trim() || undefined,
      next_meeting_at: String(form.get("next_meeting_at") ?? "") || undefined,
      status: String(form.get("status") ?? "planned"),
      signatories: sigs
        .map((s, idx) => ({
          signatory_position: idx + 1,
          full_name: String(s.full_name ?? "").trim(),
          role_title: String(s.role_title ?? "").trim() || null,
        }))
        .filter((s) => s.full_name),
    };
    onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing?.id ? "Edit meeting" : "New committee meeting"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Meeting number</Label>
              <Input
                name="meeting_number"
                defaultValue={editing?.meeting_number ?? ""}
                placeholder="Auto-generated if blank"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select name="status" defaultValue={editing?.status ?? "planned"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="held">Held</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Title *</Label>
              <Input name="title" required defaultValue={editing?.title ?? ""} />
            </div>
            <div>
              <Label>Meeting date *</Label>
              <Input
                type="datetime-local"
                name="meeting_date"
                required
                defaultValue={
                  editing?.meeting_date
                    ? new Date(editing.meeting_date).toISOString().slice(0, 16)
                    : ""
                }
              />
            </div>
            <div>
              <Label>Location</Label>
              <Input name="location" defaultValue={editing?.location ?? ""} />
            </div>
            <div>
              <Label>Chairperson</Label>
              <select
                name="chairperson"
                defaultValue={editing?.chairperson ?? ""}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select employee…</option>
                {employees.map((emp) => (
                  <option key={String(emp.id)} value={String(emp.full_name)}>
                    {String(emp.full_name)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Secretary</Label>
              <select
                name="secretary"
                defaultValue={editing?.secretary ?? ""}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select employee…</option>
                {employees.map((emp) => (
                  <option key={String(emp.id)} value={String(emp.full_name)}>
                    {String(emp.full_name)}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label>Agenda</Label>
              <BulletTextarea name="agenda" rows={3} defaultValue={editing?.agenda ?? ""} />
            </div>
            <div className="sm:col-span-2">
              <Label>Minutes</Label>
              <Textarea name="minutes" rows={5} defaultValue={editing?.minutes ?? ""} />
            </div>
            <div className="sm:col-span-2">
              <Label>Decisions</Label>
              <BulletTextarea name="decisions" rows={3} defaultValue={editing?.decisions ?? ""} />
            </div>
            <div className="sm:col-span-2">
              <Label>Next meeting</Label>
              <Input
                type="datetime-local"
                name="next_meeting_at"
                defaultValue={
                  editing?.next_meeting_at
                    ? new Date(editing.next_meeting_at).toISOString().slice(0, 16)
                    : ""
                }
              />
            </div>
          </div>

          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="mb-3 text-sm font-semibold">Signatories (up to 10)</p>
            <p className="mb-3 text-xs text-muted-foreground">Pick employees from the dropdown. Role/title auto-fills from the employee record but can be edited.</p>
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, idx) => {
                const sig = sigs[idx] ?? {};
                return (
                  <div key={idx} className="grid gap-2 sm:grid-cols-[2fr_2fr_auto] sm:items-center">
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={String(sig.full_name ?? "")}
                      onChange={(e) => {
                        const fullName = e.target.value;
                        const emp = employees.find((x) => String(x.full_name) === fullName);
                        updateSig(idx, {
                          full_name: fullName,
                          role_title: emp?.job_title ? String(emp.job_title) : String(sig.role_title ?? ""),
                        });
                      }}
                    >
                      <option value="">{`${idx + 1}. Select employee…`}</option>
                      {employees.map((emp) => (
                        <option key={String(emp.id)} value={String(emp.full_name)}>
                          {String(emp.full_name)}
                          {emp.job_title ? ` — ${String(emp.job_title)}` : ""}
                        </option>
                      ))}
                    </select>
                    <Input
                      placeholder="Role / title"
                      value={String(sig.role_title ?? "")}
                      onChange={(e) => updateSig(idx, { role_title: e.target.value })}
                    />
                    <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save meeting</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EmergencyResponsePanel({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const fetchAll = useServerFn(listEmergencyResponse);
  const save = useServerFn(saveEmergencyRecord);
  const remove = useServerFn(deleteEmergencyRecord);
  const genReport = useServerFn(generateEmergencyReport);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["emergency-response"],
    queryFn: () => fetchAll(),
  });
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const reportRef = useRef<HTMLDivElement | null>(null);
  const records = (data?.records ?? []) as Row[];
  const employees = (data?.employees ?? []) as Row[];

  const openNew = () => {
    setEditing(null);
    setDialog(true);
  };
  const openEdit = (r: Row) => {
    setEditing(r);
    setDialog(true);
  };
  const onDelete = async (id: string) => {
    if (!confirm("Delete this record?")) return;
    try {
      await remove({ data: { id } });
      await queryClient.invalidateQueries({ queryKey: ["emergency-response"] });
      toast.success("Record deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <ShieldAlert className="size-5 text-primary" /> Emergency Response
          </h2>
          <p className="text-sm text-muted-foreground">
            Drills, response events, readiness checks and post-event reviews.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReportActions
            targetRef={reportRef}
            fileName="emergency-response"
            title="Emergency Response performance"
            module="emergency_response"
            csvRows={records}
            csvColumns={[
              { key: "Reference", label: "Reference", format: (r: any) => String(r.reference ?? "") },
              { key: "Type", label: "Type", format: (r: any) => String(r.record_type ?? "") },
              { key: "Scenario", label: "Scenario", format: (r: any) => String(r.scenario ?? "") },
              { key: "Location", label: "Location", format: (r: any) => String(r.location ?? "") },
              { key: "Date", label: "Date", format: (r: any) => String(r.occurred_at ?? "") },
              { key: "Participants", label: "Participants", format: (r: any) => String(r.participants ?? "") },
              { key: "Response (min)", label: "Response (min)", format: (r: any) => String(r.response_time_minutes ?? ""), },
              { key: "Rating", label: "Rating", format: (r: any) => String(r.performance_rating ?? "") },
              { key: "Status", label: "Status", format: (r: any) => String(r.status ?? "") },
            ]}
          />
          <Button onClick={openNew}>
            <Plus className="size-4" /> New record
          </Button>
        </div>
      </div>

      <div ref={reportRef} className="grid gap-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : records.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No emergency records yet. Log a drill, response event or readiness check.
          </div>
        ) : (
          records.map((r) => (
            <EmergencyCard
              key={String(r.id)}
              r={r}
              isAdmin={isAdmin}
              generatingId={generatingId}
              onGenerate={async () => {
                const rid = String(r.id);
                setGeneratingId(rid);
                try {
                  await genReport({ data: { id: rid } });
                  await queryClient.invalidateQueries({ queryKey: ["emergency-response"] });
                  toast.success("Report generated");
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setGeneratingId(null);
                }
              }}
              onEdit={() => openEdit(r)}
              onDelete={() => onDelete(String(r.id))}
            />
          ))
        )}
      </div>

      <EmergencyDialog
        open={dialog}
        onOpenChange={setDialog}
        editing={editing}
        employees={employees}
        onSubmit={async (payload) => {
          try {
            await save({ data: payload as never });
            await queryClient.invalidateQueries({ queryKey: ["emergency-response"] });
            setDialog(false);
            toast.success("Record saved");
          } catch (e) {
            const msg = (e as Error).message || "Save failed";
            console.error("[emergency] save failed", e);
            toast.error(msg);
          }
        }}
      />
    </div>
  );
}

function EmergencyDialog({
  open,
  onOpenChange,
  editing,
  employees,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Row | null;
  employees: Row[];
  onSubmit: (data: Row) => void | Promise<void>;
}) {
  const initialSigs: Row[] = Array.isArray(editing?.signatories) ? (editing!.signatories as Row[]) : [];
  const [sigs, setSigs] = useState<Row[]>(initialSigs);
  const editingId = editing?.id ?? null;
  const lastId = useRef<string | null>(null);
  if (lastId.current !== editingId) {
    lastId.current = editingId as string | null;
    setSigs(initialSigs);
  }
  const updateSig = (idx: number, patch: Record<string, string | null>) => {
    setSigs((prev) => {
      const next = [...prev];
      next[idx] = { ...(next[idx] ?? {}), ...patch };
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const toNum = (k: string) => {
      const v = String(form.get(k) ?? "").trim();
      return v ? Number(v) : undefined;
    };
    const payload: Row = {
      id: editing?.id,
      reference: String(form.get("reference") ?? "").trim() || undefined,
      record_type: String(form.get("record_type") ?? "drill"),
      scenario: String(form.get("scenario") ?? "").trim(),
      location: String(form.get("location") ?? "").trim() || undefined,
      occurred_at: String(form.get("occurred_at") ?? ""),
      participants: toNum("participants"),
      response_time_minutes: toNum("response_time_minutes"),
      outcome: String(form.get("outcome") ?? "").trim() || undefined,
      lessons_learned: String(form.get("lessons_learned") ?? "").trim() || undefined,
      performance_rating: String(form.get("performance_rating") ?? "") || undefined,
      status: String(form.get("status") ?? "open"),
      signatories: sigs
        .map((s) => ({
          full_name: String(s.full_name ?? "").trim(),
          role_title: String(s.role_title ?? "").trim() || null,
        }))
        .filter((s) => s.full_name),
    };
    onSubmit(payload);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing?.id ? "Edit emergency record" : "New emergency record"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Reference</Label>
              <Input
                name="reference"
                defaultValue={editing?.reference ?? ""}
                placeholder="Auto-generated if blank"
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select name="record_type" defaultValue={editing?.record_type ?? "drill"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="drill">Drill</SelectItem>
                  <SelectItem value="incident_response">Incident response</SelectItem>
                  <SelectItem value="readiness_check">Readiness check</SelectItem>
                  <SelectItem value="post_event_review">Post-event review</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Scenario *</Label>
              <Input name="scenario" required defaultValue={editing?.scenario ?? ""} />
            </div>
            <div>
              <Label>Date / time *</Label>
              <Input
                type="datetime-local"
                name="occurred_at"
                required
                defaultValue={
                  editing?.occurred_at
                    ? new Date(editing.occurred_at).toISOString().slice(0, 16)
                    : ""
                }
              />
            </div>
            <div>
              <Label>Location</Label>
              <Input name="location" defaultValue={editing?.location ?? ""} />
            </div>
            <div>
              <Label>Participants</Label>
              <Input
                type="number"
                name="participants"
                defaultValue={editing?.participants ?? ""}
              />
            </div>
            <div>
              <Label>Response time (minutes)</Label>
              <Input
                type="number"
                name="response_time_minutes"
                defaultValue={editing?.response_time_minutes ?? ""}
              />
            </div>
            <div>
              <Label>Performance rating</Label>
              <Select
                name="performance_rating"
                defaultValue={editing?.performance_rating ?? "satisfactory"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="excellent">Excellent</SelectItem>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="satisfactory">Satisfactory</SelectItem>
                  <SelectItem value="needs_improvement">Needs improvement</SelectItem>
                  <SelectItem value="poor">Poor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select name="status" defaultValue={editing?.status ?? "open"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Outcome</Label>
              <BulletTextarea name="outcome" rows={3} defaultValue={editing?.outcome ?? ""} />
            </div>
            <div className="sm:col-span-2">
              <Label>Lessons learned</Label>
              <BulletTextarea
                name="lessons_learned"
                rows={3}
                defaultValue={editing?.lessons_learned ?? ""}
              />
            </div>
          </div>

          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="mb-3 text-sm font-semibold">Signatories (at least 5, up to 10)</p>
            <p className="mb-3 text-xs text-muted-foreground">Pick employees from the dropdown — role/title auto-fills and can be edited.</p>
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, idx) => {
                const sig = sigs[idx] ?? {};
                return (
                  <div key={idx} className="grid gap-2 sm:grid-cols-[2fr_2fr_auto] sm:items-center">
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={String(sig.full_name ?? "")}
                      onChange={(e) => {
                        const fullName = e.target.value;
                        const emp = employees.find((x) => String(x.full_name) === fullName);
                        updateSig(idx, {
                          full_name: fullName,
                          role_title: emp?.job_title ? String(emp.job_title) : String(sig.role_title ?? ""),
                        });
                      }}
                    >
                      <option value="">{`${idx + 1}. Select employee…`}</option>
                      {employees.map((emp) => (
                        <option key={String(emp.id)} value={String(emp.full_name)}>
                          {String(emp.full_name)}
                          {emp.job_title ? ` — ${String(emp.job_title)}` : ""}
                        </option>
                      ))}
                    </select>
                    <Input
                      placeholder="Role / title"
                      value={String(sig.role_title ?? "")}
                      onChange={(e) => updateSig(idx, { role_title: e.target.value })}
                    />
                    <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EmergencyCard({
  r,
  isAdmin,
  generatingId,
  onGenerate,
  onEdit,
  onDelete,
}: {
  r: Row;
  isAdmin: boolean;
  generatingId: string | null;
  onGenerate: () => void | Promise<void>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const ref = String(r.reference ?? "record");
  const scenario = String(r.scenario ?? "Emergency response record");
  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <article className="rounded-2xl border bg-card p-5 shadow-sm">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <CollapsibleTrigger asChild>
            <button type="button" className="flex flex-1 items-start gap-3 text-left">
              {open ? (
                <ChevronDown className="mt-1 size-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="mt-1 size-4 text-muted-foreground" />
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">
                  {ref} · {String(r.record_type ?? "")} · {String(r.status ?? "")}
                </p>
                <h3 className="text-base font-semibold">{scenario}</h3>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(r.occurred_at)} · {String(r.location ?? "—")}
                </p>
              </div>
            </button>
          </CollapsibleTrigger>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={generatingId === String(r.id)}
              onClick={onGenerate}
            >
              <FileText className="size-3" />
              {generatingId === String(r.id) ? "Generating…" : "Generate Report"}
            </Button>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="size-3" /> Edit
            </Button>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={onDelete}>
                <Trash2 className="size-3" /> Delete
              </Button>
            )}
          </div>
        </header>
        <CollapsibleContent>
          <div ref={contentRef} data-pdf-section className="mt-4">
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Participants</p>
                <p>{String(r.participants ?? "—")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Response time (min)</p>
                <p>{String(r.response_time_minutes ?? "—")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rating</p>
                <p>{String(r.performance_rating ?? "—")}</p>
              </div>
              {r.outcome && (
                <div className="sm:col-span-3">
                  <p className="text-xs text-muted-foreground">Outcome</p>
                  <p className="whitespace-pre-wrap">{String(r.outcome)}</p>
                </div>
              )}
              {r.lessons_learned && (
                <div className="sm:col-span-3">
                  <p className="text-xs text-muted-foreground">Lessons learned</p>
                  <p className="whitespace-pre-wrap">{String(r.lessons_learned)}</p>
                </div>
              )}
              {r.report_content && (
                <div className="sm:col-span-3">
                  <p className="text-xs font-semibold text-muted-foreground">Report</p>
                  <p className="whitespace-pre-wrap text-sm">{String(r.report_content)}</p>
                </div>
              )}
              {Array.isArray(r.signatories) && r.signatories.length > 0 && (
                <div className="sm:col-span-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">
                    Signatories ({r.signatories.length}/10)
                  </p>
                  <ol className="grid gap-1 text-sm sm:grid-cols-2">
                    {(r.signatories as any[]).map((s, i) => (
                      <li key={i} className="rounded-md bg-muted/40 px-3 py-1.5">
                        <span className="font-semibold">{i + 1}.</span> {String(s.full_name ?? "")}
                        {s.role_title ? (
                          <span className="text-muted-foreground"> — {String(s.role_title)}</span>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
            <div className="mt-4">
              <EvidencePanel
                module="emergency_response"
                recordId={String(r.id)}
                canAdd
                canDelete={isAdmin}
              />
            </div>
          </div>
          <div className="mt-4 border-t pt-3" data-export-hide>
            <ReportActions
              targetRef={contentRef}
              fileName={`emergency-response-${ref}`}
              title={`Emergency Response Report — ${ref}`}
              subtitle={`${scenario} · ${fmtDate(r.occurred_at)}`}
              module="emergency_response"
            />
          </div>
        </CollapsibleContent>
      </article>
    </Collapsible>
  );
}
