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

/** Public origin for Checkout success/cancel URLs. */
export function checkoutOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return "http://localhost:3000";
}
