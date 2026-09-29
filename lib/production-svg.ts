/**
 * LightBurn production SVG.
 *
 * User units are millimetres: width="60mm" and viewBox="0 0 60 20" describe
 * the same plate. If LightBurn asks for an SVG DPI, use 96 — that is the
 * setting Silhouette used. Black fill is engrave. Red stroke is the cut line.
 */

import type { PlateObject, StoredPlate } from "@/lib/orders";

export const ENGRAVE_FILL = "#000000";
export const CUT_STROKE = "#FF0000";
/** Silhouette and LightBurn's unitless SVG fallback both use 96 DPI. */
export const LIGHTBURN_SVG_DPI = 96;

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function textAnchor(align: PlateObject["align"]) {
  if (align === "center") return "middle";
  if (align === "right") return "end";
  return "start";
}

function serializeText(object: PlateObject) {
  const lines = object.text.length > 0 ? object.text.split("\n") : [""];
  const tspans = lines
    .map((line, index) => {
      const dy = index === 0 ? 0 : Math.round(object.fontSize * 1.15 * 10) / 10;
      return `<tspan x="${object.x}" dy="${dy}">${escapeXml(line || " ")}</tspan>`;
    })
    .join("");
  return `<text id="engrave-${escapeXml(object.id)}" x="${object.x}" y="${object.y}" fill="${ENGRAVE_FILL}" stroke="none" font-family="Arial, Helvetica, sans-serif" font-size="${object.fontSize}" font-weight="600" text-anchor="${textAnchor(object.align)}">${tspans}</text>`;
}

export function serializeProductionSvg(
  plate: Pick<StoredPlate, "widthMm" | "heightMm" | "colourLabel" | "adhesive3m" | "objects">
) {
  const texts = plate.objects.map((object) => serializeText(object)).join("\n    ");
  const material = plate.colourLabel
    ? `${plate.colourLabel}${plate.adhesive3m ? " · 3M adhesive" : ""}`
    : "unspecified laminate";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${plate.widthMm}mm" height="${plate.heightMm}mm" viewBox="0 0 ${plate.widthMm} ${plate.heightMm}">
  <!-- TraffLabels production file. 1 user unit = 1 mm. Document size is the ordered plate. -->
  <!-- LightBurn: if import asks for SVG DPI, use ${LIGHTBURN_SVG_DPI} (Silhouette used 96 DPI). -->
  <!-- Black fill ${ENGRAVE_FILL} = engrave (text). Red stroke ${CUT_STROKE} = outer cut line. -->
  <!-- Laminate (not a laser colour): ${escapeXml(material)} -->
  <g id="engrave" data-layer="engrave">
    ${texts}
  </g>
  <g id="cut" data-layer="cut">
    <rect x="0" y="0" width="${plate.widthMm}" height="${plate.heightMm}" fill="none" stroke="${CUT_STROKE}" stroke-width="0.1"/>
  </g>
</svg>
`;
}

export function plateFileSlug(text: string) {
  const first = text.split("\n")[0] ?? "";
  const slug = first
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "plate";
}

export type ProductionFile = {
  filename: string;
  svg: string;
};

/** One SVG per physical plate (qty is duplicated) so each cut file is exact W×H mm. */
export function productionFiles(orderNumber: number, plates: StoredPlate[]): ProductionFile[] {
  const files: ProductionFile[] = [];
  plates.forEach((plate, lineIndex) => {
    const svg = serializeProductionSvg(plate);
    const slug = plateFileSlug(plate.text);
    const copies = Math.max(1, plate.qty);
    for (let copy = 1; copy <= copies; copy += 1) {
      const multi = plates.length > 1 || plate.qty > 1;
      const suffix = multi ? `-L${lineIndex + 1}-${copy}of${plate.qty}` : "";
      files.push({
        filename: `trafflabels-${orderNumber}${suffix}-${slug}.svg`,
        svg,
      });
    }
  });
  return files;
}

export function productionDownloadKind(plates: Array<{ qty: number }>): "svg" | "zip" {
  const copies = plates.reduce((sum, plate) => sum + Math.max(1, plate.qty), 0);
  return copies <= 1 ? "svg" : "zip";
}
