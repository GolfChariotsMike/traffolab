import { NextResponse } from "next/server";
import { tokenFromCookieHeader, verifyOrdersSession } from "@/lib/admin-auth";
import { parseManualOrder } from "@/lib/manual-order";
import { getOrderStore } from "@/lib/order-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!verifyOrdersSession(tokenFromCookieHeader(request.headers.get("cookie")))) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const parsed = parseManualOrder(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: "Fix the CSV and customer details before creating an order.", errors: parsed.errors },
      { status: 400 }
    );
  }

  const store = getOrderStore();
  if (!store) {
    return NextResponse.json(
      { ok: false, error: "Orders database is not configured." },
      { status: 503 }
    );
  }

  try {
    const order = await store.insertPaidOrder(parsed.order);
    return NextResponse.json({ ok: true, order });
  } catch (error) {
    console.error("[admin] manual order import failed", error);
    return NextResponse.json({ ok: false, error: "Could not create the order." }, { status: 500 });
  }
}
