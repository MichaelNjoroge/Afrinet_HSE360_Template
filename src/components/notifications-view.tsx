import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteNotifications } from "@/lib/notifications.functions";

type Row = Record<string, unknown>;

export function NotificationsView({ rows }: { rows: Row[] }) {
  const queryClient = useQueryClient();
  const remove = useServerFn(deleteNotifications);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      ["title", "message", "alert_type"].some((k) =>
        String(r[k] ?? "").toLowerCase().includes(q),
      ),
    );
  }, [rows, search]);

  const allIds = useMemo(() => filtered.map((r) => String(r.id)), [filtered]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allIds));
  }

  async function handleDelete() {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const result = await remove({ data: { ids: Array.from(selected) } });
      setSelected(new Set());
      await queryClient.invalidateQueries({ queryKey: ["module-packs-3-4"] });
      setNotice(`${result.deleted} notification${result.deleted === 1 ? "" : "s"} deleted`);
      window.setTimeout(() => setNotice(""), 2500);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not delete notifications.");
      window.setTimeout(() => setNotice(""), 4000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <section className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Notifications</h2>
          <p className="text-sm text-muted-foreground">
            {filtered.length} active alert{filtered.length === 1 ? "" : "s"}
            {selected.size > 0 && ` · ${selected.size} selected`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search notifications"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-64"
          />
          <Button type="button" variant="outline" onClick={toggleAll} disabled={!allIds.length}>
            {allSelected ? "Clear selection" : "Select all"}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={busy || selected.size === 0}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Delete {selected.size > 0 ? `(${selected.size})` : "selected"}
          </Button>
        </div>
      </section>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          You have no active notifications.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((row) => {
                const id = String(row.id);
                const checked = selected.has(id);
                return (
                  <tr
                    key={id}
                    className={checked ? "bg-primary/5" : "hover:bg-muted/30"}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${String(row.title ?? "notification")}`}
                        checked={checked}
                        onChange={() => toggle(id)}
                        className="h-4 w-4 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">{String(row.title ?? "—")}</td>
                    <td className="max-w-md px-4 py-3 text-muted-foreground">
                      {String(row.message ?? "—")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold capitalize text-primary">
                        {String(row.alert_type ?? "—").replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.due_date ? new Date(String(row.due_date)).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-xl"
        >
          {notice}
        </div>
      )}
    </div>
  );
}
