import { NextResponse } from "next/server";
import { readOrdersSession, tokenFromCookieHeader } from "@/lib/admin-auth";
import { StockSchemaError } from "@/lib/stock";
import { getStockStore } from "@/lib/stock-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = readOrdersSession(tokenFromCookieHeader(request.headers.get("cookie")));
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  const { id } = await params;
  const numeric = Number(id);
  if (!/^\d{1,15}$/.test(id) || !Number.isSafeInteger(numeric)) {
    return NextResponse.json({ ok: false, error: "Unknown purchase." }, { status: 404 });
  }
  const store = getStockStore();
  if (!store) {
    return NextResponse.json({ ok: false, error: "Sheet stock is not available right now." }, { status: 503 });
  }
  try {
    const removed = await store.removePurchase(numeric);
    if (!removed) return NextResponse.json({ ok: false, error: "Unknown purchase." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof StockSchemaError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
    }
    console.error("[admin] stock purchase delete failed", error);
    return NextResponse.json({ ok: false, error: "Could not delete the purchase." }, { status: 500 });
  }
}
