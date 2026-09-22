"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ORDER_STORAGE_KEY,
  colourPairOf,
  designSummary,
  readStoredOrderLines,
  type OrderLine,
} from "@/lib/label-design";
import {
  PLATE_RATE_TABLE,
  SHIPPING_METHODS,
  SHIPPING_STORAGE_KEY,
  formatAreaMm2,
  formatAud,
  formatPerMm2,
  parseShippingMethod,
  priceForPlate,
  quoteOrder,
  type ShippingMethodId,
} from "@/lib/pricing";
import { routes } from "@/lib/site";
import { cn } from "@/lib/utils";

function readStoredShipping(): ShippingMethodId {
  if (typeof window === "undefined") return "standard";
  try {
    return parseShippingMethod(localStorage.getItem(SHIPPING_STORAGE_KEY));
  } catch {
    return "standard";
  }
}

function plateFields(lines: OrderLine[]) {
  return lines.map((line) => ({
    widthMm: line.design.widthMm,
    heightMm: line.design.heightMm,
    qty: line.qty,
  }));
}

export function OrderSummary() {
  const [lines, setLines] = useState<OrderLine[]>(readStoredOrderLines);
  const [shipping, setShipping] = useState<ShippingMethodId>(readStoredShipping);
  const quote = quoteOrder(plateFields(lines), shipping);

  const persistLines = (next: OrderLine[]) => {
    setLines(next);
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(next));
  };

  const selectShipping = (id: ShippingMethodId) => {
    setShipping(id);
    localStorage.setItem(SHIPPING_STORAGE_KEY, id);
  };

  return (
    <section className="trafflabels-designer font-industrial">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 md:py-10">
        {lines.length === 0 ? (
          <div className="border border-white/10 bg-charcoal/50 px-5 py-6">
            <h2 className="font-heading text-xl font-semibold text-paper">
              No plates in this draft
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-paper/65">
              Design a plate or upload a list. Australia-wide shipping is{" "}
              {SHIPPING_METHODS.map(
                (method) => `${method.label} ${formatAud(method.aud * 100)}`
              ).join(" or ")}
              , added once there is at least one line.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild className="bg-laser text-charcoal hover:bg-laser/90">
                <Link href={routes.orderDesigner}>Design online</Link>
              </Button>
              <Button asChild variant="outline" className="border-white/15">
                <Link href={routes.orderUpload}>Upload a list</Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {lines.map((line, index) => {
                const colours = colourPairOf(line.design);
                const lineQuote = priceForPlate(
                  line.design.widthMm,
                  line.design.heightMm,
                  line.qty
                );
                return (
                  <li
                    key={line.id}
                    className="border border-white/10 bg-charcoal/50 px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] tracking-[0.16em] text-laser uppercase">
                          Plate {index + 1}
                        </p>
                        <p className="mt-1 font-heading text-lg font-semibold text-paper">
                          {line.design.objects[0]?.text.split("\n")[0] || "Untitled"}
                        </p>
                        <p className="mt-1 text-sm text-paper/55">
                          {designSummary(line.design)} · {formatAreaMm2(lineQuote.areaMm2)} mm²
                        </p>
                      </div>
                      <span
                        aria-hidden
                        className="size-10 shrink-0 border border-black/30"
                        style={{ backgroundColor: colours.face }}
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`summary-qty-${line.id}`} className="text-[11px] text-paper/65">
                          Qty
                        </Label>
                        <Input
                          id={`summary-qty-${line.id}`}
                          type="number"
                          min={1}
                          max={999}
                          value={line.qty}
                          onChange={(event) =>
                            persistLines(
                              lines.map((item) =>
                                item.id === line.id
                                  ? {
                                      ...item,
                                      qty: Math.min(
                                        999,
                                        Math.max(1, Math.round(Number(event.target.value) || 1))
                                      ),
                                    }
                                  : item
                              )
                            )
                          }
                          className="h-8 w-20 bg-charcoal font-mono"
                        />
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-lg text-paper">
                          {formatAud(lineQuote.lineCents)}
                        </p>
                        <p className="text-[11px] text-paper/45">
                          {formatAud(lineQuote.unitCents)} each
                          {lineQuote.minimumApplied ? " · minimum" : ""}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-1"
                          onClick={() =>
                            persistLines(lines.filter((item) => item.id !== line.id))
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 font-mono text-[10px] tracking-[0.18em] text-paper/50 uppercase">
                Shipping
              </legend>
              {SHIPPING_METHODS.map((method) => {
                const selected = shipping === method.id;
                return (
                  <label
                    key={method.id}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-3 border px-4 py-3",
                      selected
                        ? "border-laser bg-laser/15"
                        : "border-white/10 bg-charcoal/60 hover:border-white/25"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="shipping"
                        value={method.id}
                        checked={selected}
                        onChange={() => selectShipping(method.id)}
                        className="size-4 accent-[#fee100]"
                      />
                      <span>
                        <span className="block text-sm text-paper">{method.label}</span>
                        <span className="block text-[11px] text-paper/50">{method.region}</span>
                      </span>
                    </span>
                    <span className="font-mono text-sm text-paper">
                      {formatAud(method.aud * 100)}
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <div className="border border-white/10 bg-charcoal/40 px-4 py-4">
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-paper/60">Subtotal</dt>
                  <dd className="font-mono text-paper">{formatAud(quote.subtotalCents)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-paper/60">Shipping</dt>
                  <dd className="font-mono text-paper">{formatAud(quote.shippingCents)}</dd>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-white/10 pt-3">
                  <dt className="font-mono text-[10px] tracking-[0.18em] text-paper/50 uppercase">
                    Order total
                  </dt>
                  <dd
                    className="font-heading text-3xl font-semibold text-laser"
                    aria-live="polite"
                  >
                    {formatAud(quote.totalCents)}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-sm leading-relaxed text-paper/65">
                Payment is not connected yet. This TraffLabels total is the amount
                checkout will charge: plate subtotal plus the shipping option you
                choose. Prices are AUD.
              </p>
            </div>

            <div className="text-[11px] leading-relaxed text-paper/45">
              <p>Plate price is width × height.</p>
              <ul className="mt-2 flex flex-col gap-1">
                {PLATE_RATE_TABLE.map((tier) => (
                  <li key={tier.id}>
                    {tier.label}: {formatPerMm2(tier.ratePerMm2Aud)}
                    {tier.minimumAud != null
                      ? ` · minimum ${formatAud(Math.round(tier.minimumAud * 100))}`
                      : ""}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="border-white/15">
                <Link href={routes.orderDesigner}>Edit in designer</Link>
              </Button>
              <Button asChild variant="outline" className="border-white/15">
                <Link href={routes.orderUpload}>Edit list</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
