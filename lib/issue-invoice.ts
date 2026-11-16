import "server-only";
import { AccountApplicationSchemaError } from "@/lib/account-application";
import { getAccountApplicationStore } from "@/lib/account-application-store";
import { sendInvoiceCopy } from "@/lib/invoice-mail";
import {
  InvoiceSchemaError,
  createProofInvoice,
  invoiceCcRecipients,
  invoiceErrorMessage,
  invoiceSnapshotFromWebhook,
  parseInvoiceCc,
  planProofInvoice,
  tradeCompanyName,
  type IssuedInvoice,
} from "@/lib/invoice";
import type { SavedOrder } from "@/lib/orders";
import { getOrderStore } from "@/lib/order-store";
import { getStripe } from "@/lib/stripe";
import { createStripeInvoiceGateway } from "@/lib/stripe-invoice";

export type InvoiceIssueOutcome =
  | {
      ok: true;
      order: SavedOrder;
      created: boolean;
      skipped?: "checkout-paid" | "existing";
      cc?: "sent" | "failed" | "skipped" | "dev-preview";
    }
  | { ok: false; error: string; order: SavedOrder | null };

/**
 * Create and send the tax invoice for an approved manual order.
 * A second call returns the invoice already stored or already in Stripe.
 * Failures are saved on the order and do not throw.
 */
export async function invoiceApprovedOrder(
  orderNumber: number,
  options?: { ccText?: string }
): Promise<InvoiceIssueOutcome> {
  const store = getOrderStore();
  if (!store) {
    return { ok: false, error: "Orders database is not configured.", order: null };
  }
  try {
    if (options?.ccText !== undefined) {
      const parsed = parseInvoiceCc(options.ccText);
      if (!parsed.ok) {
        return { ok: false, error: parsed.error, order: await store.getOrder(orderNumber) };
      }
      const savedCc = await store.updateOrder(orderNumber, { invoiceCcEmails: parsed.emails });
      if (!savedCc) return { ok: false, error: "Unknown order.", order: null };
    }

    const order = await store.getOrder(orderNumber);
    if (!order) return { ok: false, error: "Unknown order.", order: null };
    const proof = await store.getLatestProof(order.id);
    const trade = await lookupTradeAccount(order);
    const plan = planProofInvoice({
      order,
      proof,
      tradeAccount: trade.approved,
      companyName: trade.companyName,
    });
    if (plan.action === "skip") {
      return { ok: true, order, created: false, skipped: plan.reason };
    }
    if (plan.action === "existing") {
      return { ok: true, order, created: false, skipped: "existing" };
    }
    if (plan.action === "blocked") {
      const saved = await rememberError(orderNumber, plan.error);
      return { ok: false, error: plan.error, order: saved ?? order };
    }

    const stripe = getStripe();
    if (!stripe) {
      const message = "Stripe is not configured. Set STRIPE_SECRET_KEY.";
      const saved = await rememberError(orderNumber, message);
      return { ok: false, error: message, order: saved ?? order };
    }

    let issued: { invoice: IssuedInvoice; created: boolean };
    try {
      issued = await createProofInvoice(plan.request, createStripeInvoiceGateway(stripe));
    } catch (error) {
      console.error("[invoice] create failed", { orderNumber, error });
      const message = invoiceErrorMessage(error);
      const saved = await rememberError(orderNumber, message);
      return { ok: false, error: message, order: saved ?? order };
    }

    const saved = await store.recordStripeInvoice(order.orderNumber, {
      stripeInvoiceId: issued.invoice.id,
      stripeInvoiceNumber: issued.invoice.number,
      stripeInvoiceUrl: issued.invoice.hostedUrl,
      stripeInvoicePdfUrl: issued.invoice.pdfUrl,
      stripeInvoiceStatus: issued.invoice.status,
      stripeInvoiceError: "",
      stripeInvoiceDueAt: issued.invoice.dueAt,
    });
    const current = saved ?? order;
    if (!proof?.invoiceUrl && issued.invoice.hostedUrl) {
      try {
        await store.rememberProofInvoice(plan.request.proofId, issued.invoice.hostedUrl);
      } catch (error) {
        console.error("[invoice] could not store the proof invoice link", error);
      }
    }
    const cc = invoiceCcRecipients(current.invoiceCcEmails ?? [], current.customerEmail);
    let copy: "sent" | "failed" | "skipped" | "dev-preview" = "skipped";
    if (cc.length > 0 && issued.invoice.hostedUrl) {
      copy = await sendInvoiceCopy({
        to: cc,
        orderNumber: current.orderNumber,
        hostedUrl: issued.invoice.hostedUrl,
        pdfUrl: issued.invoice.pdfUrl,
        totalIncGstCents: plan.request.expectedTotalCents,
        gstCents: plan.request.gstCents,
      });
      if (copy === "failed") {
        console.error("[invoice] copy email failed", { orderNumber, to: cc });
      }
    }
    return { ok: true, order: current, created: issued.created, cc: copy };
  } catch (error) {
    console.error("[invoice] failed", { orderNumber, error });
    const message = invoiceErrorMessage(error);
    const saved = await rememberError(orderNumber, message);
    return { ok: false, error: message, order: saved };
  }
}

export async function applyInvoiceWebhook(
  eventType: string,
  invoice: {
    id?: string;
    number?: string | null;
    status?: string | null;
    hosted_invoice_url?: string | null;
    invoice_pdf?: string | null;
    due_date?: number | null;
    metadata?: { trafflabels_order_number?: string; trafflabels_order_id?: string } | null;
  }
) {
  const update = invoiceSnapshotFromWebhook(eventType, invoice);
  if (!update) return { applied: false as const };
  const store = getOrderStore();
  if (!store) {
    console.error("[invoice] webhook: orders database is not configured");
    return { applied: false as const, retry: true as const };
  }
  const byId = update.snapshot.id
    ? await store.findByStripeInvoiceId(update.snapshot.id)
    : null;
  const byNumber =
    !byId && update.snapshot.orderNumber
      ? await store.getOrder(update.snapshot.orderNumber)
      : null;
  const order = byId ?? byNumber;
  if (!order) {
    if (invoice.metadata?.trafflabels_order_id || update.snapshot.orderNumber) {
      console.error("[invoice] webhook: order not stored yet", {
        invoice: update.snapshot.id,
        orderNumber: update.snapshot.orderNumber,
      });
      return { applied: false as const, retry: true as const };
    }
    return { applied: false as const };
  }
  if (order.stripeInvoiceId && order.stripeInvoiceId !== update.snapshot.id) {
    return { applied: false as const };
  }
  await store.recordStripeInvoice(order.orderNumber, {
    stripeInvoiceId: update.snapshot.id,
    stripeInvoiceNumber: update.snapshot.number,
    stripeInvoiceUrl: update.snapshot.hostedUrl,
    stripeInvoicePdfUrl: update.snapshot.pdfUrl,
    stripeInvoiceStatus: update.status,
    stripeInvoiceError: update.error,
    stripeInvoiceDueAt: update.snapshot.dueAt,
  });
  return { applied: true as const, orderNumber: order.orderNumber, status: update.status };
}

async function lookupTradeAccount(order: SavedOrder) {
  try {
    const applications = getAccountApplicationStore();
    if (!applications?.findApprovedForInvoice) return { approved: false, companyName: null };
    const match = await applications.findApprovedForInvoice({
      email: order.customerEmail,
      orderId: order.id,
    });
    return { approved: Boolean(match), companyName: tradeCompanyName(match) };
  } catch (error) {
    if (!(error instanceof AccountApplicationSchemaError)) {
      console.error("[invoice] trade account lookup failed", error);
    }
    return { approved: false, companyName: null };
  }
}

async function rememberError(orderNumber: number, message: string) {
  const store = getOrderStore();
  if (!store) return null;
  try {
    return await store.recordStripeInvoice(orderNumber, { stripeInvoiceError: message });
  } catch (error) {
    if (!(error instanceof InvoiceSchemaError)) {
      console.error("[invoice] could not store the error", error);
    }
    return store.getOrder(orderNumber);
  }
}
