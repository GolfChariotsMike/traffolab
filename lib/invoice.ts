/**
 * Tax invoices for approved TraffLabels proofs. Pure helpers — no Stripe, no database.
 *
 * Proof line prices are the ex-GST cents stored on the order. GST is 10% of that
 * ex-GST total, rounded half up, which is the figure the customer approved.
 * GST is its own invoice line so the Stripe total matches that approved total
 * to the cent. Stripe's per-line tax rounding would not.
 */

import { FOOTER_LINE, SALES_EMAIL } from "@/lib/account-application-copy";
import { parseInvoiceCc, type SavedOrder, type ShippingAddress } from "@/lib/orders";

export { parseInvoiceCc };
import { formatAud } from "@/lib/pricing";
import {
  proofPriceSummary,
  type ProofPriceSummary,
  type ProofRecord,
} from "@/lib/proofs";

/** Days until a proof invoice is due when the customer has no approved trade account. */
export const DEFAULT_INVOICE_DUE_DAYS = 7;

/** Payment terms on an approved trade account. */
export const TRADE_ACCOUNT_DUE_DAYS = 14;

export const INVOICE_FROM = "TraffLabels <sales@trafflabels.com.au>";
export const INVOICE_REPLY_TO = SALES_EMAIL;

export const INVOICE_MIGRATION_HINT =
  "Apply db/migrations/20261116_trafflabels_order_invoices.sql on the database before proof invoices can be stored.";

export const INVOICE_WEBHOOK_EVENTS = [
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.voided",
  "invoice.marked_uncollectible",
] as const;

export type InvoiceWebhookEvent = (typeof INVOICE_WEBHOOK_EVENTS)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ORDER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class InvoiceSchemaError extends Error {
  constructor() {
    super(INVOICE_MIGRATION_HINT);
    this.name = "InvoiceSchemaError";
  }
}

export type InvoiceLine = {
  kind: "plate" | "shipping" | "adjustment" | "gst";
  description: string;
  quantity: number;
  unitAmountCents: number;
};

export type InvoiceRequest = {
  orderId: string;
  orderNumber: number;
  proofId: string;
  idempotencyKey: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  shipping: ShippingAddress;
  daysUntilDue: number;
  lines: InvoiceLine[];
  expectedTotalCents: number;
  gstCents: number;
  description: string;
  footer: string;
};

export type IssuedInvoice = {
  id: string;
  number: string | null;
  hostedUrl: string | null;
  pdfUrl: string | null;
  status: string;
  dueAt: string | null;
  totalCents: number | null;
};

export type StripeInvoicePatch = {
  stripeInvoiceId?: string | null;
  stripeInvoiceNumber?: string | null;
  stripeInvoiceUrl?: string | null;
  stripeInvoicePdfUrl?: string | null;
  stripeInvoiceStatus?: string | null;
  stripeInvoiceError?: string | null;
  stripeInvoiceDueAt?: string | null;
};

/** Keep the first Stripe invoice id. A different id does not replace it. */
export function mergeInvoicePatch(current: SavedOrder, patch: StripeInvoicePatch, now = new Date()): SavedOrder {
  const currentId = current.stripeInvoiceId?.trim() || null;
  const nextId =
    patch.stripeInvoiceId !== undefined ? patch.stripeInvoiceId?.trim() || null : currentId;
  if (currentId && nextId && currentId !== nextId) return current;
  const pick = <T>(value: T | undefined, fallback: T): T => (value !== undefined ? value : fallback);
  return {
    ...current,
    stripeInvoiceId: nextId,
    stripeInvoiceNumber: pick(patch.stripeInvoiceNumber, current.stripeInvoiceNumber ?? null),
    stripeInvoiceUrl: pick(patch.stripeInvoiceUrl, current.stripeInvoiceUrl ?? null),
    stripeInvoicePdfUrl: pick(patch.stripeInvoicePdfUrl, current.stripeInvoicePdfUrl ?? null),
    stripeInvoiceStatus: pick(patch.stripeInvoiceStatus, current.stripeInvoiceStatus ?? null),
    stripeInvoiceError: pick(patch.stripeInvoiceError, current.stripeInvoiceError ?? null),
    stripeInvoiceDueAt: pick(patch.stripeInvoiceDueAt, current.stripeInvoiceDueAt ?? null),
    updatedAt: now.toISOString(),
  };
}

export type InvoiceGateway = {
  findInvoice(orderId: string): Promise<IssuedInvoice | null>;
  createAndSend(request: InvoiceRequest): Promise<IssuedInvoice>;
  /** Finish a draft, or send an open invoice again under the same idempotency key. */
  resume(invoiceId: string, request: InvoiceRequest): Promise<IssuedInvoice>;
};

export type TradeAccountMatch = {
  status: string;
  apEmail: string;
  purchasingEmail: string;
  linkedOrderId: string | null;
  tradingName: string;
  registeredCompanyName: string;
};

export type InvoicePlan =
  | { action: "skip"; reason: "checkout-paid" }
  | { action: "existing" }
  | { action: "blocked"; error: string }
  | { action: "ready"; request: InvoiceRequest };

export function invoiceDueDays(hasApprovedTradeAccount: boolean) {
  return hasApprovedTradeAccount ? TRADE_ACCOUNT_DUE_DAYS : DEFAULT_INVOICE_DUE_DAYS;
}

export function invoiceIdempotencyKey(orderId: string) {
  return `trafflabels-invoice-${orderId}`;
}

export function isInvoiceWebhookEvent(type: string): type is InvoiceWebhookEvent {
  return (INVOICE_WEBHOOK_EVENTS as readonly string[]).includes(type);
}

export function invoiceLineTotal(lines: InvoiceLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity * line.unitAmountCents, 0);
}

/**
 * Plate and postage lines use the ex-GST cents on the proof. A price-adjustment
 * line appears only when those lines do not add up to the stored order total.
 * The GST line is the proof's GST, so the sum is the approved inc-GST total.
 */
export function buildInvoiceLines(summary: ProofPriceSummary): InvoiceLine[] {
  const lines: InvoiceLine[] = [];
  for (const line of summary.lines) {
    if (line.lineCents === 0) continue;
    const exactUnit = line.qty > 0 && line.unitCents * line.qty === line.lineCents;
    lines.push({
      kind: "plate",
      description: `Traffolyte labels, ${line.widthMm} × ${line.heightMm} mm`,
      quantity: exactUnit ? line.qty : 1,
      unitAmountCents: exactUnit ? line.unitCents : line.lineCents,
    });
  }
  if (summary.shippingCents !== 0) {
    lines.push({
      kind: "shipping",
      description: summary.shippingLabel,
      quantity: 1,
      unitAmountCents: summary.shippingCents,
    });
  }
  const priced = invoiceLineTotal(lines);
  const adjustment = summary.exGstCents - priced;
  if (adjustment !== 0) {
    lines.push({
      kind: "adjustment",
      description: "Price adjustment",
      quantity: 1,
      unitAmountCents: adjustment,
    });
  }
  if (summary.gstCents !== 0) {
    lines.push({
      kind: "gst",
      description: "GST 10%",
      quantity: 1,
      unitAmountCents: summary.gstCents,
    });
  }
  return lines;
}

export function invoiceFooter(gstCents: number, totalIncGstCents: number) {
  return [
    "Tax Invoice",
    FOOTER_LINE,
    `GST 10% ${formatAud(gstCents)}. Total ${formatAud(totalIncGstCents)} inc GST.`,
  ].join("\n");
}

export function invoiceDescription(orderNumber: number) {
  return `Tax Invoice for TraffLabels order #${orderNumber}`;
}

export function invoiceCustomerName(
  order: Pick<SavedOrder, "customerName" | "shipping">,
  companyName?: string | null
) {
  const company = companyName?.replace(/\s+/g, " ").trim();
  if (company) return company.slice(0, 200);
  const name = order.customerName.trim() || order.shipping.name.trim();
  return (name || "TraffLabels customer").slice(0, 200);
}

export function matchApprovedTradeAccount<T extends TradeAccountMatch>(
  applications: T[],
  input: { email: string; orderId: string }
): T | null {
  const email = input.email.trim().toLowerCase();
  const matches = applications.filter((application) => {
    if (application.status !== "approved") return false;
    if (application.linkedOrderId && application.linkedOrderId === input.orderId) return true;
    if (!email) return false;
    return (
      application.apEmail.trim().toLowerCase() === email ||
      application.purchasingEmail.trim().toLowerCase() === email
    );
  });
  const linked = matches.find((application) => application.linkedOrderId === input.orderId);
  return linked ?? matches[0] ?? null;
}

export function tradeCompanyName(match: TradeAccountMatch | null) {
  if (!match) return null;
  const name = match.tradingName.trim() || match.registeredCompanyName.trim();
  return name || null;
}

export function planProofInvoice(input: {
  order: SavedOrder;
  proof: ProofRecord | null;
  tradeAccount: boolean;
  companyName?: string | null;
  now?: Date;
}): InvoicePlan {
  const order = input.order;
  if (order.stripeInvoiceId?.trim()) return { action: "existing" };
  if (order.paymentSource !== "manual") return { action: "skip", reason: "checkout-paid" };
  if (!input.proof || input.proof.status !== "approved" || input.proof.orderId !== order.id) {
    return { action: "blocked", error: "Approve the proof before sending an invoice." };
  }
  const email = order.customerEmail.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return {
      action: "blocked",
      error: "This order has no customer email, so Stripe cannot send an invoice.",
    };
  }
  const summary = proofPriceSummary(input.proof.plates, order);
  const approved = input.proof.approvedTotalCents;
  const expectedTotalCents =
    typeof approved === "number" && approved > 0 ? approved : summary.totalIncGstCents;
  if (expectedTotalCents <= 0) {
    return { action: "blocked", error: "This proof has nothing to invoice." };
  }
  const lines = buildInvoiceLines(
    expectedTotalCents === summary.totalIncGstCents
      ? summary
      : adjustedSummary(summary, expectedTotalCents)
  );
  if (invoiceLineTotal(lines) !== expectedTotalCents) {
    return { action: "blocked", error: "Invoice lines do not add up to the approved proof total." };
  }
  return {
    action: "ready",
    request: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      proofId: input.proof.id,
      idempotencyKey: invoiceIdempotencyKey(order.id),
      customerEmail: email,
      customerName: invoiceCustomerName(order, input.companyName),
      customerPhone: order.customerPhone.trim(),
      shipping: order.shipping,
      daysUntilDue: invoiceDueDays(input.tradeAccount),
      lines,
      expectedTotalCents,
      gstCents: lines.find((line) => line.kind === "gst")?.unitAmountCents ?? 0,
      description: invoiceDescription(order.orderNumber),
      footer: invoiceFooter(
        lines.find((line) => line.kind === "gst")?.unitAmountCents ?? 0,
        expectedTotalCents
      ),
    },
  };
}

/**
 * Keep the plate and postage figures, and move any gap between the current
 * proof total and the cents the customer actually approved into the adjustment.
 */
function adjustedSummary(summary: ProofPriceSummary, expectedTotalCents: number): ProofPriceSummary {
  const gstCents = Math.max(0, expectedTotalCents - summary.exGstCents);
  const exGstCents = expectedTotalCents - gstCents;
  return { ...summary, exGstCents, gstCents, totalIncGstCents: expectedTotalCents };
}

export async function createProofInvoice(
  request: InvoiceRequest,
  gateway: InvoiceGateway
): Promise<{ invoice: IssuedInvoice; created: boolean }> {
  if (invoiceLineTotal(request.lines) !== request.expectedTotalCents) {
    throw new Error("Invoice lines do not add up to the approved proof total.");
  }
  const existing = await gateway.findInvoice(request.orderId);
  if (
    existing &&
    existing.status !== "draft" &&
    existing.status !== "open" &&
    existing.status !== "void"
  ) {
    if (existing.totalCents != null && existing.totalCents !== request.expectedTotalCents) {
      throw new Error(
        "A Stripe invoice for this order already exists and its total does not match the proof."
      );
    }
    return { invoice: existing, created: false };
  }
  const resumed = Boolean(
    existing && (existing.status === "draft" || existing.status === "open")
  );
  const invoice = resumed
    ? await gateway.resume(existing!.id, request)
    : await gateway.createAndSend(request);
  if (invoice.totalCents != null && invoice.totalCents !== request.expectedTotalCents) {
    throw new Error("Stripe invoice total does not match the approved proof.");
  }
  return { invoice, created: !resumed };
}

/** Stripe already emails the customer. CC copies go to the other addresses. */
export function invoiceCcRecipients(emails: string[], customerEmail: string) {
  const customer = customerEmail.trim().toLowerCase();
  return emails.filter((email) => email !== customer);
}

export function invoiceCopyMessage(input: {
  orderNumber: number;
  hostedUrl: string;
  pdfUrl: string | null;
  totalIncGstCents: number;
  gstCents: number;
}) {
  const total = formatAud(input.totalIncGstCents);
  const gst = formatAud(input.gstCents);
  const subject = `TraffLabels tax invoice for order #${input.orderNumber}`;
  const lines = [
    `TraffLabels has issued a tax invoice for order #${input.orderNumber}.`,
    "",
    `Total ${total} inc GST (${gst} GST).`,
    "",
    "View and pay the invoice:",
    input.hostedUrl,
  ];
  if (input.pdfUrl) lines.push("", "PDF:", input.pdfUrl);
  lines.push("", "TraffLabels", SALES_EMAIL);
  const text = lines.join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#12151a;">
<p>TraffLabels has issued a tax invoice for order #${input.orderNumber}.</p>
<p>Total ${escapeHtml(total)} inc GST (${escapeHtml(gst)} GST).</p>
<p><a href="${escapeHtml(input.hostedUrl)}">View and pay the invoice</a></p>
${input.pdfUrl ? `<p><a href="${escapeHtml(input.pdfUrl)}">Download the PDF</a></p>` : ""}
<p>TraffLabels<br>${escapeHtml(SALES_EMAIL)}</p>
</div>`;
  return { subject, text, html };
}

export type InvoiceBoardState =
  | "none"
  | "error"
  | "sent"
  | "paid"
  | "overdue"
  | "payment_failed"
  | "void";

export function invoiceBoardState(order: SavedOrder, now = new Date()): InvoiceBoardState {
  const id = order.stripeInvoiceId?.trim() || "";
  const status = order.stripeInvoiceStatus?.trim() || "";
  if (!id) return order.stripeInvoiceError?.trim() ? "error" : "none";
  if (status === "paid") return "paid";
  if (status === "void") return "void";
  const due = order.stripeInvoiceDueAt ? new Date(order.stripeInvoiceDueAt) : null;
  const pastDue = due != null && !Number.isNaN(due.getTime()) && due.getTime() < now.getTime();
  if (status === "uncollectible" || pastDue) return "overdue";
  if (status === "payment_failed") return "payment_failed";
  return "sent";
}

export function invoiceStatusLabel(state: InvoiceBoardState) {
  switch (state) {
    case "sent":
      return "Sent";
    case "paid":
      return "Paid";
    case "overdue":
      return "Overdue";
    case "payment_failed":
      return "Payment failed";
    case "void":
      return "Void";
    case "error":
      return "Failed";
    default:
      return "—";
  }
}

export type InvoiceWebhookSnapshot = {
  id: string;
  number: string | null;
  status: string | null;
  hostedUrl: string | null;
  pdfUrl: string | null;
  dueAt: string | null;
  orderNumber: number | null;
};

export function invoiceSnapshotFromWebhook(
  eventType: string,
  invoice: {
    id?: string;
    number?: string | null;
    status?: string | null;
    hosted_invoice_url?: string | null;
    invoice_pdf?: string | null;
    due_date?: number | null;
    metadata?: { trafflabels_order_number?: string } | null;
  }
): { status: string; error: string; snapshot: InvoiceWebhookSnapshot } | null {
  if (!isInvoiceWebhookEvent(eventType) || !invoice.id) return null;
  let status = invoice.status ?? "open";
  let error = "";
  if (eventType === "invoice.paid") {
    status = "paid";
    error = "";
  } else if (eventType === "invoice.payment_failed") {
    status = "payment_failed";
    error = "The customer's payment failed.";
  } else if (eventType === "invoice.voided") {
    status = "void";
  } else if (eventType === "invoice.marked_uncollectible") {
    status = "uncollectible";
  }
  const orderNumber = Number(invoice.metadata?.trafflabels_order_number);
  return {
    status,
    error,
    snapshot: {
      id: invoice.id,
      number: invoice.number ?? null,
      status,
      hostedUrl: httpsOrNull(invoice.hosted_invoice_url),
      pdfUrl: httpsOrNull(invoice.invoice_pdf),
      dueAt:
        typeof invoice.due_date === "number"
          ? new Date(invoice.due_date * 1000).toISOString()
          : null,
      orderNumber: Number.isInteger(orderNumber) && orderNumber > 0 ? orderNumber : null,
    },
  };
}

export function httpsOrNull(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isSearchableOrderId(orderId: string) {
  return ORDER_ID_RE.test(orderId);
}

export function invoiceErrorMessage(error: unknown) {
  if (error instanceof InvoiceSchemaError) return error.message;
  if (error instanceof Error && error.message.trim()) {
    return error.message.replace(/\s+/g, " ").trim().slice(0, 500);
  }
  return "Could not create the Stripe invoice.";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
