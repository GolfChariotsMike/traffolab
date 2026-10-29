/** Wording from the TraffLabels trade account PDF. Customer-facing copy only. */

export const PDF_PUBLIC_PATH = "/forms/TraffLabels-Account-Application.pdf";

export const SUPPLIER_NAME = "TraffLabels, a business of Golf Chariots (Aust) Pty Ltd";
export const SUPPLIER_ABN = "ABN 13 622 380 723";
export const SUPPLIER_CONTACT = "sales@trafflabels.com.au · trafflabels.com.au";
export const SALES_EMAIL = "sales@trafflabels.com.au";

export const INTRO_LINE =
  "Fill this in online and submit, or download the PDF version and email it back to sales@trafflabels.com.au.";

export const FOOTER_LINE =
  "TraffLabels · a business of Golf Chariots (Aust) Pty Ltd · ABN 13 622 380 723 · sales@trafflabels.com.au · trafflabels.com.au";

export const TRADING_TERMS = [
  "Payment is due 14 days from the invoice date.",
  "All prices are in Australian dollars (AUD) and include GST.",
  "Invoices are emailed with an online payment link, so you can pay by card or bank transfer.",
  "Orders go into production once the proof has been approved.",
  "Overdue accounts may be put on hold until payment is received.",
] as const;

export const AUTHORISATION_STATEMENT =
  "I confirm the details on this form are correct, that I am authorised to open this account on behalf of the business named above, and that the business agrees to the trading terms above.";

export const SIGNATURE_NOTE =
  "Typing your full name and ticking this box is your signature on this application.";

/** Off-screen field. A filled value is discarded and nothing is saved. */
export const HONEYPOT_FIELD = "companyWebsiteConfirm";
