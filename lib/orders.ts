/**
 * TraffLabels paid-order records. Pure helpers only — no database.
 * Statuses the production board can set: NEW | CUT | READY TO SHIP | SHIPPED.
 * A paid Checkout Session is stored as NEW.
 */

import {
  applyFixedTextSize,
  applyUniformTextSize,
  restoreIndividualLegendFit,
} from "@/lib/label-design";
import type { CustomCutFile } from "@/lib/custom-cut-file";
import type { EngraveFontFace, EngraveFontWeight, PlateHole } from "@/lib/label-design";
import type { ShippingMethodId } from "@/lib/pricing";

export type { EngraveFontFace, EngraveFontWeight, PlateHole };

export const ORDER_STATUSES = ["NEW", "CUT", "READY TO SHIP", "SHIPPED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_SOURCES = ["stripe", "manual"] as const;
export type PaymentSource = (typeof PAYMENT_SOURCES)[number];

export type PlateAlign = "left" | "center" | "right";

export type PlateObject = {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  align: PlateAlign;
  /** Omitted or 400 keeps existing proof hashes unchanged. */
  fontWeight?: EngraveFontWeight;
  /** Omitted or "arial" keeps existing proof hashes unchanged. */
  fontFace?: EngraveFontFace;
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
  /** Cut-through holes (cable ties, mounting). Omitted when the plate has none. */
  holes?: PlateHole[];
  /** Optional switchboard or site group, set in the admin before a proof is sent. */
  location?: string;
  /**
   * Set when this plate uses the order's shared text size for its dimensions.
   * Omitted on individually fitted plates so existing proof hashes stay put.
   */
  uniformTextSize?: boolean;
  /** Set when every plate in the order uses this exact em size. */
  uniformTextMm?: number;
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
  /** stripe = Checkout payment. manual = CSV / trade order with no Stripe charge. */
  paymentSource: PaymentSource;
  note: string;
  trackingLink: string;
  plates: StoredPlate[];
  /** One text size for every plate of the same dimensions. Off leaves each legend to fill its own plate. */
  uniformTextSize?: boolean;
  /** When set, every plate in the order uses this em size, whatever its dimensions. */
  uniformTextMm?: number;
  /** Stripe tax invoice created when a manual proof is approved. */
  stripeInvoiceId?: string | null;
  stripeInvoiceNumber?: string | null;
  stripeInvoiceUrl?: string | null;
  stripeInvoicePdfUrl?: string | null;
  stripeInvoiceStatus?: string | null;
  stripeInvoiceError?: string | null;
  stripeInvoiceDueAt?: string | null;
  /** Extra invoice recipients. Stripe emails the customer; these get a copy. */
  invoiceCcEmails?: string[];
  /**
   * Hand-made LightBurn files in the private cut-file bucket.
   * Empty or omitted means downloads use the auto-generated Arial zip.
   */
  customCutFiles?: CustomCutFile[];
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
  /** One trimmed location per plate, in plate order. */
  plateLocations?: string[];
  /** Turn the shared text size on or off. Changing it rewrites the legends. */
  uniformTextSize?: boolean;
  /** Fixed em size for every plate. Null clears it. Omit to leave the current size. */
  uniformTextMm?: number | null;
  /** Replace the invoice copy list. An empty list clears it. */
  invoiceCcEmails?: string[];
};

export class OrderUpdateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderUpdateError";
  }
}

const LOCATION_MAX = 80;

export function cleanPlateLocation(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const location = value.replace(/\s+/g, " ").trim();
  if (location.length > LOCATION_MAX) return null;
  return location;
}

export function parsePlateLocations(
  value: unknown
): { ok: true; locations: string[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) {
    return { ok: false, error: "Locations must be a list." };
  }
  if (value.length > 500) {
    return { ok: false, error: "Too many locations." };
  }
  const locations: string[] = [];
  for (const item of value) {
    const location = cleanPlateLocation(item);
    if (location === null) {
      return { ok: false, error: "Each location must be 80 characters or fewer." };
    }
    locations.push(location);
  }
  return { ok: true, locations };
}

const NOTE_MAX = 4000;
const TRACKING_MAX = 500;
const INVOICE_CC_MAX = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Comma, semicolon, or newline separated invoice copy addresses. */
export function parseInvoiceCc(
  value: unknown
): { ok: true; emails: string[] } | { ok: false; error: string } {
  if (value == null) return { ok: true, emails: [] };
  if (typeof value !== "string" && !Array.isArray(value)) {
    return { ok: false, error: "Invoice copy emails must be text." };
  }
  const raw = Array.isArray(value) ? value.filter((item) => typeof item === "string").join(",") : value;
  if (raw.length > 2000) return { ok: false, error: "Invoice copy emails are too long." };
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const part of raw.split(/[,;\n]/)) {
    const email = part.trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL_RE.test(email) || email.length > 200) {
      return { ok: false, error: `“${part.trim().slice(0, 80)}” is not an email address.` };
    }
    if (seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }
  if (emails.length > INVOICE_CC_MAX) {
    return { ok: false, error: "Enter at most 10 invoice copy emails." };
  }
  return { ok: true, emails };
}

export function paymentSourceLabel(source: PaymentSource | undefined) {
  return source === "manual" ? "Manual" : "Stripe";
}

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

/** One line for the orders board, e.g. "31 plates: 20 × 20×10 mm, 11 × 40×20 mm". */
export function plateSizeSummary(
  plates: Array<{ widthMm: number; heightMm: number; qty: number }>
) {
  const groups: { widthMm: number; heightMm: number; qty: number }[] = [];
  for (const plate of plates) {
    const qty = Number.isFinite(plate.qty) ? plate.qty : 0;
    if (qty === 0) continue;
    const found = groups.find(
      (group) => group.widthMm === plate.widthMm && group.heightMm === plate.heightMm
    );
    if (found) found.qty += qty;
    else groups.push({ widthMm: plate.widthMm, heightMm: plate.heightMm, qty });
  }
  const total = groups.reduce((sum, group) => sum + group.qty, 0);
  const noun = total === 1 ? "plate" : "plates";
  if (groups.length === 0) return `0 ${noun}`;
  const parts = groups.map(
    (group) => `${group.qty} × ${group.widthMm}×${group.heightMm} mm`
  );
  return `${total} ${noun}: ${parts.join(", ")}`;
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

/** Date and time in Perth, for a customer approval line. */
export function formatPerthDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Perth",
    hourCycle: "h12",
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

  if ("plateLocations" in raw) {
    const locations = parsePlateLocations(raw.plateLocations);
    if (!locations.ok) return locations;
    patch.plateLocations = locations.locations;
  }

  if ("uniformTextSize" in raw) {
    if (typeof raw.uniformTextSize !== "boolean") {
      return { ok: false, error: "Uniform text size must be on or off." };
    }
    patch.uniformTextSize = raw.uniformTextSize;
  }

  if ("uniformTextMm" in raw) {
    if (raw.uniformTextMm == null || raw.uniformTextMm === "") {
      patch.uniformTextMm = null;
    } else {
      const mm = cleanUniformTextMm(raw.uniformTextMm);
      if (mm == null) {
        return { ok: false, error: "Fixed text size must be between 1 and 40 mm." };
      }
      patch.uniformTextMm = mm;
    }
  }

  if ("invoiceCc" in raw) {
    const parsed = parseInvoiceCc(raw.invoiceCc);
    if (!parsed.ok) return parsed;
    patch.invoiceCcEmails = parsed.emails;
  }

  if (
    patch.status === undefined &&
    patch.note === undefined &&
    patch.trackingLink === undefined &&
    patch.plateLocations === undefined &&
    patch.uniformTextSize === undefined &&
    patch.uniformTextMm === undefined &&
    patch.invoiceCcEmails === undefined
  ) {
    return { ok: false, error: "Nothing to update." };
  }

  return { ok: true, value: patch };
}

function requestedUniform(order: SavedOrder, patch: OrderPatch) {
  const fixedMm =
    typeof patch.uniformTextMm === "number"
      ? patch.uniformTextMm
      : patch.uniformTextMm === null || patch.uniformTextSize === false
        ? undefined
        : order.uniformTextMm;
  const shared =
    fixedMm != null
      ? false
      : patch.uniformTextSize !== undefined
        ? patch.uniformTextSize
        : order.uniformTextSize === true;
  return { fixedMm, shared };
}

/**
 * 6.438 mm shown in the dashboard is cleaned to 6.4 on save. That round trip
 * is the same setting. Re-laying the legends would stack a multi-line plate
 * onto one y and rewrite its line breaks.
 */
function sameFixedMm(stored: number | undefined, requested: number | undefined) {
  if (stored == null && requested == null) return true;
  if (stored == null || requested == null) return false;
  if (stored === requested) return true;
  return cleanUniformTextMm(stored) === requested;
}

export function applyOrderPatch(order: SavedOrder, patch: OrderPatch, now = new Date()): SavedOrder {
  const status = patch.status
    ? transitionStatus(order.status, patch.status) ?? order.status
    : order.status;
  let plates = order.plates;
  if (patch.plateLocations) {
    const nextLocations = patch.plateLocations;
    const locationsChanged = plates.some(
      (plate, index) => (plate.location ?? "") !== (nextLocations[index] ?? "")
    );
    if (locationsChanged) {
      plates = plates.map((plate, index) => ({
        ...plate,
        location: nextLocations[index] ?? "",
      }));
    }
  }
  const requested = requestedUniform(order, patch);
  const layoutUnchanged =
    sameFixedMm(order.uniformTextMm, requested.fixedMm) &&
    requested.shared === (order.uniformTextMm == null && order.uniformTextSize === true);
  let uniformTextSize = order.uniformTextSize === true;
  let uniformTextMm = order.uniformTextMm;
  if (!layoutUnchanged) {
    if (requested.fixedMm != null) {
      plates = applyFixedTextSize(plates, requested.fixedMm);
      uniformTextSize = false;
      uniformTextMm = requested.fixedMm;
    } else if (requested.shared) {
      plates = applyUniformTextSize(plates);
      uniformTextSize = true;
      uniformTextMm = undefined;
    } else if (order.uniformTextSize === true || order.uniformTextMm != null) {
      plates = restoreIndividualLegendFit(plates);
      uniformTextSize = false;
      uniformTextMm = undefined;
    } else {
      uniformTextSize = false;
      uniformTextMm = undefined;
    }
  }
  return {
    ...order,
    status,
    note: patch.note !== undefined ? patch.note : order.note,
    trackingLink:
      patch.trackingLink !== undefined ? patch.trackingLink : order.trackingLink,
    uniformTextSize,
    uniformTextMm,
    plates,
    invoiceCcEmails:
      patch.invoiceCcEmails !== undefined ? patch.invoiceCcEmails : order.invoiceCcEmails,
    updatedAt: now.toISOString(),
  };
}

export function cleanUniformTextMm(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed * 10) / 10;
  if (rounded < 1 || rounded > 40) return null;
  return rounded;
}

/** Body the orders dashboard sends. A locked order omits every plate field. */
export function adminOrderUpdateBody(input: {
  platesLocked: boolean;
  status: OrderStatus;
  note: string;
  trackingLink: string;
  locations: string[];
  uniformText: boolean;
  uniformTextMm: string;
  invoiceCc: string;
}): { ok: true; body: Record<string, unknown> } | { ok: false; error: string } {
  const body: Record<string, unknown> = {
    status: input.status,
    note: input.note,
    trackingLink: input.trackingLink,
    invoiceCc: input.invoiceCc,
  };
  if (input.platesLocked) return { ok: true, body };
  const typed = input.uniformTextMm.trim();
  const fixedMm = input.uniformText && typed ? cleanUniformTextMm(typed) : null;
  if (input.uniformText && typed && fixedMm == null) {
    return { ok: false, error: "Fixed text size must be between 1 and 40 mm." };
  }
  body.plateLocations = input.locations;
  body.uniformTextSize = input.uniformText && fixedMm == null;
  body.uniformTextMm = input.uniformText ? fixedMm : null;
  return { ok: true, body };
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
    paymentSource: "stripe",
    note: "",
    trackingLink: "",
    plates: draft.plates,
  };
}
