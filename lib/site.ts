export const siteName = "TraffLabels";

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
} as const;

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
] as const;

export function absoluteUrl(path: string) {
  return new URL(path, `${siteUrl}/`).toString();
}
