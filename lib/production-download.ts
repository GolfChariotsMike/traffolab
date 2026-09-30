import type { StoredPlate } from "@/lib/orders";
import { productionFiles } from "@/lib/production-svg";
import {
  formatNestSummary,
  nestPlates,
  nestSheetFilename,
  serializeNestSheetSvg,
} from "@/lib/sheet-nest";
import { zipStore } from "@/lib/zip";

export function buildProductionDownload(orderNumber: number, plates: StoredPlate[]) {
  const pieces = productionFiles(orderNumber, plates);
  if (pieces.length === 0) return null;
  const plan = nestPlates(plates);
  const encoder = new TextEncoder();
  return {
    filename: `trafflabels-order-${orderNumber}.zip`,
    contentType: "application/zip",
    body: zipStore([
      {
        name: "nest-summary.txt",
        data: encoder.encode(formatNestSummary(orderNumber, plan)),
      },
      ...plan.sheets.map((sheet) => ({
        name: `sheets/${nestSheetFilename(orderNumber, sheet)}`,
        data: encoder.encode(serializeNestSheetSvg(orderNumber, sheet)),
      })),
      ...pieces.map((file) => ({
        name: `pieces/${file.filename}`,
        data: encoder.encode(file.svg),
      })),
    ]),
  };
}
