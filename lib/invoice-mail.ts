import { Resend } from "resend";
import {
  INVOICE_FROM,
  INVOICE_REPLY_TO,
  invoiceCopyMessage,
} from "@/lib/invoice";

export type InvoiceCopyDelivery = "sent" | "failed" | "skipped" | "dev-preview";

/**
 * Stripe emails the invoice to the customer only. Extra recipients, such as
 * accounts payable, get a short copy from TraffLabels through Resend.
 */
export async function sendInvoiceCopy(input: {
  to: string[];
  orderNumber: number;
  hostedUrl: string;
  pdfUrl: string | null;
  totalIncGstCents: number;
  gstCents: number;
}): Promise<InvoiceCopyDelivery> {
  if (input.to.length === 0 || !input.hostedUrl) return "skipped";
  const message = invoiceCopyMessage(input);
  if (process.env.NODE_ENV !== "production") {
    console.info("[invoice] copy", message.subject, input.to.join(", "));
    return "dev-preview";
  }
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error("[invoice] RESEND_API_KEY is not set");
    return "failed";
  }
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: INVOICE_FROM,
    to: input.to,
    replyTo: INVOICE_REPLY_TO,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  if (error || !data) {
    console.error("[invoice] copy email failed", error);
    return "failed";
  }
  return "sent";
}
