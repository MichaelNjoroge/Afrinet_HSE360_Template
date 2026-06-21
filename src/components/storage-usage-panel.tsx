import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { HardDrive, Database, AlertTriangle, Lightbulb, FileWarning } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getStorageSnapshot,
  type StorageSnapshot,
  type BucketUsage,
} from "@/lib/storage-monitoring.functions";

function fmtBytes(n: number): string {
  if (!n) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

type Detail = { title: string; description?: string; content: ReactNode } | null;

export function StorageUsagePanel() {
  const fetchSnapshot = useServerFn(getStorageSnapshot);
  const { data, isLoading, error } = useQuery({
    queryKey: ["storage-snapshot"],
    queryFn: () => fetchSnapshot({ data: undefined as never }),
    refetchInterval: 60_000,
  });

  const [detail, setDetail] = useState<Detail>(null);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading storage usage…</p>;
  }
  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="pt-4 text-sm text-destructive">
          {(error as Error).message}
        </CardContent>
      </Card>
    );
  }
  if (!data) return null;

  const pct = Math.min(100, (data.totalBytes / data.quotaBytes) * 100);
  const tone: "default" | "secondary" | "destructive" =
    pct >= 90 ? "destructive" : pct >= 70 ? "default" : "secondary";

  return (
    <section className="space-y-4">
      <Card
        className="cursor-pointer transition hover:border-primary/50"
        onClick={() =>
          setDetail({
            title: "Overall storage usage",
            description: `${fmtBytes(data.totalBytes)} of ${fmtBytes(data.quotaBytes)} soft quota`,
            content: <OverallDetail data={data} />,
          })
        }
      >
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="h-4 w-4" />
            Storage consumption
            <Badge variant={tone} className="ml-auto">
              {pct.toFixed(1)}% used
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={pct} className="h-2" />
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
            <KV k="Used" v={fmtBytes(data.totalBytes)} />
            <KV k="Free" v={fmtBytes(Math.max(0, data.quotaBytes - data.totalBytes))} />
            <KV k="Files" v={data.totalFiles.toLocaleString()} />
            <KV k="Buckets" v={data.buckets.length} />
          </div>
          <div className="text-xs text-muted-foreground">
            Plan capacity:{" "}
            <span className="font-medium text-foreground">{data.quotaTierLabel}</span>{" "}
            <span className="opacity-70">
              ({data.quotaSource === "env-override"
                ? "set via STORAGE_QUOTA_BYTES"
                : data.quotaSource === "auto-detected-tier"
                  ? "auto-detected from usage"
                  : "default"}
              )
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.buckets.map((b) => (
          <BucketCard
            key={b.bucket}
            bucket={b}
            quota={data.quotaBytes}
            onClick={() =>
              setDetail({
                title: `Bucket · ${b.bucket}`,
                description: `${fmtBytes(b.bytes)} · ${b.fileCount} file(s)`,
                content: <BucketDetail bucket={b} />,
              })
            }
          />
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.recommendations.length === 0 && (
            <p className="text-sm text-muted-foreground">No recommendations at this time.</p>
          )}
          {data.recommendations.map((r, i) => (
            <div
              key={i}
              className="cursor-pointer rounded-md border p-3 text-sm hover:bg-muted/50"
              onClick={() =>
                setDetail({
                  title: r.title,
                  description: r.severity.toUpperCase(),
                  content: (
                    <div className="space-y-2 text-sm">
                      <p>{r.detail}</p>
                      <p className="pt-2 text-xs text-muted-foreground">
                        Click "Storage consumption" above for cleanup guidance, or open a bucket card to find specific files to remove.
                      </p>
                    </div>
                  ),
                })
              }
            >
              <div className="flex items-start gap-2">
                {r.severity === "critical" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                ) : r.severity === "warn" ? (
                  <FileWarning className="mt-0.5 h-4 w-4 text-amber-500" />
                ) : (
                  <Lightbulb className="mt-0.5 h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <div className="font-medium">{r.title}</div>
                  <div className="text-xs text-muted-foreground">{r.detail}</div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>{detail?.title}</DialogTitle>
            {detail?.description && <DialogDescription>{detail.description}</DialogDescription>}
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-3">{detail?.content}</ScrollArea>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide">{k}</span>
      <span className="text-sm font-medium text-foreground">{v}</span>
    </div>
  );
}

function BucketCard({
  bucket,
  quota,
  onClick,
}: {
  bucket: BucketUsage;
  quota: number;
  onClick: () => void;
}) {
  const pct = Math.min(100, (bucket.bytes / quota) * 100);
  return (
    <Card className="cursor-pointer transition hover:border-primary/50" onClick={onClick}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Database className="h-4 w-4" />
          {bucket.bucket}
          <Badge variant={bucket.isPublic ? "outline" : "secondary"} className="ml-auto text-[10px]">
            {bucket.isPublic ? "public" : "private"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-lg font-semibold">{fmtBytes(bucket.bytes)}</div>
        <Progress value={pct} className="h-1.5" />
        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
          <span>{bucket.fileCount} files</span>
          <span>{bucket.staleCount} stale</span>
          <span>{bucket.duplicateCandidates} dupes?</span>
        </div>
      </CardContent>
    </Card>
  );
}

function OverallDetail({ data }: { data: StorageSnapshot }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <KV k="Used" v={fmtBytes(data.totalBytes)} />
        <KV k="Quota" v={fmtBytes(data.quotaBytes)} />
        <KV k="Free" v={fmtBytes(Math.max(0, data.quotaBytes - data.totalBytes))} />
        <KV k="Files" v={data.totalFiles} />
      </div>
      <div className="pt-2">
        <div className="mb-1 text-xs text-muted-foreground">Per-bucket distribution</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bucket</TableHead>
              <TableHead className="text-right">Files</TableHead>
              <TableHead className="text-right">Size</TableHead>
              <TableHead className="text-right">% of total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.buckets.map((b) => (
              <TableRow key={b.bucket}>
                <TableCell className="text-xs">{b.bucket}</TableCell>
                <TableCell className="text-right text-xs">{b.fileCount}</TableCell>
                <TableCell className="text-right text-xs">{fmtBytes(b.bytes)}</TableCell>
                <TableCell className="text-right text-xs">
                  {data.totalBytes > 0 ? ((b.bytes / data.totalBytes) * 100).toFixed(1) : "0"}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="pt-2 text-xs text-muted-foreground">
        Plan capacity is auto-detected from observed usage ({data.quotaTierLabel}). The gauge
        promotes itself to the next standard tier as data grows — no manual config needed. To
        pin a custom ceiling, set the <code>STORAGE_QUOTA_BYTES</code> server secret.
      </p>
    </div>
  );
}

function BucketDetail({ bucket }: { bucket: BucketUsage }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <KV k="Total size" v={fmtBytes(bucket.bytes)} />
        <KV k="Files" v={bucket.fileCount} />
        <KV k="Stale (180d+)" v={`${bucket.staleCount} · ${fmtBytes(bucket.staleBytes)}`} />
        <KV k="Visibility" v={bucket.isPublic ? "Public" : "Private"} />
      </div>

      <div>
        <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">File types</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Count</TableHead>
              <TableHead className="text-right">Size</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bucket.fileTypeBreakdown.map((t) => (
              <TableRow key={t.type}>
                <TableCell className="text-xs">{t.type}</TableCell>
                <TableCell className="text-right text-xs">{t.count}</TableCell>
                <TableCell className="text-right text-xs">{fmtBytes(t.bytes)}</TableCell>
              </TableRow>
            ))}
            {bucket.fileTypeBreakdown.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-xs text-muted-foreground">
                  No files
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div>
        <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">Largest files</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead className="text-right">Size</TableHead>
              <TableHead className="text-right">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bucket.largestFiles.map((f) => (
              <TableRow key={f.name}>
                <TableCell className="max-w-[260px] truncate text-xs" title={f.name}>
                  {f.name}
                </TableCell>
                <TableCell className="text-right text-xs">{fmtBytes(f.bytes)}</TableCell>
                <TableCell className="text-right text-xs">
                  {f.updatedAt ? new Date(f.updatedAt).toLocaleDateString() : "—"}
                </TableCell>
              </TableRow>
            ))}
            {bucket.largestFiles.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-xs text-muted-foreground">
                  No files
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {bucket.oldestFiles.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">
            Oldest files (cleanup candidates)
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead className="text-right">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bucket.oldestFiles.map((f) => (
                <TableRow key={f.name}>
                  <TableCell className="max-w-[260px] truncate text-xs" title={f.name}>
                    {f.name}
                  </TableCell>
                  <TableCell className="text-right text-xs">{fmtBytes(f.bytes)}</TableCell>
                  <TableCell className="text-right text-xs">
                    {f.updatedAt ? new Date(f.updatedAt).toLocaleDateString() : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
