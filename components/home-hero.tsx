import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LaminatePlate } from "@/components/laminate-plate";
import { brandName, routes } from "@/lib/site";

export function HomeHero() {
  return (
    <section className="border-b border-steel bg-charcoal text-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:items-center md:py-20">
        <div className="flex flex-col gap-6">
          <p className="font-mono text-[11px] tracking-[0.18em] text-laser uppercase">
            {brandName} · Perth · Traffolyte
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance md:text-5xl">
            Engraved Traffolyte labels for Perth trades and custom work
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-haze md:text-lg">
            Permanent two-colour laminate — not vinyl. Trade crews order circuit
            IDs and isolator legends. Everyone else can personalise a one-off
            plate. Design online when the designer ships; we nest the job for
            the laser and engrave in Australia.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="h-12 bg-laser px-6 text-base font-semibold text-charcoal hover:bg-laser/90"
            >
              <Link href={routes.order}>
                Order
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 border-paper/20 bg-transparent px-6 text-paper hover:bg-paper/10 hover:text-paper"
            >
              <Link href={routes.hub}>Trade labels</Link>
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <LaminatePlate
            legend="Main switch"
            palette="yellow-black"
            caption="Yellow / black — face stays, laser cuts to the core."
            className="[&_figcaption]:text-haze"
          />
          <LaminatePlate
            legend="PV isolator"
            palette="red-white"
            caption="Red / white — typical solar and plant isolator pair."
            className="[&_figcaption]:text-haze"
          />
          <LaminatePlate
            legend="DB-1 · Circuit 14"
            palette="black-white"
            caption="Black / white — circuit IDs and switchboard schedules."
            className="[&_figcaption]:text-haze"
          />
        </div>
      </div>
    </section>
  );
}
