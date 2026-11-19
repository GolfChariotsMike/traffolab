import { NextResponse } from "next/server";
import { readOrdersSession, tokenFromCookieHeader } from "@/lib/admin-auth";
import { getOrderStore } from "@/lib/order-store";
import {
  StockSchemaError,
  StockValidationError,
  parseNewCount,
  parseNewPurchase,
  stockPosition,
} from "@/lib/stock";
import { getStockStore } from "@/lib/stock-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorised() {
  return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
}

function failure(error: unknown, action: string) {
  if (error instanceof StockSchemaError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
  }
  console.error(`[admin] stock ${action} failed`, error);
  return NextResponse.json({ ok: false, error: `Could not ${action} sheet stock.` }, { status: 500 });
}

export async function GET(request: Request) {
  const session = readOrdersSession(tokenFromCookieHeader(request.headers.get("cookie")));
  if (!session) return unauthorised();
  const store = getStockStore();
  const orders = getOrderStore();
  if (!store || !orders) {
    return NextResponse.json({ ok: false, error: "Sheet stock is not available right now." }, { status: 503 });
  }
  try {
    const [purchases, counts, allOrders] = await Promise.all([
      store.listPurchases(),
      store.listCounts(),
      orders.listOrders(),
    ]);
    return NextResponse.json({
      ok: true,
      purchases,
      counts,
      position: stockPosition(purchases, allOrders),
    });
  } catch (error) {
    return failure(error, "load");
  }
}

export async function POST(request: Request) {
  const session = readOrdersSession(tokenFromCookieHeader(request.headers.get("cookie")));
  if (!session) return unauthorised();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const record = body as Record<string, unknown>;
  const store = getStockStore();
  if (!store) {
    return NextResponse.json({ ok: false, error: "Sheet stock is not available right now." }, { status: 503 });
  }
  try {
    if (record.kind === "purchase") {
      const purchase = await store.insertPurchase(parseNewPurchase(record, session.email));
      return NextResponse.json({ ok: true, purchase });
    }
    if (record.kind === "count") {
      const count = await store.insertCount(parseNewCount(record, session.email));
      return NextResponse.json({ ok: true, count });
    }
    return NextResponse.json({ ok: false, error: "Unknown stock entry." }, { status: 400 });
  } catch (error) {
    if (error instanceof StockValidationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    return failure(error, "save");
  }
}
