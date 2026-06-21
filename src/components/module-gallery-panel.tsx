import { useState } from "react";
import { ChevronDown, ChevronRight, Images } from "lucide-react";
import { EvidencePanel } from "@/components/evidence-panel";

// Sentinel UUID representing "no specific record" — used to store module-wide
// (gallery) photos that are always available regardless of selected record.
export const MODULE_GALLERY_RECORD_ID = "00000000-0000-0000-0000-000000000000";

type GalleryModule =
  | "incidents"
  | "hazards"
  | "observations"
  | "near_misses"
  | "environment"
  | "audits"
  | "inspections";

export function ModuleGalleryPanel({
  module,
  title,
  canAdd = true,
  canDelete = true,
  ownerOnly = false,
  currentUserId,
  defaultOpen = false,
}: {
  module: GalleryModule;
  title?: string;
  canAdd?: boolean;
  canDelete?: boolean;
  ownerOnly?: boolean;
  currentUserId?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mb-6 border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-5 text-left hover:bg-muted/40"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <Images className="text-primary" />
          <div>
            <h3 className="font-bold">{title ?? "Module photo library"}</h3>
            <p className="text-xs text-muted-foreground">
              {ownerOnly
                ? "Photographs you have uploaded for this module."
                : "Permanent photo library for this module."}
              {" "}Click to {open ? "collapse" : "expand"}.
            </p>
          </div>
        </div>
        {open ? <ChevronDown /> : <ChevronRight />}
      </button>
      {open && (
        <div className="border-t p-5">
          <EvidencePanel
            module={module}
            recordId={MODULE_GALLERY_RECORD_ID}
            canAdd={canAdd}
            canDelete={canDelete}
            ownerOnly={ownerOnly}
            currentUserId={currentUserId}
            photosOnly
          />
        </div>
      )}
    </section>
  );
}
