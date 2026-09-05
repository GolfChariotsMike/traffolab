import type { Metadata } from "next";
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
  title: "Switchboard Labels Perth | Engraved Circuit IDs | TraffLabels",
  description:
    "Engraved Traffolyte switchboard labels for Perth trades — circuit IDs, main switches, and isolators. Order a single legend or a full schedule. Designer coming soon.",
  alternates: { canonical: absoluteUrl(routes.switchboard) },
};

export default function SwitchboardLabelsPage() {
  return (
    <>
      <PageHero
        eyebrow="Electrical"
        title="Switchboard labels for Perth trades"
        lede="Engraved circuit IDs, main-switch plates, and isolator legends for Perth electricians and switchboard builders. Order a single replacement or a full schedule. Traffolyte stays readable on a warm board where vinyl lifts."
        crumbs={[{ label: "Switchboard labels" }]}
      />

      <Section>
        <SectionHeading
          eyebrow="What to specify"
          title="Singles or a whole schedule"
        >
          Send a circuit list, a marked-up photo, or wait for the online
          designer. We nest the job as SVG for LightBurn and engrave in WA.
        </SectionHeading>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Circuit IDs</CardTitle>
              <CardDescription>
                Numbered or named ways that match the schedule the electrician
                hangs in the door.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Main switch &amp; isolators</CardTitle>
              <CardDescription>
                High-contrast legends for main switches, PV isolators, and
                mechanical services isolators.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>AS/NZS 3000 boards</CardTitle>
              <CardDescription>
                Labels support the clear identification electricians use on
                AS/NZS 3000 switchboards. We do not claim the labels themselves
                are AS/NZS certified.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </Section>

      <Section className="pt-0">
        <SectionHeading eyebrow="FAQ" title="Ordering a board set" />
        <FaqList
          items={[
            {
              question: "Can I order one replacement legend?",
              answer: (
                <p>
                  Yes. No minimum order — a single burnt or missing ID is a
                  normal job.
                </p>
              ),
            },
            {
              question: "Do you certify boards to AS/NZS 3000?",
              answer: (
                <p>
                  No. TraffLabels engraves identification labels that electricians
                  use so AS/NZS 3000 boards stay clearly marked. Certification
                  of the installation sits with the licensed electrician.
                </p>
              ),
            },
            {
              question: "Where is the work done?",
              answer: (
                <p>
                  Perth / WA, under the Stik Stickers group. See the{" "}
                  <a href={routes.hub}>Perth Traffolyte hub</a> for production
                  and shipping.
                </p>
              ),
            },
          ]}
        />
      </Section>

      <Section className="pt-0">
        <SectionHeading
          eyebrow="Related"
          title="Material, suburbs, and the hub"
        />
        <RelatedLinks
          links={[
            {
              href: routes.hub,
              title: "Traffolyte labels Perth",
              description: "Hub for trade orders, turnaround, and WA production.",
            },
            {
              href: routes.whatIs,
              title: "What is Traffolyte?",
              description: "Why engraving laminate is specified instead of vinyl.",
            },
            {
              href: routes.malaga,
              title: "Malaga",
              description: "Northern light-industrial delivery.",
            },
            {
              href: routes.wangara,
              title: "Wangara",
              description: "Industrial-estate turnaround.",
            },
            {
              href: routes.welshpool,
              title: "Welshpool",
              description: "Welshpool–Kewdale corridor.",
            },
          ]}
        />
      </Section>

      <CtaBand
        title="Specify a switchboard job"
        body="The designer is a stub for now. Start an order and we will take the schedule, or read the Perth hub first."
        primary={{ href: routes.order, label: "Order — designer soon" }}
        secondary={{ href: routes.hub, label: "Perth labels hub" }}
      />
    </>
  );
}
