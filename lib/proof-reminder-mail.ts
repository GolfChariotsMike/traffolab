import "server-only";
import { Resend } from "resend";
import {
  PROOF_REMINDER_FROM,
  PROOF_REMINDER_REPLY_TO,
  proofReminderMessage,
} from "@/lib/proof-reminder";
import type { ProofReminderDelivery } from "@/lib/proof-reminder-run";

export async function sendProofReminderEmail(
  message: ReturnType<typeof proofReminderMessage> & { to: string }
): Promise<ProofReminderDelivery> {
  if (process.env.NODE_ENV !== "production") {
    console.info("[proof-reminder] dev preview", message.subject, message.to);
    return "dev-preview";
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error("[proof-reminder] RESEND_API_KEY is not set");
    return "failed";
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: PROOF_REMINDER_FROM,
    to: message.to,
    replyTo: PROOF_REMINDER_REPLY_TO,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  if (error || !data) {
    console.error("[proof-reminder] email failed", error);
    return "failed";
  }
  return "sent";
}
