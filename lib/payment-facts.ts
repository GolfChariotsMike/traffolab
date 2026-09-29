/**
 * Read the Stripe Checkout Session fields we persist. Structural on purpose
 * so tests do not construct Stripe SDK objects.
 */

import type { PaymentFacts, ShippingAddress } from "@/lib/orders";

type AddressLike = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

export type CheckoutSessionLike = {
  id: string;
  livemode?: boolean;
  created?: number;
  payment_status?: string | null;
  customer_email?: string | null;
  metadata?: Record<string, string> | null;
  customer_details?: {
    email?: string | null;
    name?: string | null;
    individual_name?: string | null;
    phone?: string | null;
    address?: AddressLike | null;
  } | null;
  collected_information?: {
    shipping_details?: {
      name?: string | null;
      address?: AddressLike | null;
    } | null;
  } | null;
  payment_intent?: string | { id?: string | null } | null;
};

function text(value: string | null | undefined) {
  return (value ?? "").trim();
}

function addressFrom(name: string, address: AddressLike | null | undefined): ShippingAddress | null {
  if (!address) return null;
  const line1 = text(address.line1);
  const country = text(address.country);
  if (!line1 && !country && !text(address.city)) return null;
  return {
    name,
    line1,
    line2: text(address.line2),
    city: text(address.city),
    state: text(address.state),
    postalCode: text(address.postal_code),
    country,
  };
}

export function paymentIntentIdOf(session: CheckoutSessionLike) {
  const paymentIntent = session.payment_intent;
  if (typeof paymentIntent === "string" && paymentIntent) return paymentIntent;
  if (paymentIntent && typeof paymentIntent === "object" && paymentIntent.id) {
    return paymentIntent.id;
  }
  return null;
}

export function paymentFactsFromCheckoutSession(
  session: CheckoutSessionLike,
  receiptUrl: string | null = null
): { facts: PaymentFacts; draftId: string | null } {
  const details = session.customer_details;
  const shippingDetails = session.collected_information?.shipping_details;
  const shippingName = text(shippingDetails?.name) || text(details?.name) || text(details?.individual_name);
  const shipping =
    addressFrom(shippingName, shippingDetails?.address) ??
    addressFrom(shippingName, details?.address);

  const createdAt =
    typeof session.created === "number" && Number.isFinite(session.created)
      ? new Date(session.created * 1000).toISOString()
      : new Date().toISOString();

  const draftId = session.metadata?.checkoutDraftId?.trim() || null;

  return {
    draftId,
    facts: {
      sessionId: session.id,
      livemode: session.livemode === true,
      createdAt,
      customerEmail: text(details?.email) || text(session.customer_email) || null,
      customerName: text(details?.name) || text(details?.individual_name) || null,
      customerPhone: text(details?.phone) || null,
      paymentIntentId: paymentIntentIdOf(session),
      receiptUrl: receiptUrl?.trim() || null,
      shipping,
    },
  };
}
