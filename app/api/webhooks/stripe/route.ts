import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Stripe webhook stub for checkout.session.completed.
 * Verifies STRIPE_WEBHOOK_SECRET when present; logs the session id.
 * No order DB yet — fulfillment can hook in here later.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Stripe webhook is not configured. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.",
      },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { ok: false, error: "Missing stripe-signature header." },
      { status: 400 }
    );
  }

  const payload = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error("[stripe-webhook] signature verification failed", error);
    return NextResponse.json(
      { ok: false, error: "Invalid webhook signature." },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    console.info("[stripe-webhook] checkout.session.completed", {
      id: session.id,
      payment_status: session.payment_status,
      customer_email: session.customer_details?.email ?? session.customer_email,
      amount_total: session.amount_total,
      currency: session.currency,
      metadata: session.metadata,
    });
  } else {
    console.info("[stripe-webhook] ignored event", event.type);
  }

  return NextResponse.json({ received: true });
}
