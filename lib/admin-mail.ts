import { Resend } from "resend";

export function resendConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM?.trim());
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function magicLinkMessage(input: { to: string; url: string }) {
  const url = input.url;
  return {
    to: input.to,
    subject: "TraffLabels orders sign-in",
    text: [
      "Sign in to the TraffLabels orders board:",
      "",
      url,
      "",
      "This link expires in 20 minutes and works once.",
      "If you did not ask for it, you can ignore this email.",
    ].join("\n"),
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#12151a;">
<p>Sign in to the TraffLabels orders board.</p>
<p><a href="${escapeHtml(url)}">Open the orders board</a></p>
<p style="color:#64748b;font-size:13px;">This link expires in 20 minutes and works once. If you did not ask for it, you can ignore this email.</p>
</div>`,
  };
}

export type MagicLinkDelivery = "sent" | "failed" | "dev-preview";

/**
 * Production sends through Resend. Local development shows the link on the
 * sign-in page instead, so a workshop machine does not email the allowlist.
 */
export async function sendMagicLinkEmail(input: { to: string; url: string }): Promise<MagicLinkDelivery> {
  if (process.env.NODE_ENV !== "production") return "dev-preview";

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!apiKey || !from) {
    console.error("[admin] RESEND_API_KEY or RESEND_FROM is not set");
    return "failed";
  }

  const message = magicLinkMessage(input);
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  if (error || !data) {
    console.error("[admin] magic link email failed", error);
    return "failed";
  }
  return "sent";
}
