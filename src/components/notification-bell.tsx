import { useEffect, useState, useCallback } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Notification = {
  id: string;
  title: string;
  message: string;
  alert_type: string;
  due_date: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id,title,message,alert_type,due_date,read_at,created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data ?? []) as Notification[]);
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 60_000);
    return () => clearInterval(interval);
  }, [load]);

  const unread = items.filter((n) => !n.read_at);

  const markOne = async (id: string) => {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    await load();
  };

  const markAll = async () => {
    if (!unread.length) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in(
        "id",
        unread.map((n) => n.id),
      );
    await load();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ""}`}
          className="relative"
        >
          <Bell />
          {unread.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-bold">Notifications</p>
            <p className="text-xs text-muted-foreground">
              {unread.length} unread · {items.length} recent
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={markAll}
            disabled={!unread.length}
          >
            <CheckCheck className="mr-1 size-4" />
            Mark all read
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              You're all caught up.
            </p>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 ${
                    n.read_at ? "opacity-70" : "bg-primary/5"
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                        {n.alert_type.replaceAll("_", " ")}
                      </span>
                      <p className="text-sm font-semibold">{n.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{n.message}</p>
                    {n.due_date && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Due {new Date(n.due_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {!n.read_at && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Mark read"
                      onClick={() => markOne(n.id)}
                    >
                      <Check className="size-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
