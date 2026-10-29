import { NextResponse } from "next/server";
import {
  AccountApplicationRateError,
  AccountApplicationSchemaError,
  parseAccountApplication,
} from "@/lib/account-application";
import { sendAccountApplicationEmails } from "@/lib/account-application-mail";
import { getAccountApplicationStore } from "@/lib/account-application-store";
import { requestClientMeta } from "@/lib/proofs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid application." }, { status: 400 });
  }

  const meta = requestClientMeta(request);
  const parsed = parseAccountApplication(body, meta);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  if (parsed.honeypot) {
    return NextResponse.json({ ok: true });
  }

  const store = getAccountApplicationStore();
  if (!store) {
    return NextResponse.json(
      { ok: false, error: "Account applications are not available right now." },
      { status: 503 }
    );
  }

  try {
    const saved = await store.insert(parsed.application);
    try {
      await sendAccountApplicationEmails(saved);
    } catch (error) {
      console.error("[account-application] email failed", error);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AccountApplicationRateError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 429 });
    }
    if (error instanceof AccountApplicationSchemaError) {
      console.error("[account-application] schema", error.message);
      return NextResponse.json(
        { ok: false, error: "Account applications are not available right now." },
        { status: 503 }
      );
    }
    console.error("[account-application] save failed", error);
    return NextResponse.json(
      { ok: false, error: "Could not save the application." },
      { status: 500 }
    );
  }
}
