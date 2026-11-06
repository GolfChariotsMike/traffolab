import type { Metadata } from "next";
import { Suspense } from "react";
import { JsonLd } from "@/components/json-ld";
import { OrderEntry } from "@/components/order/order-entry";
import { ORDER_COPY, OrderIntro } from "@/components/order/order-intro";
import { orderMode, type OrderMode } from "@/lib/order-mode";
import { absoluteUrl, productName, routes } from "@/lib/site";
import { breadcrumbNode, webPageNode, websiteNode } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: `Order Traffolyte labels | ${productName}`,
  description:
    "Design a Traffolyte plate in the browser, or upload a CSV of many legends. Export SVG for LightBurn or add the job to a TraffLabels order draft.",
  alternates: { canonical: absoluteUrl(routes.order) },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function orderPath(mode: OrderMode) {
  if (mode === "designer") return routes.orderDesigner;
  if (mode === "upload") return routes.orderUpload;
  if (mode === "checkout") return routes.orderCheckout;
  return routes.order;
}

function orderCrumbs(mode: OrderMode): { name: string; path: string }[] {
  const crumbs: { name: string; path: string }[] = [
    { name: "Home", path: routes.home },
    { name: "Order", path: routes.order },
  ];
  if (mode === "designer") {
    crumbs.push({ name: "Design online", path: routes.orderDesigner });
  } else if (mode === "upload") {
    crumbs.push({ name: "Upload a list", path: routes.orderUpload });
  } else if (mode === "checkout") {
    crumbs.push({ name: "Summary", path: routes.orderCheckout });
  }
  return crumbs;
}

export default async function OrderPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const mode = orderMode(firstParam((await searchParams).mode));
  const copy = ORDER_COPY[mode];

  return (
    <>
      <JsonLd
        data={[
          websiteNode(),
          webPageNode({
            name: copy.title,
            description: copy.lede,
            path: orderPath(mode),
          }),
          breadcrumbNode(orderCrumbs(mode)),
        ]}
      />
      <OrderIntro mode={mode} />
      <Suspense
        fallback={
          <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted-foreground">
            Loading order options…
          </div>
        }
      >
        <OrderEntry mode={mode} />
      </Suspense>
    </>
  );
}
