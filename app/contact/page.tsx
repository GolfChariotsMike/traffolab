import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { absoluteUrl, productName, routes } from "@/lib/site";

export const metadata: Metadata = {
  title: `Contact | ${productName}`,
  description:
    "Send a TraffLabels job without formatting a file. Email the Stik Stickers group in Perth.",
  alternates: { canonical: absoluteUrl(routes.contact) },
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow={productName}
        title="Contact us"
        lede="Send a schedule or a single legend without formatting a file. TraffLabels engraves Traffolyte in WA under the Stik Stickers group."
        crumbs={[{ label: "Contact" }]}
      />
      <Section>
        <ContactForm />
      </Section>
    </>
  );
}
