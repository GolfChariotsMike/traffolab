import { faqAnswerText, type FaqItem } from "@/lib/faq";
import {
  PLATE_RATE_TABLE,
  SHIPPING_METHODS,
  formatAud,
  formatPerMm2,
  priceForPlate,
} from "@/lib/pricing";
import { routes } from "@/lib/site";

/**
 * People-also-ask questions use the exact wording requested.
 * No existing Perth question asked the same thing, so none were replaced.
 * Sheet thickness in millimetres is not published anywhere in the repo.
 */
const costAnswer = costFaqAnswer();

export const perthFaq = [
  {
    question: "Where are TraffLabels labels made?",
    answer:
      "WA production under the Stik Stickers group. Jobs are nested and laser-engraved in Perth, then posted across WA and Australia.",
  },
  {
    question: "How fast can I get labels?",
    answer:
      "Same-week turnaround is the target for standard legends once the job is in the nest. Complex schedules or unusual colours can take longer.",
  },
  {
    question: "Is there a minimum order?",
    answer:
      "No minimum order. Order a single isolator legend or a full switchboard schedule.",
  },
  {
    question: "Are these vinyl stickers?",
    answer:
      "No. Traffolyte is engraving laminate — two-colour sheet the laser cuts through. It is not printed vinyl.",
  },
  {
    question: "What is a traffolyte label?",
    answer:
      "A traffolyte label is an engraved plate made from two-colour engraving laminate. A face colour sits over a contrasting core, and the laser removes the face so the legend is the core rather than ink on the surface. TraffLabels engraves them in WA for switchboards, circuit IDs, isolators, and plant tags.",
  },
  {
    question: "How much do traffolyte labels cost?",
    answer: costAnswer,
  },
  {
    question: "What is the thickness of traffolyte labels?",
    answer: [
      "TraffLabels does not publish a sheet thickness in millimetres. Stock is two-layer engraving laminate: a thin cap over a thicker core, and the laser removes the cap so the core colour is the lettering. If thickness matters for the job, ",
      { text: "contact us", href: routes.contact },
      " and we can advise for the application.",
    ],
  },
  {
    question: "Can you laser engrave a traffolyte?",
    answer:
      "Yes. TraffLabels laser-engraves Traffolyte in WA. The laser removes the top colour so the contrasting core becomes the lettering, and the edges can be cut to size in the same pass. Design the legend online or send a schedule, and the job is nested for the laser.",
  },
  {
    question: "What is the main difference between acrylic and traffolyte?",
    answer:
      "Acrylic is a single plastic, clear or a solid colour, so engraving cuts into that one material. Traffolyte is layered engraving laminate: a face colour bonded over a contrasting core, and engraving reveals the core. TraffLabels engraves Traffolyte plates in WA; they are engraved laminate, not printed stickers.",
  },
  {
    question: "What is traffolyte made of?",
    answer:
      "Traffolyte is layered engraving laminate: coloured plastic sheets bonded together, not vinyl and not printed ink. Typical stock is two layers, a thin cap over a thicker core. Engraving removes the cap so the core colour shows as the text.",
  },
  {
    question: "Is traffolyte a brand?",
    answer:
      "Traffolyte began as a trade name. People now use the word for this kind of multi-layer engraving laminate in general — a face colour over a contrasting core. TraffLabels is the business that engraves the plates in WA; Traffolyte is the material name.",
  },
] as const satisfies readonly FaqItem[];

export function perthFaqAnswers() {
  return perthFaq.map((item) => ({
    question: item.question,
    answer: faqAnswerText(item.answer),
  }));
}

function costFaqAnswer(): FaqItem["answer"] {
  const [small, medium, large] = PLATE_RATE_TABLE;
  const minimum = formatAud(Math.round((small.minimumAud ?? 0) * 100));
  const sample = formatAud(priceForPlate(20, 10, 1).unitCents);
  const shipping = SHIPPING_METHODS.map(
    (method) => `${method.label} ${formatAud(method.aud * 100)}`,
  ).join(" or ");
  const largeLabel = large.label.charAt(0).toLowerCase() + large.label.slice(1);

  return [
    `Plate price is width × height. ${small.label} is ${formatPerMm2(small.ratePerMm2Aud)}, with a minimum of ${minimum} per plate — a 20 × 10 mm plate is ${sample}. ${medium.label} is ${formatPerMm2(medium.ratePerMm2Aud)}, and ${largeLabel} is ${formatPerMm2(large.ratePerMm2Aud)}. There is no minimum order — price a plate on the `,
    { text: "order page", href: routes.order },
    `, then Australia-wide shipping is ${shipping}.`,
  ];
}
