import { NextResponse } from "next/server";
import { readOrdersSession, tokenFromCookieHeader } from "@/lib/admin-auth";
import { getCostStore } from "@/lib/cost-store";
import {
  CostSchemaError,
  CostValidationError,
  isValidMonth,
  monthSummary,
  orderProfit,
  parseNewCost,
  perthMonth,
} from "@/lib/costs";
import { getOrderStore } from "@/lib/order-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorised() {
  return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
}

function failure(error: unknown, action: string) {
  if (error instanceof CostSchemaError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
  }
  console.error(`[admin] cost ${action} failed`, error);
  return NextResponse.json({ ok: false, error: `Could not ${action} costs.` }, { status: 500 });
}

/** GET ?orderNumber=1003 -> that order's costs and profit. GET ?month=2026-11 -> month summary. */
export async function GET(request: Request) {
  const session = readOrdersSession(tokenFromCookieHeader(request.headers.get("cookie")));
  if (!session) return unauthorised();
  const store = getCostStore();
  const orders = getOrderStore();
  if (!store || !orders) {
    return NextResponse.json({ ok: false, error: "Costs are not available right now." }, { status: 503 });
  }
  const url = new URL(request.url);
  const orderNumber = Number(url.searchParams.get("orderNumber"));
  try {
    if (url.searchParams.has("orderNumber")) {
      const order = Number.isInteger(orderNumber) ? await orders.getOrder(orderNumber) : null;
      if (!order) return NextResponse.json({ ok: false, error: "Unknown order." }, { status: 404 });
      const costs = await store.listForOrder(order.id);
      return NextResponse.json({ ok: true, costs, profit: orderProfit(order, costs) });
    }
    const monthParam = url.searchParams.get("month");
    const month = isValidMonth(monthParam) ? monthParam : perthMonth();
    const [costs, allOrders] = await Promise.all([store.listForMonth(month), orders.listOrders()]);
    return NextResponse.json({ ok: true, costs, summary: monthSummary(month, allOrders, costs) });
  } catch (error) {
    return failure(error, "load");
  }
}

/** POST { date, amount, gstIncluded, category, description, receiptRef, orderNumber? } */
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
  const store = getCostStore();
  const orders = getOrderStore();
  if (!store || !orders) {
    return NextResponse.json({ ok: false, error: "Costs are not available right now." }, { status: 503 });
  }
  let orderId: string | null = null;
  if (record.orderNumber != null && record.orderNumber !== "") {
    const n = Number(record.orderNumber);
    const order = Number.isInteger(n) && n > 0 ? await orders.getOrder(n) : null;
    if (!order) return NextResponse.json({ ok: false, error: "No order with that number." }, { status: 400 });
    orderId = order.id;
  }
  try {
    const cost = await store.insert(parseNewCost(record, orderId, session.email));
    return NextResponse.json({ ok: true, cost });
  } catch (error) {
    if (error instanceof CostValidationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    return failure(error, "save");
  }
}
