/**
 * Pure helpers for TraffLabels Stripe Checkout: validate the client payload,
 * recalculate plate + shipping totals with lib/pricing.ts, and build Session
 * line_items. Never trust client-supplied money amounts.
 */

import { COLOUR_PAIRS, type ColourPairId } from "@/lib/label-design";
import type { PlateObject, StoredPlate } from "@/lib/orders";
import {
  SHIPPING_METHODS,
  clampOrderQty,
  formatAreaMm2,
  formatAud,
  isShippingMethodId,
  quoteOrder,
  type OrderQuote,
  type ShippingMethodId,
} from "@/lib/pricing";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LINES = 200;
const MAX_SUMMARY_LEN = 240;
const MAX_OBJECTS = 40;
const MAX_TEXT = 500;
const MIN_MM = 0.1;
const MAX_MM = 2000;

export type CheckoutLineInput = {
  widthMm: number;
  heightMm: number;
  qty: number;
  designSummary?: string;
  colourPair?: ColourPairId;
  adhesive3m?: boolean;
  objects?: PlateObject[];
};

export type CheckoutRequest = {
  lines: CheckoutLineInput[];
  shippingMethodId: ShippingMethodId;
  customerEmail: string;
};

export type CheckoutLineItem = {
  quantity: number;
  price_data: {
    currency: "aud";
    unit_amount: number;
    product_data: {
      name: string;
      description?: string;
      metadata?: Record<string, string>;
    };
  };
};

export type BuiltCheckout = {
  request: CheckoutRequest;
  quote: OrderQuote;
  lineItems: CheckoutLineItem[];
  plates: StoredPlate[];
  metadata: Record<string, string>;
};

export type CheckoutParseError = {
  ok: false;
  status: 400;
  error: string;
};

export type CheckoutParseOk = {
  ok: true;
  value: BuiltCheckout;
};

function isColourPairId(value: unknown): value is ColourPairId {
  return typeof value === "string" && value in COLOUR_PAIRS;
}

function isAlign(value: unknown): value is PlateObject["align"] {
  return value === "left" || value === "center" || value === "right";
}

function parseLineDesign(
  row: Record<string, unknown>,
  lineNo: number
):
  | { ok: true; colourPair: ColourPairId; adhesive3m: boolean; objects: PlateObject[] }
  | CheckoutParseError {
  let colourPair: ColourPairId = "yellow-black";
  if (row.colourPair != null && row.colourPair !== "") {
    if (!isColourPairId(row.colourPair)) {
      return {
        ok: false,
        status: 400,
        error: `Plate line ${lineNo} has an unknown colour.`,
      };
    }
    colourPair = row.colourPair;
  }

  let adhesive3m = false;
  if (row.adhesive3m != null) {
    if (typeof row.adhesive3m !== "boolean") {
      return {
        ok: false,
        status: 400,
        error: `Plate line ${lineNo} has an invalid adhesive flag.`,
      };
    }
    adhesive3m = row.adhesive3m;
  }

  if (row.objects == null) {
    return { ok: true, colourPair, adhesive3m, objects: [] };
  }
  if (!Array.isArray(row.objects) || row.objects.length > MAX_OBJECTS) {
    return {
      ok: false,
      status: 400,
      error: `Plate line ${lineNo} has invalid legend text.`,
    };
  }

  const objects: PlateObject[] = [];
  for (const item of row.objects) {
    if (!item || typeof item !== "object") {
      return {
        ok: false,
        status: 400,
        error: `Plate line ${lineNo} has invalid legend text.`,
      };
    }
    const object = item as Record<string, unknown>;
    const x = Number(object.x);
    const y = Number(object.y);
    const fontSize = Number(object.fontSize);
    if (
      typeof object.text !== "string" ||
      object.text.length > MAX_TEXT ||
      !isAlign(object.align) ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(fontSize) ||
      fontSize < 0.5 ||
      fontSize > 80 ||
      Math.abs(x) > 3000 ||
      Math.abs(y) > 3000
    ) {
      return {
        ok: false,
        status: 400,
        error: `Plate line ${lineNo} has invalid legend text.`,
      };
    }
    const id =
      typeof object.id === "string" && object.id.trim()
        ? object.id.trim().slice(0, 40)
        : `text-${objects.length + 1}`;
    objects.push({
      id,
      text: object.text,
      x,
      y,
      fontSize,
      align: object.align,
    });
  }

  return { ok: true, colourPair, adhesive3m, objects };
}

export function parseCheckoutBody(body: unknown): CheckoutParseOk | CheckoutParseError {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "Invalid request." };
  }

  const raw = body as Record<string, unknown>;
  const email = String(raw.customerEmail ?? "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email) || email.length > 200) {
    return {
      ok: false,
      status: 400,
      error: "Enter a valid email so Stripe can send the receipt.",
    };
  }

  const shippingRaw = raw.shippingMethodId ?? raw.shipping;
  if (!isShippingMethodId(shippingRaw)) {
    return {
      ok: false,
      status: 400,
      error: "Choose Standard or Express shipping.",
    };
  }

  if (!Array.isArray(raw.lines) || raw.lines.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "Add at least one plate before checkout.",
    };
  }
  if (raw.lines.length > MAX_LINES) {
    return {
      ok: false,
      status: 400,
      error: `Checkout supports up to ${MAX_LINES} plate lines.`,
    };
  }

  const lines: CheckoutLineInput[] = [];
  for (let i = 0; i < raw.lines.length; i++) {
    const item = raw.lines[i];
    if (!item || typeof item !== "object") {
      return {
        ok: false,
        status: 400,
        error: `Plate line ${i + 1} is invalid.`,
      };
    }
    const row = item as Record<string, unknown>;
    const widthMm = Number(row.widthMm);
    const heightMm = Number(row.heightMm);
    const qty = clampOrderQty(Number(row.qty));
    if (
      !Number.isFinite(widthMm) ||
      !Number.isFinite(heightMm) ||
      widthMm < MIN_MM ||
      heightMm < MIN_MM ||
      widthMm > MAX_MM ||
      heightMm > MAX_MM
    ) {
      return {
        ok: false,
        status: 400,
        error: `Plate line ${i + 1} needs a positive width and height in mm.`,
      };
    }
    const summaryRaw = row.designSummary;
    const designSummary =
      typeof summaryRaw === "string"
        ? summaryRaw.trim().slice(0, MAX_SUMMARY_LEN)
        : undefined;
    const design = parseLineDesign(row, i + 1);
    if (!design.ok) return design;
    lines.push({
      widthMm,
      heightMm,
      qty,
      ...(designSummary ? { designSummary } : {}),
      colourPair: design.colourPair,
      adhesive3m: design.adhesive3m,
      objects: design.objects,
    });
  }

  return { ok: true, value: buildCheckout({ lines, shippingMethodId: shippingRaw, customerEmail: email }) };
}

export function buildCheckout(request: CheckoutRequest): BuiltCheckout {
  const quote = quoteOrder(
    request.lines.map((line) => ({
      widthMm: line.widthMm,
      heightMm: line.heightMm,
      qty: line.qty,
    })),
    request.shippingMethodId
  );

  if (quote.subtotalCents <= 0 || quote.totalCents <= 0) {
    // Still return a structured value; the route rejects empty money.
  }

  const lineItems: CheckoutLineItem[] = quote.lines.map((priced, index) => {
    const input = request.lines[index];
    const summary = input.designSummary?.trim();
    const sizeLabel = `${formatAreaMm2(priced.widthMm)} × ${formatAreaMm2(priced.heightMm)} mm`;
    const descriptionParts = [
      `${sizeLabel} · ${formatAreaMm2(priced.areaMm2)} mm²`,
      `${formatAud(priced.unitCents)} each`,
      priced.minimumApplied ? "minimum applied" : null,
      summary || null,
    ].filter(Boolean);

    return {
      quantity: priced.qty,
      price_data: {
        currency: "aud",
        unit_amount: priced.unitCents,
        product_data: {
          name: `TraffLabels plate ${index + 1} (${sizeLabel})`,
          description: descriptionParts.join(" · ").slice(0, 500),
          metadata: {
            widthMm: String(priced.widthMm),
            heightMm: String(priced.heightMm),
            areaMm2: String(priced.areaMm2),
            tierId: priced.tierId,
          },
        },
      },
    };
  });

  const shipping = SHIPPING_METHODS.find(
    (method) => method.id === request.shippingMethodId
  )!;
  lineItems.push({
    quantity: 1,
    price_data: {
      currency: "aud",
      unit_amount: quote.shippingCents,
      product_data: {
        name: `Shipping — ${shipping.label}`,
        description: `${shipping.region} · ${shipping.label}`,
        metadata: {
          shippingMethodId: shipping.id,
        },
      },
    },
  });

  const plates: StoredPlate[] = quote.lines.map((priced, index) => {
    const input = request.lines[index];
    const colourPair = input.colourPair ?? "yellow-black";
    const objects = input.objects ?? [];
    const text = objects
      .map((object) => object.text.trim())
      .filter(Boolean)
      .join("\n");
    return {
      widthMm: priced.widthMm,
      heightMm: priced.heightMm,
      qty: priced.qty,
      unitCents: priced.unitCents,
      lineCents: priced.lineCents,
      colourPair,
      colourLabel: COLOUR_PAIRS[colourPair].label,
      adhesive3m: input.adhesive3m === true,
      text,
      objects,
    };
  });

  return {
    request,
    quote,
    lineItems,
    plates,
    metadata: {
      shippingMethodId: request.shippingMethodId,
      plateCount: String(request.lines.length),
      subtotalCents: String(quote.subtotalCents),
      shippingCents: String(quote.shippingCents),
      totalCents: String(quote.totalCents),
    },
  };
}

/** Recalculate and assert the built total matches quoteOrder (for tests). */
export function checkoutTotalCents(request: CheckoutRequest) {
  return buildCheckout(request).quote.totalCents;
}
