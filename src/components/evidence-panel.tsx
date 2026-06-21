import { useState, type ChangeEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, FileImage, FileText, Images, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CameraCaptureDialog } from "@/components/camera-capture-dialog";
import { deleteEvidence, getRecordEvidence, saveEvidenceMetadata } from "@/lib/evidence.functions";
import { compressImage } from "@/lib/image-compress";

type EvidenceModule =
  | "incidents"
  | "hazards"
  | "observations"
  | "near_misses"
  | "environment"
  | "audits"
  | "inspections"
  | "risks"
  | "capa"
  | "contractors"
  | "documents"
  | "reviews"
  | "safety_committee"
  | "emergency_response"
  | "permits"
  | "legal"
  | "training"
  | "competency";

export function EvidencePanel({
  module,
  recordId,
  canAdd = true,
  canDelete = true,
  photosOnly = false,
  ownerOnly = false,
  currentUserId,
  title,
  description,
  uploadLabel,
  emptyText,
}: {
  module: EvidenceModule;
  recordId: string;
  canAdd?: boolean;
  canDelete?: boolean;
  photosOnly?: boolean;
  ownerOnly?: boolean;
  currentUserId?: string;
  title?: string;
  description?: string;
  uploadLabel?: string;
  emptyText?: string;
}) {
  const queryClient = useQueryClient();
  const load = useServerFn(getRecordEvidence);
  const save = useServerFn(saveEvidenceMetadata);
  const remove = useServerFn(deleteEvidence);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const queryKey = ["evidence", module, recordId];
  const { data: rawData = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => load({ data: { module, recordId } }),
  });
  const data = ownerOnly && currentUserId
    ? rawData.filter((row) => row.uploaded_by === currentUserId)
    : rawData;


  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    if (files.length > 20) {
      setError("Select no more than 20 photographs at a time.");
      return;
    }
    const invalidFile = files.find(
      (file) =>
        !(photosOnly
          ? ["image/jpeg", "image/png", "image/webp"].includes(file.type)
          : ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) ||
        file.size > 10_485_760,
    );
    if (invalidFile) {
      setError(
        `${invalidFile.name}: use ${photosOnly ? "a JPG, PNG or WebP image" : "JPG, PNG, WebP or PDF"} up to 10 MB.`,
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Please sign in again.");
      for (const original of files) {
        const file = original.type.startsWith("image/")
          ? await compressImage(original)
          : original;
        const extension = file.name.split(".").pop()?.toLowerCase() ?? (photosOnly ? "jpg" : "pdf");
        const path = `${auth.user.id}/${module}/${recordId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("hse-evidence")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw new Error(`${file.name} could not be uploaded.`);
        try {
          await save({
            data: {
              module,
              recordId,
              storagePath: path,
              fileName: file.name,
              mimeType: file.type as
                | "image/jpeg"
                | "image/png"
                | "image/webp"
                | "application/pdf",
              fileSize: file.size,
            },
          });
        } catch (cause) {
          await supabase.storage.from("hse-evidence").remove([path]);
          throw cause;
        }
      }
      await queryClient.invalidateQueries({ queryKey });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Evidence could not be uploaded.");
    } finally {
      setBusy(false);
    }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    await uploadFiles(files);
  }

  return (
    <section className="space-y-3 border-t pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">
            {title ?? (photosOnly ? "Photographic evidence" : "Supporting evidence")}
          </p>
          <p className="text-xs text-muted-foreground">
            {description ??
              (photosOnly
                ? "Upload up to 20 photographs per selection. JPG, PNG or WebP; 10 MB per image."
                : "Upload up to 20 files per selection. JPG, PNG, WebP or PDF; 10 MB per file.")}
          </p>
        </div>
        {canAdd && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setCameraOpen(true)}
              className="gap-2"
            >
              <Camera />
              {busy ? "Uploading…" : "Camera"}
            </Button>
            <Button type="button" variant="safety" size="sm" disabled={busy} asChild>
              <label>
                <Images />
                {busy
                  ? photosOnly
                    ? "Uploading photographs…"
                    : "Uploading files…"
                  : photosOnly
                    ? (uploadLabel ?? "Add photographs")
                    : (uploadLabel ?? "Add evidence")}
                <Input
                  className="sr-only"
                  type="file"
                  accept={
                    photosOnly
                      ? "image/jpeg,image/png,image/webp"
                      : "image/jpeg,image/png,image/webp,application/pdf"
                  }
                  multiple
                  onChange={upload}
                />
              </label>
            </Button>
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {isLoading && (
          <p className="col-span-full border border-dashed p-4 text-sm text-muted-foreground">
            Loading photographs…
          </p>
        )}
        {data.map((item) => (
          <div key={item.id} className="flex items-center gap-3 border bg-card p-3 shadow-sm">
            {item.mime_type === "application/pdf" ? (
              <FileText className="shrink-0 text-primary" />
            ) : item.signedUrl ? (
              <a href={item.signedUrl} target="_blank" rel="noreferrer" className="shrink-0">
                <img
                  src={item.signedUrl}
                  alt={item.caption || `Photographic evidence: ${item.file_name}`}
                  className="size-16 rounded-md border object-cover"
                  loading="lazy"
                  width={64}
                  height={64}
                />
              </a>
            ) : (
              <FileImage className="shrink-0 text-primary" />
            )}
            <a
              className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
              href={item.signedUrl ?? undefined}
              target="_blank"
              rel="noreferrer"
            >
              {item.file_name}
            </a>
            {canDelete && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 text-destructive"
                aria-label="Delete evidence"
                onClick={async () => {
                  await remove({ data: { id: item.id } });
                  await queryClient.invalidateQueries({ queryKey });
                }}
              >
                <Trash2 />
                Delete
              </Button>
            )}
          </div>
        ))}
        {!isLoading && data.length === 0 && (
          <p className="col-span-full border border-dashed p-4 text-sm text-muted-foreground">
            {emptyText ??
              (photosOnly
                ? "No photographs attached yet. Use Add photographs to select several images."
                : "No evidence attached yet.")}
          </p>
        )}
      </div>
      <CameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={async (file) => {
          await uploadFiles([file]);
        }}
        title="Capture evidence photo"
        description="Center the subject in the frame, then capture."
        defaultFacing="environment"
      />
    </section>
  );
}
