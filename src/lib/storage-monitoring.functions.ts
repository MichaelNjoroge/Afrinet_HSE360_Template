import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BucketUsage = {
  bucket: string;
  isPublic: boolean;
  fileCount: number;
  bytes: number;
  largestFiles: Array<{
    name: string;
    bytes: number;
    contentType: string | null;
    updatedAt: string | null;
    owner: string | null;
  }>;
  oldestFiles: Array<{
    name: string;
    bytes: number;
    updatedAt: string | null;
  }>;
  fileTypeBreakdown: Array<{ type: string; count: number; bytes: number }>;
  staleCount: number; // not updated for >180 days
  staleBytes: number;
  duplicateCandidates: number; // files sharing identical size (rough heuristic)
};

export type StorageSnapshot = {
  generatedAt: string;
  quotaBytes: number; // soft quota for the UI gauge
  quotaSource: "env-override" | "auto-detected-tier" | "default";
  quotaTierLabel: string;
  totalBytes: number;
  totalFiles: number;
  buckets: BucketUsage[];
  recommendations: Array<{
    severity: "info" | "warn" | "critical";
    title: string;
    detail: string;
  }>;
};

const GB = 1024 * 1024 * 1024;
// Standard hosting-plan storage tiers (bytes, label). Auto-detection picks the
// smallest tier that comfortably fits current usage — no manual config needed.
const PLAN_TIERS: Array<{ bytes: number; label: string }> = [
  { bytes: 1 * GB, label: "Free tier (1 GB)" },
  { bytes: 8 * GB, label: "Starter tier (8 GB)" },
  { bytes: 100 * GB, label: "Pro tier (100 GB)" },
  { bytes: 250 * GB, label: "Team tier (250 GB)" },
  { bytes: 500 * GB, label: "Scale tier (500 GB)" },
  { bytes: 1024 * GB, label: "Enterprise (1 TB)" },
  { bytes: 2048 * GB, label: "Enterprise (2 TB)" },
  { bytes: 4096 * GB, label: "Enterprise (4 TB)" },
];

function detectQuota(currentBytes: number): {
  quotaBytes: number;
  quotaSource: StorageSnapshot["quotaSource"];
  quotaTierLabel: string;
} {
  const override = Number(process.env.STORAGE_QUOTA_BYTES);
  if (Number.isFinite(override) && override > 0) {
    return {
      quotaBytes: override,
      quotaSource: "env-override",
      quotaTierLabel: `Custom (${(override / GB).toFixed(1)} GB)`,
    };
  }
  // Pick the smallest tier whose ceiling leaves at least 25% headroom over
  // observed usage. This means the gauge auto-promotes the plan as data grows.
  const needed = currentBytes / 0.75;
  const tier = PLAN_TIERS.find((t) => t.bytes >= needed) ?? PLAN_TIERS[PLAN_TIERS.length - 1];
  return {
    quotaBytes: tier.bytes,
    quotaSource: "auto-detected-tier",
    quotaTierLabel: tier.label,
  };
}

export const getStorageSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StorageSnapshot> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: admin role required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: bucketsList, error: bucketsErr } = await supabaseAdmin.storage.listBuckets();
    if (bucketsErr) throw new Error(bucketsErr.message);

    const buckets: BucketUsage[] = [];
    let totalBytes = 0;
    let totalFiles = 0;
    const now = Date.now();
    const STALE_MS = 1000 * 60 * 60 * 24 * 180;

    for (const b of bucketsList ?? []) {
      // Use raw SQL via PostgREST is restricted; pull from storage.objects via service role.
      const { data: rows, error } = await (supabaseAdmin as any)
        .schema("storage")
        .from("objects")
        .select("name,metadata,updated_at,owner")
        .eq("bucket_id", b.id)
        .limit(10000);
      if (error) {
        buckets.push({
          bucket: b.id,
          isPublic: b.public,
          fileCount: 0,
          bytes: 0,
          largestFiles: [],
          oldestFiles: [],
          fileTypeBreakdown: [],
          staleCount: 0,
          staleBytes: 0,
          duplicateCandidates: 0,
        });
        continue;
      }

      type FileRec = {
        name: string;
        bytes: number;
        contentType: string | null;
        updatedAt: string | null;
        owner: string | null;
      };
      const files: FileRec[] = ((rows ?? []) as any[]).map((r) => {
        const size = Number(r.metadata?.size ?? 0);
        return {
          name: r.name as string,
          bytes: Number.isFinite(size) ? size : 0,
          contentType: (r.metadata?.mimetype as string | null) ?? null,
          updatedAt: r.updated_at as string | null,
          owner: r.owner as string | null,
        };
      });

      const bucketBytes = files.reduce((s, f) => s + f.bytes, 0);
      totalBytes += bucketBytes;
      totalFiles += files.length;

      const sortedBySize = [...files].sort((a, b) => b.bytes - a.bytes);
      const sortedByAge = [...files]
        .filter((f) => f.updatedAt)
        .sort((a, b) => new Date(a.updatedAt!).getTime() - new Date(b.updatedAt!).getTime());

      const typeMap = new Map<string, { count: number; bytes: number }>();
      for (const f of files) {
        const ext = (f.name.split(".").pop() || "other").toLowerCase().slice(0, 12);
        const key = f.contentType || ext;
        const prev = typeMap.get(key) ?? { count: 0, bytes: 0 };
        prev.count += 1;
        prev.bytes += f.bytes;
        typeMap.set(key, prev);
      }

      const sizeCounts = new Map<number, number>();
      for (const f of files) {
        if (f.bytes > 50 * 1024) {
          sizeCounts.set(f.bytes, (sizeCounts.get(f.bytes) ?? 0) + 1);
        }
      }
      const duplicateCandidates = Array.from(sizeCounts.values()).reduce(
        (s, c) => s + (c > 1 ? c : 0),
        0,
      );

      const stale = files.filter(
        (f) => f.updatedAt && now - new Date(f.updatedAt).getTime() > STALE_MS,
      );

      buckets.push({
        bucket: b.id,
        isPublic: b.public,
        fileCount: files.length,
        bytes: bucketBytes,
        largestFiles: sortedBySize.slice(0, 10).map((f) => ({
          name: f.name,
          bytes: f.bytes,
          contentType: f.contentType,
          updatedAt: f.updatedAt,
          owner: f.owner,
        })),
        oldestFiles: sortedByAge.slice(0, 5).map((f) => ({
          name: f.name,
          bytes: f.bytes,
          updatedAt: f.updatedAt,
        })),
        fileTypeBreakdown: Array.from(typeMap.entries())
          .map(([type, v]) => ({ type, ...v }))
          .sort((a, b) => b.bytes - a.bytes)
          .slice(0, 8),
        staleCount: stale.length,
        staleBytes: stale.reduce((s, f) => s + f.bytes, 0),
        duplicateCandidates,
      });
    }

    buckets.sort((a, b) => b.bytes - a.bytes);

    const { quotaBytes, quotaSource, quotaTierLabel } = detectQuota(totalBytes);
    const pct = totalBytes / quotaBytes;
    const recommendations: StorageSnapshot["recommendations"] = [];

    if (pct >= 0.9) {
      recommendations.push({
        severity: "critical",
        title: "Storage above 90% of soft quota",
        detail:
          "Immediately archive or delete the largest files. Consider raising the plan quota before uploads start failing.",
      });
    } else if (pct >= 0.7) {
      recommendations.push({
        severity: "warn",
        title: "Storage above 70% of soft quota",
        detail: "Plan a cleanup of stale and oversized files in the next 7 days.",
      });
    } else {
      recommendations.push({
        severity: "info",
        title: "Storage healthy",
        detail: `Using ${(pct * 100).toFixed(1)}% of the configured soft quota.`,
      });
    }

    for (const b of buckets) {
      if (b.staleBytes > 100 * 1024 * 1024) {
        recommendations.push({
          severity: "warn",
          title: `Stale files in "${b.bucket}"`,
          detail: `${b.staleCount} file(s) (${formatBytesServer(b.staleBytes)}) not updated in 180+ days. Archive to cold storage or delete.`,
        });
      }
      const oversize = b.largestFiles.filter((f) => f.bytes > 5 * 1024 * 1024);
      if (oversize.length > 0) {
        recommendations.push({
          severity: "info",
          title: `Oversized files in "${b.bucket}"`,
          detail: `${oversize.length} file(s) above 5 MB. Compress images (WebP/AVIF) or downscale before upload.`,
        });
      }
      if (b.duplicateCandidates >= 3) {
        recommendations.push({
          severity: "info",
          title: `Possible duplicates in "${b.bucket}"`,
          detail: `${b.duplicateCandidates} file(s) share identical sizes — review for duplicate uploads.`,
        });
      }
      const imageHeavy = b.fileTypeBreakdown.find(
        (t) => /png|jpeg|jpg/i.test(t.type) && t.bytes > 50 * 1024 * 1024,
      );
      if (imageHeavy) {
        recommendations.push({
          severity: "info",
          title: `Convert images in "${b.bucket}" to WebP`,
          detail: `${formatBytesServer(imageHeavy.bytes)} of ${imageHeavy.type}. WebP/AVIF typically cuts size by 30–60%.`,
        });
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      quotaBytes,
      quotaSource,
      quotaTierLabel,
      totalBytes,
      totalFiles,
      buckets,
      recommendations,
    };
  });

function formatBytesServer(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
