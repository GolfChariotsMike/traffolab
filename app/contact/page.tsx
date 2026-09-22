import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { absoluteUrl, productName, routes } from "@/lib/site";

export const metadata: Metadata = {
  title: `Contact | ${productName}`,
  description:
    "Send TraffLabels a job by email. Attach a CSV, spreadsheet, PDF, or photo, or type the legend.",
  alternates: { canonical: absoluteUrl(routes.contact) },
};

export default function ContactPage() {
  return (
    <>
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
