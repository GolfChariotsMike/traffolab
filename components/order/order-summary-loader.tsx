"use client";

import dynamic from "next/dynamic";

export const OrderSummaryLoader = dynamic(
  () =>
    import("@/components/order/order-summary").then((module) => module.OrderSummary),
  {
    ssr: false,
    loading: () => (
      <section className="trafflabels-designer min-h-[420px] border-t border-white/10">
        <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-paper/55">
          Loading TraffLabels order summary…
        </div>
      </section>
    ),
  }
);
