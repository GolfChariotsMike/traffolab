import type { Metadata } from "next";

export const siteName = "TraffLabels";
export const brandName = "TraffLabels";
export const productName = "TraffLabels";

/** The only contact address approved for the public site. */
export const publicContactEmail = "sales@trafflabels.com.au";

export const logoPath = "/brand/trafflabels-logo.png";

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://traffolab.vercel.app");

export const routes = {
  home: "/",
  hub: "/traffolyte-labels-perth/",
  whatIs: "/what-is-traffolyte/",
  switchboard: "/switchboard-labels/",
  malaga: "/traffolyte-labels/malaga/",
  wangara: "/traffolyte-labels/wangara/",
  welshpool: "/traffolyte-labels/welshpool/",
  order: "/order/",
  orderDesigner: "/order/?mode=designer",
  orderUpload: "/order/?mode=upload",
  orderCheckout: "/order/?mode=checkout",
  orderSuccess: "/order/success/",
  contact: "/contact/",
} as const;

/** Published on the Stik Stickers store; also the fallback when CONTACT_TO is unset. */
export const contactEmail = "info@stikstickers.com";

export type SiteRoute = (typeof routes)[keyof typeof routes];

export const navLinks = [
  { href: routes.hub, label: "Perth labels" },
  { href: routes.whatIs, label: "What is Traffolyte" },
  { href: routes.switchboard, label: "Switchboard" },
] as const;

export const suburbs = [
  {
    slug: "malaga",
    name: "Malaga",
    href: routes.malaga,
    blurb: "Light-industrial workshops, warehouses, and electrical contractors.",
  },
  {
    slug: "wangara",
    name: "Wangara",
    href: routes.wangara,
    blurb: "Northern industrial estates that need a same-week WA turnaround.",
  },
  {
    slug: "welshpool",
    name: "Welshpool",
    href: routes.welshpool,
    blurb: "Welshpool–Kewdale logistics corridor and metro plant rooms.",
  },
] as const;

export const sitemapPaths = [
  routes.home,
  routes.hub,
  routes.whatIs,
  routes.switchboard,
  routes.malaga,
  routes.wangara,
  routes.welshpool,
  routes.order,
  routes.contact,
] as const;

export function absoluteUrl(path: string) {
  return new URL(path, `${siteUrl}/`).toString();
}

/**
 * Canonical link plus og:url for one page.
 * openGraph is replaced (not deep-merged) by the page, so type, locale,
 * and siteName are repeated here.
 */
export function withCanonical(path: string, metadata: Metadata): Metadata {
  const url = absoluteUrl(path);
  const current = metadata.openGraph;
  const openGraph = current && !Array.isArray(current) ? current : undefined;
  const rawTitle = openGraph?.title ?? metadata.title;
  const rawDescription = openGraph?.description ?? metadata.description;
  const title = typeof rawTitle === "string" ? rawTitle : undefined;
  const description =
    typeof rawDescription === "string" ? rawDescription : undefined;

  return {
    ...metadata,
    alternates: { ...metadata.alternates, canonical: url },
    openGraph: {
      type: "website",
      locale: "en_AU",
      siteName,
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      url,
    },
  };
}
