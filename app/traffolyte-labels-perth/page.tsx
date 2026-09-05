import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CtaBand } from "@/components/cta-band";
import { FaqList } from "@/components/faq-list";
import { PageHero } from "@/components/page-hero";
import { RelatedLinks } from "@/components/related-links";
import { Section, SectionHeading } from "@/components/section";
import { absoluteUrl, routes } from "@/lib/site";

export const metadata: Metadata = {
  title: "Traffolyte Labels Perth | Design Online, Engraved in WA | TraffLabels",
  description:
    "Order custom Traffolyte labels in Perth — switchboard, circuit ID, and industrial tags. Design online, engraved in WA, Australia-wide shipping. Same-week turnaround target.",
  alternates: { canonical: absoluteUrl(routes.hub) },
};

export default function PerthHubPage() {
  return (
    <>
      <PageHero
        eyebrow="Perth · Western Australia"
        title="Traffolyte labels in Perth — ordered online, engraved in WA"
        lede="Need permanent engraved labels that won’t peel off a hot switchboard? TraffLabels makes Traffolyte (engraving laminate) labels for Perth trades and businesses — circuit IDs, main switches, isolators, plant tags, and custom legends. Design online, we nest the job for the laser, and ship across WA and Australia."
        crumbs={[{ label: "Traffolyte labels Perth" }]}
      />

      <Section>
        <SectionHeading
          eyebrow="Why Traffolyte"
          title="Stickers fade. The text is the material."
        >
          Traffolyte is two-colour engraving laminate. The laser removes the top
          layer so the lettering is the core — not ink sitting on vinyl.
        </SectionHeading>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Won’t peel on a hot board</CardTitle>
              <CardDescription>
                Engraved laminate stays put on switchboards and plant that cook
                vinyl and paper labels off.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Two-colour, through the sheet</CardTitle>
              <CardDescription>
                Face colour over a contrasting core. Common pairs: black/white,
                red/white, yellow/black.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Not vinyl</CardTitle>
              <CardDescription>
                This is engraving laminate, not a printed sticker. If you need
                vinyl, that is a different product.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </Section>

      <Section className="pt-0">
        <SectionHeading
          eyebrow="Who orders"
          title="Trades and plants along the industrial belt"
        >
          Electricians, switchboard builders, solar, maintenance, and factories
          — especially the Malaga, Wangara, Welshpool, and Kewdale belt.
        </SectionHeading>
        <RelatedLinks
          links={[
            {
              href: routes.switchboard,
              title: "Switchboard labels",
              description:
                "Circuit IDs, main switches, and isolator legends — singles or a full schedule.",
            },
            {
              href: routes.whatIs,
              title: "What is Traffolyte?",
              description:
                "Multi-layer engraving laminate explained: uses, colours, and why it beats stickers.",
            },
            {
              href: routes.malaga,
              title: "Malaga",
              description:
                "Light-industrial hub — workshops, warehouses, and electrical contractors.",
            },
            {
              href: routes.wangara,
              title: "Wangara",
              description:
                "Northern industrial estates with a same-week WA production target.",
            },
            {
              href: routes.welshpool,
              title: "Welshpool",
              description:
                "Welshpool–Kewdale logistics corridor and metro plant rooms.",
            },
          ]}
        />
      </Section>

      <Section className="pt-0">
        <SectionHeading
          eyebrow="How it works"
          title="Design → checkout → nest / engrave → pickup or post"
        >
          You specify the legend online. We nest the job as SVG for LightBurn,
          engrave in WA, then you collect in Perth or we post Australia-wide.
        </SectionHeading>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Labels support the clear identification electricians use on{" "}
          <span className="text-foreground">AS/NZS 3000</span> boards. TraffLabels
          does not claim AS/NZS certification of the labels.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={routes.order}>Start an order</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={routes.switchboard}>Switchboard labels</Link>
          </Button>
        </div>
      </Section>

      <Section className="pt-0">
        <SectionHeading eyebrow="FAQ" title="Perth production, plain answers" />
        <FaqList
          items={[
            {
              question: "Where are TraffLabels labels made?",
              answer: (
                <p>
                  WA production under the Stik Stickers group. Jobs are nested
                  and laser-engraved in Perth, then posted across WA and
                  Australia.
                </p>
              ),
            },
            {
              question: "How fast can I get labels?",
              answer: (
                <p>
                  Same-week turnaround is the target for standard legends once
                  the job is in the nest. Complex schedules or unusual colours
                  can take longer.
                </p>
              ),
            },
            {
              question: "Is there a minimum order?",
              answer: (
                <p>
                  No minimum order. Order a single isolator legend or a full
                  switchboard schedule.
                </p>
              ),
            },
            {
              question: "Are these vinyl stickers?",
              answer: (
                <p>
                  No. Traffolyte is engraving laminate — two-colour sheet the
                  laser cuts through. It is not printed vinyl.
                </p>
              ),
            },
          ]}
        />
      </Section>

      <CtaBand
        title="Ready to specify a legend?"
        body="The online designer is coming soon. Trade jobs can start from the switchboard page; one-off personalise jobs can wait on the stub."
        primary={{ href: routes.order, label: "Designer coming soon" }}
        secondary={{ href: routes.switchboard, label: "Switchboard labels" }}
      />
    </>
  );
}
