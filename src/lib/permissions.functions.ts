import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const moduleNames = [
  "incidents",
  "hazards",
  "observations",
  "near_misses",
  "environment",
  "risks",
  "audits",
  "capa",
  "inspections",
  "objectives",
  "employees",
  "training",
  "competencies",
  "legal",
  "contractors",
  "ppe",
  "documents",
  "reviews",
  "reporting",
  "intelligence",
  "global_search",
  "notifications",
  "safety_committee",
  "emergency_response",
  "permits",
] as const;
export const permissionActions = ["view", "create", "edit", "delete", "approve", "export"] as const;
const moduleName = z.enum(moduleNames);
const permissionAction = z.enum(permissionActions);

export type ModulePermission = Record<(typeof permissionActions)[number], boolean>;

export type ModulePermissionOverride = {
  user_id: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  can_export: boolean;
};

export const getMyModulePermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const entries = await Promise.all(
      moduleNames.map(async (module) => {
        const values = await Promise.all(
          permissionActions.map(async (action) => {
            const { data } = await context.supabase.rpc("has_module_permission", {
              _user_id: context.userId,
              _module: module,
              _action: action,
            } as never);
            return [action, data === true] as const;
          }),
        );
        return [module, Object.fromEntries(values) as ModulePermission] as const;
      }),
    );
    return Object.fromEntries(entries) as Record<(typeof moduleNames)[number], ModulePermission>;
  });

export const saveUserModulePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        module: moduleName,
        permissions: z.object({
          can_view: z.boolean(),
          can_create: z.boolean(),
          can_edit: z.boolean(),
          can_delete: z.boolean(),
          can_approve: z.boolean(),
          can_export: z.boolean(),
        }),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!admin) throw new Error("Only administrators can change module permissions.");
    const { error } = await context.supabase.from("user_module_permissions").upsert(
      {
        user_id: data.userId,
        module: data.module,
        granted_by: context.userId,
        ...data.permissions,
      },
      { onConflict: "user_id,module" },
    );
    if (error) {
      console.error("[permissions] save failed", error.message);
      throw new Error("The permission override could not be saved. Please try again.");
    }
    return { ok: true };
  });

export const saveBulkUserModulePermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userIds: z.array(z.string().uuid()).min(1).max(500),
        modules: z.array(moduleName).min(1).max(moduleNames.length),
        permissions: z.object({
          can_view: z.boolean(),
          can_create: z.boolean(),
          can_edit: z.boolean(),
          can_delete: z.boolean(),
          can_approve: z.boolean(),
          can_export: z.boolean(),
        }),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!admin) throw new Error("Only administrators can change module permissions.");
    const rows = data.userIds.flatMap((userId) =>
      data.modules.map((module) => ({
        user_id: userId,
        module,
        granted_by: context.userId,
        ...data.permissions,
      })),
    );
    const { error } = await context.supabase
      .from("user_module_permissions")
      .upsert(rows, { onConflict: "user_id,module" });
    if (error) {
      console.error("[permissions] bulk save failed", error.message);
      throw new Error("The selected permission changes could not be saved. Please try again.");
    }
    return { ok: true, updated: rows.length };
  });

export const getAdminModulePermissionOverrides = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!admin) throw new Error("Only administrators can view permission overrides.");
    const { data, error } = await context.supabase
      .from("user_module_permissions")
      .select("user_id,module,can_view,can_create,can_edit,can_delete,can_approve,can_export")
      .order("module");
    if (error) throw new Error("Permission overrides could not be loaded.");
    return (data ?? []) as ModulePermissionOverride[];
  });

export const getAdminUserEffectivePermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid(), module: moduleName }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!admin) throw new Error("Only administrators can view employee permissions.");
    const values = await Promise.all(
      permissionActions.map(async (action) => {
        const { data: allowed } = await context.supabase.rpc("has_module_permission", {
          _user_id: data.userId,
          _module: data.module,
          _action: action,
        });
        return [action, allowed === true] as const;
      }),
    );
    return Object.fromEntries(values) as ModulePermission;
  });

export const resetUserModulePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid(), module: moduleName }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!admin) throw new Error("Only administrators can reset module permissions.");
    const { error } = await context.supabase
      .from("user_module_permissions")
      .delete()
      .eq("user_id", data.userId)
      .eq("module", data.module);
    if (error) throw new Error("The permission override could not be reset.");
    return { ok: true };
  });

export async function assertPermission(
  context: { supabase: SupabaseClient<Database>; userId: string },
  module: string,
  action: string,
) {
  const parsedModule = moduleName.parse(module);
  const parsedAction = permissionAction.parse(action);
  const { data } = await context.supabase.rpc("has_module_permission", {
    _user_id: context.userId,
    _module: parsedModule,
    _action: parsedAction,
  });
  if (data !== true)
    throw new Error(
      `You do not have permission to ${parsedAction} ${parsedModule.replaceAll("_", " ")}.`,
    );
}

export async function assertCreateOrEditPermission(
  context: { supabase: SupabaseClient<Database>; userId: string },
  module: string,
) {
  const parsedModule = moduleName.parse(module);
  const checks = await Promise.all(
    (["create", "edit"] as const).map((action) =>
      context.supabase.rpc("has_module_permission", {
        _user_id: context.userId,
        _module: parsedModule,
        _action: action,
      }),
    ),
  );
  if (!checks.some((result) => result.data === true))
    throw new Error(
      `You do not have permission to add ${parsedModule.replaceAll("_", " ")} records.`,
    );
}
