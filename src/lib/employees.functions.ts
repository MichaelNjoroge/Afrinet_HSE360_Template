import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { assertCreateOrEditPermission, assertPermission } from "@/lib/permissions.functions";

const role = z.enum([
  "admin",
  "hr_manager",
  "hse_manager",
  "hse_coordinator",
  "director",
  "supervisor",
  "employee",
  "auditor",
]);
const employeeInput = z.object({
  id: z.string().uuid().optional(),
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(60).optional().default(""),
  department: z.string().trim().max(160).optional().default(""),
  jobTitle: z.string().trim().max(160).optional().default(""),
  employmentStatus: z.enum(["active", "inactive", "on_leave"]),
  managerEmployeeId: z.string().uuid().optional().or(z.literal("")),
  approvalLevel: z.coerce.number().int().min(1).max(5),
  role,
});

async function requireAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Only administrators can manage employee accounts.");
}

async function ensureAdminRoleSafety(
  context: { supabase: SupabaseClient<Database>; userId: string },
  targetUserId: string | null | undefined,
  nextRole: z.infer<typeof role>,
) {
  if (!targetUserId || nextRole === "admin") return;
  const { data: targetIsAdmin } = await context.supabase.rpc("has_role", {
    _user_id: targetUserId,
    _role: "admin",
  });
  if (!targetIsAdmin) return;
  if (targetUserId === context.userId) {
    throw new Error("You cannot remove your own administrator access while editing employees.");
  }
  const { data: adminRows, error } = await context.supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  if (error || (adminRows ?? []).filter((row) => row.user_id !== targetUserId).length === 0) {
    throw new Error("At least one administrator account must remain active.");
  }
}

async function requirePeopleManager(context: {
  supabase: SupabaseClient<Database>;
  userId: string;
}) {
  const checks = await Promise.all(
    (["admin", "hr_manager"] as const).map((assignedRole) =>
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: assignedRole }),
    ),
  );
  if (!checks.some((result) => result.data === true))
    throw new Error("Only administrators and HR Managers can delete employee entries.");
}

export const saveEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => employeeInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    if (data.id) await assertPermission(context, "employees", "edit");
    else await assertCreateOrEditPermission(context, "employees");
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const values = {
      full_name: data.fullName,
      email: data.email.toLowerCase(),
      phone: data.phone || null,
      department: data.department || null,
      job_title: data.jobTitle || null,
      employment_status: data.employmentStatus,
      manager_employee_id: data.managerEmployeeId || null,
      approval_level: data.approvalLevel,
    };
    const result = data.id
      ? await context.supabase.from("employees").update(values).eq("id", data.id)
      : await context.supabase.from("employees").insert(values);
    if (result.error) {
      console.error("[employees] save failed", result.error.message);
      throw new Error("The employee record could not be saved. Please try again.");
    }
    if (data.id && isAdmin) {
      const { data: employee } = await context.supabase
        .from("employees")
        .select("user_id")
        .eq("id", data.id)
        .single();
      if (employee?.user_id) {
        await ensureAdminRoleSafety(context, employee.user_id, data.role);
        await context.supabase.from("user_roles").delete().eq("user_id", employee.user_id);
        const { error } = await context.supabase
          .from("user_roles")
          .insert({ user_id: employee.user_id, role: data.role });
        if (error) {
          console.error("[employees] role update failed", error.message);
          throw new Error("The employee role could not be updated. Please try again.");
        }
      }
    }
    return { ok: true };
  });

export const inviteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ employeeId: z.string().uuid(), role }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const request = getRequest();
    const redirectTo = request ? `${new URL(request.url).origin}/accept-invite` : undefined;
    const { data: employee, error } = await context.supabase
      .from("employees")
      .select("id,email,full_name,user_id")
      .eq("id", data.employeeId)
      .single();
    if (error || !employee?.email)
      throw new Error("This employee needs a valid work email before an account can be created.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (employee.user_id) {
      const reinvited = await supabaseAdmin.auth.admin.inviteUserByEmail(employee.email, {
        data: { full_name: employee.full_name, employee_id: employee.id },
        redirectTo,
      });
      if (reinvited.error) {
        // Fallback: generate an invite link and rely on Supabase's email delivery
        const link = await supabaseAdmin.auth.admin.generateLink({
          type: "invite",
          email: employee.email,
          options: { redirectTo },
        });
        if (link.error) {
          console.error("[employees] invitation resend failed", reinvited.error.message, link.error.message);
          throw new Error("The invitation could not be resent. Please try again.");
        }
      }
      const refreshed = await supabaseAdmin
        .from("employees")
        .update({ account_status: "invited" })
        .eq("id", employee.id);
      if (refreshed.error) {
        console.error("[employees] invitation status refresh failed", refreshed.error.message);
      }
      return { ok: true, resent: true };
    }
    const invited = await supabaseAdmin.auth.admin.inviteUserByEmail(employee.email, {
      data: { full_name: employee.full_name, employee_id: employee.id },
      redirectTo,
    });
    if (invited.error || !invited.data.user) {
      if (invited.error) console.error("[employees] invitation failed", invited.error.message);
      throw new Error("The invitation could not be sent. Please try again.");
    }
    const update = await supabaseAdmin
      .from("employees")
      .update({ user_id: invited.data.user.id, account_status: "invited" })
      .eq("id", employee.id);
    if (update.error) {
      console.error("[employees] invitation status update failed", update.error.message);
      throw new Error("The invited account could not be linked. Please try again.");
    }
    const assigned = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: invited.data.user.id, role: data.role });
    if (assigned.error) {
      console.error("[employees] invited role assignment failed", assigned.error.message);
      throw new Error("The invited account role could not be assigned. Please try again.");
    }
    return { ok: true };
  });

export const adminResetEmployeePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ employeeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: employee, error } = await context.supabase
      .from("employees")
      .select("email,full_name")
      .eq("id", data.employeeId)
      .single();
    if (error || !employee?.email)
      throw new Error("This employee needs a valid work email before a password reset can be sent.");
    const request = getRequest();
    const redirectTo = request ? `${new URL(request.url).origin}/reset-password` : undefined;
    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error: resetError } = await anon.auth.resetPasswordForEmail(employee.email, {
      redirectTo,
    });
    if (resetError) {
      console.error("[employees] admin password reset failed", resetError.message);
      throw new Error("The password reset email could not be sent. Please try again.");
    }
    return { ok: true, email: employee.email };
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ employeeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requirePeopleManager(context);
    const { data: employee, error: lookupError } = await context.supabase
      .from("employees")
      .select("user_id,account_status")
      .eq("id", data.employeeId)
      .single();
    if (lookupError || !employee) throw new Error("The employee entry could not be found.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (employee.user_id) {
      const roleResult = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", employee.user_id);
      if (roleResult.error) {
        console.error("[employees] role cleanup failed", roleResult.error.message);
        throw new Error("The employee account could not be removed. Please try again.");
      }
    }
    const { data: deleted, error } = await supabaseAdmin
      .from("employees")
      .delete()
      .eq("id", data.employeeId)
      .select("id")
      .maybeSingle();
    if (error || !deleted) {
      if (error) console.error("[employees] delete failed", error.message);
      throw new Error("The employee entry was not deleted. Please try again.");
    }
    if (employee.user_id) {
      const authResult = await supabaseAdmin.auth.admin.deleteUser(employee.user_id);
      if (authResult.error)
        console.error("[employees] linked account cleanup failed", authResult.error.message);
    }
    return { ok: true };
  });

const avatarPathRe = /^[0-9a-f-]{36}\/avatar\.(jpg|jpeg|png|webp)$/i;

export const setEmployeeAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        employeeId: z.string().uuid(),
        avatarPath: z.string().regex(avatarPathRe).max(300),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: emp, error } = await context.supabase
      .from("employees")
      .select("user_id")
      .eq("id", data.employeeId)
      .maybeSingle();
    if (error || !emp) throw new Error("The employee record could not be found.");
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const isSelf = emp.user_id === context.userId;
    if (!isAdmin && !isSelf)
      throw new Error("Only an administrator or the employee can change this profile photo.");
    const folder = data.avatarPath.split("/")[0];
    const expectedFolder = emp.user_id ?? context.userId;
    if (folder !== expectedFolder)
      throw new Error("The photo path does not belong to this employee.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const updated = await supabaseAdmin
      .from("employees")
      .update({ avatar_path: data.avatarPath })
      .eq("id", data.employeeId);
    if (updated.error) {
      console.error("[employees] avatar save failed", updated.error.message);
      throw new Error("The profile photo could not be saved. Please try again.");
    }
    if (emp.user_id) {
      await supabaseAdmin
        .from("profiles")
        .update({ avatar_path: data.avatarPath })
        .eq("id", emp.user_id);
    }
    return { ok: true };
  });

export const removeEmployeeAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ employeeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: emp } = await context.supabase
      .from("employees")
      .select("user_id,avatar_path")
      .eq("id", data.employeeId)
      .maybeSingle();
    if (!emp) throw new Error("The employee record could not be found.");
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin && emp.user_id !== context.userId)
      throw new Error("Only an administrator or the employee can remove this profile photo.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (emp.avatar_path) {
      await supabaseAdmin.storage.from("profile-photos").remove([emp.avatar_path]);
    }
    await supabaseAdmin
      .from("employees")
      .update({ avatar_path: null })
      .eq("id", data.employeeId);
    if (emp.user_id) {
      await supabaseAdmin.from("profiles").update({ avatar_path: null }).eq("id", emp.user_id);
    }
    return { ok: true };
  });

export const bulkDeleteEmployees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requirePeopleManager(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: emps } = await supabaseAdmin
      .from("employees")
      .select("id,user_id")
      .in("id", data.ids);
    const userIds = ((emps ?? []) as Array<{ user_id: string | null }>)
      .map((entry) => entry.user_id)
      .filter((value): value is string => Boolean(value));
    if (userIds.length) {
      await supabaseAdmin.from("user_roles").delete().in("user_id", userIds);
    }
    const { error } = await supabaseAdmin.from("employees").delete().in("id", data.ids);
    if (error) {
      console.error("[employees] bulk delete failed", error.message);
      throw new Error("Some employee entries could not be deleted. Please try again.");
    }
    for (const uid of userIds) {
      const result = await supabaseAdmin.auth.admin.deleteUser(uid);
      if (result.error)
        console.error("[employees] bulk auth cleanup failed", result.error.message);
    }
    return { ok: true, count: data.ids.length };
  });

// Allow employees with insufficient edit rights to request profile changes from an admin.
export const requestEmployeeProfileChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        employeeId: z.string().uuid(),
        message: z.string().trim().min(5).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Verify the requester owns the employee record.
    const { data: emp, error: empErr } = await supabase
      .from("employees")
      .select("id, user_id, full_name")
      .eq("id", data.employeeId)
      .maybeSingle();
    if (empErr || !emp) throw new Error("Employee record not found.");
    if (emp.user_id !== userId) {
      throw new Error("You can only request changes to your own profile.");
    }
    // Pick an admin to route the request to.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: admins } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1);
    const approverId = admins?.[0]?.user_id;
    if (!approverId) {
      throw new Error("No administrator is configured to receive the request.");
    }
    const { error } = await supabase.from("approval_requests").insert({
      module: "employees",
      record_id: data.employeeId,
      requested_by: userId,
      approver_id: approverId,
      approval_level: 5,
      status: "pending",
      request_note: data.message,
    });
    if (error) {
      console.error("[employees] profile change request failed", error.message);
      throw new Error("Could not submit your request. Please try again.");
    }
    return { ok: true };
  });
