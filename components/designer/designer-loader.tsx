"use client";

import dynamic from "next/dynamic";

export const LabelDesignerLoader = dynamic(
  () =>
    import("@/components/designer/label-designer").then(
      (module) => module.LabelDesigner
    ),
  {
    ssr: false,
    loading: () => (
      <section className="trafflabels-designer min-h-[560px] border-t border-white/10">
        <div className="mx-auto max-w-[1440px] px-4 py-10 text-sm text-paper/55">
          Loading TraffLabels designer…
        </div>
      </section>
    ),
  }
);
