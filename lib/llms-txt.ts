import { CANONICAL_CHECKOUT_ORIGIN } from "@/lib/checkout-return";
import { organizationDescription } from "@/lib/structured-data";
import { sitemapPaths } from "@/lib/site";

const CANONICAL_SITE = `${CANONICAL_CHECKOUT_ORIGIN}/`;

const pageCopy: Record<
  (typeof sitemapPaths)[number],
  { title: string; summary: string }
> = {
  "/": {
    title: "Home",
    summary: "Engraved Traffolyte labels for trades and custom work.",
  },
  "/traffolyte-labels-perth/": {
    title: "Traffolyte labels Perth",
    summary: "Ordered online, engraved in Western Australia.",
  },
  "/what-is-traffolyte/": {
    title: "What is Traffolyte?",
    summary: "Engraving laminate explained: face colour over a contrasting core.",
  },
  "/switchboard-labels/": {
    title: "Switchboard labels",
    summary: "Circuit IDs, main switches, and isolator legends for Perth trades.",
  },
  "/traffolyte-labels/malaga/": {
    title: "Malaga",
    summary: "Traffolyte labels for Malaga workshops, warehouses, and contractors.",
  },
  "/traffolyte-labels/wangara/": {
    title: "Wangara",
    summary: "Traffolyte labels for Wangara factories and electrical contractors.",
  },
  "/traffolyte-labels/welshpool/": {
    title: "Welshpool",
    summary: "Traffolyte labels for Welshpool and Kewdale.",
  },
  "/order/": {
    title: "Order",
    summary: "Design a Traffolyte plate online or upload a label list.",
  },
  "/contact/": {
    title: "Contact",
    summary: "Send TraffLabels a job.",
  },
};

function pageUrl(path: string) {
  return new URL(path, CANONICAL_SITE).toString();
}

export function llmsTxt() {
  const pages = sitemapPaths.map((path) => {
    const page = pageCopy[path];
    return `- [${page.title}](${pageUrl(path)}): ${page.summary}`;
  });

  return [
    "# TraffLabels",
    "",
    `> ${organizationDescription}`,
    "",
    `Canonical site: ${CANONICAL_SITE}`,
    "",
    "Service area: Perth and Western Australia, including Malaga, Wangara, and Welshpool. Orders can be posted Australia-wide.",
    "",
    "## Pages",
    "",
    ...pages,
    "",
  ].join("\n");
}

export function aiTxt() {
  return [
    "# TraffLabels",
    "",
    `Canonical site: ${CANONICAL_SITE}`,
    "",
    organizationDescription,
    "Service area: Perth and Western Australia, including Malaga, Wangara, and Welshpool.",
    "",
    `Page list: ${pageUrl("/llms.txt")}`,
    "",
  ].join("\n");
}
