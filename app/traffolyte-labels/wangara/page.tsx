import { SuburbPage, suburbMetadata } from "@/components/suburb-page";
import { routes } from "@/lib/site";

const wangara = {
  name: "Wangara",
  path: routes.wangara,
  intro:
    "Wangara’s industrial estates run on short lead times — factories, wholesalers, and electrical contractors who cannot wait a fortnight for a plate. TraffLabels targets a same-week nest from Perth so Wangara jobs stay on the local laser.",
  bodyTitle: "Industrial-estate turnaround, engraved in WA",
  body: "Wangara sits in the northern industrial belt with Malaga next door. We engrave Traffolyte circuit IDs, isolators, and plant tags in WA rather than sending artwork east. If the site is actually in Malaga, use that page; metro-wide orders start from the Perth hub.",
  nearbyTitle: "Wangara and neighbouring estates",
  nearbyLinks: [
    {
      href: routes.malaga,
      title: "Malaga",
      description: "The adjoining light-industrial hub — same production line.",
    },
    {
      href: routes.hub,
      title: "Traffolyte labels Perth",
      description: "City-wide hub for design online and WA engraving.",
    },
    {
      href: routes.welshpool,
      title: "Welshpool",
      description: "South-east corridor when the job is Kewdale or Welshpool.",
    },
    {
      href: routes.switchboard,
      title: "Switchboard labels",
      description: "Schedules and singles for Wangara electricians.",
    },
    {
      href: routes.whatIs,
      title: "What is Traffolyte?",
      description: "Engraving laminate versus vinyl for estate plant rooms.",
    },
  ],
  faq: [
    {
      question: "Can Wangara jobs hit a same-week target?",
      answer: (
        <p>
          Same-week turnaround is the target for standard legends once checkout
          is complete and the job is in the LightBurn nest. Large schedules or
          unusual colours can slip.
        </p>
      ),
    },
    {
      question: "Is Wangara a separate factory?",
      answer: (
        <p>
          No. All TraffLabels engraving is WA production under the Stik Stickers
          group. Wangara is a delivery and trade area, not a second plant.
        </p>
      ),
    },
  ],
};

export const metadata = suburbMetadata(wangara);

export default function WangaraPage() {
  return <SuburbPage suburb={wangara} />;
}
