import { cn } from "@/lib/utils";

const palettes = {
  "yellow-black": {
    face: "#F5C400",
    core: "#12151A",
    edge: "#8A6F00",
  },
  "black-white": {
    face: "#16181C",
    core: "#F4F5F7",
    edge: "#0B0C0E",
  },
  "red-white": {
    face: "#B42318",
    core: "#F4F5F7",
    edge: "#6F150E",
  },
} as const;

export function LaminatePlate({
  legend,
  caption,
  palette = "yellow-black",
  className,
}: {
  legend: string;
  caption?: string;
  palette?: keyof typeof palettes;
  className?: string;
}) {
  const colors = palettes[palette];

  return (
    <figure className={cn("flex flex-col gap-2", className)}>
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-0 translate-x-[3px] translate-y-[4px] rounded-[3px]"
          style={{ background: colors.edge }}
        />
        <div
          className="relative overflow-hidden rounded-[3px] px-4 py-5 shadow-[0_12px_28px_rgba(0,0,0,0.28)]"
          style={{
            background: colors.face,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(0,0,0,0.22), 0 12px 28px rgba(0,0,0,0.28)`,
          }}
        >
          <p
            className="font-heading text-xl font-semibold tracking-[0.04em] uppercase md:text-2xl"
            style={{ color: colors.core }}
          >
            {legend}
          </p>
          <p
            className="mt-2 font-mono text-[10px] tracking-[0.16em] uppercase"
            style={{ color: colors.core, opacity: 0.55 }}
          >
            Traffolyte · 2-layer
          </p>
        </div>
      </div>
      {caption ? (
        <figcaption className="text-xs text-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
