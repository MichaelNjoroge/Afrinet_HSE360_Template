import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { BulletTextarea } from "@/components/ui/bullet-textarea";
import {
  approveEnvironmentalRecord,
  getEnvironmentalRecord,
  submitEnvironmentalInvestigation,
  verifyEnvironmentalClosure,
} from "@/lib/environmental-workflow.functions";

interface EmployeeOption {
  id: string;
  full_name: string;
}

export function EnvironmentalWorkflowDialog({
  recordId,
  open,
  onOpenChange,
  employees,
  canApprove,
}: {
  recordId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: EmployeeOption[];
  canApprove: boolean;
}) {
  const queryClient = useQueryClient();
  const load = useServerFn(getEnvironmentalRecord);
  const submit = useServerFn(submitEnvironmentalInvestigation);
  const approve = useServerFn(approveEnvironmentalRecord);
  const verify = useServerFn(verifyEnvironmentalClosure);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const queryKey = ["environmental-record", recordId];
  const { data: record } = useQuery({
    queryKey,
    queryFn: () => (recordId ? load({ data: { recordId } }) : Promise.resolve(null)),
    enabled: Boolean(open && recordId),
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recordId) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const v = (name: string) => String(form.get(name) ?? "").trim();
    try {
      await submit({
        data: {
          recordId,
          investigationFindings: v("investigation"),
          rootCause: v("root_cause"),
          immediateAction: v("immediate"),
          correctiveActions: v("corrective"),
          preventiveActions: v("preventive"),
          responsiblePersonId: v("owner"),
          actionDueDate: v("due"),
          lessonsLearned: v("lessons"),
          closureEvidence: v("closure"),
        },
      });
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["module-packs-3-4"] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    if (!recordId) return;
    setBusy(true);
    setError("");
    try {
      await approve({ data: { recordId } });
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["module-packs-3-4"] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Approval failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    if (!recordId) return;
    setBusy(true);
    setError("");
    try {
      await verify({ data: { recordId } });
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["module-packs-3-4"] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Closure verification failed.");
    } finally {
      setBusy(false);
    }
  }

  const status = String(record?.approval_status ?? "pending");
  const isApproved = status === "approved";
  const isClosed = String(record?.status ?? "") === "closed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Environmental record · Investigation, CAPA & approval</DialogTitle>
          <DialogDescription>
            Record investigation findings, root cause, corrective and preventive actions, then
            submit for approval and verified closure. Each text box accepts bullet points (one per
            line).
          </DialogDescription>
        </DialogHeader>

        {record && (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded bg-muted px-2 py-1 font-semibold uppercase tracking-wider">
              {String(record.reference ?? "—")}
            </span>
            <span className="rounded bg-muted px-2 py-1">Status: {String(record.status)}</span>
            <span
              className={`rounded px-2 py-1 font-semibold ${
                isApproved
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              Approval: {status}
            </span>
            {isClosed && (
              <span className="rounded bg-sky-100 px-2 py-1 font-semibold text-sky-800">
                Verified & closed
              </span>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="env-investigation">Investigation findings</Label>
            <BulletTextarea
              id="env-investigation"
              name="investigation"
              defaultValue={String(record?.investigation_findings ?? "")}
              rows={4}
              disabled={isApproved}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="env-root">Root cause analysis</Label>
            <BulletTextarea
              id="env-root"
              name="root_cause"
              defaultValue={String(record?.root_cause ?? "")}
              rows={3}
              disabled={isApproved}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="env-immediate">Immediate action taken</Label>
            <BulletTextarea
              id="env-immediate"
              name="immediate"
              defaultValue={String(record?.immediate_action ?? "")}
              rows={3}
              disabled={isApproved}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="env-corrective">Corrective actions (CAPA)</Label>
            <BulletTextarea
              id="env-corrective"
              name="corrective"
              defaultValue={String(record?.corrective_actions ?? "")}
              rows={4}
              disabled={isApproved}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="env-preventive">Preventive actions (CAPA)</Label>
            <BulletTextarea
              id="env-preventive"
              name="preventive"
              defaultValue={String(record?.preventive_actions ?? "")}
              rows={4}
              disabled={isApproved}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="env-owner">Responsible person</Label>
              <select
                id="env-owner"
                name="owner"
                defaultValue={String(record?.responsible_person_id ?? "")}
                disabled={isApproved}
                className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select…</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="env-due">Action due date</Label>
              <Input
                id="env-due"
                name="due"
                type="date"
                defaultValue={String(record?.action_due_date ?? "")}
                disabled={isApproved}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="env-lessons">Lessons learned</Label>
            <BulletTextarea
              id="env-lessons"
              name="lessons"
              defaultValue={String(record?.lessons_learned ?? "")}
              rows={3}
              disabled={isApproved}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="env-closure">Closure evidence</Label>
            <BulletTextarea
              id="env-closure"
              name="closure"
              defaultValue={String(record?.closure_evidence ?? "")}
              rows={3}
              disabled={isApproved}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button type="submit" variant="outline" disabled={busy || isApproved}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              Save investigation & CAPA
            </Button>
            {canApprove && !isApproved && (
              <Button type="button" onClick={handleApprove} disabled={busy}>
                <ShieldCheck />
                Approve record
              </Button>
            )}
            {canApprove && isApproved && !isClosed && (
              <Button type="button" variant="safety" onClick={handleVerify} disabled={busy}>
                <CheckCircle2 />
                Verify closure
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
