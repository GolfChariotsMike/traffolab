"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { colourPairOf, designSummary, type OrderLine } from "@/lib/label-design";
import { formatAud, priceForPlate, subtotalCents } from "@/lib/pricing";
import { routes } from "@/lib/site";

export function OrderPanel({
  lines,
  onQty,
  onRemove,
  onContinue,
  continueDisabled = false,
  onOpenInDesigner,
}: {
  lines: OrderLine[];
  onQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onContinue: () => void;
  continueDisabled?: boolean;
  onOpenInDesigner?: (line: OrderLine) => void;
}) {
  const platesCents = subtotalCents(
    lines.map((line) => ({
      widthMm: line.design.widthMm,
      heightMm: line.design.heightMm,
      qty: line.qty,
    }))
  );

  return (
    <div className="flex flex-col gap-4">
      {lines.length === 0 ? (
        <p className="text-sm text-paper/55">
          No plates in this draft yet. Add a design or a CSV list when the
          legends are right.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {lines.map((line, index) => {
            const colours = colourPairOf(line.design);
            const quote = priceForPlate(
              line.design.widthMm,
              line.design.heightMm,
              line.qty
            );
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
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-mono text-sm text-laser">
                      {formatAud(quote.lineCents)}
                    </span>
                    <span className="text-[10px] text-paper/45">
                      {formatAud(quote.unitCents)} each
                    </span>
                    <span
                      aria-hidden
                      className="size-8 border border-black/30"
                      style={{ backgroundColor: colours.face }}
                    />
                  </div>
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
                  <div className="flex flex-wrap gap-1">
                    {onOpenInDesigner ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenInDesigner(line)}
                      >
                        Open in designer
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(line.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {lines.length > 0 ? (
        <div className="flex items-center justify-between border-t border-white/10 pt-3">
          <span className="font-mono text-[10px] tracking-[0.16em] text-paper/50 uppercase">
            Subtotal
          </span>
          <span className="font-mono text-sm text-paper">{formatAud(platesCents)}</span>
        </div>
      ) : null}

      <Button
        type="button"
        variant="outline"
        className="border-white/15"
        onClick={onContinue}
        disabled={continueDisabled}
      >
        Review order
      </Button>

      <p className="text-[11px] leading-relaxed text-paper/45">
        Subtotal is plates only, in AUD. Australia-wide shipping is chosen on the
        order summary.
      </p>

      <p className="text-[11px] leading-relaxed text-paper/40">
        Need a full schedule?{" "}
        <Link href={routes.orderUpload} className="text-laser underline-offset-2 hover:underline">
          Upload a CSV
        </Link>
        .
      </p>
    </div>
  );
}
