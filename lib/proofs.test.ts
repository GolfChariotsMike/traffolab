import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createFileOrderStore } from "./order-store-file";
import { ORDER_SCHEMA_SQL } from "./order-schema";
import { OrderUpdateError, formatPerthDateTime, type NewPaidOrder, type StoredPlate } from "./orders";
import { proofPlateSvg } from "./proof-plate";
import { serializeProductionSvg } from "./production-svg";
import {
  APPROVAL_STATEMENT,
  EMPTY_PROOF_SUMMARY,
  canonicalPlates,
  cleanApproverName,
  cleanChangeComment,
  cleanInvoiceUrl,
  groupPlates,
  isProofToken,
  platesApprovalHash,
  proofNotificationCopy,
  proofStatusText,
  proofSummary,
} from "./proofs";

const migration = readFileSync(
  new URL("../db/migrations/20261027_trafflabels_proofs.sql", import.meta.url),
  "utf8"
);
assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
assert.match(migration, /GRANT ALL ON TABLE public\.trafflabels_proofs TO service_role/);
assert.match(migration, /REVOKE ALL ON TABLE public\.trafflabels_proofs FROM anon/);
assert.match(migration, /REVOKE ALL ON TABLE public\.trafflabels_proofs FROM authenticated/);
assert.doesNotMatch(migration, /GRANT\b[^;]*\bTO anon\b/);
assert.doesNotMatch(migration, /GRANT\b[^;]*\bTO authenticated\b/);
assert.doesNotMatch(migration, /CREATE POLICY/i);
assert.doesNotMatch(migration, /FORCE ROW LEVEL SECURITY/);
assert.match(migration, /No sequence is created/);
assert.equal(ORDER_SCHEMA_SQL.includes("trafflabels_proofs"), false);

const proofPage = readFileSync(new URL("../app/proof/[token]/page.tsx", import.meta.url), "utf8");
const proofForm = readFileSync(
  new URL("../components/proof/proof-decision.tsx", import.meta.url),
  "utf8"
);
assert.doesNotMatch(proofPage, /Stik Stickers|TraffoLab/);
assert.doesNotMatch(proofForm, /Stik Stickers|TraffoLab/);
assert.match(proofForm, /APPROVAL_STATEMENT/);
assert.match(APPROVAL_STATEMENT, /I've checked the spelling, wording, sizes and quantities/);

assert.equal(cleanApproverName("Alex Nguyen"), "Alex Nguyen");
assert.equal(cleanApproverName("  Mary-Jane   O'Brien "), "Mary-Jane O'Brien");
assert.equal(cleanApproverName("Alex"), null);
assert.equal(cleanApproverName(""), null);
assert.equal(cleanChangeComment("  Move the DB label  "), "Move the DB label");
assert.equal(cleanChangeComment("   "), null);
assert.equal(cleanInvoiceUrl(""), "");
assert.equal(cleanInvoiceUrl("http://invoice.stripe.com/i/abc"), null);
assert.equal(cleanInvoiceUrl("https://example.com/invoice"), null);
assert.equal(
  cleanInvoiceUrl("https://invoice.stripe.com/i/acct_123/test_abc"),
  "https://invoice.stripe.com/i/acct_123/test_abc"
);

const plate = (patch: Partial<StoredPlate> = {}): StoredPlate => ({
  widthMm: 40,
  heightMm: 20,
  qty: 2,
  unitCents: 400,
  lineCents: 800,
  colourPair: "white-black",
  colourLabel: "White / black",
  adhesive3m: true,
  text: "DB 12 AND GENERATOR LIGHTING",
  objects: [
    {
      id: "text-1",
      text: "DB 12 AND GENERATOR LIGHTING",
      x: 20,
      y: 10,
      fontSize: 4,
      align: "center",
    },
  ],
  ...patch,
});

const basePlates = [
  plate({ location: "DB room" }),
  plate({
    text: "MAIN SWITCH",
    qty: 1,
    location: "",
    objects: [{ id: "text-1", text: "MAIN SWITCH", x: 20, y: 10, fontSize: 4, align: "center" }],
  }),
  plate({ text: "LIGHT", qty: 1, location: "db room" }),
  plate({ text: "PUMP", qty: 3, location: "Workshop" }),
];
const grouped = groupPlates(basePlates);
assert.deepEqual(
  grouped.map((group) => group.location),
  ["DB room", "Workshop", ""]
);
assert.equal(grouped[0].plates.length, 2);
assert.equal(grouped[2].plates[0].plate.text, "MAIN SWITCH");

const hash = platesApprovalHash(basePlates);
assert.equal(platesApprovalHash(basePlates), hash);
assert.notEqual(platesApprovalHash(basePlates.map((item, index) => index === 0 ? { ...item, location: "Other" } : item)), hash);
assert.notEqual(platesApprovalHash([{ ...basePlates[0], text: "CHANGED" }]), platesApprovalHash([basePlates[0]]));
assert.notEqual(platesApprovalHash([{ ...basePlates[0], qty: 9 }]), platesApprovalHash([basePlates[0]]));
assert.equal(
  platesApprovalHash([{ ...basePlates[0], unitCents: 1, lineCents: 2 }]),
  platesApprovalHash([basePlates[0]])
);
assert.equal(canonicalPlates([plate()])[0].location, "");

const perth = formatPerthDateTime("2026-10-27T05:12:00.000Z");
assert.match(perth, /27 October 2026/);
assert.match(perth, /1:12/);
assert.match(perth, /pm/i);

const orderShell = {
  id: "order-1",
  orderNumber: 1001,
  createdAt: "2026-10-27T05:00:00.000Z",
  updatedAt: "2026-10-27T05:00:00.000Z",
  status: "NEW" as const,
  customerName: "Alex Nguyen",
  customerEmail: "alex@example.com",
  customerPhone: "",
  shipping: {
    name: "Alex Nguyen",
    line1: "12 Workshop Road",
    line2: "",
    city: "Malaga",
    state: "WA",
    postalCode: "6090",
    country: "AU",
  },
  shippingMethodId: "standard" as const,
  subtotalCents: 800,
  shippingCents: 0,
  totalCents: 800,
  stripeSessionId: "manual:1",
  stripePaymentIntentId: null,
  stripeReceiptUrl: null,
  stripeLivemode: false,
  paymentSource: "manual" as const,
  note: "",
  trackingLink: "",
  plates: basePlates,
};

assert.equal(proofSummary(orderShell, null).state, "not_sent");
assert.equal(proofStatusText(EMPTY_PROOF_SUMMARY), "Not sent");

const dir = await mkdtemp(path.join(tmpdir(), "trafflabels-proofs-"));
const store = createFileOrderStore(path.join(dir, "orders.json"));
const paid: NewPaidOrder = { ...orderShell };
const saved = await store.insertPaidOrder(paid);
assert.equal(saved.orderNumber, 1001);

const created = await store.createProof(saved.orderNumber, {
  invoiceUrl: "https://invoice.stripe.com/i/acct_123/test_abc",
});
assert.ok(created);
assert.equal(isProofToken(created.token), true);
assert.notEqual(created.token, saved.id);
assert.notEqual(created.token, String(saved.orderNumber));
assert.equal(created.status, "pending");
assert.equal(created.platesHash, platesApprovalHash(saved.plates));
assert.equal(proofSummary(saved, created).state, "awaiting");
assert.equal(proofStatusText(proofSummary(saved, created)), "Awaiting approval");

const opened = await store.openProof(created.token);
assert.equal(opened?.proof.status, "pending");
assert.equal(opened?.order.customerName, "Alex Nguyen");

const approved = await store.decideProof(created.token, {
  action: "approve",
  name: "Alex Nguyen",
  ip: "203.0.113.8",
  userAgent: "TestBrowser",
});
assert.equal(approved.ok, true);
if (!approved.ok) throw new Error("expected approval");
assert.equal(approved.changed, true);
assert.equal(approved.proof.approvedName, "Alex Nguyen");
assert.equal(approved.proof.approvedIp, "203.0.113.8");
assert.equal(approved.proof.approvedUserAgent, "TestBrowser");
assert.equal(approved.proof.approvalStatement, APPROVAL_STATEMENT);
assert.ok(approved.proof.approvedAt);
assert.equal(proofSummary(saved, approved.proof).state, "approved");
assert.match(proofStatusText(proofSummary(saved, approved.proof)), /Approved by Alex Nguyen at /);

const again = await store.decideProof(created.token, {
  action: "approve",
  name: "Someone Else",
  ip: "198.51.100.4",
  userAgent: "Other",
});
assert.equal(again.ok, true);
if (!again.ok) throw new Error("expected repeat");
assert.equal(again.changed, false);
assert.equal(again.proof.approvedAt, approved.proof.approvedAt);
assert.equal(again.proof.approvedName, "Alex Nguyen");

const notice = proofNotificationCopy({
  kind: "approved",
  orderNumber: saved.orderNumber,
  customerName: saved.customerName,
  actorName: "Alex Nguyen",
  comment: "",
  at: approved.proof.approvedAt,
  proofUrl: `https://www.trafflabels.com.au/proof/${created.token}`,
  ip: "203.0.113.8",
  userAgent: "TestBrowser",
});
assert.match(notice.subject, /order #1001/);
assert.match(notice.text, /Alex Nguyen/);
assert.match(notice.text, /workshop only/);
assert.doesNotMatch(`${notice.subject}\n${notice.text}\n${notice.html}`, /Stik Stickers|TraffoLab/);

const moved = await store.updateOrder(saved.orderNumber, {
  plateLocations: ["Switchroom", "", "Switchroom", "Workshop"],
});
assert.equal(moved?.plates[0].location, "Switchroom");
assert.equal(moved?.plates[2].location, "Switchroom");
const stale = await store.openProof(created.token);
assert.equal(stale?.proof.status, "superseded");
assert.equal(stale?.proof.plates[0].location, "DB room");
assert.equal(proofSummary(moved!, stale!.proof).state, "superseded");
assert.match(proofStatusText(proofSummary(moved!, stale!.proof)), /Superseded/);
const blocked = await store.decideProof(created.token, {
  action: "approve",
  name: "Alex Nguyen",
  ip: "203.0.113.8",
  userAgent: "TestBrowser",
});
assert.equal(blocked.ok, false);
if (blocked.ok) throw new Error("expected superseded");
assert.equal(blocked.code, "superseded");

const replacement = await store.createProof(saved.orderNumber, { invoiceUrl: "" });
assert.ok(replacement);
assert.notEqual(replacement.token, created.token);
assert.equal(replacement.status, "pending");
assert.equal((await store.getLatestProof(saved.id))?.token, replacement.token);
const changes = await store.decideProof(replacement.token, {
  action: "changes",
  comment: "GENERATOR should be on one line",
  ip: "203.0.113.9",
  userAgent: "TestBrowser",
});
assert.equal(changes.ok, true);
if (!changes.ok) throw new Error("expected changes");
assert.equal(changes.proof.changeComment, "GENERATOR should be on one line");
assert.equal(changes.proof.changeIp, "203.0.113.9");
const latestOrder = await store.getOrder(saved.orderNumber);
assert.equal(proofSummary(latestOrder!, changes.proof).state, "changes_requested");
assert.match(
  proofStatusText(proofSummary(latestOrder!, changes.proof)),
  /Changes requested — GENERATOR should be on one line/
);
const closed = await store.decideProof(replacement.token, {
  action: "approve",
  name: "Alex Nguyen",
  ip: "203.0.113.8",
  userAgent: "TestBrowser",
});
assert.equal(closed.ok, false);

await assert.rejects(
  () => store.updateOrder(saved.orderNumber, { plateLocations: ["Only one"] }),
  (error: unknown) => error instanceof OrderUpdateError
);

const production = serializeProductionSvg(plate());
const drawing = proofPlateSvg(plate());
const textElements = /<text\b[^>]*>[\s\S]*?<\/text>/g;
assert.deepEqual(drawing.match(textElements), production.match(textElements));
assert.match(drawing, /fill="#FFFFFF"/);
assert.doesNotMatch(drawing, /#FF0000/);
assert.match(drawing, />GENERATOR</);
assert.doesNotMatch(drawing, />RATOR</);
assert.doesNotMatch(drawing, />GENE</);

console.log("lib/proofs.test.ts: ok");
