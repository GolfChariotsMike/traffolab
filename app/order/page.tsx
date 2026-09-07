import type { Metadata } from "next";
import dynamic from "next/dynamic";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { absoluteUrl, productName, routes } from "@/lib/site";
import Link from "next/link";

const LabelDesigner = dynamic(
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

export const metadata: Metadata = {
  title: `Plate designer | Order Traffolyte labels | ${productName}`,
  description:
    "Design a Traffolyte plate in the browser — size, colour pair, and engraved text. Export SVG for LightBurn or add the job to a TraffLabels order draft.",
  alternates: { canonical: absoluteUrl(routes.order) },
};

export default function OrderPage() {
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
                <BreadcrumbPage className="text-primary-foreground">
                  Order
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <p className="font-mono text-[11px] tracking-[0.18em] text-signal uppercase">
            {productName}
          </p>
          <h1 className="max-w-3xl font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            Design a Traffolyte plate
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-primary-foreground/75 md:text-base">
            Set the size and colour pair, add a legend, and export a LightBurn-ready
            SVG. Add the plate to an order draft in this browser — checkout is the
            next step. Identification plates only; {productName} does not claim
            AS/NZS certification of the labels.
          </p>
        </div>
      </section>

      <LabelDesigner />
    </>
  );
}
