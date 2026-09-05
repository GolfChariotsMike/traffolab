import { SuburbPage, suburbMetadata } from "@/components/suburb-page";
import { routes } from "@/lib/site";

const malaga = {
  name: "Malaga",
  path: routes.malaga,
  intro:
    "Malaga is one of Perth’s busiest light-industrial hubs — workshops, warehouses, and electrical contractors sitting on the northern trade belt. TraffLabels engraves Traffolyte labels in WA so a Malaga job does not sit in an East Coast queue.",
  bodyTitle: "WA production for a workshop suburb",
  body: "Circuit IDs, isolators, and plant tags for Malaga sheds and switchrooms are nested here and laser-cut from engraving laminate. East Coast engraving adds freight days you do not have when a board is being terminated this week. Nearby Wangara and Welshpool use the same Perth nest; the city-wide hub covers the rest of the metro.",
  nearbyTitle: "Malaga, then the rest of the belt",
  nearbyLinks: [
    {
      href: routes.wangara,
      title: "Wangara",
      description: "Next industrial estate north — same WA turnaround target.",
    },
    {
      href: routes.welshpool,
      title: "Welshpool",
      description: "South-east logistics corridor including Kewdale jobs.",
    },
    {
      href: routes.hub,
      title: "Traffolyte labels Perth",
      description: "Metro hub for design, engraving, and Australia-wide post.",
    },
    {
      href: routes.switchboard,
      title: "Switchboard labels",
      description: "Circuit IDs and isolator legends for Malaga electricians.",
    },
    {
      href: routes.whatIs,
      title: "What is Traffolyte?",
      description: "Why laminate lasts on a hot Malaga switchboard.",
    },
  ],
  faq: [
    {
      question: "Do you deliver Traffolyte labels to Malaga?",
      answer: (
        <p>
          Yes. Malaga is on the regular Perth metro run — pickup can be
          arranged, or we post into the suburb. Same-week target for standard
          legends once the job is nested.
        </p>
      ),
    },
    {
      question: "Why not order from the East Coast?",
      answer: (
        <p>
          Interstate engraving plus freight often misses a live board date. WA
          production under the Stik Stickers group keeps the nest in Perth.
        </p>
      ),
    },
  ],
};

export const metadata = suburbMetadata(malaga);

export default function MalagaPage() {
  return <SuburbPage suburb={malaga} />;
}
