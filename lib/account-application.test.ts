import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  AUTHORISATION_STATEMENT,
  FOOTER_LINE,
  INTRO_LINE,
  PDF_PUBLIC_PATH,
  SUPPLIER_ABN,
  SUPPLIER_NAME,
  TRADING_TERMS,
} from "./account-application-copy";
import { createFileAccountApplicationStore } from "./account-application-file";
import {
  APPLICANT_FROM,
  APPLICANT_REPLY_TO,
  AccountApplicationRateError,
  HONEYPOT_FIELD,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  applicantConfirmationCopy,
  cleanAbn,
  cleanAcn,
  isRateLimited,
  parseAccountApplication,
  recentApplicationCount,
  workshopApplicationCopy,
  type AccountApplication,
  type NewAccountApplication,
} from "./account-application";
import { cleanApproverName } from "./proofs";

const migration = readFileSync(
  new URL("../db/migrations/20261029_trafflabels_account_applications.sql", import.meta.url),
  "utf8"
);
assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
assert.doesNotMatch(migration, /FORCE ROW LEVEL SECURITY/);
assert.doesNotMatch(migration, /CREATE POLICY/i);
assert.match(migration, /REVOKE ALL ON TABLE public\.trafflabels_account_applications FROM PUBLIC/);
assert.match(migration, /REVOKE ALL ON TABLE public\.trafflabels_account_applications FROM anon/);
assert.match(
  migration,
  /REVOKE ALL ON TABLE public\.trafflabels_account_applications FROM authenticated/
);
assert.match(
  migration,
  /GRANT ALL ON TABLE public\.trafflabels_account_applications TO service_role/
);
assert.doesNotMatch(migration, /GRANT\b[^;]*\bTO anon\b/);
assert.doesNotMatch(migration, /GRANT\b[^;]*\bTO authenticated\b/);
assert.match(migration, /CHECK \(status IN \('new', 'approved', 'declined'\)\)/);
assert.match(
  migration,
  /linked_order_id text REFERENCES public\.trafflabels_orders \(id\) ON DELETE SET NULL/
);
assert.doesNotMatch(migration, /CREATE SEQUENCE/i);

assert.deepEqual(TRADING_TERMS, [
  "Payment is due 14 days from the invoice date.",
  "All prices are in Australian dollars (AUD) and include GST.",
  "Invoices are emailed with an online payment link, so you can pay by card or bank transfer.",
  "Orders go into production once the proof has been approved.",
  "Overdue accounts may be put on hold until payment is received.",
]);
assert.equal(
  AUTHORISATION_STATEMENT,
  "I confirm the details on this form are correct, that I am authorised to open this account on behalf of the business named above, and that the business agrees to the trading terms above."
);
assert.equal(
  INTRO_LINE,
  "Fill this in online and submit, or download the PDF version and email it back to sales@trafflabels.com.au."
);
assert.equal(SUPPLIER_NAME, "TraffLabels, a business of Golf Chariots (Aust) Pty Ltd");
assert.equal(SUPPLIER_ABN, "ABN 13 622 380 723");
assert.equal(PDF_PUBLIC_PATH, "/forms/TraffLabels-Account-Application.pdf");
assert.equal(FOOTER_LINE.includes("sales@trafflabels.com.au"), true);
assert.equal(exists("public/forms/TraffLabels-Account-Application.pdf"), true);

const formSource = readFileSync(
  new URL("../components/account-application/application-form.tsx", import.meta.url),
  "utf8"
);
const pageSource = readFileSync(
  new URL("../app/account-application/page.tsx", import.meta.url),
  "utf8"
);
const mailSource = readFileSync(
  new URL("../lib/account-application-mail.ts", import.meta.url),
  "utf8"
);
const shellSource = readFileSync(new URL("../components/site-shell.tsx", import.meta.url), "utf8");
const robotsSource = readFileSync(new URL("../app/robots.ts", import.meta.url), "utf8");
for (const source of [formSource, pageSource, mailSource, migration]) {
  assert.doesNotMatch(source, /Stik Stickers|TraffoLab/);
}
assert.match(formSource, /TRADING_TERMS/);
assert.match(formSource, /AUTHORISATION_STATEMENT/);
assert.match(formSource, /PDF_PUBLIC_PATH/);
assert.match(formSource, /INTRO_LINE/);
assert.match(formSource, /Download PDF version/);
assert.doesNotMatch(formSource, /RETURN_LINE|Please return the completed, signed form by email/);
assert.match(pageSource, /noindex|index: false/);
assert.match(shellSource, /\/account-application/);
assert.match(robotsSource, /\/account-application\//);
assert.match(mailSource, /RESEND_API_KEY/);
assert.match(mailSource, /RESEND_FROM/);
assert.match(mailSource, /proofNotifyRecipients/);
assert.match(mailSource, /APPLICANT_FROM/);
assert.doesNotMatch(mailSource, /TURNSTILE|turnstile/i);

assert.equal(cleanAbn("13 622 380 723"), "13622380723");
assert.equal(cleanAbn("1362238072"), null);
assert.equal(cleanAbn("136223807233"), null);
assert.equal(cleanAcn(""), "");
assert.equal(cleanAcn("123 456 789"), "123456789");
assert.equal(cleanAcn("12345678"), null);
assert.equal(cleanApproverName("Alex Nguyen"), "Alex Nguyen");

const meta = {
  ip: "203.0.113.8",
  userAgent: "TestBrowser/1",
  authorisedAt: "2026-10-29T04:00:00.000Z",
};

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    registeredCompanyName: "Tasman Asset Management",
    acn: "123 456 789",
    tradingName: "",
    abn: "13 622 380 723",
    billingAddress: "28 Bayly St\nNorth Fremantle WA 6159",
    deliveryAddress: "",
    mainPhone: "08 9335 1234",
    website: "",
    apName: "Accounts",
    apEmail: "accounts@example.com",
    apPhone: "",
    purchasingName: "",
    purchasingEmail: "",
    purchasingPhone: "",
    poRequired: false,
    confirmed: true,
    authorisedName: "Simon Bradley",
    position: "Director",
    [HONEYPOT_FIELD]: "",
    ...overrides,
  };
}

const parsed = parseAccountApplication(validBody(), meta);
assert.equal(parsed.ok, true);
if (!parsed.ok || parsed.honeypot) throw new Error("expected a saved application");
assert.equal(parsed.application.abn, "13622380723");
assert.equal(parsed.application.acn, "123456789");
assert.equal(parsed.application.authorisationStatement, AUTHORISATION_STATEMENT);
assert.equal(parsed.application.authorisedName, "Simon Bradley");
assert.equal(parsed.application.authorisedIp, "203.0.113.8");
assert.equal(parsed.application.authorisedAt, meta.authorisedAt);
assert.equal(parsed.application.poRequired, false);

assert.equal(parseAccountApplication(validBody({ abn: "123" }), meta).ok, false);
assert.equal(parseAccountApplication(validBody({ registeredCompanyName: "" }), meta).ok, false);
assert.equal(parseAccountApplication(validBody({ billingAddress: "x" }), meta).ok, false);
assert.equal(parseAccountApplication(validBody({ mainPhone: "" }), meta).ok, false);
assert.equal(parseAccountApplication(validBody({ apEmail: "not-an-email" }), meta).ok, false);
assert.equal(parseAccountApplication(validBody({ purchasingEmail: "bad" }), meta).ok, false);
assert.equal(parseAccountApplication(validBody({ poRequired: "yes" }), meta).ok, false);
assert.equal(parseAccountApplication(validBody({ confirmed: false }), meta).ok, false);
assert.equal(parseAccountApplication(validBody({ authorisedName: "Simon" }), meta).ok, false);
assert.equal(parseAccountApplication(validBody({ position: "" }), meta).ok, false);
assert.equal(parseAccountApplication(validBody({ acn: "12" }), meta).ok, false);

const trapped = parseAccountApplication(
  validBody({ [HONEYPOT_FIELD]: "https://spam.example" }),
  meta
);
assert.deepEqual(trapped, { ok: true, honeypot: true });
const trappedEmpty = parseAccountApplication({ [HONEYPOT_FIELD]: "bot" }, meta);
assert.deepEqual(trappedEmpty, { ok: true, honeypot: true });

const now = Date.parse("2026-10-29T06:00:00.000Z");
const inside = new Date(now - RATE_LIMIT_WINDOW_MS + 1).toISOString();
const edge = new Date(now - RATE_LIMIT_WINDOW_MS).toISOString();
assert.equal(
  recentApplicationCount(
    Array.from({ length: RATE_LIMIT_MAX }, () => ({ authorisedIp: "1.1.1.1", createdAt: inside })),
    "1.1.1.1",
    now
  ),
  RATE_LIMIT_MAX
);
assert.equal(isRateLimited([{ authorisedIp: "1.1.1.1", createdAt: edge }], "1.1.1.1", now), false);
assert.equal(
  isRateLimited(
    Array.from({ length: RATE_LIMIT_MAX }, () => ({ authorisedIp: "1.1.1.1", createdAt: edge })),
    "1.1.1.1",
    now
  ),
  false
);

const dir = await mkdtemp(path.join(tmpdir(), "account-applications-"));
const store = createFileAccountApplicationStore(path.join(dir, "applications.json"));
const saved = await store.insert(parsed.application);
assert.equal(saved.status, "new");
assert.equal(saved.linkedOrderId, null);
assert.equal((await store.list()).length, 1);
const approved = await store.update(saved.id, {
  status: "approved",
  decidedBy: "info@stikstickers.com",
  linkedOrderId: "order-1",
  linkedOrderNumber: 1003,
});
assert.equal(approved?.status, "approved");
assert.equal(approved?.linkedOrderNumber, 1003);
assert.equal(approved?.decidedBy, "info@stikstickers.com");
assert.ok(approved?.decidedAt);

const limited = createFileAccountApplicationStore(path.join(dir, "limited.json"));
let last: NewAccountApplication = parsed.application;
for (let i = 0; i < RATE_LIMIT_MAX; i += 1) {
  last = { ...parsed.application, authorisedIp: "198.51.100.4" };
  await limited.insert(last);
}
await assert.rejects(() => limited.insert(last), AccountApplicationRateError);
await limited.insert({ ...last, authorisedIp: "198.51.100.5" });

const limitedPath = path.join(dir, "limited.json");
const raw = JSON.parse(readFileSync(limitedPath, "utf8")) as {
  applications: AccountApplication[];
};
for (const item of raw.applications) {
  if (item.authorisedIp === "198.51.100.4") {
    item.createdAt = new Date(Date.now() - RATE_LIMIT_WINDOW_MS - 1000).toISOString();
  }
}
writeFileSync(limitedPath, JSON.stringify(raw));
const afterWindow = await limited.insert(last);
assert.equal(afterWindow.authorisedIp, "198.51.100.4");

const workshop = workshopApplicationCopy(saved);
const applicant = applicantConfirmationCopy(saved);
assert.match(workshop.subject, /^TraffLabels trade account application/);
assert.match(workshop.text, /Tasman Asset Management/);
assert.match(workshop.text, /Simon Bradley/);
assert.match(applicant.subject, /^TraffLabels/);
assert.match(applicant.text, /sales@trafflabels.com.au/);
assert.equal(APPLICANT_FROM, "TraffLabels <sales@trafflabels.com.au>");
assert.equal(APPLICANT_REPLY_TO, "sales@trafflabels.com.au");
assert.doesNotMatch(`${workshop.text}\n${applicant.text}`, /Stik Stickers|TraffoLab/);

function exists(relativePath: string) {
  try {
    readFileSync(new URL(`../${relativePath}`, import.meta.url));
    return true;
  } catch {
    return false;
  }
}

console.log("account-application tests passed");
