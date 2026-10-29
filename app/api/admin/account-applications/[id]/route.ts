import { NextResponse } from "next/server";
import { readOrdersSession, tokenFromCookieHeader } from "@/lib/admin-auth";
import {
  AccountApplicationSchemaError,
  isAccountApplicationStatus,
} from "@/lib/account-application";
import { getAccountApplicationStore } from "@/lib/account-application-store";
import { getOrderStore } from "@/lib/order-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = readOrdersSession(tokenFromCookieHeader(request.headers.get("cookie")));
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  const { id } = await params;
  if (!ID_RE.test(id)) {
    return NextResponse.json({ ok: false, error: "Unknown application." }, { status: 404 });
  }

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
  const hasStatus = "status" in record;
  const hasOrder = "orderNumber" in record;
  if (!hasStatus && !hasOrder) {
    return NextResponse.json({ ok: false, error: "Nothing to update." }, { status: 400 });
  }
  if (hasStatus && !isAccountApplicationStatus(record.status)) {
    return NextResponse.json({ ok: false, error: "Unknown status." }, { status: 400 });
  }

  let linkedOrderId: string | null | undefined;
  let linkedOrderNumber: number | null | undefined;
  if (hasOrder) {
    if (record.orderNumber == null || record.orderNumber === "") {
      linkedOrderId = null;
      linkedOrderNumber = null;
    } else if (
      typeof record.orderNumber !== "number" ||
      !Number.isInteger(record.orderNumber) ||
      record.orderNumber < 1 ||
      record.orderNumber > 99_999_999
    ) {
      return NextResponse.json({ ok: false, error: "Enter a valid order number." }, { status: 400 });
    } else {
      const orders = getOrderStore();
      const order = orders ? await orders.getOrder(record.orderNumber) : null;
      if (!order) {
        return NextResponse.json({ ok: false, error: "No order with that number." }, { status: 400 });
      }
      linkedOrderId = order.id;
      linkedOrderNumber = order.orderNumber;
    }
  }

  const store = getAccountApplicationStore();
  if (!store) {
    return NextResponse.json(
      { ok: false, error: "Account applications are not available right now." },
      { status: 503 }
    );
  }

  try {
    const application = await store.update(id, {
      status: hasStatus && isAccountApplicationStatus(record.status) ? record.status : undefined,
      decidedBy: session.email,
      ...(hasOrder ? { linkedOrderId, linkedOrderNumber } : {}),
    });
    if (!application) {
      return NextResponse.json({ ok: false, error: "Unknown application." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, application });
  } catch (error) {
    if (error instanceof AccountApplicationSchemaError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
    }
    console.error("[admin] account application update failed", error);
    return NextResponse.json({ ok: false, error: "Could not update the application." }, { status: 500 });
  }
}
