import type { Metadata } from "next";
import { CtaBand } from "@/components/cta-band";
import { FaqList } from "@/components/faq-list";
import { PageHero } from "@/components/page-hero";
import { RelatedLinks, type RelatedLink } from "@/components/related-links";
import { Section, SectionHeading } from "@/components/section";
import { JsonLd } from "@/components/json-ld";
import { faqAnswerText, type FaqItem } from "@/lib/faq";
import { routes, withCanonical } from "@/lib/site";
import { breadcrumbNode, faqPageNode, serviceNode } from "@/lib/structured-data";

export type SuburbContent = {
  name: string;
  path: string;
  intro: string;
  description: string;
  bodyTitle: string;
  body: string;
  nearbyTitle: string;
  nearbyLinks: RelatedLink[];
  faq: FaqItem[];
};

export function suburbMetadata(suburb: SuburbContent): Metadata {
  return withCanonical(suburb.path, {
    title: `Traffolyte Labels ${suburb.name} | Order Online | TraffLabels`,
    description: suburb.description,
  });
}

export function SuburbPage({ suburb }: { suburb: SuburbContent }) {
  return (
    <>
      <JsonLd
        data={[
          serviceNode({
            name: `Traffolyte labels in ${suburb.name}`,
            description: suburb.description,
            path: suburb.path,
            areaName: suburb.name,
          }),
          breadcrumbNode([
            { name: "Home", path: routes.home },
            { name: "Perth labels", path: routes.hub },
            { name: suburb.name, path: suburb.path },
          ]),
          faqPageNode(
            suburb.faq.map((item) => ({
              question: item.question,
              answer: faqAnswerText(item.answer),
            })),
          ),
        ]}
      />
      <PageHero
        eyebrow={`${suburb.name} · Perth industrial belt`}
        title={`Traffolyte labels in ${suburb.name}`}
        lede={suburb.intro}
        crumbs={[
          { href: routes.hub, label: "Perth labels" },
          { label: suburb.name },
        ]}
      />

      <Section>
        <SectionHeading title={suburb.bodyTitle}>{suburb.body}</SectionHeading>
      </Section>

      <Section className="pt-0">
        <SectionHeading eyebrow="Nearby" title={suburb.nearbyTitle} />
        <RelatedLinks links={suburb.nearbyLinks} />
      </Section>

      <Section className="pt-0">
        <SectionHeading
          eyebrow="FAQ"
          title={`${suburb.name} orders and delivery`}
        />
        <FaqList items={suburb.faq} />
      </Section>

      <CtaBand
        title={`Order Traffolyte for ${suburb.name}`}
        body="Design a plate in the TraffLabels designer, or start from the Perth hub."
        primary={{ href: routes.orderDesigner, label: "Open the designer" }}
        secondary={{ href: routes.hub, label: "Perth labels hub" }}
      />
    </>
  );
}
