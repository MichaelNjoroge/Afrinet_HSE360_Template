import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const avatarPathSchema = z.object({
  avatarPath: z
    .string()
    .min(1)
    .max(300)
    .regex(/^[0-9a-f-]{36}\/avatar\.(jpg|jpeg|png|webp)$/i),
});

export const saveProfilePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => avatarPathSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Contact an administrator to change your profile photo.");
    if (!data.avatarPath.startsWith(`${context.userId}/`)) {
      throw new Error("You can only update your own profile photo.");
    }
    const { data: employee } = await context.supabase
      .from("employees")
      .select("full_name,email,department,job_title,phone,employment_status")
      .eq("user_id", context.userId)
      .maybeSingle();
    const email = String(context.claims.email ?? employee?.email ?? "").trim();
    if (!email) throw new Error("Your account needs a work email before a photo can be saved.");
    const { error } = await context.supabase.from("profiles").upsert({
      id: context.userId,
      full_name:
        employee?.full_name ??
        String(context.claims.user_metadata?.full_name ?? email.split("@")[0]),
      email,
      department: employee?.department ?? null,
      job_title: employee?.job_title ?? null,
      phone: employee?.phone ?? null,
      employment_status: employee?.employment_status ?? "active",
      avatar_path: data.avatarPath,
    });
    if (error) {
      console.error("[profile] photo save failed", error.message);
      throw new Error("Your profile photo could not be saved. Please try again.");
    }
    return { ok: true };
  });
