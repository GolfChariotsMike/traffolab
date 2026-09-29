import { NextResponse } from "next/server";
import { tokenFromCookieHeader, verifyOrdersSession } from "@/lib/admin-auth";
import { parseOrderPatch } from "@/lib/orders";
import { getOrderStore } from "@/lib/order-store";

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

export async function PATCH(
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const parsed = parseOrderPatch(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  const store = getOrderStore();
  if (!store) {
    return NextResponse.json(
      { ok: false, error: "Orders database is not configured." },
      { status: 503 }
    );
  }

  try {
    const order = await store.updateOrder(orderNumber, parsed.value);
    if (!order) {
      return NextResponse.json({ ok: false, error: "Unknown order." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, order });
  } catch (error) {
    console.error("[admin] order update failed", error);
    return NextResponse.json({ ok: false, error: "Could not update the order." }, { status: 500 });
  }
}
