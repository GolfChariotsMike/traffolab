import { Resend } from "resend";
import { contactEmail } from "@/lib/site";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type JobEnquiry = {
  name: string;
  email: string;
  company: string;
  message: string;
};

export function parseRecipients(raw: string | undefined): string[] {
  const list = (raw ?? "")
    .split(/[,;]/)
    .map((value) => value.trim())
    .filter((value) => EMAIL_RE.test(value));
  return list.length > 0 ? list : [contactEmail];
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function jobSubject(enquiry: JobEnquiry): string {
  const name = enquiry.name.replace(/[\r\n]+/g, " ");
  const company = enquiry.company.replace(/[\r\n]+/g, " ");
  return company
    ? `TraffLabels job — ${name} (${company})`
    : `TraffLabels job — ${name}`;
}

export function formatJobText(enquiry: JobEnquiry): string {
  return [
    `Name: ${enquiry.name}`,
    `Email: ${enquiry.email}`,
    `Company: ${enquiry.company || "(not provided)"}`,
    "",
    enquiry.message,
  ].join("\n");
}

export function formatJobHtml(enquiry: JobEnquiry): string {
  const rows: [string, string][] = [
    ["Name", enquiry.name],
    ["Email", enquiry.email],
    ["Company", enquiry.company || "(not provided)"],
  ];
  const details = rows
    .map(
      ([label, value]) =>
        `<tr><th align="left" style="padding:4px 12px 4px 0;color:#64748b;font-size:12px;text-transform:uppercase;">${escapeHtml(label)}</th><td style="padding:4px 0;color:#12151a;">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#12151a;">
<p>TraffLabels job</p>
<table>${details}</table>
<p style="white-space:pre-wrap;margin-top:16px;">${escapeHtml(enquiry.message)}</p>
</div>`;
}

export async function sendJobEmail(
  enquiry: JobEnquiry,
): Promise<{ ok: true } | { ok: false; error: "missing-key" | "missing-from" | "resend" }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!apiKey) {
    console.error("[contact] RESEND_API_KEY is not set");
    return { ok: false, error: "missing-key" };
  }
  if (!from) {
    console.error("[contact] RESEND_FROM is not set");
    return { ok: false, error: "missing-from" };
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: parseRecipients(process.env.CONTACT_TO),
    replyTo: enquiry.email,
    subject: jobSubject(enquiry),
    text: formatJobText(enquiry),
    html: formatJobHtml(enquiry),
  });

  if (error || !data) {
    console.error("[contact] Resend error", error);
    return { ok: false, error: "resend" };
  }
  return { ok: true };
}
