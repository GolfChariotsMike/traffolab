import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { EngravingScrub } from "@/components/engraving-scrub";
import { HomeHero } from "@/components/home-hero";
import { Section, SectionHeading } from "@/components/section";
import { UseCases } from "@/components/use-cases";
import { absoluteUrl, routes, siteName } from "@/lib/site";

export const metadata: Metadata = {
  title: `${siteName} | Traffolyte Labels for Perth Trades & Custom Work`,
  description:
    "Traffolyte labels for Perth trades. Upload a schedule, design a plate online, or contact TraffLabels. Engraved in WA by the Stik Stickers group.",
  alternates: { canonical: absoluteUrl(routes.home) },
};

const steps = [
  {
    step: "01",
    title: "Design",
    body: "Specify legends, sizes, and colours in the TraffLabels designer — or upload a CSV schedule.",
  },
  {
    step: "02",
    title: "Checkout",
    body: "Pay for the job. No minimum order. Singles and full switchboard sets are both welcome.",
  },
  {
    step: "03",
    title: "Nest / engrave",
    body: "We nest the artwork as SVG for LightBurn, then laser-engrave Traffolyte laminate in WA.",
  },
  {
    step: "04",
    title: "Pickup / post",
    body: "Collect in Perth or we post across WA and Australia. Same-week turnaround is the target.",
  },
];

export default function HomePage() {
  return (
    <>
      <HomeHero />
      <EngravingScrub />
      <UseCases />

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-12 md:grid-cols-3 md:py-16">
        <article className="flex flex-col border border-border bg-card p-6">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Bulk
          </h2>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
            Send a schedule of circuit IDs, isolators, and other legends.
            Colour, width, height, text, and qty become order-draft lines.
          </p>
          <Button
            asChild
            className="mt-6 h-12 rounded-none bg-laser px-4 text-base font-semibold text-charcoal hover:bg-laser/90"
          >
            <Link href={routes.orderUpload}>Upload CSV or Excel File</Link>
          </Button>
        </article>
        <article className="flex flex-col border border-border bg-card p-6">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Open Designer
          </h2>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
            Lay out one plate in the browser — size, colour pair, and legend —
            and export SVG for the laser.
          </p>
          <Button
            asChild
            className="mt-6 h-12 rounded-none bg-laser px-4 text-base font-semibold text-charcoal hover:bg-laser/90"
          >
            <Link href={routes.orderDesigner}>Open Designer</Link>
          </Button>
        </article>
        <article className="flex flex-col border border-border bg-card p-6">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Contact Us
          </h2>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
            Skip the spreadsheet. Send the legends in a message and we will
            take the job from there.
          </p>
          <Button
            asChild
            className="mt-6 h-12 rounded-none bg-laser px-4 text-base font-semibold text-charcoal hover:bg-laser/90"
          >
            <Link href={routes.contact}>Contact Us</Link>
          </Button>
        </article>
      </section>

      <Section className="pt-0">
        <SectionHeading
          eyebrow="How a job runs"
          title="Design → checkout → nest / engrave → pickup or post"
        >
          Online design becomes SVG ops for LightBurn. You specify the legend;
          we nest the sheet and cut on the laser in WA.
        </SectionHeading>
        <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((item) => (
            <li key={item.step} className="flex flex-col gap-2 border-t pt-4">
              <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground">
                {item.step}
              </p>
              <h3 className="font-heading text-lg font-medium">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ol>
      </Section>
    </>
  );
}
