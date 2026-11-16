import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aiTxt, llmsTxt } from "./llms-txt";
import { orderMode } from "./order-mode";
import {
  META_DESCRIPTION_LIMIT,
  suburbMetaDescriptions,
} from "./seo-copy";
import { faqAnswerText } from "./faq";
import { perthFaq, perthFaqAnswers } from "./perth-faq";
import { sitemapPaths, withCanonical } from "./site";
import {
  faqPageNode,
  localBusinessNode,
  organizationDescription,
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
  "lib/perth-faq.ts",
  "lib/faq.ts",
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
  const business = localBusinessNode();
  assert.equal(business["@type"], "LocalBusiness");
  assert.equal(business.name, "TraffLabels");
  assert.equal(business.url, "https://www.trafflabels.com.au/");
  assert.equal(business.email, "sales@trafflabels.com.au");
  assert.equal(
    business.logo,
    "https://www.trafflabels.com.au/brand/trafflabels-logo.png",
  );
  assert.equal(business.image, business.logo);
  assert.equal(business.description, organizationDescription);
  const serialized = serializeJsonLd(business);
  assert.doesNotMatch(
    serialized,
    /"telephone"|"streetAddress"|"postalCode"|"openingHours"|"sameAs"|"geo"|"aggregateRating"|"reviewCount"|"ratingValue"/,
  );
  assert.match(serialized, /Perth/);
  assert.match(serialized, /Western Australia/);
  assert.match(serialized, /manufactured in Australia/);
  assert.match(serialized, /sales@trafflabels\.com\.au/);
}

{
  const peopleAlsoAsk = [
    "What is a traffolyte label?",
    "How much do traffolyte labels cost?",
    "What is the thickness of traffolyte labels?",
    "Can you laser engrave a traffolyte?",
    "What is the main difference between acrylic and traffolyte?",
    "What is traffolyte made of?",
    "Is traffolyte a brand?",
  ];
  const questions = perthFaq.map((item) => item.question);
  for (const question of peopleAlsoAsk) {
    assert.equal(questions.filter((item) => item === question).length, 1, question);
  }
  const answers = perthFaqAnswers();
  const page = faqPageNode(answers);
  const main = page.mainEntity as {
    name: string;
    acceptedAnswer: { text: string };
  }[];
  assert.equal(main.length, perthFaq.length);
  for (const [index, item] of perthFaq.entries()) {
    assert.equal(main[index]?.name, item.question);
    assert.equal(main[index]?.acceptedAnswer.text, faqAnswerText(item.answer));
  }
  const cost = faqAnswerText(
    perthFaq.find((item) => item.question === "How much do traffolyte labels cost?")!
      .answer,
  );
  assert.match(cost, /\$0\.0075\/mm²/);
  assert.match(cost, /\$1\.50/);
  assert.match(cost, /\$0\.005\/mm²/);
  assert.match(cost, /\$0\.0035\/mm²/);
  assert.match(cost, /Standard \$10\.00 or Express \$15\.00/);
  assert.match(cost, /order page/);
  const thickness = faqAnswerText(
    perthFaq.find(
      (item) => item.question === "What is the thickness of traffolyte labels?",
    )!.answer,
  );
  assert.doesNotMatch(thickness, /\d+(?:\.\d+)?\s*mm/);
  assert.match(thickness, /contact us/);
  assert.match(thickness, /does not publish a sheet thickness/);
  const acrylic = faqAnswerText(
    perthFaq.find(
      (item) =>
        item.question ===
        "What is the main difference between acrylic and traffolyte?",
    )!.answer,
  );
  assert.match(
    acrylic,
    /TraffLabels engraves Traffolyte plates in WA; they are engraved laminate, not printed stickers\.$/,
  );
  assert.doesNotMatch(acrylic, /makes the layered laminate/);
}

{
  const meta = withCanonical("/contact/", {
    title: "Contact TraffLabels | Traffolyte Labels Perth",
    description: "Send TraffLabels a job by email.",
  });
  const canonical = meta.alternates?.canonical;
  const graph = meta.openGraph;
  assert.equal(typeof canonical, "string");
  assert.ok(graph && !Array.isArray(graph));
  if (graph && !Array.isArray(graph)) {
    assert.equal(graph.url, canonical);
    assert.match(String(graph.url), /\/contact\/$/);
  }
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
