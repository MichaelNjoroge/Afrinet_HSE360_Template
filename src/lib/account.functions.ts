import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const activateInvitedEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("employees")
      .update({ account_status: "active" })
      .eq("user_id", context.userId);
    if (error)
      throw new Error(
        "Your password was created, but account activation needs administrator review.",
      );
    return { ok: true };
  });
