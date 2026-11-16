import { NextResponse } from "next/server";
import { tokenFromCookieHeader, verifyOrdersSession } from "@/lib/admin-auth";
import { invoiceApprovedOrder } from "@/lib/issue-invoice";
import { getOrderStore } from "@/lib/order-store";
import { proofSummary, ProofSchemaError } from "@/lib/proofs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authed(request: Request) {
  return verifyOrdersSession(tokenFromCookieHeader(request.headers.get("cookie")));
}

function orderNumberFrom(id: string) {
  if (!/^[0-9]+$/.test(id)) return null;
  const value = Number(id);
  if (!Number.isInteger(value) || value < 1 || value > 99_999_999) return null;
  return value;
}

/**
 * Send or retry the tax invoice for an approved order.
 * Orders approved before this feature are not invoiced until someone uses this.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!authed(request)) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  const { id } = await params;
  const orderNumber = orderNumberFrom(id);
  if (!orderNumber) {
    return NextResponse.json({ ok: false, error: "Unknown order." }, { status: 404 });
  }

  let ccText: string | undefined;
  try {
    const body = await request.json();
    if (body && typeof body === "object" && "invoiceCc" in body) {
      const raw = (body as { invoiceCc?: unknown }).invoiceCc;
      ccText = typeof raw === "string" ? raw : "";
    }
  } catch {
    ccText = undefined;
  }

  const result = await invoiceApprovedOrder(orderNumber, { ccText });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, order: result.order, proof: await proofFor(result.order) },
      { status: result.error === "Unknown order." ? 404 : 400 }
    );
  }
  if (result.skipped === "checkout-paid") {
    return NextResponse.json(
      {
        ok: false,
        error: "This order was paid at checkout, so no invoice is sent.",
        order: result.order,
      },
      { status: 409 }
    );
  }
  const message =
    result.skipped === "existing"
      ? "This order already has a Stripe invoice."
      : result.cc === "failed"
        ? "Invoice sent. The copy to the extra addresses could not be emailed."
        : result.created
          ? "Tax invoice sent."
          : "Tax invoice is already in Stripe.";
  return NextResponse.json({
    ok: true,
    order: result.order,
    proof: await proofFor(result.order),
    message,
    created: result.created,
  });
}

async function proofFor(order: { id: string; orderNumber: number } | null) {
  if (!order) return null;
  const store = getOrderStore();
  if (!store) return null;
  try {
    const proof = await store.getLatestProof(order.id);
    const full = await store.getOrder(order.orderNumber);
    if (!full) return null;
    return proofSummary(full, proof);
  } catch (error) {
    if (!(error instanceof ProofSchemaError)) {
      console.error("[invoice] could not load the proof", error);
    }
    return null;
  }
}
