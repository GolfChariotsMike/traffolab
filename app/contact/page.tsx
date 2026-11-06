import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { JsonLd } from "@/components/json-ld";
import { contactTitle } from "@/lib/seo-copy";
import { absoluteUrl, productName, routes } from "@/lib/site";
import {
  breadcrumbNode,
  organizationNode,
  webPageNode,
  websiteNode,
} from "@/lib/structured-data";

const description =
  "Send TraffLabels a job by email. Attach a CSV, spreadsheet, PDF, or photo, or type the legend.";

export const metadata: Metadata = {
  title: contactTitle,
  description,
  alternates: { canonical: absoluteUrl(routes.contact) },
};

export default function ContactPage() {
  return (
    <>
      <JsonLd
        data={[
          organizationNode(),
          websiteNode(),
          webPageNode({
            type: "ContactPage",
            name: contactTitle,
            description,
            path: routes.contact,
          }),
          breadcrumbNode([
            { name: "Home", path: routes.home },
            { name: "Contact", path: routes.contact },
          ]),
        ]}
      />
      <PageHero
        eyebrow={productName}
        title="Contact us"
        lede="Attach a schedule, spreadsheet, PDF, or photo, or type the job. TraffLabels engraves Traffolyte labels in WA."
        crumbs={[{ label: "Contact" }]}
      />
      <Section>
        <ContactForm />
      </Section>
    </>
  );
}
