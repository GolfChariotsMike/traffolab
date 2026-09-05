import { SuburbPage, suburbMetadata } from "@/components/suburb-page";
import { routes } from "@/lib/site";

const welshpool = {
  name: "Welshpool",
  path: routes.welshpool,
  intro:
    "Welshpool and the Kewdale logistics corridor move freight, plant, and electrical work on tight windows. TraffLabels engraves Traffolyte labels in Perth so a Welshpool switchroom or warehouse does not wait on interstate plates.",
  bodyTitle: "Welshpool–Kewdale corridor, metro service",
  body: "This page is for Welshpool sites and the adjoining Kewdale logistics strip — distribution sheds, workshops, and the switchboards that feed them. Nearby Wangara and Malaga share the same WA nest; the Perth hub is the parent page for the rest of the metro.",
  nearbyTitle: "Welshpool plus the northern belt",
  nearbyLinks: [
    {
      href: routes.wangara,
      title: "Wangara",
      description: "Northern industrial estates on the same production target.",
    },
    {
      href: routes.malaga,
      title: "Malaga",
      description: "Light-industrial hub for workshops and electrical contractors.",
    },
    {
      href: routes.hub,
      title: "Traffolyte labels Perth",
      description: "Metro and Australia-wide shipping from the WA nest.",
    },
    {
      href: routes.switchboard,
      title: "Switchboard labels",
      description: "Circuit IDs for Welshpool and Kewdale boards.",
    },
    {
      href: routes.whatIs,
      title: "What is Traffolyte?",
      description: "Why laminate is specified on logistics-site boards.",
    },
  ],
  faq: [
    {
      question: "Do you cover Kewdale as well as Welshpool?",
      answer: (
        <p>
          Yes. Kewdale sits on the same logistics corridor and is covered by the
          Perth metro service — post or arranged pickup — from the Welshpool
          page or the city hub.
        </p>
      ),
    },
    {
      question: "Can a warehouse order plant tags, not just circuit IDs?",
      answer: (
        <p>
          Yes. Traffolyte is used for plant, rack, and isolator legends as well
          as switchboard IDs. Start from the{" "}
          <a href={routes.hub}>Perth hub</a> or the order stub.
        </p>
      ),
    },
  ],
};

export const metadata = suburbMetadata(welshpool);

export default function WelshpoolPage() {
  return <SuburbPage suburb={welshpool} />;
}
