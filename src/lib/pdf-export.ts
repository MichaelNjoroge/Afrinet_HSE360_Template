import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";
import { toast } from "sonner";

export type Branding = {
  companyName?: string;
  reportFooter?: string;
  letterheadUrl?: string | null;
  letterheadMime?: string | null;
};

export type ExportOptions = {
  fileName: string;
  title?: string;
  subtitle?: string;
  branding?: Branding | null;
};

async function loadLetterheadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// A4 portrait in points (pt). 1mm = 2.83465pt
const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const MARGIN_PT = 42; // ~15mm
const SECTION_GAP_PT = 8;

/**
 * Renders an HTMLElement onto an A4 portrait PDF on company letterhead.
 *
 * Uses section-based capture: any descendant with [data-pdf-section] is
 * captured as an atomic block and moved to the next page if it would not
 * fit the remaining space. This avoids content being cut mid-line.
 * If no sections are present we fall back to slice-based pagination of
 * the entire element.
 */
export async function buildBrandedPdf(
  element: HTMLElement,
  options: ExportOptions,
): Promise<jsPDF | null> {
  document.body.classList.add("is-exporting");
  try {
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

    // Letterhead image (skip if PDF or missing).
    let letterhead: HTMLImageElement | null = null;
    const isImageLetterhead =
      !!options.branding?.letterheadUrl &&
      options.branding?.letterheadMime !== "application/pdf";
    if (isImageLetterhead && options.branding?.letterheadUrl) {
      letterhead = await loadLetterheadImage(options.branding.letterheadUrl);
    }

    const headerHeight = letterhead ? 90 : options.branding?.companyName ? 22 : 0;
    const footerText = options.branding?.reportFooter ?? "";
    const footerHeight = footerText ? 22 : 14;

    // Extra breathing room below the letterhead so the first line of body
    // content never sits underneath the letterhead artwork.
    const contentTop = MARGIN_PT + headerHeight + (headerHeight ? 28 : 0);
    const contentBottom = A4_HEIGHT_PT - MARGIN_PT - footerHeight;
    const contentWidth = A4_WIDTH_PT - MARGIN_PT * 2;
    const availablePageHeight = contentBottom - contentTop;

    let currentY = contentTop;
    let pageIndex = 0;
    const pages: Array<{ index: number }> = [{ index: 0 }];

    const addPage = () => {
      pdf.addPage();
      pageIndex += 1;
      pages.push({ index: pageIndex });
      currentY = contentTop;
    };

    const renderNode = async (node: HTMLElement, isFirst: boolean) => {
      const canvas = await html2canvas(node, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      const ratio = canvas.height / canvas.width;
      // Cap drawWidth at contentWidth but allow narrower content (e.g. centered
      // report bodies with a max-width) to stay centered horizontally on the page.
      const naturalWidth = Math.min(contentWidth, canvas.width * 0.75);
      const drawWidth = Math.max(naturalWidth, contentWidth * 0.85);
      const drawHeight = drawWidth * ratio;
      const drawX = MARGIN_PT + (contentWidth - drawWidth) / 2;
      const imgData = canvas.toDataURL("image/png");


      // If this block is taller than a full page, slice it across pages.
      if (drawHeight > availablePageHeight) {
        const pxPerPt = canvas.width / drawWidth;
        const sliceHeightPx = availablePageHeight * pxPerPt;
        let sourceY = 0;
        let first = true;
        while (sourceY < canvas.height) {
          const sliceH = Math.min(sliceHeightPx, canvas.height - sourceY);
          const slice = document.createElement("canvas");
          slice.width = canvas.width;
          slice.height = sliceH;
          const ctx = slice.getContext("2d");
          if (!ctx) break;
          ctx.drawImage(canvas, 0, sourceY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
          if (!first || (!isFirst && currentY !== contentTop)) {
            addPage();
          }
          pdf.addImage(
            slice.toDataURL("image/png"),
            "PNG",
            drawX,
            currentY,
            drawWidth,
            (sliceH / canvas.width) * drawWidth,
          );

          currentY = contentBottom; // force next page
          sourceY += sliceH;
          first = false;
        }
        return;
      }

      const remaining = contentBottom - currentY;
      if (drawHeight > remaining && currentY !== contentTop) {
        addPage();
      }
      pdf.addImage(imgData, "PNG", drawX, currentY, drawWidth, drawHeight);
      currentY += drawHeight + SECTION_GAP_PT;
    };

    const sections = Array.from(
      element.querySelectorAll<HTMLElement>("[data-pdf-section]"),
    );

    if (sections.length > 0) {
      let isFirst = true;
      for (const section of sections) {
        await renderNode(section, isFirst);
        isFirst = false;
      }
    } else {
      await renderNode(element, true);
    }

    // Title + subtitle on the first page above the captured content
    // (drawn after so it overlays the empty area between header & content).
    if (options.title) {
      pdf.setPage(1);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(15);
      pdf.text(options.title, MARGIN_PT, MARGIN_PT + headerHeight - 4);
      if (options.subtitle) {
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(110);
        pdf.text(options.subtitle, MARGIN_PT, MARGIN_PT + headerHeight + 8);
      }
      pdf.setTextColor(0);
    }

    // Draw header/footer on every page.
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      if (letterhead) {
        const ratio = letterhead.height / letterhead.width;
        const w = contentWidth;
        const h = Math.min(headerHeight, w * ratio);
        pdf.addImage(letterhead, "PNG", MARGIN_PT, MARGIN_PT - 8, w, h);
      } else if (options.branding?.companyName) {
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(60);
        pdf.text(options.branding.companyName, MARGIN_PT, MARGIN_PT + 4);
        pdf.setTextColor(0);
      }
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(130);
      if (footerText) {
        pdf.text(footerText, MARGIN_PT, A4_HEIGHT_PT - MARGIN_PT + 14);
      }
      pdf.text(
        `Page ${i} of ${pageCount}`,
        A4_WIDTH_PT - MARGIN_PT,
        A4_HEIGHT_PT - MARGIN_PT + 14,
        { align: "right" },
      );
      pdf.setTextColor(0);
    }

    return pdf;
  } catch (error) {
    console.error("PDF export failed", error);
    toast.error("Could not generate PDF. Please try again.");
    return null;
  } finally {
    document.body.classList.remove("is-exporting");
  }
}

export async function exportElementToPdf(
  element: HTMLElement,
  options: ExportOptions,
): Promise<void> {
  const pdf = await buildBrandedPdf(element, options);
  if (!pdf) return;
  pdf.save(`${options.fileName}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function elementToPdfBase64(
  element: HTMLElement,
  options: ExportOptions,
): Promise<{ base64: string; fileName: string } | null> {
  const pdf = await buildBrandedPdf(element, options);
  if (!pdf) return null;
  const dataUri = pdf.output("datauristring");
  const base64 = dataUri.split(",")[1] ?? "";
  return {
    base64,
    fileName: `${options.fileName}-${new Date().toISOString().slice(0, 10)}.pdf`,
  };
}
