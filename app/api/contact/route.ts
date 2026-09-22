import { NextResponse } from "next/server";
import { sendJobEmail, type JobEnquiry } from "@/lib/contact-mail";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEND_ERROR = "Could not send that message. Try again shortly.";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request." },
      { status: 400 },
    );
  }

  if (String(body.website ?? "").trim()) {
    return NextResponse.json({ ok: true });
  }

  const enquiry: JobEnquiry = {
    name: String(body.name ?? "").trim(),
    email: String(body.email ?? "").trim(),
    company: String(body.company ?? "").trim(),
    message: String(body.message ?? "").trim(),
  };

  if (!enquiry.name || !enquiry.email || !enquiry.message) {
    return NextResponse.json(
      { ok: false, error: "Name, email, and the job are required." },
      { status: 400 },
    );
  }
  if (!EMAIL_RE.test(enquiry.email)) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid email address." },
      { status: 400 },
    );
  }
  if (
    enquiry.name.length > 120 ||
    enquiry.email.length > 200 ||
    enquiry.company.length > 160 ||
    enquiry.message.length > 5000
  ) {
    return NextResponse.json(
      { ok: false, error: "That looks too long. Shorten it and try again." },
      { status: 400 },
    );
  }

  const result = await sendJobEmail(enquiry);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: SEND_ERROR }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
