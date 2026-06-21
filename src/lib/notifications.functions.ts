import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });

export const deleteNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => input.parse(value))
  .handler(async ({ data, context }) => {
    const { error, count } = await context.supabase
      .from("notifications")
      .delete({ count: "exact" })
      .in("id", data.ids)
      .eq("recipient_id", context.userId);
    if (error) throw new Error("Notifications could not be deleted.");
    return { deleted: count ?? 0 };
  });
