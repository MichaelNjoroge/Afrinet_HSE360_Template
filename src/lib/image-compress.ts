// Client-side image compression. Resizes large images down to a max edge,
// re-encodes as JPEG to drop EXIF/metadata and reduce file size, and keeps
// non-image files untouched. PDFs and unknown types pass through unchanged.

export type CompressOptions = {
  maxEdge?: number; // max width or height in pixels
  quality?: number; // 0..1 JPEG quality
  maxBytes?: number; // skip compression if file is already smaller than this
};

const DEFAULTS: Required<CompressOptions> = {
  maxEdge: 1920,
  quality: 0.82,
  maxBytes: 400 * 1024, // 400 KB — already small, don't bother
};

const SUPPORTED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<File> {
  const opts = { ...DEFAULTS, ...options };
  if (!SUPPORTED.has(file.type)) return file;
  if (file.size <= opts.maxBytes) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const scale = Math.min(1, opts.maxEdge / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", opts.quality),
    );
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
