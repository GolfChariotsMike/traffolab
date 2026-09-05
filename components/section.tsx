import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 md:py-16", className)}>
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex max-w-3xl flex-col gap-3">
      {eyebrow ? (
        <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
        {title}
      </h2>
      {children ? (
        <div className="text-base leading-relaxed text-muted-foreground">
          {children}
        </div>
      ) : null}
    </div>
  );
}
