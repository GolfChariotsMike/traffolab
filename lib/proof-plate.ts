/**
 * Customer proof drawing. Engrave positions come from the production serializer
 * so the approved legend is the one the cut file uses. The face is white
 * Traffolyte with black engraving — not the red laser stroke.
 */

import { serializeEngraveText } from "@/lib/production-svg";
import type { StoredPlate } from "@/lib/orders";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function proofPlateSvg(plate: Pick<StoredPlate, "widthMm" | "heightMm" | "text" | "objects">) {
  const label = plate.text.replace(/\s+/g, " ").trim() || "Plate";
  const texts = plate.objects
    .map((object) => serializeEngraveText(object, "", plate))
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${plate.widthMm} ${plate.heightMm}" role="img" aria-label="${escapeXml(label)}"><rect x="0" y="0" width="${plate.widthMm}" height="${plate.heightMm}" fill="#FFFFFF" stroke="#C5C8CE" stroke-width="0.2"/>${texts}</svg>`;
}
