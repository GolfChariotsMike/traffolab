import { NextResponse } from "next/server";
import { parseCheckoutBody } from "@/lib/checkout";
import {
  checkoutReturnUrls,
  resolveCheckoutReturnOrigin,
} from "@/lib/checkout-return";
import type { CheckoutDraft } from "@/lib/orders";
import { getOrderStore } from "@/lib/order-store";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

const CHECKOUT_UNAVAILABLE =
  "Checkout unavailable. Card payment is not configured on this deployment yet.";

const ORDERS_UNAVAILABLE =
  "Checkout unavailable. The orders database is not configured on this deployment yet.";

export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { ok: false, error: CHECKOUT_UNAVAILABLE },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request." },
      { status: 400 }
    );
  }

  const parsed = parseCheckoutBody(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: parsed.error },
      { status: parsed.status }
    );
  }

  const { request: checkout, quote, lineItems, plates, metadata } = parsed.value;
  if (quote.subtotalCents <= 0 || quote.totalCents <= 0) {
    return NextResponse.json(
      { ok: false, error: "Order total must be greater than zero." },
      { status: 400 }
    );
  }

  const store = getOrderStore();
  if (!store) {
    return NextResponse.json({ ok: false, error: ORDERS_UNAVAILABLE }, { status: 503 });
  }

  const draft: CheckoutDraft = {
    id: crypto.randomUUID(),
    customerEmail: checkout.customerEmail,
    shippingMethodId: checkout.shippingMethodId,
    subtotalCents: quote.subtotalCents,
    shippingCents: quote.shippingCents,
    totalCents: quote.totalCents,
    plates,
  };

  try {
    await store.saveDraft(draft);
  } catch (error) {
    console.error("[checkout] could not save order draft", error);
    return NextResponse.json(
      { ok: false, error: "Could not save this order before payment. Try again shortly." },
      { status: 503 }
    );
  }

  // Return to the shopper's origin. VERCEL_URL is the deployment host and
  // does not share localStorage with www.trafflabels.com.au.
  const requestedOrigin =
    body && typeof body === "object"
      ? (body as { returnOrigin?: unknown }).returnOrigin
      : undefined;
  const origin = resolveCheckoutReturnOrigin({
    originHeader: request.headers.get("origin"),
    requestedOrigin,
    forwardedHost: request.headers.get("x-forwarded-host"),
    host: request.headers.get("host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
  });
  const { successUrl, cancelUrl } = checkoutReturnUrls(origin);

  try {
    // Do not set payment_method_types — Dashboard dynamic payment methods apply.
    const sessionMetadata = {
      ...metadata,
      checkoutDraftId: draft.id,
      brand: "TraffLabels",
    };
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: checkout.customerEmail,
      client_reference_id: draft.id,
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      // Australia-wide rates are already a line item. Collect the postal address
      // and phone here so production can ship without a second form.
      shipping_address_collection: { allowed_countries: ["AU"] },
      phone_number_collection: { enabled: true },
      metadata: sessionMetadata,
      payment_intent_data: {
        metadata: sessionMetadata,
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { ok: false, error: "Stripe did not return a checkout URL." },
        { status: 502 }
      );
    }

    try {
      await store.attachDraftSession(draft.id, session.id);
    } catch (error) {
      console.error("[checkout] could not attach Stripe session to draft", error);
    }

    return NextResponse.json({ ok: true, url: session.url, id: session.id });
  } catch (error) {
    console.error("[checkout] Stripe session create failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Could not start checkout. Try again shortly.",
      },
      { status: 502 }
    );
  }
}
