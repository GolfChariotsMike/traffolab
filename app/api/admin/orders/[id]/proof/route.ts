import { NextResponse } from "next/server";
import { tokenFromCookieHeader, verifyOrdersSession } from "@/lib/admin-auth";
import { OrderUpdateError, parsePlateLocations } from "@/lib/orders";
import { getOrderStore } from "@/lib/order-store";
import { cleanInvoiceUrl, proofPath, proofSummary, ProofSchemaError, PROOF_MIGRATION_HINT } from "@/lib/proofs";

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const raw = body as Record<string, unknown>;
  const invoiceUrl = cleanInvoiceUrl(
    raw.invoiceUrl === undefined || raw.invoiceUrl === null ? "" : raw.invoiceUrl
  );
  if (invoiceUrl === null) {
    return NextResponse.json(
      { ok: false, error: "Invoice link must be an https:// Stripe URL." },
      { status: 400 }
    );
  }

  let plateLocations: string[] | undefined;
  if ("plateLocations" in raw) {
    const locations = parsePlateLocations(raw.plateLocations);
    if (!locations.ok) {
      return NextResponse.json({ ok: false, error: locations.error }, { status: 400 });
    }
    plateLocations = locations.locations;
  }

  const store = getOrderStore();
  if (!store) {
    return NextResponse.json(
      { ok: false, error: "Orders database is not configured." },
      { status: 503 }
    );
  }

  try {
    const existing = plateLocations ? await store.updateOrder(orderNumber, { plateLocations }) : await store.getOrder(orderNumber);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Unknown order." }, { status: 404 });
    }
    const proof = await store.createProof(orderNumber, { invoiceUrl });
    if (!proof) {
      return NextResponse.json({ ok: false, error: "Unknown order." }, { status: 404 });
    }
    const order = (await store.getOrder(orderNumber)) ?? existing;
    return NextResponse.json({
      ok: true,
      order,
      proof: proofSummary(order, proof),
      path: proofPath(proof.token),
    });
  } catch (error) {
    if (error instanceof OrderUpdateError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    if (error instanceof ProofSchemaError) {
      return NextResponse.json({ ok: false, error: PROOF_MIGRATION_HINT }, { status: 503 });
    }
    console.error("[admin] create proof failed", error);
    return NextResponse.json({ ok: false, error: "Could not create the proof." }, { status: 500 });
  }
}
