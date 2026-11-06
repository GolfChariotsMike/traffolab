import { absoluteUrl, siteName } from "@/lib/site";

export type JsonLdNode = Record<string, unknown>;

/**
 * Facts already published on the site: Perth / WA, Traffolyte engraving,
 * Australian-made, Stik Stickers group. No phone, street, hours, or ratings.
 */
export const organizationDescription =
  "Traffolyte (engraving laminate) labels for Perth trades and businesses. Design online, engraved in WA. 100% owned & manufactured in Australia. Stik Stickers group.";

export function organizationId() {
  return `${absoluteUrl("/")}#organization`;
}

export function organizationNode(): JsonLdNode {
  return {
    "@type": "Organization",
    "@id": organizationId(),
    name: siteName,
    url: absoluteUrl("/"),
    description: organizationDescription,
    areaServed: [
      {
        "@type": "City",
        name: "Perth",
        containedInPlace: { "@type": "State", name: "Western Australia" },
      },
    ],
  };
}

export function websiteNode(): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": `${absoluteUrl("/")}#website`,
    name: siteName,
    url: absoluteUrl("/"),
    description: organizationDescription,
    inLanguage: "en-AU",
    publisher: { "@id": organizationId() },
  };
}

export function serviceNode(input: {
  name: string;
  description: string;
  path: string;
  areaName: string;
}): JsonLdNode {
  const perth = {
    "@type": "City",
    name: "Perth",
    containedInPlace: { "@type": "State", name: "Western Australia" },
  };
  const areaServed =
    input.areaName === "Perth"
      ? perth
      : {
          "@type": "Place",
          name: input.areaName,
          containedInPlace: perth,
        };

  return {
    "@type": "Service",
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    serviceType: "Traffolyte label engraving",
    provider: {
      "@type": "Organization",
      name: siteName,
      url: absoluteUrl("/"),
    },
    areaServed,
  };
}

export function breadcrumbNode(
  items: { name: string; path: string }[],
): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function webPageNode(input: {
  name: string;
  description: string;
  path: string;
  type?: "WebPage" | "ContactPage";
}): JsonLdNode {
  return {
    "@type": input.type ?? "WebPage",
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    isPartOf: { "@id": `${absoluteUrl("/")}#website` },
    about: { "@id": organizationId() },
  };
}

export function serializeJsonLd(data: JsonLdNode | JsonLdNode[]) {
  const payload = Array.isArray(data)
    ? { "@context": "https://schema.org", "@graph": data }
    : { "@context": "https://schema.org", ...data };
  return JSON.stringify(payload).replace(/</g, "\\u003c");
}
