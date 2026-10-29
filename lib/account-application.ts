/**
 * Trade account applications. Pure helpers — no database.
 */

import { cleanApproverName } from "@/lib/proofs";
import { formatPerthDateTime } from "@/lib/orders";
import { CANONICAL_CHECKOUT_ORIGIN } from "@/lib/checkout-return";
import {
  AUTHORISATION_STATEMENT,
  HONEYPOT_FIELD,
  SALES_EMAIL,
  TRADING_TERMS,
} from "@/lib/account-application-copy";
import {
  formatAbn,
  isAccountApplicationStatus,
  type AccountApplication,
  type AccountApplicationStatus,
} from "@/lib/account-application-model";

export {
  formatAbn,
  isAccountApplicationStatus,
  type AccountApplication,
  type AccountApplicationStatus,
};
export { HONEYPOT_FIELD };
export const RATE_LIMIT_MAX = 5;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export const ACCOUNT_APPLICATION_MIGRATION_HINT =
  "Apply db/migrations/20261029_trafflabels_account_applications.sql on the database before account applications can be saved.";

export const APPLICANT_FROM = "TraffLabels <sales@trafflabels.com.au>";
export const APPLICANT_REPLY_TO = SALES_EMAIL;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AccountApplicationRateError extends Error {
  constructor() {
    super("Too many applications from this network. Try again in an hour.");
    this.name = "AccountApplicationRateError";
  }
}

export class AccountApplicationSchemaError extends Error {
  constructor() {
    super(ACCOUNT_APPLICATION_MIGRATION_HINT);
    this.name = "AccountApplicationSchemaError";
  }
}

/** Fields the public form is allowed to set. The server adds id, status, and links. */
export type NewAccountApplication = Omit<
  AccountApplication,
  | "id"
  | "createdAt"
  | "status"
  | "linkedOrderId"
  | "linkedOrderNumber"
  | "decidedAt"
  | "decidedBy"
>;

export type ParseAccountApplicationResult =
  | { ok: true; honeypot: true }
  | { ok: true; honeypot: false; application: NewAccountApplication }
  | { ok: false; error: string };

export function cleanAbn(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/[\s-]/g, "");
  if (!/^\d{11}$/.test(digits)) return null;
  return digits;
}

export function cleanAcn(value: unknown): string | null {
  if (value == null) return "";
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/[\s-]/g, "");
  if (!/^\d{9}$/.test(digits)) return null;
  return digits;
}

export function recentApplicationCount(
  rows: { authorisedIp: string; createdAt: string }[],
  ip: string,
  now: number,
  windowMs = RATE_LIMIT_WINDOW_MS
) {
  return rows.filter((row) => {
    if (row.authorisedIp !== ip) return false;
    const at = new Date(row.createdAt).getTime();
    if (Number.isNaN(at)) return false;
    return now - at < windowMs;
  }).length;
}

export function isRateLimited(
  rows: { authorisedIp: string; createdAt: string }[],
  ip: string,
  now: number
) {
  return recentApplicationCount(rows, ip, now) >= RATE_LIMIT_MAX;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\r\n/g, "\n").trim();
  if (text.length > max) return null;
  return text;
}

function cleanEmail(value: unknown, required: boolean): string | null {
  if (typeof value !== "string") return required ? null : "";
  const email = value.trim().toLowerCase();
  if (!email) return required ? null : "";
  if (email.length > 200 || !EMAIL_RE.test(email)) return null;
  return email;
}

function cleanPhone(value: unknown, required: boolean): string | null {
  if (typeof value !== "string") return required ? null : "";
  const text = value.trim();
  if (!text) return required ? null : "";
  if (text.length > 40) return null;
  const digits = text.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 20) return null;
  return text;
}

function cleanPersonName(value: unknown, required: boolean): string | null {
  if (typeof value !== "string") return required ? null : "";
  const name = value.replace(/\s+/g, " ").trim();
  if (!name) return required ? null : "";
  if (name.length < 2 || name.length > 120) return null;
  return name;
}

function honeypotTripped(value: unknown) {
  if (value == null) return false;
  if (typeof value !== "string") return true;
  return value.trim().length > 0;
}

export function parseAccountApplication(
  body: unknown,
  meta: { ip: string; userAgent: string; authorisedAt?: string }
): ParseAccountApplicationResult {
  const record = asRecord(body);
  if (!record) return { ok: false, error: "Invalid application." };
  if (honeypotTripped(record[HONEYPOT_FIELD])) return { ok: true, honeypot: true };

  const registeredCompanyName = cleanText(record.registeredCompanyName, 200);
  if (!registeredCompanyName || registeredCompanyName.length < 2) {
    return { ok: false, error: "Enter the registered company name." };
  }
  const acn = cleanAcn(record.acn);
  if (acn == null) return { ok: false, error: "ACN must be 9 digits." };
  const tradingName = cleanText(record.tradingName ?? "", 200);
  if (tradingName == null) return { ok: false, error: "Trading name is too long." };
  const abn = cleanAbn(record.abn);
  if (!abn) return { ok: false, error: "ABN must be 11 digits." };
  const billingAddress = cleanText(record.billingAddress, 1000);
  if (!billingAddress || billingAddress.length < 5) {
    return { ok: false, error: "Enter the billing address." };
  }
  const deliveryAddress = cleanText(record.deliveryAddress ?? "", 1000);
  if (deliveryAddress == null) return { ok: false, error: "Delivery address is too long." };
  const mainPhone = cleanPhone(record.mainPhone, true);
  if (!mainPhone) return { ok: false, error: "Enter the main phone number." };
  const website = cleanText(record.website ?? "", 200);
  if (website == null || /\s/.test(website)) {
    return { ok: false, error: "Enter a valid website or leave it blank." };
  }
  const apName = cleanPersonName(record.apName, true);
  if (!apName) return { ok: false, error: "Enter the accounts payable contact name." };
  const apEmail = cleanEmail(record.apEmail, true);
  if (!apEmail) return { ok: false, error: "Enter the email address for invoices." };
  const apPhone = cleanPhone(record.apPhone ?? "", false);
  if (apPhone == null) {
    return { ok: false, error: "Enter a valid accounts payable phone number or leave it blank." };
  }
  const purchasingName = cleanPersonName(record.purchasingName ?? "", false);
  if (purchasingName == null) {
    return { ok: false, error: "Enter a valid purchasing contact name or leave it blank." };
  }
  const purchasingEmail = cleanEmail(record.purchasingEmail ?? "", false);
  if (purchasingEmail == null) {
    return { ok: false, error: "Enter a valid purchasing contact email or leave it blank." };
  }
  const purchasingPhone = cleanPhone(record.purchasingPhone ?? "", false);
  if (purchasingPhone == null) {
    return { ok: false, error: "Enter a valid purchasing contact phone or leave it blank." };
  }
  if (typeof record.poRequired !== "boolean") {
    return {
      ok: false,
      error: "Say whether a purchase order number is required on invoices.",
    };
  }
  if (record.confirmed !== true) {
    return {
      ok: false,
      error: "Tick the box to confirm you are authorised to open this account.",
    };
  }
  const authorisedName = cleanApproverName(record.authorisedName);
  if (!authorisedName) return { ok: false, error: "Enter your full name (first and last)." };
  const position = cleanPersonName(record.position, true);
  if (!position) return { ok: false, error: "Enter your position." };

  const authorisedAt = meta.authorisedAt ?? new Date().toISOString();
  return {
    ok: true,
    honeypot: false,
    application: {
      registeredCompanyName,
      acn,
      tradingName,
      abn,
      billingAddress,
      deliveryAddress,
      mainPhone,
      website,
      apName,
      apEmail,
      apPhone,
      purchasingName,
      purchasingEmail,
      purchasingPhone,
      poRequired: record.poRequired,
      authorisationStatement: AUTHORISATION_STATEMENT,
      authorisedName,
      position,
      authorisedAt,
      authorisedIp: meta.ip.slice(0, 200),
      authorisedUserAgent: meta.userAgent.slice(0, 500),
    },
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function detailLines(application: AccountApplication) {
  const lines = [
    `Company: ${application.registeredCompanyName}`,
    `ACN: ${application.acn || "—"}`,
    `Trading name: ${application.tradingName || "—"}`,
    `ABN: ${formatAbn(application.abn)}`,
    `Billing address: ${application.billingAddress}`,
    `Delivery address: ${application.deliveryAddress || "—"}`,
    `Main phone: ${application.mainPhone}`,
    `Website: ${application.website || "—"}`,
    `Accounts payable: ${application.apName}`,
    `Invoice email: ${application.apEmail}`,
    `Accounts payable phone: ${application.apPhone || "—"}`,
    `Purchasing contact: ${application.purchasingName || "—"}`,
    `Purchasing email: ${application.purchasingEmail || "—"}`,
    `Purchasing phone: ${application.purchasingPhone || "—"}`,
    `Purchase order number required on invoices: ${application.poRequired ? "Yes" : "No"}`,
    `Authorised by: ${application.authorisedName}, ${application.position}`,
    `Signed: ${formatPerthDateTime(application.authorisedAt)} (Perth)`,
    `IP: ${application.authorisedIp || "—"}`,
    `Browser: ${application.authorisedUserAgent || "—"}`,
    `Declaration: ${application.authorisationStatement}`,
  ];
  return lines;
}

export function workshopApplicationCopy(application: AccountApplication) {
  const subject = `TraffLabels trade account application — ${application.registeredCompanyName}`;
  const adminUrl = `${CANONICAL_CHECKOUT_ORIGIN}/admin/account-applications/`;
  const lines = [
    `New TraffLabels trade account application from ${application.registeredCompanyName}.`,
    "",
    ...detailLines(application),
    "",
    ...TRADING_TERMS.map((term) => `• ${term}`),
    "",
    `Review it at ${adminUrl}`,
  ];
  const text = lines.join("\n");
  const html = `<p>${escapeHtml(lines[0])}</p><ul>${detailLines(application)
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join("")}</ul><p><a href="${escapeHtml(adminUrl)}">Review account applications</a></p>`;
  return { subject, text, html };
}

export function applicantConfirmationCopy(input: {
  registeredCompanyName: string;
  apEmail: string;
}) {
  const subject = "TraffLabels trade account application received";
  const text = [
    `Thanks for applying for a TraffLabels trade account for ${input.registeredCompanyName}.`,
    "",
    `We have the application and will reply to ${input.apEmail}.`,
    "",
    "TraffLabels",
    SALES_EMAIL,
  ].join("\n");
  const html = `<p>Thanks for applying for a TraffLabels trade account for ${escapeHtml(input.registeredCompanyName)}.</p><p>We have the application and will reply to ${escapeHtml(input.apEmail)}.</p><p>TraffLabels<br>${escapeHtml(SALES_EMAIL)}</p>`;
  return { subject, text, html };
}
