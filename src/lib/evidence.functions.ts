import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermission } from "@/lib/permissions.functions";

const moduleName = z.enum([
  "incidents",
  "hazards",
  "observations",
  "near_misses",
  "environment",
  "audits",
  "inspections",
  "risks",
  "capa",
  "contractors",
  "documents",
  "reviews",
  "safety_committee",
  "emergency_response",
  "permits",
  "legal",
  "training",
  "competencies",
  "ppe",
  "objectives",
  "employees",
]);
const evidenceSchema = z.object({
  module: moduleName,
  recordId: z.string().uuid(),
  storagePath: z
    .string()
    .regex(/^[0-9a-f-]{36}\/[a-z_]+\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|pdf)$/i),
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
  fileSize: z.number().int().min(1).max(10_485_760),
  caption: z.string().trim().max(1000).optional(),
});

export const saveEvidenceMetadata = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => evidenceSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertPermission(context, data.module, "edit");
    if (!data.storagePath.startsWith(`${context.userId}/`))
      throw new Error("Invalid evidence path.");
    const { error } = await context.supabase.from("evidence_attachments").insert({
      module: data.module,
      record_id: data.recordId,
      storage_path: data.storagePath,
      file_name: data.fileName,
      mime_type: data.mimeType,
      file_size: data.fileSize,
      caption: data.caption || null,
      uploaded_by: context.userId,
    } as never);
    if (error) throw new Error("The evidence metadata could not be saved.");
    return { ok: true };
  });

export const getRecordEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ module: moduleName, recordId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertPermission(context, data.module, "view");
    const { data: rows, error } = await context.supabase
      .from("evidence_attachments")
      .select("*")
      .eq("module", data.module)
      .eq("record_id", data.recordId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Evidence could not be loaded.");
    const paths = (rows ?? []).map((row) => row.storage_path);
    const signed = paths.length
      ? await context.supabase.storage.from("hse-evidence").createSignedUrls(paths, 900)
      : { data: [] };
    return (rows ?? []).map((row, index) => ({
      ...row,
      signedUrl: signed.data?.[index]?.signedUrl ?? null,
    }));
  });

export const deleteEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error: lookupError } = await context.supabase
      .from("evidence_attachments")
      .select("module,storage_path,uploaded_by")
      .eq("id", data.id)
      .maybeSingle();
    if (lookupError || !row) throw new Error("Evidence could not be found.");
    if (row.uploaded_by === context.userId) await assertPermission(context, row.module, "edit");
    else await assertPermission(context, row.module, "delete");
    const { error: fileError } = await context.supabase.storage
      .from("hse-evidence")
      .remove([row.storage_path]);
    if (fileError) throw new Error("Evidence file could not be deleted.");
    const { error } = await context.supabase
      .from("evidence_attachments")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error("Evidence metadata could not be deleted.");
    return { ok: true };
  });
