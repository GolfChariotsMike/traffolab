import { NextResponse } from "next/server";
import {
  DraftMissingError,
  OrderStoreUnavailableError,
  persistPaidCheckoutSession,
} from "@/lib/fulfill-order";
import { shouldFulfillCheckout } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Stripe webhook for paid TraffLabels checkouts.
 * Verifies STRIPE_WEBHOOK_SECRET, then stores the order as NEW.
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

  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  ) {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object;
  if (!shouldFulfillCheckout(event.type, session.payment_status)) {
    console.info("[stripe-webhook] waiting for payment", {
      id: session.id,
      type: event.type,
      payment_status: session.payment_status,
    });
    return NextResponse.json({ received: true });
  }

  try {
    const order = await persistPaidCheckoutSession(session);
    console.info("[stripe-webhook] order stored", {
      id: session.id,
      orderNumber: order?.orderNumber ?? null,
      status: order?.status ?? null,
    });
    return NextResponse.json({ received: true, orderNumber: order?.orderNumber ?? null });
  } catch (error) {
    if (error instanceof OrderStoreUnavailableError) {
      console.error("[stripe-webhook] orders database is not configured");
      return NextResponse.json(
        { ok: false, error: "Orders database is not configured." },
        { status: 503 }
      );
    }
    if (error instanceof DraftMissingError) {
      console.error("[stripe-webhook] checkout draft missing", error.message);
      return NextResponse.json(
        { ok: false, error: "Checkout draft missing." },
        { status: 500 }
      );
    }
    console.error("[stripe-webhook] could not store order", error);
    return NextResponse.json(
      { ok: false, error: "Could not store order." },
      { status: 500 }
    );
  }
}
