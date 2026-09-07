"use client";

import dynamic from "next/dynamic";

export const CsvUploadLoader = dynamic(
  () => import("@/components/order/csv-upload").then((module) => module.CsvUpload),
  {
    ssr: false,
    loading: () => (
      <section className="trafflabels-designer min-h-[420px] border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-paper/55">
          Loading TraffLabels upload…
        </div>
      </section>
    ),
  }
);
