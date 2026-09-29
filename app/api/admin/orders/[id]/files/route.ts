import { NextResponse } from "next/server";
import { tokenFromCookieHeader, verifyOrdersSession } from "@/lib/admin-auth";
import { buildProductionDownload } from "@/lib/production-download";
import { getOrderStore } from "@/lib/order-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function orderNumberFrom(id: string) {
  if (!/^[0-9]+$/.test(id)) return null;
  const value = Number(id);
  if (!Number.isInteger(value) || value < 1 || value > 99_999_999) return null;
  return value;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyOrdersSession(tokenFromCookieHeader(request.headers.get("cookie")))) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  const { id } = await params;
  const orderNumber = orderNumberFrom(id);
  if (!orderNumber) {
    return NextResponse.json({ ok: false, error: "Unknown order." }, { status: 404 });
  }

  const store = getOrderStore();
  if (!store) {
    return NextResponse.json(
      { ok: false, error: "Orders database is not configured." },
      { status: 503 }
    );
  }

  const order = await store.getOrder(orderNumber);
  if (!order) {
    return NextResponse.json({ ok: false, error: "Unknown order." }, { status: 404 });
  }

  const file = buildProductionDownload(order.orderNumber, order.plates);
  if (!file) {
    return NextResponse.json({ ok: false, error: "This order has no plates." }, { status: 404 });
  }

  return new NextResponse(Buffer.from(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
