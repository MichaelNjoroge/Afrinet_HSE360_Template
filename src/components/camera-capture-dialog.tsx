import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCcw, SwitchCamera, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void | Promise<void>;
  title?: string;
  description?: string;
  /** "user" = front (selfie), "environment" = rear */
  defaultFacing?: "user" | "environment";
};

export function CameraCaptureDialog({
  open,
  onOpenChange,
  onCapture,
  title = "Take a photo",
  description = "Position yourself in the frame, then tap Capture.",
  defaultFacing = "user",
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">(defaultFacing);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const startStream = useCallback(
    async (mode: "user" | "environment") => {
      setError(null);
      stopStream();
      if (typeof window !== "undefined" && window.isSecureContext === false) {
        setError("Camera requires a secure (HTTPS) connection.");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera is not supported in this browser.");
        return;
      }
      // Try preferred facing first; fall back to any available camera. Laptops
      // commonly expose only one webcam with no facingMode hint, which causes
      // the strict mobile-style constraint to fail silently.
      const attempts: MediaStreamConstraints[] = [
        { video: { facingMode: { ideal: mode } }, audio: false },
        { video: true, audio: false },
      ];
      let lastError: unknown = null;
      for (const constraints of attempts) {
        try {
          const s = await navigator.mediaDevices.getUserMedia(constraints);
          streamRef.current = s;
          setStream(s);
          return;
        } catch (e) {
          lastError = e;
        }
      }
      const msg = lastError instanceof Error ? lastError.message : "Could not access the camera.";
      setError(
        /permission|denied|notallowed/i.test(msg)
          ? "Camera permission denied. Allow camera access in your browser settings."
          : /notfound|devicesnotfound/i.test(msg)
            ? "No camera was found on this device."
            : msg,
      );
    },
    [stopStream],
  );

  // Attach the live stream to the <video> element whenever both exist. This
  // handles the laptop race where the video element mounts after
  // getUserMedia resolves (Radix portals the dialog content on a later tick).
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream || preview) return;
    if (video.srcObject !== stream) video.srcObject = stream;
    video.play().catch(() => {});
  }, [stream, preview]);

  useEffect(() => {
    if (!open) {
      stopStream();
      setPreview(null);
      return;
    }
    void startStream(facing);
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const flip = async () => {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    await startStream(next);
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    setPreview(canvas.toDataURL("image/jpeg", 0.9));
  };

  const retake = () => {
    setPreview(null);
  };

  const usePhoto = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    try {
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9),
      );
      if (!blob) {
        setError("Could not process the photo.");
        return;
      }
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
      await onCapture(file);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4" /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="relative overflow-hidden rounded-md bg-black aspect-square">
          {preview ? (
            <img src={preview} alt="Captured" className="h-full w-full object-cover" />
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
              style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
            />
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={flip}
            disabled={!!preview || busy}
            className="gap-1"
          >
            <SwitchCamera className="h-4 w-4" />
            {facing === "user" ? "Use rear camera" : "Use front camera"}
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={busy}
              className="gap-1"
            >
              <X className="h-4 w-4" /> Cancel
            </Button>
            {preview ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={retake} disabled={busy} className="gap-1">
                  <RefreshCcw className="h-4 w-4" /> Retake
                </Button>
                <Button type="button" size="sm" onClick={usePhoto} disabled={busy}>
                  {busy ? "Saving…" : "Use photo"}
                </Button>
              </>
            ) : (
              <Button type="button" size="sm" onClick={capture} disabled={!!error} className="gap-1">
                <Camera className="h-4 w-4" /> Capture
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
