import Link from "next/link";
import { Button } from "@/components/ui/button";
import { brandName, routes } from "@/lib/site";

export function HomeHero() {
  return (
    <section className="border-b bg-charcoal text-paper">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 px-4 py-12 md:py-16">
        <p className="font-mono text-[11px] tracking-[0.18em] text-laser uppercase">
          {brandName} · Traffolyte
        </p>
        <h1 className="max-w-3xl font-heading text-4xl font-semibold tracking-tight text-balance md:text-5xl">
          Engraved Traffolyte labels. Order online.
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-paper/70 md:text-lg">
          Permanent two-colour laminate — not vinyl. No minimum. Laser-engraved
          in Australia.
        </p>
        <Button
          asChild
          size="lg"
          className="h-12 w-full bg-laser px-8 text-base font-semibold text-charcoal hover:bg-laser/90 sm:w-auto"
        >
          <Link href={routes.order}>Order</Link>
        </Button>
      </div>
    </section>
  );
}
