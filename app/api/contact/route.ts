import { NextResponse } from "next/server";
import {
  validateAttachment,
  type OutboundAttachment,
} from "@/lib/contact-attachment";
import { sendJobEmail, type JobEnquiry } from "@/lib/contact-mail";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEND_ERROR = "Could not send that message. Try again shortly.";

export const runtime = "nodejs";

function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request." },
      { status: 400 },
    );
  }

  if (field(form, "website")) {
    return NextResponse.json({ ok: true });
  }

  const enquiry: JobEnquiry = {
    name: field(form, "name"),
    email: field(form, "email"),
    company: field(form, "company"),
    message: field(form, "message"),
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

  const uploaded = form.get("attachment");
  let attachment: OutboundAttachment | null = null;
  if (uploaded instanceof File && (uploaded.name.trim() || uploaded.size > 0)) {
    const checked = validateAttachment({
      name: uploaded.name,
      size: uploaded.size,
    });
    if (!checked.ok) {
      return NextResponse.json(
        { ok: false, error: checked.error },
        { status: 400 },
      );
    }
    const content = Buffer.from(await uploaded.arrayBuffer());
    if (content.length !== uploaded.size) {
      return NextResponse.json(
        { ok: false, error: "Could not read that file. Try again." },
        { status: 400 },
      );
    }
    attachment = {
      filename: checked.filename,
      contentType: checked.contentType,
      content,
    };
    enquiry.attachmentName = checked.filename;
  }

  const result = await sendJobEmail(enquiry, attachment);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: SEND_ERROR }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
