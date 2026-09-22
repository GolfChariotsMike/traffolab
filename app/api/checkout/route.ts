import { NextResponse } from "next/server";
import { parseCheckoutBody } from "@/lib/checkout";
import {
  checkoutReturnUrls,
  resolveCheckoutReturnOrigin,
} from "@/lib/checkout-return";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

const CHECKOUT_UNAVAILABLE =
  "Checkout unavailable. Card payment is not configured on this deployment yet.";

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

  const { request: checkout, quote, lineItems, metadata } = parsed.value;
  if (quote.subtotalCents <= 0 || quote.totalCents <= 0) {
    return NextResponse.json(
      { ok: false, error: "Order total must be greater than zero." },
      { status: 400 }
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
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: checkout.customerEmail,
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      payment_intent_data: {
        metadata,
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { ok: false, error: "Stripe did not return a checkout URL." },
        { status: 502 }
      );
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
