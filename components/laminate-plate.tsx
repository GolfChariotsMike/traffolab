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

/** Space Grotesk bold uppercase widths, in em, so a legend fills the plate. */
const glyphWidth: Record<string, number> = {
  " ": 0.254,
  "-": 0.432,
  "·": 0.218,
  "0": 0.648,
  "1": 0.452,
  "2": 0.594,
  "3": 0.608,
  "4": 0.636,
  "5": 0.6,
  "6": 0.618,
  "7": 0.554,
  "8": 0.6,
  "9": 0.618,
  A: 0.634,
  B: 0.664,
  C: 0.644,
  D: 0.666,
  E: 0.554,
  F: 0.534,
  G: 0.662,
  H: 0.656,
  I: 0.264,
  J: 0.61,
  K: 0.626,
  L: 0.542,
  M: 0.882,
  N: 0.67,
  O: 0.676,
  P: 0.604,
  Q: 0.676,
  R: 0.632,
  S: 0.606,
  T: 0.588,
  U: 0.672,
  V: 0.618,
  W: 0.898,
  X: 0.644,
  Y: 0.624,
  Z: 0.576,
};

/** Scale the legend so engraved type fills the plate, like a cut Traffolyte nameplate. */
function legendFontSize(legend: string) {
  const text = legend.trim().toUpperCase();
  let em = 0;
  for (const char of text) em += glyphWidth[char] ?? 0.64;
  em += Math.max(text.length - 1, 0) * 0.01;
  const cqi = Math.min(19, Math.max(6, 92 / Math.max(em, 0.6)));
  return `clamp(1.35rem, ${cqi.toFixed(2)}cqi, 6rem)`;
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
          className="@container relative overflow-hidden rounded-[3px] px-2 py-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.28)] md:py-2"
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
