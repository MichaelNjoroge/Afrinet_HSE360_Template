import { useMemo, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Search, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  moduleNames,
  permissionActions,
  saveBulkUserModulePermissions,
} from "@/lib/permissions.functions";

type Employee = Record<string, unknown>;

export function PermissionAdministration({ employees }: { employees: Employee[] }) {
  const queryClient = useQueryClient();
  const saveBulk = useServerFn(saveBulkUserModulePermissions);
  const [search, setSearch] = useState("");
  const [jobTitle, setJobTitle] = useState("all");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedModules, setSelectedModules] = useState<(typeof moduleNames)[number][]>([]);
  const [values, setValues] = useState<Record<(typeof permissionActions)[number], boolean>>({
    view: true,
    create: false,
    edit: false,
    delete: false,
    approve: false,
    export: false,
  });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const eligibleEmployees = employees.filter((employee) => typeof employee.user_id === "string");
  const jobTitles = useMemo(
    () =>
      Array.from(
        new Set(
          eligibleEmployees
            .map((employee) => String(employee.job_title ?? "").trim())
            .filter(Boolean),
        ),
      ).sort(),
    [eligibleEmployees],
  );
  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    return eligibleEmployees.filter((employee) => {
      const matchesTitle = jobTitle === "all" || String(employee.job_title ?? "") === jobTitle;
      const matchesSearch =
        !term ||
        [employee.full_name, employee.email, employee.job_title, employee.department].some(
          (value) =>
            String(value ?? "")
              .toLowerCase()
              .includes(term),
        );
      return matchesTitle && matchesSearch;
    });
  }, [eligibleEmployees, jobTitle, search]);
  const filteredIds = filteredEmployees.map((employee) => String(employee.user_id));
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedUserIds.includes(id));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUserIds.length || !selectedModules.length) return;
    setSaving(true);
    setMessage("");
    try {
      const result = await saveBulk({
        data: {
          userIds: selectedUserIds,
          modules: selectedModules,
          permissions: {
            can_view: values.view,
            can_create: values.create,
            can_edit: values.edit,
            can_delete: values.delete,
            can_approve: values.approve,
            can_export: values.export,
          },
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-module-permission-overrides"] }),
        queryClient.invalidateQueries({ queryKey: ["module-permissions"] }),
      ]);
      setMessage(`${result.updated} employee-module permission assignments updated.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Permissions could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-6 border bg-card">
      <div className="border-b px-5 py-4">
        <h3 className="flex items-center gap-2 font-bold">
          <ShieldCheck /> Employee module permissions
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Filter and select one or more activated employees, choose modules, then grant or remove
          rights in one update.
        </p>
      </div>
      <form className="space-y-6 p-5" onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-[1fr_240px]">
          <div className="space-y-2">
            <Label htmlFor="permission-employee-search">Filter employee names</Label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                id="permission-employee-search"
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, email, role or department…"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="permission-job-role">Filter job role</Label>
            <select
              id="permission-job-role"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
            >
              <option value="all">All job roles</option>
              {jobTitles.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(280px,.8fr)_minmax(440px,1.2fr)]">
          <fieldset className="border">
            <legend className="mx-3 px-2 text-sm font-semibold">Employees</legend>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <Label className="flex items-center gap-2">
                <Checkbox
                  checked={allFilteredSelected}
                  onCheckedChange={(checked) =>
                    setSelectedUserIds((current) =>
                      checked === true
                        ? Array.from(new Set([...current, ...filteredIds]))
                        : current.filter((id) => !filteredIds.includes(id)),
                    )
                  }
                />
                Select all filtered
              </Label>
              <span className="text-xs text-muted-foreground">
                {selectedUserIds.length} selected
              </span>
            </div>
            <div className="max-h-72 divide-y overflow-y-auto">
              {filteredEmployees.map((employee) => {
                const id = String(employee.user_id);
                return (
                  <Label
                    key={String(employee.id)}
                    className="flex cursor-pointer items-start gap-3 px-4 py-3"
                  >
                    <Checkbox
                      checked={selectedUserIds.includes(id)}
                      onCheckedChange={(checked) =>
                        setSelectedUserIds((current) =>
                          checked === true
                            ? [...current, id]
                            : current.filter((item) => item !== id),
                        )
                      }
                    />
                    <span>
                      <span className="block font-medium">{String(employee.full_name)}</span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        {String(employee.job_title ?? "No job role")} ·{" "}
                        {String(employee.department ?? "No department")}
                      </span>
                    </span>
                  </Label>
                );
              })}
              {!filteredEmployees.length && (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No activated employees match this filter.
                </p>
              )}
            </div>
          </fieldset>

          <fieldset className="border">
            <legend className="mx-3 px-2 text-sm font-semibold">Modules to update</legend>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <Label className="flex items-center gap-2">
                <Checkbox
                  checked={selectedModules.length === moduleNames.length}
                  onCheckedChange={(checked) =>
                    setSelectedModules(checked === true ? [...moduleNames] : [])
                  }
                />
                Select all modules
              </Label>
              <span className="text-xs text-muted-foreground">
                {selectedModules.length} selected
              </span>
            </div>
            <div className="grid max-h-72 grid-cols-1 gap-0 overflow-y-auto sm:grid-cols-2">
              {moduleNames.map((name) => (
                <Label
                  key={name}
                  className="flex cursor-pointer items-center gap-2 border-b px-4 py-2.5 capitalize sm:border-r"
                >
                  <Checkbox
                    checked={selectedModules.includes(name)}
                    onCheckedChange={(checked) =>
                      setSelectedModules((current) =>
                        checked === true
                          ? [...current, name]
                          : current.filter((item) => item !== name),
                      )
                    }
                  />
                  {name.replaceAll("_", " ")}
                </Label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="border bg-muted/30 p-4">
          <div className="mb-3 flex items-center gap-2 font-semibold">
            <Users className="size-4" /> Rights to apply
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            Checked rights will be granted; unchecked rights will be removed for every selected
            employee and module.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {permissionActions.map((action) => (
              <Label key={action} className="flex items-center gap-2 capitalize">
                <Checkbox
                  checked={values[action]}
                  onCheckedChange={(checked) =>
                    setValues((current) => ({ ...current, [action]: checked === true }))
                  }
                />
                {action}
              </Label>
            ))}
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={!selectedUserIds.length || !selectedModules.length || saving}
          >
            {saving
              ? "Applying rights…"
              : `Apply rights to ${selectedUserIds.length || 0} employee${selectedUserIds.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </form>
      {message && (
        <p role="status" className="flex items-center gap-2 border-t px-5 py-3 text-sm">
          <CheckCircle2 className="size-4 text-success" />
          {message}
        </p>
      )}
    </section>
  );
}
