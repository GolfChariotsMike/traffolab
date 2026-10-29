import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { getOrderStore } from "@/lib/order-store";
import { proofReminderNotBefore } from "@/lib/proof-reminder";
import { sendProofReminderEmail } from "@/lib/proof-reminder-mail";
import { runProofReminders } from "@/lib/proof-reminder-run";
import { ProofSchemaError, PROOF_MIGRATION_HINT } from "@/lib/proofs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REMINDER_MIGRATION_HINT =
  "Apply db/migrations/20261029_trafflabels_proof_reminders.sql before proof reminders can be recorded.";

export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const notBefore = proofReminderNotBefore(process.env.PROOF_REMINDER_NOT_BEFORE);
  if (notBefore === "invalid") {
    return NextResponse.json(
      { ok: false, error: "PROOF_REMINDER_NOT_BEFORE is not a valid date." },
      { status: 500 }
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
    const result = await runProofReminders({
      store,
      now: new Date(),
      notBefore,
      send: sendProofReminderEmail,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ProofSchemaError) {
      return NextResponse.json(
        { ok: false, error: `${REMINDER_MIGRATION_HINT} ${PROOF_MIGRATION_HINT}` },
        { status: 503 }
      );
    }
    console.error("[proof-reminder] job failed", error);
    return NextResponse.json({ ok: false, error: "Reminder job failed." }, { status: 500 });
  }
}
