import type { Metadata } from "next";
import { CtaBand } from "@/components/cta-band";
import { FaqList, type FaqItem } from "@/components/faq-list";
import { PageHero } from "@/components/page-hero";
import { RelatedLinks, type RelatedLink } from "@/components/related-links";
import { Section, SectionHeading } from "@/components/section";
import { absoluteUrl, routes } from "@/lib/site";

export type SuburbContent = {
  name: string;
  path: string;
  intro: string;
  bodyTitle: string;
  body: string;
  nearbyTitle: string;
  nearbyLinks: RelatedLink[];
  faq: FaqItem[];
};

export function suburbMetadata(suburb: SuburbContent): Metadata {
  return {
    title: `Traffolyte Labels ${suburb.name} | Order Online | TraffoLab`,
    description: suburb.intro,
    alternates: { canonical: absoluteUrl(suburb.path) },
  };
}

export function SuburbPage({ suburb }: { suburb: SuburbContent }) {
  return (
    <>
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
        body="Design online when the designer ships. Until then, start from the Perth hub or the order stub."
        primary={{ href: routes.order, label: "Designer coming soon" }}
        secondary={{ href: routes.hub, label: "Perth labels hub" }}
      />
    </>
  );
}
