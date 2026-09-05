import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LaminatePlate } from "@/components/laminate-plate";
import { Section, SectionHeading } from "@/components/section";
import { absoluteUrl, routes, siteName } from "@/lib/site";

export const metadata: Metadata = {
  title: `${siteName} | Traffolyte Labels for Perth Trades & Custom Work`,
  description:
    "Hybrid trade and personalise paths for Traffolyte labels in Perth. Circuit IDs for electricians, or a custom legend — engraved in WA by the Stik Stickers group.",
  alternates: { canonical: absoluteUrl(routes.home) },
};

const steps = [
  {
    step: "01",
    title: "Design",
    body: "Specify legends, sizes, and colours in the online designer (coming soon) — or start from a trade schedule.",
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
      <section className="border-b bg-ink text-primary-foreground">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] md:items-center md:py-20">
          <div className="flex flex-col gap-6">
            <p className="font-mono text-[11px] tracking-[0.18em] text-signal uppercase">
              {siteName} · Perth · Stik Stickers group
            </p>
            <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance md:text-5xl">
              Engraved Traffolyte labels for Perth trades and custom work
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-primary-foreground/75 md:text-lg">
              Permanent two-colour laminate — not vinyl. Trade crews order
              circuit IDs and isolator legends. Everyone else can personalise a
              one-off plate. Design online when the designer ships; we nest the
              job for the laser and engrave in WA.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-11 px-4">
                <Link href={routes.hub}>
                  Trade labels
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-11 border-primary-foreground/20 bg-transparent px-4 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <Link href={routes.order}>Personalise a label</Link>
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <LaminatePlate
              legend="Main switch"
              caption="Top layer stays. Laser removes the face so the text is the material."
              className="[&_figcaption]:text-primary-foreground/55"
            />
            <LaminatePlate
              legend="PV isolator"
              palette="red-white"
              caption="Typical switchboard colours — black/white, red/white, yellow/black."
              className="[&_figcaption]:text-primary-foreground/55"
            />
          </div>
        </div>
      </section>

      <Section>
        <SectionHeading
          eyebrow="Two paths"
          title="Trade or personalise — same WA laser"
        >
          Start where the job is. Both routes end at engraved Traffolyte, nested
          for LightBurn and produced under the Stik Stickers group in Perth.
        </SectionHeading>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                Trade
              </p>
              <CardTitle>Circuit IDs, isolators, schedules</CardTitle>
              <CardDescription>
                Electricians, switchboard builders, solar, and maintenance
                crews. See Perth Traffolyte labels or go straight to switchboard
                work.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={routes.hub}>Perth labels hub</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={routes.switchboard}>Switchboard labels</Link>
              </Button>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader>
              <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                Personalise
              </p>
              <CardTitle>A warmer path for one-off legends</CardTitle>
              <CardDescription>
                Workshop tags, plant names, trailer plates, or a single custom
                legend. The designer is a stub for now — leave the intent and we
                will open the tool when it is ready.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button asChild variant="outline">
                <Link href={routes.order}>Personalise — designer soon</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </Section>

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
