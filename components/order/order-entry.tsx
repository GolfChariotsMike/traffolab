"use client";

import { CsvUploadLoader } from "@/components/order/csv-upload-loader";
import { OrderChooser } from "@/components/order/order-chooser";
import { OrderSummaryLoader } from "@/components/order/order-summary-loader";
import { LabelDesignerLoader } from "@/components/designer/designer-loader";
import type { OrderMode } from "@/lib/order-mode";

export function OrderEntry({ mode }: { mode: OrderMode }) {
  if (mode === "designer") return <LabelDesignerLoader />;
  if (mode === "upload") return <CsvUploadLoader />;
  if (mode === "checkout") return <OrderSummaryLoader />;
  return <OrderChooser />;
}
