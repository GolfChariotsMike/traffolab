import "server-only";
import Stripe from "stripe";

/**
 * Server-only Stripe client. Returns null when STRIPE_SECRET_KEY is unset so
 * builds and non-payment pages stay healthy before keys land on Vercel.
 */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key);
}

const CHECKOUT_SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]+$/;

export function isCheckoutSessionId(sessionId: string) {
  return CHECKOUT_SESSION_ID.test(sessionId) && sessionId.length <= 255;
}

/** Full Checkout Session, or null when it cannot be loaded. */
export async function retrieveCheckoutSession(sessionId: string) {
  if (!isCheckoutSessionId(sessionId)) return null;
  const stripe = getStripe();
  if (!stripe) return null;
  try {
    return await stripe.checkout.sessions.retrieve(sessionId);
  } catch (error) {
    console.error("[checkout] could not load session", error);
    return null;
  }
}

/** Stripe payment_status for a Checkout Session, or null when it cannot be confirmed. */
export async function checkoutSessionPaymentStatus(
  sessionId: string
): Promise<string | null> {
  const session = await retrieveCheckoutSession(sessionId);
  return session?.payment_status ?? null;
}
