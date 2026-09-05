import type { ReactNode } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { routes } from "@/lib/site";
import Link from "next/link";

type Crumb = {
  href?: string;
  label: string;
};

export function PageHero({
  eyebrow,
  title,
  lede,
  crumbs,
}: {
  eyebrow?: string;
  title: string;
  lede?: ReactNode;
  crumbs?: Crumb[];
}) {
  return (
    <section className="border-b bg-ink text-primary-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 md:py-16">
        {crumbs && crumbs.length > 0 ? (
          <Breadcrumb>
            <BreadcrumbList className="text-primary-foreground/55">
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={routes.home} className="hover:text-primary-foreground">
                    Home
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              {crumbs.map((crumb) => (
                <span key={crumb.label} className="contents">
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {crumb.href ? (
                      <BreadcrumbLink asChild>
                        <Link
                          href={crumb.href}
                          className="hover:text-primary-foreground"
                        >
                          {crumb.label}
                        </Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage className="text-primary-foreground">
                        {crumb.label}
                      </BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </span>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        ) : null}
        {eyebrow ? (
          <p className="font-mono text-[11px] tracking-[0.18em] text-signal uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="max-w-3xl font-heading text-3xl font-semibold tracking-tight text-balance md:text-5xl">
          {title}
        </h1>
        {lede ? (
          <div className="max-w-3xl text-base leading-relaxed text-primary-foreground/75 md:text-lg">
            {lede}
          </div>
        ) : null}
      </div>
    </section>
  );
}
