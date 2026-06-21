import { toast } from "sonner";

export type WordExportOptions = {
  fileName: string;
  title?: string;
  subtitle?: string;
  branding?: {
    companyName?: string;
    reportFooter?: string;
    letterheadUrl?: string | null;
    letterheadMime?: string | null;
  } | null;
};

async function fetchAsDataUrl(src: string): Promise<string | null> {
  try {
    const resp = await fetch(src, { mode: "cors" });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Convert remote images inside the captured DOM to inline data URIs so
 * MS-Word renders them when the .doc file is opened offline.
 */
async function inlineImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) return;
      const dataUrl = await fetchAsDataUrl(src);
      if (dataUrl) img.setAttribute("src", dataUrl);
    }),
  );
}

/**
 * Export a DOM element to an MS-Word (.doc) file. Uses Word's HTML
 * import: a plain HTML document wrapped with Word XML namespaces and
 * served with `application/msword` — Word opens it as an editable doc.
 *
 * Buttons and elements marked `[data-export-hide]` are stripped so
 * internal UI chrome (Edit/Delete/Export/Generate buttons) never leaks
 * into client-facing documents.
 */
export async function exportElementToWord(
  element: HTMLElement,
  options: WordExportOptions,
): Promise<void> {
  document.body.classList.add("is-exporting");
  try {
    const clone = element.cloneNode(true) as HTMLElement;
    // Remove buttons, hidden chrome, and elements Word cannot render
    // reliably (canvases, inline SVGs, scripts/styles) so the document
    // body is never silently empty when opened.
    clone
      .querySelectorAll(
        "button, [data-export-hide], script, style, link, canvas, svg, video, iframe",
      )
      .forEach((node) => node.remove());
    await inlineImages(clone);

    const bodyHtml = clone.innerHTML.trim();
    if (!bodyHtml) {
      toast.error("Nothing to export yet — please wait for the report to load.");
      return;
    }

    // Inline the letterhead to a data URI so Word renders it offline.
    // Constrain with an explicit width attribute (Word ignores some CSS
    // max-width rules), preventing oversized letterheads from overflowing
    // the A4 page margins.
    let header = "";
    if (options.branding?.letterheadUrl) {
      const dataUrl =
        (await fetchAsDataUrl(options.branding.letterheadUrl)) ??
        options.branding.letterheadUrl;
      header = `<div style="text-align:center;margin-bottom:16pt"><img src="${dataUrl}" width="600" style="width:17cm;max-width:100%;height:auto"/></div>`;
    } else if (options.branding?.companyName) {
      header = `<div style="font-weight:bold;font-size:12pt;color:#333;margin-bottom:8pt">${escapeHtml(options.branding.companyName)}</div>`;
    }

    const titleBlock = options.title
      ? `<h1 style="font-family:Calibri,Arial,sans-serif;font-size:18pt;margin:0 0 4pt 0">${escapeHtml(options.title)}</h1>${
          options.subtitle
            ? `<div style="color:#666;font-size:10pt;margin-bottom:12pt">${escapeHtml(options.subtitle)}</div>`
            : ""
        }`
      : "";

    const footer = options.branding?.reportFooter
      ? `<div style="margin-top:24pt;color:#666;font-size:9pt;border-top:1px solid #ccc;padding-top:8pt">${escapeHtml(options.branding.reportFooter)}</div>`
      : "";

    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(options.title ?? options.fileName)}</title>
<xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml>
<style>
  @page WordSection1 { size: A4; margin: 2cm; }
  div.WordSection1 { page: WordSection1; }
  body { font-family: Calibri, Arial, sans-serif; font-size: 12pt; color: #111; }
  img { max-width: 17cm; height: auto; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  th, td { border: 1px solid #ccc; padding: 4pt 6pt; vertical-align: top; word-wrap: break-word; }
  h1,h2,h3,h4 { font-family: Calibri, Arial, sans-serif; }
</style>
</head>
<body>
<div class="WordSection1">
${header}
${titleBlock}
${bodyHtml}
${footer}
</div>
</body>
</html>`;

    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${options.fileName}-${new Date().toISOString().slice(0, 10)}.doc`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } catch (error) {
    console.error("Word export failed", error);
    toast.error("Could not generate Word document. Please try again.");
  } finally {
    document.body.classList.remove("is-exporting");
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
