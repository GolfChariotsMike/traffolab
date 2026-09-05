import type { Metadata } from "next";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CtaBand } from "@/components/cta-band";
import { LaminatePlate } from "@/components/laminate-plate";
import { PageHero } from "@/components/page-hero";
import { RelatedLinks } from "@/components/related-links";
import { Section, SectionHeading } from "@/components/section";
import { absoluteUrl, routes } from "@/lib/site";

export const metadata: Metadata = {
  title: "What is Traffolyte? Engraving Laminate Explained | TraffLabels",
  description:
    "Traffolyte is multi-layer engraving laminate. The laser removes the top colour so text is the core — used for switchboard, circuit ID, and industrial tags in Perth.",
  alternates: { canonical: absoluteUrl(routes.whatIs) },
};

export default function WhatIsTraffolytePage() {
  return (
    <>
      <PageHero
        eyebrow="Material"
        title="What is Traffolyte?"
        lede="Traffolyte is a trade name people still use for multi-layer engraving laminate. Two (or more) coloured sheets are bonded. A laser or rotary engraver removes the face so the core colour becomes the lettering. The text is the material — not a print sitting on top."
        crumbs={[{ label: "What is Traffolyte" }]}
      />

      <Section>
        <div className="grid gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:items-start">
          <div className="flex flex-col gap-4">
            <SectionHeading
              eyebrow="How it is built"
              title="A face colour over a contrasting core"
            >
              Typical stock is two-layer: a thin cap over a thicker core. The
              machine ablates the cap in the shape of your legend. Edges can be
              cut to size in the same pass. That is why Traffolyte survives heat
              and solvents that lift vinyl.
            </SectionHeading>
            <p className="text-muted-foreground">
              TraffLabels nests each order as SVG for LightBurn, then engraves in
              WA. You are buying a cut plate, not a sticker run.
            </p>
          </div>
          <LaminatePlate
            legend="Circuit 14"
            caption="Face removed, core showing — that is the engraving."
          />
        </div>
      </Section>

      <Section className="pt-0">
        <SectionHeading eyebrow="Uses" title="Where trades still specify it" />
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Switchboards</CardTitle>
              <CardDescription>
                Circuit IDs, main switches, and isolators that need to stay
                readable on a hot board. See{" "}
                <a href={routes.switchboard}>switchboard labels</a>.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Plant and machinery</CardTitle>
              <CardDescription>
                Asset numbers, valve tags, and warning legends that get wiped
                down with solvents.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Workshops and yards</CardTitle>
              <CardDescription>
                Rack labels, trailer plates, and custom legends that vinyl will
                not survive outdoors.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </Section>

      <Section className="pt-0">
        <SectionHeading
          eyebrow="Colours"
          title="Standard pairs electricians recognise"
        >
          We stock the pairs boards already use. Custom cores are possible once
          the designer is live; unusual colours may add lead time.
        </SectionHeading>
        <div className="grid gap-4 sm:grid-cols-3">
          <LaminatePlate
            legend="Main switch"
            palette="yellow-black"
            caption="Yellow / black"
          />
          <LaminatePlate
            legend="Neutral bar"
            palette="black-white"
            caption="Black / white"
          />
          <LaminatePlate
            legend="Emergency stop"
            palette="red-white"
            caption="Red / white"
          />
        </div>
      </Section>

      <Section className="pt-0">
        <SectionHeading
          eyebrow="Versus stickers"
          title="Ink sits on vinyl. Traffolyte is the sheet."
        >
          Printed vinyl fades, edges lift, and adhesive fails on warm metal.
          Engraving laminate is a solid plate. If a job only needs a temporary
          mark, vinyl is cheaper. If the legend has to last on a switchboard or
          plant, specify Traffolyte.
        </SectionHeading>
      </Section>

      <Section className="pt-0">
        <SectionHeading
          eyebrow="Keep reading"
          title="From material to a Perth order"
        />
        <RelatedLinks
          links={[
            {
              href: routes.hub,
              title: "Traffolyte labels Perth",
              description:
                "Order custom labels online — engraved in WA, posted Australia-wide.",
            },
            {
              href: routes.switchboard,
              title: "Switchboard labels",
              description:
                "Circuit IDs and isolator legends for Perth electrical trades.",
            },
            {
              href: routes.malaga,
              title: "Malaga production belt",
              description:
                "WA engraving for the northern light-industrial suburbs.",
            },
          ]}
        />
      </Section>

      <CtaBand
        title="Order Traffolyte in Perth"
        body="Same material, specified online, nested for the laser, engraved in WA."
        primary={{ href: routes.hub, label: "Perth labels hub" }}
        secondary={{ href: routes.order, label: "Designer coming soon" }}
      />
    </>
  );
}
