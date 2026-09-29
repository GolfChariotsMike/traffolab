import { productionDownloadKind, productionFiles } from "@/lib/production-svg";
import type { StoredPlate } from "@/lib/orders";
import { zipStore } from "@/lib/zip";

export function buildProductionDownload(orderNumber: number, plates: StoredPlate[]) {
  const files = productionFiles(orderNumber, plates);
  if (files.length === 0) return null;
  if (productionDownloadKind(plates) === "svg") {
    return {
      filename: files[0].filename,
      contentType: "image/svg+xml; charset=utf-8",
      body: new TextEncoder().encode(files[0].svg),
    };
  }
  return {
    filename: `trafflabels-order-${orderNumber}.zip`,
    contentType: "application/zip",
    body: zipStore(
      files.map((file) => ({
        name: file.filename,
        data: new TextEncoder().encode(file.svg),
      }))
    ),
  };
}
