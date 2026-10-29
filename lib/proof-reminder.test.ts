import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { cronAuthorized } from "./cron-auth";
import { createFileOrderStore } from "./order-store-file";
import { formatPerthDay, type NewPaidOrder, type StoredPlate } from "./orders";
import {
  PROOF_REMINDER_AFTER_MS,
  PROOF_REMINDER_FROM,
  PROOF_REMINDER_REPLY_TO,
  proofReminderDue,
  proofReminderMessage,
  proofReminderNotBefore,
  proofReminderUrl,
  type ProofReminderCheck,
} from "./proof-reminder";
import { runProofReminders } from "./proof-reminder-run";
import { proofReminderLabel, proofViewLabel } from "./proofs";

const NOW = new Date("2026-10-29T02:00:00.000Z");
const DAY = PROOF_REMINDER_AFTER_MS;

function due(patch: Partial<ProofReminderCheck> = {}): ProofReminderCheck {
  return {
    status: "pending",
    createdAt: new Date(NOW.getTime() - DAY).toISOString(),
    reminderSentAt: null,
    autoReminder: true,
    isLatest: true,
    platesMatch: true,
    now: NOW.getTime(),
    notBefore: null,
    ...patch,
  };
}

assert.equal(proofReminderDue(due()), true);
assert.equal(
  proofReminderDue(due({ createdAt: new Date(NOW.getTime() - DAY + 1).toISOString() })),
  false
);
assert.equal(proofReminderDue(due({ createdAt: new Date(NOW.getTime() - DAY - 1).toISOString() })), true);
assert.equal(proofReminderDue(due({ status: "approved" })), false);
assert.equal(proofReminderDue(due({ status: "changes_requested" })), false);
assert.equal(proofReminderDue(due({ status: "superseded" })), false);
assert.equal(proofReminderDue(due({ platesMatch: false })), false);
assert.equal(proofReminderDue(due({ isLatest: false })), false);
assert.equal(proofReminderDue(due({ reminderSentAt: NOW.toISOString() })), false);
assert.equal(proofReminderDue(due({ autoReminder: false })), false);

const cutoff = NOW.getTime() - 48 * 60 * 60 * 1000;
assert.equal(
  proofReminderDue(
    due({
      createdAt: new Date(cutoff).toISOString(),
      notBefore: cutoff,
    })
  ),
  false
);
assert.equal(
  proofReminderDue(
    due({
      createdAt: new Date(cutoff - 1000).toISOString(),
      notBefore: cutoff,
    })
  ),
  false
);
assert.equal(
  proofReminderDue(
    due({
      createdAt: new Date(NOW.getTime() - 30 * 60 * 60 * 1000).toISOString(),
      notBefore: NOW.getTime() - 36 * 60 * 60 * 1000,
    })
  ),
  true
);
assert.equal(proofReminderNotBefore(undefined), null);
assert.equal(proofReminderNotBefore("  "), null);
assert.equal(proofReminderNotBefore("not-a-date"), "invalid");
assert.ok(proofReminderNotBefore("2026-10-29T00:00:00.000Z") instanceof Date);

const migration = readFileSync(
  new URL("../db/migrations/20261029_trafflabels_proof_reminders.sql", import.meta.url),
  "utf8"
);
assert.match(migration, /ADD COLUMN IF NOT EXISTS first_viewed_at/);
assert.match(migration, /ADD COLUMN IF NOT EXISTS reminder_sent_at/);
assert.match(migration, /SET auto_reminder = false/);
assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
assert.match(migration, /GRANT ALL ON TABLE public\.trafflabels_proofs TO service_role/);
assert.match(migration, /REVOKE ALL ON TABLE public\.trafflabels_proofs FROM anon/);
assert.match(migration, /REVOKE ALL ON TABLE public\.trafflabels_proofs FROM authenticated/);
assert.doesNotMatch(migration, /GRANT\b[^;]*\bTO anon\b/);
assert.doesNotMatch(migration, /GRANT\b[^;]*\bTO authenticated\b/);
assert.doesNotMatch(migration, /CREATE POLICY/i);
assert.doesNotMatch(migration, /FORCE ROW LEVEL SECURITY/);
assert.doesNotMatch(
  migration,
  /GRANT\b[^;]*\b(TRUNCATE|REFERENCES|TRIGGER)\b[^;]*\bTO (anon|authenticated)\b/
);

assert.equal(cronAuthorized(null, "secret"), false);
assert.equal(cronAuthorized("Bearer secret", ""), false);
assert.equal(cronAuthorized("Bearer secret", undefined), false);
assert.equal(cronAuthorized("Bearer wrong", "secret"), false);
assert.equal(cronAuthorized("secret", "secret"), false);
assert.equal(cronAuthorized("Bearer secret", "secret"), true);

const message = proofReminderMessage({
  customerName: "Harbour Electrical",
  orderNumber: 1003,
  proofUrl: proofReminderUrl("abc"),
  totalIncGstCents: 9240,
});
assert.equal(PROOF_REMINDER_FROM, "TraffLabels <sales@trafflabels.com.au>");
assert.equal(PROOF_REMINDER_REPLY_TO, "sales@trafflabels.com.au");
assert.match(message.subject, /order #1003/);
assert.match(message.text, /Hello Harbour Electrical/);
assert.match(message.text, /came through/);
assert.match(message.text, /https:\/\/www\.trafflabels\.com\.au\/proof\/abc\//);
assert.match(message.text, /\$92\.40 inc GST/);
assert.match(message.text, /type your name and tick the box/);
assert.match(message.text, /request changes/);
assert.match(message.text, /Reply to this email/);
assert.match(message.text, /Mike\nTraffLabels/);
assert.doesNotMatch(`${message.subject}\n${message.text}\n${message.html}`, /Stik Stickers|TraffoLab|screw/i);
assert.match(message.html, /TRAFFLABELS/);
assert.match(message.html, /#fee100/);

assert.equal(proofViewLabel({ state: "not_sent", firstViewedAt: null }), null);
assert.equal(proofViewLabel({ state: "awaiting", firstViewedAt: null }), "Not opened yet");
assert.equal(proofViewLabel({ state: "awaiting", firstViewedAt: NOW.toISOString() }), "Viewed");
assert.equal(proofViewLabel({ state: "approved", firstViewedAt: null }), "Viewed");
assert.equal(
  proofReminderLabel({ reminderSentAt: "2026-10-28T16:30:00.000Z" }),
  `Reminder sent ${formatPerthDay("2026-10-28T16:30:00.000Z")}`
);
assert.match(formatPerthDay("2026-10-28T16:30:00.000Z"), /29 Oct 2026/);

const plate: StoredPlate = {
  widthMm: 40,
  heightMm: 20,
  qty: 1,
  unitCents: 400,
  lineCents: 400,
  colourPair: "white-black",
  colourLabel: "White / black",
  adhesive3m: true,
  text: "DB 12",
  objects: [{ id: "text-1", text: "DB 12", x: 20, y: 10, fontSize: 4, align: "center" }],
};

function order(email = "accounts@harbour.example"): NewPaidOrder {
  return {
    id: crypto.randomUUID(),
    createdAt: "2026-10-27T00:00:00.000Z",
    updatedAt: "2026-10-27T00:00:00.000Z",
    status: "NEW",
    customerName: "Harbour Electrical",
    customerEmail: email,
    customerPhone: "",
    shipping: {
      name: "Harbour Electrical",
      line1: "14 Quay Street",
      line2: "",
      city: "Fremantle",
      state: "WA",
      postalCode: "6160",
      country: "AU",
    },
    shippingMethodId: "standard",
    subtotalCents: 400,
    shippingCents: 1000,
    totalCents: 1400,
    stripeSessionId: `manual:${crypto.randomUUID()}`,
    stripePaymentIntentId: null,
    stripeReceiptUrl: null,
    stripeLivemode: false,
    paymentSource: "manual",
    note: "",
    trackingLink: "",
    plates: [{ ...plate }],
  };
}

const dir = await mkdtemp(path.join(tmpdir(), "trafflabels-reminder-"));
const filePath = path.join(dir, "orders.json");
const store = createFileOrderStore(filePath);
const saved = await store.insertPaidOrder(order());
const created = await store.createProof(saved.orderNumber, { invoiceUrl: "" });
assert.ok(created);
assert.equal(created.autoReminder, true);
assert.equal(created.firstViewedAt, null);

const opened = await store.openProof(created.token);
assert.ok(opened?.proof.firstViewedAt);
const again = await store.openProof(created.token);
assert.equal(again?.proof.firstViewedAt, opened?.proof.firstViewedAt);

const raw = JSON.parse(readFileSync(filePath, "utf8")) as {
  proofs: Array<{ createdAt: string }>;
};
raw.proofs[0].createdAt = new Date(Date.now() - DAY - 60_000).toISOString();
writeFileSync(filePath, JSON.stringify(raw));

let sends = 0;
const first = await runProofReminders({
  store,
  now: new Date(),
  notBefore: null,
  send: async () => {
    sends += 1;
    return "sent";
  },
});
assert.equal(first.sent, 1);
assert.equal(sends, 1);
const reminded = await store.getLatestProof(saved.id);
assert.ok(reminded?.reminderSentAt);
assert.equal(
  await store.claimProofReminder(reminded!.id, new Date().toISOString()),
  null
);

const second = await runProofReminders({
  store,
  now: new Date(),
  notBefore: null,
  send: async () => {
    sends += 1;
    return "sent";
  },
});
assert.equal(second.sent, 0);
assert.equal(sends, 1);

const quietDir = await mkdtemp(path.join(tmpdir(), "trafflabels-reminder-quiet-"));
const quietPath = path.join(quietDir, "orders.json");
const quiet = createFileOrderStore(quietPath);
const approvedOrder = await quiet.insertPaidOrder(order("approved@harbour.example"));
const approvedProof = await quiet.createProof(approvedOrder.orderNumber, { invoiceUrl: "" });
assert.ok(approvedProof);
await quiet.decideProof(approvedProof.token, {
  action: "approve",
  name: "Alex Nguyen",
  ip: "203.0.113.8",
  userAgent: "Test",
});
const changesOrder = await quiet.insertPaidOrder(order("changes@harbour.example"));
const changesProof = await quiet.createProof(changesOrder.orderNumber, { invoiceUrl: "" });
assert.ok(changesProof);
await quiet.decideProof(changesProof.token, {
  action: "changes",
  comment: "Please fix the legend",
  ip: "203.0.113.9",
  userAgent: "Test",
});
const oldOrder = await quiet.insertPaidOrder(order("old@harbour.example"));
const oldProof = await quiet.createProof(oldOrder.orderNumber, { invoiceUrl: "" });
assert.ok(oldProof);
const exemptOrder = await quiet.insertPaidOrder(order("exempt@harbour.example"));
const exemptProof = await quiet.createProof(exemptOrder.orderNumber, { invoiceUrl: "" });
assert.ok(exemptProof);
const blankOrder = await quiet.insertPaidOrder(order("not-an-email"));
const blankProof = await quiet.createProof(blankOrder.orderNumber, { invoiceUrl: "" });
assert.ok(blankProof);

const quietRaw = JSON.parse(readFileSync(quietPath, "utf8")) as {
  proofs: Array<{ id: string; createdAt: string; autoReminder?: boolean }>;
};
const oldCreated = new Date(Date.now() - 3 * DAY).toISOString();
for (const proof of quietRaw.proofs) {
  proof.createdAt = oldCreated;
  if (proof.id === exemptProof.id) proof.autoReminder = false;
}
writeFileSync(quietPath, JSON.stringify(quietRaw));

let quietSends = 0;
const quietRun = await runProofReminders({
  store: quiet,
  now: new Date(),
  notBefore: new Date(Date.now() - 2 * DAY),
  send: async () => {
    quietSends += 1;
    return "sent";
  },
});
assert.equal(quietSends, 0);
assert.equal(quietRun.sent, 0);
const blankStill = await quiet.getLatestProof(blankOrder.id);
assert.equal(blankStill?.reminderSentAt, null);

console.log("lib/proof-reminder.test.ts: ok");
