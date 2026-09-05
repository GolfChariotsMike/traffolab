import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CtaBand({
  title,
  body,
  primary,
  secondary,
}: {
  title: string;
  body: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <section className="border-t bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 md:flex-row md:items-end md:justify-between">
        <div className="flex max-w-xl flex-col gap-3">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            {title}
          </h2>
          <p className="text-muted-foreground">{body}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg" className="h-11 px-4">
            <Link href={primary.href}>{primary.label}</Link>
          </Button>
          {secondary ? (
            <Button asChild size="lg" variant="outline" className="h-11 px-4">
              <Link href={secondary.href}>{secondary.label}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
