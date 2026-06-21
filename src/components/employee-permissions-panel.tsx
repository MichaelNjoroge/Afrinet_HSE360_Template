import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  getAdminModulePermissionOverrides,
  moduleNames,
  permissionActions,
  resetUserModulePermission,
  saveUserModulePermission,
  type ModulePermissionOverride,
} from "@/lib/permissions.functions";

type ModuleKey = (typeof moduleNames)[number];
type ActionKey = (typeof permissionActions)[number];
type Rights = Record<ActionKey, boolean>;

const EMPTY: Rights = {
  view: false,
  create: false,
  edit: false,
  delete: false,
  approve: false,
  export: false,
};

function fromOverride(o?: ModulePermissionOverride): Rights {
  if (!o) return { ...EMPTY };
  return {
    view: o.can_view,
    create: o.can_create,
    edit: o.can_edit,
    delete: o.can_delete,
    approve: o.can_approve,
    export: o.can_export,
  };
}

export function EmployeePermissionsPanel({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const fetchOverrides = useServerFn(getAdminModulePermissionOverrides);
  const saveOne = useServerFn(saveUserModulePermission);
  const resetOne = useServerFn(resetUserModulePermission);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-module-permission-overrides"],
    queryFn: () => fetchOverrides(),
  });

  const userOverrides = useMemo(() => {
    const map = new Map<string, ModulePermissionOverride>();
    (data ?? [])
      .filter((row) => row.user_id === userId)
      .forEach((row) => map.set(row.module, row));
    return map;
  }, [data, userId]);

  const [draft, setDraft] = useState<Record<string, Rights>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const next: Record<string, Rights> = {};
    for (const m of moduleNames) next[m] = fromOverride(userOverrides.get(m));
    setDraft(next);
  }, [userOverrides]);

  async function save(module: ModuleKey) {
    setBusy(module);
    setMessage("");
    try {
      await saveOne({
        data: {
          userId,
          module,
          permissions: {
            can_view: draft[module].view,
            can_create: draft[module].create,
            can_edit: draft[module].edit,
            can_delete: draft[module].delete,
            can_approve: draft[module].approve,
            can_export: draft[module].export,
          },
        },
      });
      await queryClient.invalidateQueries({
        queryKey: ["admin-module-permission-overrides"],
      });
      setMessage(`Saved rights for ${module.replaceAll("_", " ")}.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  }

  async function reset(module: ModuleKey) {
    setBusy(module);
    setMessage("");
    try {
      await resetOne({ data: { userId, module } });
      await queryClient.invalidateQueries({
        queryKey: ["admin-module-permission-overrides"],
      });
      setMessage(`Reset ${module.replaceAll("_", " ")} to role default.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not reset.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-md border">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <ShieldCheck className="size-4 text-primary" />
        <p className="text-sm font-semibold">Module access rights</p>
      </div>
      <p className="px-4 pt-3 text-xs text-muted-foreground">
        Grant different rights per module for this employee. Empty rows fall
        back to the role default.
      </p>
      {isLoading ? (
        <p className="p-4 text-sm text-muted-foreground">Loading rights…</p>
      ) : (
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-muted/60 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Module</th>
                {permissionActions.map((a) => (
                  <th key={a} className="px-2 py-2 text-center font-semibold capitalize">
                    {a}
                  </th>
                ))}
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {moduleNames.map((m) => {
                const hasOverride = userOverrides.has(m);
                const rights = draft[m] ?? EMPTY;
                return (
                  <tr key={m} className="border-t">
                    <td className="px-3 py-2 capitalize">
                      {m.replaceAll("_", " ")}
                      {hasOverride ? (
                        <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
                          Override
                        </span>
                      ) : (
                        <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                          Role default
                        </span>
                      )}
                    </td>
                    {permissionActions.map((a) => (
                      <td key={a} className="px-2 py-2 text-center">
                        <Label className="sr-only">
                          {m} {a}
                        </Label>
                        <Checkbox
                          checked={rights[a]}
                          onCheckedChange={(checked) =>
                            setDraft((cur) => ({
                              ...cur,
                              [m]: { ...cur[m], [a]: checked === true },
                            }))
                          }
                        />
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-2 py-2 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mr-1 h-7 px-2"
                        disabled={busy === m}
                        onClick={() => save(m)}
                      >
                        <Save className="size-3" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        disabled={busy === m || !hasOverride}
                        onClick={() => reset(m)}
                        title="Reset to role default"
                      >
                        <RotateCcw className="size-3" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {message && (
        <p role="status" className="border-t px-4 py-2 text-xs text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  );
}
