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

/** Scale the legend so engraved type fills the plate, like a cut Traffolyte nameplate. */
function legendFontSize(legend: string) {
  const length = Math.max(legend.trim().length, 1);
  const cqi = Math.min(15, Math.max(5.4, 132 / length));
  return `clamp(1.35rem, ${cqi.toFixed(2)}cqi, 3.6rem)`;
}

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
          className="@container relative overflow-hidden rounded-[3px] px-2.5 py-2 shadow-[0_12px_28px_rgba(0,0,0,0.28)] md:px-3 md:py-2.5"
          style={{
            background: colors.face,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(0,0,0,0.22), 0 12px 28px rgba(0,0,0,0.28)`,
          }}
        >
          <p
            className="text-center font-heading leading-none font-bold tracking-[0.01em] uppercase"
            style={{ color: colors.core, fontSize: legendFontSize(legend) }}
          >
            {legend}
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
