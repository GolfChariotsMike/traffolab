import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderEntry } from "@/components/order/order-entry";
import { absoluteUrl, productName, routes } from "@/lib/site";

export const metadata: Metadata = {
  title: `Order Traffolyte labels | ${productName}`,
  description:
    "Design a Traffolyte plate in the browser, or upload a CSV of many legends. Export SVG for LightBurn or add the job to a TraffLabels order draft.",
  alternates: { canonical: absoluteUrl(routes.order) },
};

export default function OrderPage() {
  return (
    <Suspense
      fallback={
        <section className="border-b bg-ink text-primary-foreground">
          <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-primary-foreground/70">
            Loading order options…
          </div>
        </section>
      }
    >
      <OrderEntry />
    </Suspense>
  );
}
