import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon, PenLineIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/site";

export function OrderChooser() {
  return (
    <section className="trafflabels-designer font-industrial">
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10 md:grid-cols-2 md:py-14">
        <ChooserCard
          href={routes.orderDesigner}
          kicker="Single plate"
          title="Design online"
          body="Set the size and colour pair, place a legend on the canvas, and export a LightBurn SVG. Same TraffLabels designer as before."
          action="Design online"
          icon={<PenLineIcon className="size-6" />}
        />
        <ChooserCard
          href={routes.orderUpload}
          kicker="Many legends"
          title="Upload a list"
          body="Download the CSV template or map columns from your own schedule. Colour, size, text, and qty become order-draft lines."
          action="Upload a list"
          icon={<UploadIcon className="size-6" />}
        />
      </div>
    </section>
  );
}

function ChooserCard({
  href,
  kicker,
  title,
  body,
  action,
  icon,
}: {
  href: string;
  kicker: string;
  title: string;
  body: string;
  action: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col border border-white/10 bg-charcoal/70 p-6 transition-colors hover:border-laser/80 hover:bg-charcoal"
    >
      <div className="flex items-start justify-between gap-4">
        <p className="font-mono text-[10px] tracking-[0.18em] text-laser uppercase">
          {kicker}
        </p>
        <span className="flex size-11 items-center justify-center border border-laser/50 bg-laser/10 text-laser">
          {icon}
        </span>
      </div>
      <h2 className="mt-4 font-heading text-2xl font-semibold tracking-tight text-paper">
        {title}
      </h2>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-paper/65">{body}</p>
      <Button
        asChild
        className="mt-6 h-11 bg-laser px-4 font-semibold text-charcoal hover:bg-laser/90"
      >
        <span>
          {action}
          <ArrowRightIcon data-icon="inline-end" />
        </span>
      </Button>
    </Link>
  );
}
