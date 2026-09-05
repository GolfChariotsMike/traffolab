import Link from "next/link";
import type { Metadata } from "next";
import { PenToolIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { absoluteUrl, routes } from "@/lib/site";

export const metadata: Metadata = {
  title: "Designer Coming Soon | Order Traffolyte Labels | TraffoLab",
  description:
    "The TraffoLab online designer is coming soon. Personalise a Traffolyte legend or start from Perth trade labels. Jobs will nest as SVG for LightBurn and engrave in WA.",
  alternates: { canonical: absoluteUrl(routes.order) },
};

export default function OrderPage() {
  return (
    <>
      <PageHero
        eyebrow="Order"
        title="Designer coming soon"
        lede="Personalise a Traffolyte legend when you want a one-off plate — a name, a plant tag, a workshop mark — or use the trade path for circuit IDs. The browser designer is a stub for now."
        crumbs={[{ label: "Order" }]}
      />

      <Section>
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PenToolIcon />
            </EmptyMedia>
            <EmptyTitle>Online design is not live yet</EmptyTitle>
            <EmptyDescription>
              When it opens you will lay out legends in the browser. We convert
              the job to nested SVG for LightBurn, engrave Traffolyte in WA, and
              ship. Until then, read the Perth hub or switchboard page so the
              spec is ready.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link href={routes.hub}>Perth labels hub</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={routes.switchboard}>Switchboard labels</Link>
              </Button>
            </div>
          </EmptyContent>
        </Empty>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Trade crews: start from{" "}
          <Link href={routes.hub} className="underline underline-offset-4">
            Traffolyte labels in Perth
          </Link>{" "}
          or{" "}
          <Link
            href={routes.switchboard}
            className="underline underline-offset-4"
          >
            switchboard labels
          </Link>
          . Personalise stays here — warmer, one-off, no need to talk like a
          sparky.
        </p>
      </Section>
    </>
  );
}
