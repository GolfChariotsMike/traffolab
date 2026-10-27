import { NextResponse } from "next/server";
import { magicLinkOrigin } from "@/lib/admin-auth";
import { getOrderStore } from "@/lib/order-store";
import { sendProofNotification } from "@/lib/proof-mail";
import {
  cleanApproverName,
  cleanChangeComment,
  isProofToken,
  proofPath,
  ProofSchemaError,
  requestClientMeta,
} from "@/lib/proofs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!isProofToken(token)) {
    return NextResponse.json({ ok: false, error: "This proof link is not valid." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const raw = body as Record<string, unknown>;
  const meta = requestClientMeta(request);
  const action = raw.action;

  let decision:
    | { action: "approve"; name: string; ip: string; userAgent: string }
    | { action: "changes"; comment: string; ip: string; userAgent: string };
  if (action === "approve") {
    if (raw.confirmed !== true) {
      return NextResponse.json(
        { ok: false, error: "Tick the box to approve this proof." },
        { status: 400 }
      );
    }
    const name = cleanApproverName(raw.name);
    if (!name) {
      return NextResponse.json(
        { ok: false, error: "Enter your full name." },
        { status: 400 }
      );
    }
    decision = { action: "approve", name, ...meta };
  } else if (action === "changes") {
    const comment = cleanChangeComment(raw.comment);
    if (!comment) {
      return NextResponse.json(
        { ok: false, error: "Describe the changes you need." },
        { status: 400 }
      );
    }
    decision = { action: "changes", comment, ...meta };
  } else {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const store = getOrderStore();
  if (!store) {
    return NextResponse.json(
      { ok: false, error: "Proofs are not available right now." },
      { status: 503 }
    );
  }

  try {
    const result = await store.decideProof(token, decision);
    if (!result.ok) {
      const status = result.code === "not_found" ? 404 : 409;
      const error =
        result.code === "superseded"
          ? "This proof is out of date. Ask TraffLabels for a new link."
          : result.code === "closed"
            ? "This proof has already been answered."
            : "This proof link is not valid.";
      return NextResponse.json({ ok: false, error, code: result.code }, { status });
    }
    if (result.changed) {
      const proofUrl = `${magicLinkOrigin(request.url)}${proofPath(token)}`;
      try {
        await sendProofNotification({ proof: result.proof, proofUrl });
      } catch (error) {
        console.error("[proof] notification failed", error);
      }
    }
    return NextResponse.json({
      ok: true,
      status: result.proof.status,
      approvedName: result.proof.approvedName,
      approvedAt: result.proof.approvedAt,
      changeComment: result.proof.changeComment,
      changeRequestedAt: result.proof.changeRequestedAt,
    });
  } catch (error) {
    if (error instanceof ProofSchemaError) {
      return NextResponse.json(
        { ok: false, error: "Proofs are not available right now." },
        { status: 503 }
      );
    }
    console.error("[proof] decision failed", error);
    return NextResponse.json({ ok: false, error: "Could not save that response." }, { status: 500 });
  }
}
