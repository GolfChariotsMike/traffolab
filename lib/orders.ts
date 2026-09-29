/**
 * TraffLabels paid-order records. Pure helpers only — no database.
 * Statuses the production board can set: NEW | CUT | READY TO SHIP | SHIPPED.
 * A paid Checkout Session is stored as NEW.
 */

import type { ShippingMethodId } from "@/lib/pricing";

export const ORDER_STATUSES = ["NEW", "CUT", "READY TO SHIP", "SHIPPED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type PlateAlign = "left" | "center" | "right";

export type PlateObject = {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  align: PlateAlign;
};

/** Geometry needed to cut the plate later. Prices are server-calculated cents. */
export type StoredPlate = {
  widthMm: number;
  heightMm: number;
  qty: number;
  unitCents: number;
  lineCents: number;
  colourPair: string;
  colourLabel: string;
  adhesive3m: boolean;
  text: string;
  objects: PlateObject[];
};

export type CheckoutDraft = {
  id: string;
  customerEmail: string;
  shippingMethodId: ShippingMethodId;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  plates: StoredPlate[];
};

export type ShippingAddress = {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type SavedOrder = {
  id: string;
  orderNumber: number;
  createdAt: string;
  updatedAt: string;
  status: OrderStatus;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shipping: ShippingAddress;
  shippingMethodId: ShippingMethodId;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  stripeSessionId: string;
  stripePaymentIntentId: string | null;
  stripeReceiptUrl: string | null;
  stripeLivemode: boolean;
  note: string;
  trackingLink: string;
  plates: StoredPlate[];
};

export type NewPaidOrder = Omit<SavedOrder, "orderNumber">;

export type PaymentFacts = {
  sessionId: string;
  livemode: boolean;
  createdAt: string;
  customerEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
  paymentIntentId: string | null;
  receiptUrl: string | null;
  shipping: ShippingAddress | null;
};

export type OrderPatch = {
  status?: OrderStatus;
  note?: string;
  trackingLink?: string;
};

const NOTE_MAX = 4000;
const TRACKING_MAX = 500;

export function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    typeof value === "string" &&
    (ORDER_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Move an order to one of the four production statuses.
 * Any of the four may be chosen from any current status so a mis-click can be corrected.
 */
export function transitionStatus(
  current: OrderStatus,
  next: unknown
): OrderStatus | null {
  if (!isOrderStatus(current) || !isOrderStatus(next)) return null;
  return next;
}

export function shouldFulfillCheckout(
  eventType: string,
  paymentStatus: string | null | undefined
): boolean {
  if (eventType === "checkout.session.async_payment_succeeded") return true;
  return eventType === "checkout.session.completed" && paymentStatus === "paid";
}

export function orderItemCount(plates: Array<{ qty: number }>) {
  return plates.reduce((sum, plate) => sum + (Number.isFinite(plate.qty) ? plate.qty : 0), 0);
}

export function countryLabel(code: string) {
  if (code.trim().toUpperCase() === "AU") return "Australia";
  return code.trim();
}

export function formatPostage(input: {
  shipping: ShippingAddress;
  customerPhone?: string;
  customerEmail?: string;
}) {
  const shipping = input.shipping;
  const lines = [
    shipping.name,
    shipping.line1,
    shipping.line2,
    [shipping.city, shipping.state, shipping.postalCode].filter(Boolean).join(" "),
    countryLabel(shipping.country),
    input.customerPhone ?? "",
    input.customerEmail ?? "",
  ]
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.join("\n");
}

export function formatOrderDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Perth",
  }).format(date);
}

export function stripeDashboardPaymentUrl(
  livemode: boolean,
  paymentIntentId: string | null
) {
  if (!paymentIntentId) return null;
  const prefix = livemode ? "" : "test/";
  return `https://dashboard.stripe.com/${prefix}payments/${paymentIntentId}`;
}

function cleanTrackingLink(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length > TRACKING_MAX) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return trimmed;
}

export function parseOrderPatch(
  body: unknown
): { ok: true; value: OrderPatch } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request." };
  }
  const raw = body as Record<string, unknown>;
  const patch: OrderPatch = {};

  if ("status" in raw) {
    const next = transitionStatus("NEW", raw.status);
    if (!next) {
      return {
        ok: false,
        error: "Status must be NEW, CUT, READY TO SHIP, or SHIPPED.",
      };
    }
    patch.status = next;
  }

  if ("note" in raw) {
    if (typeof raw.note !== "string") {
      return { ok: false, error: "Note must be text." };
    }
    const note = raw.note.trim();
    if (note.length > NOTE_MAX) {
      return { ok: false, error: "Note is too long." };
    }
    patch.note = note;
  }

  if ("trackingLink" in raw) {
    if (typeof raw.trackingLink !== "string") {
      return { ok: false, error: "Tracking link must be text." };
    }
    const trackingLink = cleanTrackingLink(raw.trackingLink);
    if (trackingLink == null) {
      return {
        ok: false,
        error: "Tracking link must be an http or https URL.",
      };
    }
    patch.trackingLink = trackingLink;
  }

  if (
    patch.status === undefined &&
    patch.note === undefined &&
    patch.trackingLink === undefined
  ) {
    return { ok: false, error: "Nothing to update." };
  }

  return { ok: true, value: patch };
}

export function applyOrderPatch(order: SavedOrder, patch: OrderPatch, now = new Date()): SavedOrder {
  const status = patch.status
    ? transitionStatus(order.status, patch.status) ?? order.status
    : order.status;
  return {
    ...order,
    status,
    note: patch.note !== undefined ? patch.note : order.note,
    trackingLink:
      patch.trackingLink !== undefined ? patch.trackingLink : order.trackingLink,
    updatedAt: now.toISOString(),
  };
}

function blankShipping(name: string): ShippingAddress {
  return {
    name,
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  };
}

/** Build the row inserted after Stripe confirms payment. Status is always NEW. */
export function buildPaidOrder(
  draft: CheckoutDraft,
  payment: PaymentFacts,
  now = new Date()
): NewPaidOrder {
  const customerName = (
    payment.shipping?.name ||
    payment.customerName ||
    ""
  ).trim();
  const shipping = payment.shipping
    ? { ...payment.shipping, name: payment.shipping.name.trim() || customerName }
    : blankShipping(customerName);
  const createdAt = payment.createdAt || now.toISOString();

  return {
    id: crypto.randomUUID(),
    createdAt,
    updatedAt: now.toISOString(),
    status: "NEW",
    customerName,
    customerEmail: (payment.customerEmail || draft.customerEmail).trim().toLowerCase(),
    customerPhone: (payment.customerPhone || "").trim(),
    shipping,
    shippingMethodId: draft.shippingMethodId,
    subtotalCents: draft.subtotalCents,
    shippingCents: draft.shippingCents,
    totalCents: draft.totalCents,
    stripeSessionId: payment.sessionId,
    stripePaymentIntentId: payment.paymentIntentId,
    stripeReceiptUrl: payment.receiptUrl,
    stripeLivemode: payment.livemode,
    note: "",
    trackingLink: "",
    plates: draft.plates,
  };
}
