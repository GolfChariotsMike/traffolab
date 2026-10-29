import "server-only";
import { Resend } from "resend";
import {
  APPLICANT_FROM,
  APPLICANT_REPLY_TO,
  applicantConfirmationCopy,
  workshopApplicationCopy,
  type AccountApplication,
} from "@/lib/account-application";
import { proofNotifyRecipients, type ProofMailDelivery } from "@/lib/proof-mail";

export type AccountApplicationMailDelivery = {
  workshop: ProofMailDelivery;
  applicant: ProofMailDelivery;
};

function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM?.trim());
}

/**
 * Workshop notice uses the same Resend sender and inbox as proof notifications.
 * The applicant confirmation is sent from sales@trafflabels.com.au.
 * Both wait on RESEND_API_KEY and RESEND_FROM. Local development logs instead.
 */
export async function sendAccountApplicationEmails(
  application: AccountApplication
): Promise<AccountApplicationMailDelivery> {
  const workshop = workshopApplicationCopy(application);
  const applicant = applicantConfirmationCopy(application);

  if (process.env.NODE_ENV !== "production") {
    console.info("[account-application] workshop", workshop.subject);
    console.info("[account-application] applicant", applicant.subject);
    return { workshop: "dev-preview", applicant: "dev-preview" };
  }

  if (!mailConfigured()) {
    console.error("[account-application] RESEND_API_KEY or RESEND_FROM is not set");
    return { workshop: "failed", applicant: "failed" };
  }

  const resend = new Resend(process.env.RESEND_API_KEY!.trim());
  const from = process.env.RESEND_FROM!.trim();

  const workshopResult = await resend.emails.send({
    from,
    to: proofNotifyRecipients(),
    replyTo: application.apEmail,
    subject: workshop.subject,
    text: workshop.text,
    html: workshop.html,
  });
  const applicantResult = await resend.emails.send({
    from: APPLICANT_FROM,
    replyTo: APPLICANT_REPLY_TO,
    to: application.apEmail,
    subject: applicant.subject,
    text: applicant.text,
    html: applicant.html,
  });

  if (workshopResult.error || !workshopResult.data) {
    console.error("[account-application] workshop email failed", workshopResult.error);
  }
  if (applicantResult.error || !applicantResult.data) {
    console.error("[account-application] applicant email failed", applicantResult.error);
  }

  return {
    workshop: workshopResult.error || !workshopResult.data ? "failed" : "sent",
    applicant: applicantResult.error || !applicantResult.data ? "failed" : "sent",
  };
}
