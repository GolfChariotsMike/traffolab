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

/** Stripe payment_status for a Checkout Session, or null when it cannot be confirmed. */
export async function checkoutSessionPaymentStatus(
  sessionId: string
): Promise<string | null> {
  if (!CHECKOUT_SESSION_ID.test(sessionId) || sessionId.length > 255) return null;
  const stripe = getStripe();
  if (!stripe) return null;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session.payment_status ?? null;
  } catch (error) {
    console.error("[checkout] could not confirm session payment", error);
    return null;
  }
}
