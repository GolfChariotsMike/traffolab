"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CsvUploadLoader } from "@/components/order/csv-upload-loader";
import { OrderChooser } from "@/components/order/order-chooser";
import { OrderSummaryLoader } from "@/components/order/order-summary-loader";
import { LabelDesignerLoader } from "@/components/designer/designer-loader";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { productName, routes } from "@/lib/site";

const COPY = {
  chooser: {
    title: "Order Traffolyte labels",
    lede: "Design a plate in the browser, or upload a CSV of many legends. Prices are in AUD. Add lines to an order draft in this browser, then review Australia-wide shipping. Identification plates only; TraffLabels does not claim AS/NZS certification of the labels.",
  },
  designer: {
    title: "Design a Traffolyte plate",
    lede: "Set the size and colour pair, add a legend, and export a LightBurn-ready SVG. The plate price updates with the size. Add it to an order draft in this browser, then review shipping. Identification plates only; TraffLabels does not claim AS/NZS certification of the labels.",
  },
  upload: {
    title: "Upload a label list",
    lede: "Download the TraffLabels CSV template, or map columns from your own schedule. Width and height are separate millimetre columns — any positive size, not a preset. Valid rows are priced in AUD and become the same order-draft lines as the designer.",
  },
  checkout: {
    title: "Order summary",
    lede: "Check each plate, choose Australia-wide shipping, and confirm the AUD total. Card payment is not connected yet — this summary is the amount TraffLabels checkout will charge.",
  },
} as const;

export function OrderEntry() {
  const searchParams = useSearchParams();
  const rawMode = searchParams.get("mode");
  const mode =
    rawMode === "designer" || rawMode === "upload" || rawMode === "checkout"
      ? rawMode
      : "chooser";
  const copy = COPY[mode];

  return (
    <>
      <section className="border-b bg-ink text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 md:py-10">
          <Breadcrumb>
            <BreadcrumbList className="text-primary-foreground/55">
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={routes.home} className="hover:text-primary-foreground">
                    Home
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {mode === "chooser" ? (
                  <BreadcrumbPage className="text-primary-foreground">
                    Order
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={routes.order} className="hover:text-primary-foreground">
                      Order
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {mode !== "chooser" ? (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-primary-foreground">
                      {mode === "designer"
                        ? "Design online"
                        : mode === "upload"
                          ? "Upload a list"
                          : "Summary"}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              ) : null}
            </BreadcrumbList>
          </Breadcrumb>
          {mode !== "chooser" ? (
            <Link
              href={routes.order}
              className="w-fit font-mono text-[11px] tracking-[0.14em] text-signal uppercase hover:text-signal/80"
            >
              ← All order options
            </Link>
          ) : null}
          <p className="font-mono text-[11px] tracking-[0.18em] text-signal uppercase">
            {productName}
          </p>
          <h1 className="max-w-3xl font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            {copy.title}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-primary-foreground/75 md:text-base">
            {copy.lede}
          </p>
        </div>
      </section>

      {mode === "designer" ? (
        <LabelDesignerLoader />
      ) : mode === "upload" ? (
        <CsvUploadLoader />
      ) : mode === "checkout" ? (
        <OrderSummaryLoader />
      ) : (
        <OrderChooser />
      )}
    </>
  );
}
