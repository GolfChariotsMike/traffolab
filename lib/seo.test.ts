import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aiTxt, llmsTxt } from "./llms-txt";
import { orderMode } from "./order-mode";
import {
  META_DESCRIPTION_LIMIT,
  suburbMetaDescriptions,
} from "./seo-copy";
import { sitemapPaths } from "./site";
import {
  organizationNode,
  serializeJsonLd,
  serviceNode,
} from "./structured-data";

const visibleSources = [
  "app/page.tsx",
  "app/contact/page.tsx",
  "app/not-found.tsx",
  "app/order/page.tsx",
  "app/switchboard-labels/page.tsx",
  "app/what-is-traffolyte/page.tsx",
  "app/traffolyte-labels-perth/page.tsx",
  "app/traffolyte-labels/malaga/page.tsx",
  "app/traffolyte-labels/wangara/page.tsx",
  "app/traffolyte-labels/welshpool/page.tsx",
  "components/suburb-page.tsx",
  "components/home-hero.tsx",
  "components/site-footer.tsx",
  "components/order/order-intro.tsx",
  "components/order/order-entry.tsx",
  "lib/seo-copy.ts",
  "lib/llms-txt.ts",
  "lib/structured-data.ts",
];

for (const file of visibleSources) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  assert.doesNotMatch(source, /TraffoLab/, `${file} still says TraffoLab`);
}

{
  const descriptions = Object.values(suburbMetaDescriptions);
  assert.equal(new Set(descriptions).size, descriptions.length);
  for (const description of descriptions) {
    assert.ok(
      description.length <= META_DESCRIPTION_LIMIT,
      `${description.length} chars: ${description}`,
    );
    assert.match(description, /TraffLabels/);
    assert.doesNotMatch(description, /TraffoLab/);
  }
}

{
  const organization = organizationNode();
  assert.equal(organization["@type"], "Organization");
  assert.equal(organization.name, "TraffLabels");
  const serialized = serializeJsonLd(organization);
  assert.doesNotMatch(
    serialized,
    /telephone|streetAddress|postalCode|openingHours|aggregateRating|reviewCount|ratingValue/i,
  );
  assert.match(serialized, /Perth/);
  assert.match(serialized, /Western Australia/);
  assert.match(serialized, /manufactured in Australia/);
  assert.doesNotMatch(serialized, /LocalBusiness/);
}

{
  const service = serviceNode({
    name: "Traffolyte labels in Malaga",
    description: suburbMetaDescriptions.malaga,
    path: "/traffolyte-labels/malaga/",
    areaName: "Malaga",
  });
  assert.equal(service["@type"], "Service");
  assert.match(serializeJsonLd(service), /TraffLabels/);
}

{
  const llms = llmsTxt();
  const ai = aiTxt();
  assert.match(llms, /Canonical site: https:\/\/www\.trafflabels\.com\.au\//);
  assert.match(ai, /Canonical site: https:\/\/www\.trafflabels\.com\.au\//);
  assert.match(ai, /https:\/\/www\.trafflabels\.com\.au\/llms\.txt/);
  assert.doesNotMatch(`${llms}\n${ai}`, /TraffoLab/);
  for (const path of sitemapPaths) {
    assert.match(llms, new RegExp(path.replaceAll("/", "\\/")));
  }
}

assert.equal(orderMode(undefined), "chooser");
assert.equal(orderMode("designer"), "designer");
assert.equal(orderMode("nope"), "chooser");
