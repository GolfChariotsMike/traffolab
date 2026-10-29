import { CANONICAL_CHECKOUT_ORIGIN } from "@/lib/checkout-return";
import type { SavedOrder } from "@/lib/orders";
import { formatAud } from "@/lib/pricing";
import {
  platesMatchProof,
  type ProofRecord,
  type ProofStatus,
} from "@/lib/proofs";

/** A proof is due once it has been waiting at least this long. */
export const PROOF_REMINDER_AFTER_MS = 24 * 60 * 60 * 1000;

export const PROOF_REMINDER_FROM = "TraffLabels <sales@trafflabels.com.au>";
export const PROOF_REMINDER_REPLY_TO = "sales@trafflabels.com.au";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ProofReminderCheck = {
  status: ProofStatus | string;
  createdAt: string;
  reminderSentAt: string | null;
  /** False for proofs that existed before reminders went live. */
  autoReminder: boolean;
  isLatest: boolean;
  /** False when the plates were edited after the proof was sent. */
  platesMatch: boolean;
  now: number;
  /** Proofs created at or before this instant are excluded. Null skips the cutoff. */
  notBefore: number | null;
};

/**
 * Latest pending proof, still matching the plates, created after go-live,
 * with no reminder recorded, and sent at least 24 hours ago.
 * Exactly 24 hours qualifies. One millisecond earlier does not.
 */
export function proofReminderDue(input: ProofReminderCheck) {
  if (!input.isLatest || !input.autoReminder || !input.platesMatch) return false;
  if (input.status !== "pending") return false;
  if (input.reminderSentAt) return false;
  const created = new Date(input.createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  if (input.notBefore != null && created <= input.notBefore) return false;
  return input.now - created >= PROOF_REMINDER_AFTER_MS;
}

export function proofReminderNotBefore(raw: string | undefined): Date | null | "invalid" {
  const value = raw?.trim() ?? "";
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "invalid";
  return date;
}

export function customerReminderEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!email || email.length > 200 || !EMAIL_RE.test(email)) return null;
  return email;
}

export function proofReminderUrl(token: string) {
  return `${CANONICAL_CHECKOUT_ORIGIN}/proof/${token}/`;
}

export function selectDueProofReminders(
  orders: SavedOrder[],
  latestProofs: ProofRecord[],
  now: Date,
  notBefore: Date | null
) {
  const byId = new Map(orders.map((order) => [order.id, order]));
  const due: Array<{ order: SavedOrder; proof: ProofRecord }> = [];
  for (const proof of latestProofs) {
    const order = byId.get(proof.orderId);
    if (!order) continue;
    if (
      !proofReminderDue({
        status: proof.status,
        createdAt: proof.createdAt,
        reminderSentAt: proof.reminderSentAt,
        autoReminder: proof.autoReminder,
        isLatest: true,
        platesMatch: platesMatchProof(order.plates, proof),
        now: now.getTime(),
        notBefore: notBefore ? notBefore.getTime() : null,
      })
    ) {
      continue;
    }
    due.push({ order, proof });
  }
  return due;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function proofReminderMessage(input: {
  customerName: string;
  orderNumber: number;
  proofUrl: string;
  totalIncGstCents: number;
}) {
  const name = input.customerName.trim();
  const hello = name ? `Hello ${name},` : "Hello,";
  const total = formatAud(input.totalIncGstCents);
  const subject = `Your TraffLabels proof — order #${input.orderNumber}`;
  const text = [
    hello,
    "",
    `Just checking the proof for your TraffLabels order #${input.orderNumber} came through.`,
    "",
    input.proofUrl,
    "",
    `The total to approve is ${total} inc GST.`,
    "",
    "When you're happy with the plates, type your name and tick the box to approve them for production. If something needs to change, use the request changes box on the same page.",
    "",
    "Reply to this email if you have any questions.",
    "",
    "Mike",
    "TraffLabels",
  ].join("\n");
  const html = `<div style="margin:0;padding:24px;background:#f4f1ea;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4e0d6;">
    <div style="height:6px;background:#fee100;"></div>
    <div style="padding:28px 32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#12151a;">
      <p style="margin:0 0 18px;font-size:13px;letter-spacing:0.14em;font-weight:700;">TRAFFLABELS</p>
      <p style="margin:0 0 14px;">${escapeHtml(hello)}</p>
      <p style="margin:0 0 14px;">Just checking the proof for your TraffLabels order #${input.orderNumber} came through.</p>
      <p style="margin:0 0 14px;"><a href="${escapeHtml(input.proofUrl)}" style="color:#12151a;">Open your proof</a></p>
      <p style="margin:0 0 14px;">The total to approve is <strong>${escapeHtml(total)} inc GST</strong>.</p>
      <p style="margin:0 0 14px;">When you're happy with the plates, type your name and tick the box to approve them for production. If something needs to change, use the request changes box on the same page.</p>
      <p style="margin:0 0 14px;">Reply to this email if you have any questions.</p>
      <p style="margin:0;">Mike<br>TraffLabels</p>
    </div>
  </div>
</div>`;
  return { subject, text, html };
}
