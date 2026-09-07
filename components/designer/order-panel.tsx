"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { colourPairOf, designSummary, type OrderLine } from "@/lib/label-design";

export function OrderPanel({
  lines,
  continued,
  onQty,
  onRemove,
  onContinue,
}: {
  lines: OrderLine[];
  continued: boolean;
  onQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onContinue: () => void;
}) {
  const totalPlates = lines.reduce((sum, line) => sum + line.qty, 0);

  return (
    <div className="flex flex-col gap-4">
      {lines.length === 0 ? (
        <p className="text-sm text-paper/55">
          No plates in this draft yet. Add the current design when the legend is
          right.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {lines.map((line, index) => {
            const colours = colourPairOf(line.design);
            return (
              <li
                key={line.id}
                className="border border-white/10 bg-charcoal/50 px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] tracking-[0.16em] text-laser uppercase">
                      Plate {index + 1}
                    </p>
                    <p className="mt-1 truncate font-industrial text-sm font-medium">
                      {line.design.objects[0]?.text.split("\n")[0] || "Untitled"}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-paper/50">
                      {designSummary(line.design)}
                    </p>
                  </div>
                  <span
                    aria-hidden
                    className="size-8 shrink-0 border border-black/30"
                    style={{ backgroundColor: colours.face }}
                  />
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <Label
                      htmlFor={`qty-${line.id}`}
                      className="text-[11px] text-paper/65"
                    >
                      Qty
                    </Label>
                    <Input
                      id={`qty-${line.id}`}
                      type="number"
                      min={1}
                      max={999}
                      value={line.qty}
                      onChange={(event) =>
                        onQty(line.id, Number(event.target.value))
                      }
                      className="h-7 w-20 bg-charcoal font-mono"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(line.id)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        className="border-white/15"
        onClick={onContinue}
      >
        Continue
      </Button>

      {continued ? (
        <div className="border border-laser/40 bg-laser/10 px-3 py-3 text-sm leading-relaxed text-paper/85">
          Draft ready — {totalPlates} plate{totalPlates === 1 ? "" : "s"} held in
          this browser with design JSON and LightBurn SVG. Stripe checkout is the
          next step and is not live yet.
        </div>
      ) : (
        <p className="text-[11px] leading-relaxed text-paper/45">
          Checkout and inventory are next. This panel only captures the job.
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-paper/40">
        Switchboard CSV schedule importer — coming soon.
      </p>
    </div>
  );
}
