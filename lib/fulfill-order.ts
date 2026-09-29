import "server-only";
import type Stripe from "stripe";
import { buildPaidOrder } from "@/lib/orders";
import { getOrderStore } from "@/lib/order-store";
import { paymentFactsFromCheckoutSession, paymentIntentIdOf } from "@/lib/payment-facts";
import { getStripe } from "@/lib/stripe";

export class OrderStoreUnavailableError extends Error {
  constructor() {
    super("Orders database is not configured.");
    this.name = "OrderStoreUnavailableError";
  }
}

export class DraftMissingError extends Error {
  constructor(draftId: string) {
    super(`Checkout draft ${draftId} was not found.`);
    this.name = "DraftMissingError";
  }
}

async function receiptUrlFor(session: Stripe.Checkout.Session) {
  const stripe = getStripe();
  const paymentIntentId = paymentIntentIdOf(session);
  if (!stripe || !paymentIntentId) return null;
  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });
    const charge = intent.latest_charge;
    if (charge && typeof charge !== "string") return charge.receipt_url ?? null;
  } catch (error) {
    console.error("[orders] could not read Stripe receipt", error);
  }
  return null;
}

/**
 * Persist a paid Checkout Session. Idempotent on the session id.
 * Throws OrderStoreUnavailableError when the deployment has no database,
 * and DraftMissingError when the plate payload was not saved before redirect.
 */
export async function persistPaidCheckoutSession(session: Stripe.Checkout.Session) {
  const store = getOrderStore();
  if (!store) throw new OrderStoreUnavailableError();

  const receiptUrl = await receiptUrlFor(session);
  const { facts, draftId } = paymentFactsFromCheckoutSession(session, receiptUrl);
  if (!draftId) {
    console.error("[orders] paid session has no checkoutDraftId", session.id);
    return null;
  }

  const draft = await store.getDraft(draftId);
  if (!draft) throw new DraftMissingError(draftId);

  const order = buildPaidOrder(draft, facts);
  return store.insertPaidOrder(order);
}
