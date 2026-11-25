import { planCutDownload, type CustomCutFile } from "@/lib/custom-cut-file";
import type { StoredPlate } from "@/lib/orders";
import { buildProductionDownload } from "@/lib/production-download";
import { unzipStore } from "@/lib/zip";

export const CUT_PREVIEW_FONT_NOTE =
  "Fonts such as Gadugi may display with a fallback if they are not installed on this computer. The downloaded file is unchanged.";

export const CUT_PREVIEW_LOCKED = "Locked until the customer approves the proof.";

export const CUT_PREVIEW_UNPREVIEWABLE =
  "This LightBurn file can't be drawn in the browser. The yellow download is the file to open.";

const PREVIEW_SHEET_LIMIT = 24;

export type CutPreviewSheet = {
  name: string;
  body: Uint8Array;
};

function isSvgName(name: string) {
  return name.toLowerCase().endsWith(".svg");
}

function looksLikeSvg(body: Uint8Array) {
  const head = new TextDecoder("utf-8", { fatal: false }).decode(body.subarray(0, 800)).toLowerCase();
  return head.includes("<svg");
}

/**
 * SVG files inside a cut-file zip. Nested sheets win when the zip has a
 * sheets/ folder, because that is what LightBurn cuts. Otherwise every SVG.
 */
export function svgSheetsFromZip(bytes: Uint8Array): CutPreviewSheet[] {
  const entries = unzipStore(bytes);
  const svgs = entries.filter((entry) => isSvgName(entry.name) && looksLikeSvg(entry.data));
  const sheets = svgs.filter((entry) => entry.name.startsWith("sheets/"));
  const chosen = sheets.length > 0 ? sheets : svgs;
  return chosen.slice(0, PREVIEW_SHEET_LIMIT).map((entry) => ({
    name: entry.name,
    body: entry.data,
  }));
}

/**
 * The pictures for the yellow LightBurn download. Custom files are read from
 * storage. Otherwise the sheets are taken out of the same zip that button downloads.
 */
export async function collectCutPreview(input: {
  orderNumber: number;
  plates: StoredPlate[];
  customCutFiles?: CustomCutFile[];
  readObject?: (file: CustomCutFile) => Promise<Uint8Array>;
}): Promise<
  | { ok: true; sheets: CutPreviewSheet[] }
  | { ok: false; code: "unpreviewable" | "empty" | "storage" }
> {
  const plan = planCutDownload({
    customCutFiles: input.customCutFiles,
    source: null,
    file: null,
  });
  if (plan.kind === "missing") return { ok: false, code: "empty" };
  if (plan.kind === "auto") {
    const download = buildProductionDownload(input.orderNumber, input.plates);
    if (!download) return { ok: false, code: "empty" };
    const sheets = svgSheetsFromZip(download.body);
    if (sheets.length === 0) return { ok: false, code: "unpreviewable" };
    return { ok: true, sheets };
  }
  if (!input.readObject) return { ok: false, code: "storage" };
  const sheets: CutPreviewSheet[] = [];
  for (const file of plan.files) {
    const bytes = await input.readObject(file);
    const lower = file.filename.toLowerCase();
    if (lower.endsWith(".svg") && looksLikeSvg(bytes)) {
      sheets.push({ name: file.filename, body: bytes });
    } else if (lower.endsWith(".zip")) {
      sheets.push(...svgSheetsFromZip(bytes));
    }
    if (sheets.length >= PREVIEW_SHEET_LIMIT) break;
  }
  if (sheets.length === 0) return { ok: false, code: "unpreviewable" };
  return { ok: true, sheets: sheets.slice(0, PREVIEW_SHEET_LIMIT) };
}
