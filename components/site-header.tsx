"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { navLinks, routes, siteName } from "@/lib/site";

function isActive(pathname: string, href: string) {
  if (href === routes.home) return pathname === "/";
  return pathname === href || pathname.startsWith(href);
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b bg-ink text-primary-foreground">
      <div className="h-1 bg-signal" />
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href={routes.home} className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid size-7 place-items-center bg-signal text-[10px] font-semibold tracking-tight text-signal-foreground"
          >
            TL
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-heading text-sm font-semibold tracking-wide">
              {siteName}
            </span>
            <span className="font-mono text-[10px] tracking-[0.16em] text-primary-foreground/60 uppercase">
              Perth · WA
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-2 py-1 text-sm text-primary-foreground/75 transition-colors hover:text-primary-foreground",
                isActive(pathname, link.href) && "text-primary-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            asChild
            size="sm"
            className="hidden bg-signal text-signal-foreground hover:bg-signal/90 sm:inline-flex"
          >
            <Link href={routes.order}>Order</Link>
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground lg:hidden"
              >
                <MenuIcon />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-ink text-primary-foreground">
              <SheetHeader>
                <SheetTitle className="text-primary-foreground">
                  {siteName}
                </SheetTitle>
                <SheetDescription className="text-primary-foreground/65">
                  Traffolyte labels · Perth / WA
                </SheetDescription>
              </SheetHeader>
              <Separator className="bg-primary-foreground/15" />
              <nav className="flex flex-col gap-1 px-4" aria-label="Mobile">
                {navLinks.map((link) => (
                  <SheetClose asChild key={link.href}>
                    <Link
                      href={link.href}
                      className="py-2 text-sm text-primary-foreground/85 hover:text-primary-foreground"
                    >
                      {link.label}
                    </Link>
                  </SheetClose>
                ))}
                <SheetClose asChild>
                  <Link
                    href={routes.order}
                    className="py-2 text-sm font-medium text-signal"
                  >
                    Order
                  </Link>
                </SheetClose>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
