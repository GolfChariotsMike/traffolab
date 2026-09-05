import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { routes, siteName, suburbs } from "@/lib/site";

const footerNav = [
  { href: routes.hub, label: "Traffolyte labels Perth" },
  { href: routes.whatIs, label: "What is Traffolyte" },
  { href: routes.switchboard, label: "Switchboard labels" },
  { href: routes.order, label: "Order" },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-ink text-primary-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12">
        <div className="grid gap-10 md:grid-cols-3">
          <div className="flex flex-col gap-3">
            <p className="font-heading text-lg font-semibold tracking-wide">
              {siteName}
            </p>
            <p className="max-w-xs text-sm text-primary-foreground/70">
              Traffolyte (engraving laminate) labels for Perth trades and
              businesses. Designed online, nested for the laser, engraved in WA.
            </p>
            <p className="font-mono text-[11px] tracking-[0.12em] text-primary-foreground/45 uppercase">
              {siteName} · Perth · Stik Stickers group
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <p className="font-mono text-[11px] tracking-[0.16em] text-signal uppercase">
              Labels
            </p>
            <ul className="flex flex-col gap-2 text-sm">
              {footerNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-primary-foreground/75 hover:text-primary-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <p className="font-mono text-[11px] tracking-[0.16em] text-signal uppercase">
              Perth industrial belt
            </p>
            <ul className="flex flex-col gap-2 text-sm">
              {suburbs.map((suburb) => (
                <li key={suburb.href}>
                  <Link
                    href={suburb.href}
                    className="text-primary-foreground/75 hover:text-primary-foreground"
                  >
                    {suburb.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="bg-primary-foreground/12" />

        <p className="text-xs text-primary-foreground/45">
          Labels support the clear identification electricians use on AS/NZS 3000
          switchboards. TraffLabels does not claim AS/NZS certification of the
          labels themselves.
        </p>
      </div>
    </footer>
  );
}
