import "server-only";
import { Resend } from "resend";
import { proofNotificationCopy, type ProofRecord } from "@/lib/proofs";
import { contactEmail } from "@/lib/site";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ProofMailDelivery = "sent" | "failed" | "dev-preview";

/** Workshop inbox. Always includes info@stikstickers.com, plus CONTACT_TO when set. */
export function proofNotifyRecipients() {
  const seen = new Set<string>([contactEmail]);
  for (const part of (process.env.CONTACT_TO ?? "").split(/[,;]/)) {
    const email = part.trim().toLowerCase();
    if (email && EMAIL_RE.test(email)) seen.add(email);
  }
  return [...seen];
}

/**
 * Production sends through Resend. Local development logs the notice instead,
 * matching the orders sign-in link.
 */
export async function sendProofNotification(input: {
  proof: ProofRecord;
  proofUrl: string;
}): Promise<ProofMailDelivery> {
  const kind = input.proof.status === "approved" ? "approved" : "changes";
  const message = proofNotificationCopy({
    kind,
    orderNumber: input.proof.orderNumber,
    customerName: input.proof.customerName,
    actorName: input.proof.approvedName,
    comment: input.proof.changeComment,
    at:
      (kind === "approved" ? input.proof.approvedAt : input.proof.changeRequestedAt) ||
      new Date().toISOString(),
    proofUrl: input.proofUrl,
    ip: kind === "approved" ? input.proof.approvedIp : input.proof.changeIp,
    userAgent:
      kind === "approved" ? input.proof.approvedUserAgent : input.proof.changeUserAgent,
    totalIncGstCents: input.proof.approvedTotalCents,
  });

  if (process.env.NODE_ENV !== "production") {
    console.info("[proof] notification", message.subject);
    return "dev-preview";
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!apiKey || !from) {
    console.error("[proof] RESEND_API_KEY or RESEND_FROM is not set");
    return "failed";
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: proofNotifyRecipients(),
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  if (error || !data) {
    console.error("[proof] notification email failed", error);
    return "failed";
  }
  return "sent";
}
