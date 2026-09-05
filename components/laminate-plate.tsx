import { cn } from "@/lib/utils";

const palettes = {
  "yellow-black": {
    face: "bg-signal text-signal-foreground",
    core: "bg-ink text-signal",
  },
  "black-white": {
    face: "bg-zinc-900 text-zinc-100",
    core: "bg-zinc-100 text-zinc-900",
  },
  "red-white": {
    face: "bg-red-800 text-red-50",
    core: "bg-zinc-100 text-red-900",
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
      <div
        className={cn(
          "overflow-hidden rounded-md ring-1 ring-foreground/15",
          colors.face
        )}
      >
        <div className="px-3 py-1.5 font-mono text-[10px] tracking-[0.16em] uppercase">
          Traffolyte · 2-layer
        </div>
        <div
          className={cn(
            "flex min-h-20 items-center px-3 py-4 font-mono text-lg font-medium tracking-wide uppercase md:text-xl",
            colors.core
          )}
        >
          {legend}
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
