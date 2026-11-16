import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gstOnExclusiveCents, proofPriceSummary } from "./proofs";
import { formatAud } from "./pricing";
import type { SavedOrder, StoredPlate } from "./orders";
import type { ProofRecord } from "./proofs";
import {
  DEFAULT_INVOICE_DUE_DAYS,
  INVOICE_WEBHOOK_EVENTS,
  TRADE_ACCOUNT_DUE_DAYS,
  buildInvoiceLines,
  createProofInvoice,
  invoiceBoardState,
  invoiceCcRecipients,
  invoiceCopyMessage,
  invoiceDueDays,
  invoiceIdempotencyKey,
  invoiceLineTotal,
  invoiceSnapshotFromWebhook,
  matchApprovedTradeAccount,
  mergeInvoicePatch,
  parseInvoiceCc,
  planProofInvoice,
  tradeCompanyName,
  type InvoiceGateway,
  type InvoiceRequest,
  type IssuedInvoice,
} from "./invoice";

const migration = readFileSync(
  new URL("../db/migrations/20261116_trafflabels_order_invoices.sql", import.meta.url),
  "utf8"
);
assert.match(migration, /ADD COLUMN IF NOT EXISTS stripe_invoice_id text/);
assert.match(migration, /stripe_invoice_number/);
assert.match(migration, /stripe_invoice_url/);
assert.match(migration, /stripe_invoice_status/);
assert.match(migration, /invoice_cc_emails/);
assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
assert.match(migration, /GRANT ALL ON TABLE public\.trafflabels_orders TO service_role/);
assert.match(migration, /REVOKE ALL ON TABLE public\.trafflabels_orders FROM anon/);
assert.match(migration, /REVOKE ALL ON TABLE public\.trafflabels_orders FROM authenticated/);
assert.match(migration, /REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public\.trafflabels_orders FROM anon/);
assert.match(
  migration,
  /REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public\.trafflabels_orders FROM authenticated/
);
assert.doesNotMatch(migration, /GRANT\b[^;]*\bTO anon\b/);
assert.doesNotMatch(migration, /GRANT\b[^;]*\bTO authenticated\b/);
assert.doesNotMatch(
  migration,
  /GRANT\b[^;]*\b(TRUNCATE|REFERENCES|TRIGGER)\b[^;]*\bTO (anon|authenticated)\b/
);
assert.doesNotMatch(migration, /CREATE POLICY/i);
assert.match(migration, /No sequence is created/);

const proofRoute = readFileSync(new URL("../app/api/proof/[token]/route.ts", import.meta.url), "utf8");
const webhookRoute = readFileSync(
  new URL("../app/api/webhooks/stripe/route.ts", import.meta.url),
  "utf8"
);
const board = readFileSync(
  new URL("../components/admin/orders-board.tsx", import.meta.url),
  "utf8"
);
assert.match(proofRoute, /result\.changed/);
assert.match(proofRoute, /invoiceApprovedOrder/);
assert.ok(
  proofRoute.indexOf("if (result.changed)") < proofRoute.indexOf("await invoiceApprovedOrder"),
  "invoice runs only after the approval is saved"
);
assert.match(webhookRoute, /isInvoiceWebhookEvent/);
assert.deepEqual(
  [...INVOICE_WEBHOOK_EVENTS],
  ["invoice.paid", "invoice.payment_failed", "invoice.voided", "invoice.marked_uncollectible"]
);
assert.match(webhookRoute, /invoice\.paid/);
assert.match(webhookRoute, /invoice\.payment_failed/);
assert.match(board, /Retry invoice/);
assert.match(board, /Send invoice/);
assert.doesNotMatch(`${proofRoute}\n${board}`, /Stik Stickers/);

function plate(overrides: Partial<StoredPlate> = {}): StoredPlate {
  return {
    widthMm: 20,
    heightMm: 10,
    qty: 10,
    unitCents: 555,
    lineCents: 5550,
    colourPair: "white-black",
    colourLabel: "White / black",
    adhesive3m: false,
    text: "DB",
    objects: [],
    ...overrides,
  };
}

function order(overrides: Partial<SavedOrder> = {}): SavedOrder {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    orderNumber: 1004,
    createdAt: "2026-11-16T00:00:00.000Z",
    updatedAt: "2026-11-16T00:00:00.000Z",
    status: "NEW",
    customerName: "Alex Nguyen",
    customerEmail: "alex@example.com",
    customerPhone: "0400000000",
    shipping: {
      name: "Alex Nguyen",
      line1: "12 Workshop Road",
      line2: "",
      city: "Malaga",
      state: "WA",
      postalCode: "6090",
      country: "AU",
    },
    shippingMethodId: "standard",
    subtotalCents: 5550,
    shippingCents: 1000,
    totalCents: 6550,
    stripeSessionId: "manual:1004",
    stripePaymentIntentId: null,
    stripeReceiptUrl: null,
    stripeLivemode: false,
    paymentSource: "manual",
    note: "",
    trackingLink: "",
    plates: [plate()],
    ...overrides,
  };
}

function proof(saved: SavedOrder, overrides: Partial<ProofRecord> = {}): ProofRecord {
  const price = proofPriceSummary(saved.plates, saved);
  return {
    id: "proof-1",
    orderId: saved.id,
    orderNumber: saved.orderNumber,
    token: "a".repeat(32),
    createdAt: "2026-11-16T01:00:00.000Z",
    status: "approved",
    plates: saved.plates,
    platesHash: "hash",
    customerName: saved.customerName,
    shipping: saved.shipping,
    invoiceUrl: "",
    approvedName: "Alex Nguyen",
    approvedAt: "2026-11-16T02:00:00.000Z",
    approvedIp: "203.0.113.8",
    approvedUserAgent: "Test",
    approvalStatement: "approved",
    approvedTotalCents: price.totalIncGstCents,
    changeComment: "",
    changeRequestedAt: null,
    changeIp: "",
    changeUserAgent: "",
    ...overrides,
  };
}

const quoteOrder = order();
const quote = proofPriceSummary(quoteOrder.plates, quoteOrder);
assert.equal(quote.exGstCents, 6550);
assert.equal(gstOnExclusiveCents(6550), 655);
assert.equal(quote.gstCents, 655);
assert.equal(quote.totalIncGstCents, 7205);
assert.equal(formatAud(6550), formatAud(quote.exGstCents));
assert.equal(7205 - Math.round((7205 * 10) / 11), 655);
assert.equal(formatAud(7205), "$72.05");
assert.equal(formatAud(6550), "$65.50");
assert.equal(formatAud(655), "$6.55");

const lines = buildInvoiceLines(quote);
assert.deepEqual(
  lines.map((line) => [line.kind, line.description, line.quantity, line.unitAmountCents]),
  [
    ["plate", "Traffolyte labels, 20 × 10 mm", 10, 555],
    ["shipping", "Standard postage", 1, 1000],
    ["gst", "GST 10%", 1, 655],
  ]
);
assert.equal(invoiceLineTotal(lines.filter((line) => line.kind !== "gst")), 6550);
assert.equal(invoiceLineTotal(lines), 7205);

const driftedOrder = order({
  plates: [plate({ qty: 10, unitCents: 150, lineCents: 1500 })],
  subtotalCents: 1500,
  shippingCents: 1500,
  shippingMethodId: "express",
  totalCents: 2000,
});
const drifted = proofPriceSummary(driftedOrder.plates, driftedOrder);
assert.equal(drifted.matchesOrderTotal, false);
assert.equal(drifted.totalIncGstCents, 2200);
const driftedLines = buildInvoiceLines(drifted);
assert.equal(invoiceLineTotal(driftedLines), 2200);
assert.equal(driftedLines.find((line) => line.kind === "adjustment")?.unitAmountCents, -1000);
assert.equal(driftedLines.find((line) => line.kind === "gst")?.unitAmountCents, 200);

const ready = planProofInvoice({ order: quoteOrder, proof: proof(quoteOrder), tradeAccount: false });
assert.equal(ready.action, "ready");
if (ready.action !== "ready") throw new Error("expected a ready invoice");
assert.equal(ready.request.expectedTotalCents, 7205);
assert.equal(ready.request.gstCents, 655);
assert.equal(ready.request.daysUntilDue, DEFAULT_INVOICE_DUE_DAYS);
assert.equal(DEFAULT_INVOICE_DUE_DAYS, 7);
assert.equal(invoiceDueDays(false), 7);
assert.equal(invoiceDueDays(true), TRADE_ACCOUNT_DUE_DAYS);
assert.equal(TRADE_ACCOUNT_DUE_DAYS, 14);
assert.equal(ready.request.customerName, "Alex Nguyen");
assert.match(ready.request.description, /Tax Invoice/);
assert.match(ready.request.footer, /Tax Invoice/);
assert.match(ready.request.footer, /\$6\.55/);
assert.match(ready.request.footer, /\$72\.05/);
assert.doesNotMatch(`${ready.request.description}\n${ready.request.footer}`, /Stik Stickers|stikstickers/i);
assert.equal(
  ready.request.idempotencyKey,
  invoiceIdempotencyKey(quoteOrder.id)
);
assert.equal(invoiceIdempotencyKey(quoteOrder.id), invoiceIdempotencyKey(quoteOrder.id));

const trade = planProofInvoice({
  order: quoteOrder,
  proof: proof(quoteOrder),
  tradeAccount: true,
  companyName: "Rotech Pty Ltd",
});
assert.equal(trade.action, "ready");
if (trade.action !== "ready") throw new Error("expected trade terms");
assert.equal(trade.request.daysUntilDue, 14);
assert.equal(trade.request.customerName, "Rotech Pty Ltd");

const checkout = planProofInvoice({
  order: order({ paymentSource: "stripe", stripeSessionId: "cs_test_checkout" }),
  proof: proof(quoteOrder),
  tradeAccount: false,
});
assert.deepEqual(checkout, { action: "skip", reason: "checkout-paid" });

const already = planProofInvoice({
  order: order({ stripeInvoiceId: "in_existing" }),
  proof: proof(quoteOrder),
  tradeAccount: false,
});
assert.equal(already.action, "existing");

const matched = matchApprovedTradeAccount(
  [
    {
      status: "new",
      apEmail: "alex@example.com",
      purchasingEmail: "",
      linkedOrderId: null,
      tradingName: "",
      registeredCompanyName: "Not Yet",
    },
    {
      status: "approved",
      apEmail: "accounts@example.com",
      purchasingEmail: "alex@example.com",
      linkedOrderId: null,
      tradingName: "Rotech",
      registeredCompanyName: "Rotech Pty Ltd",
    },
  ],
  { email: "Alex@Example.com", orderId: quoteOrder.id }
);
assert.equal(tradeCompanyName(matched), "Rotech");
assert.equal(
  matchApprovedTradeAccount(
    [
      {
        status: "approved",
        apEmail: "other@example.com",
        purchasingEmail: "",
        linkedOrderId: quoteOrder.id,
        tradingName: "",
        registeredCompanyName: "Linked Co",
      },
    ],
    { email: "nobody@example.com", orderId: quoteOrder.id }
  )?.registeredCompanyName,
  "Linked Co"
);

const cc = parseInvoiceCc("Admin@Example.com, accounts@example.com\nadmin@example.com");
assert.deepEqual(cc, { ok: true, emails: ["admin@example.com", "accounts@example.com"] });
assert.deepEqual(invoiceCcRecipients(["admin@example.com", "alex@example.com"], "Alex@Example.com"), [
  "admin@example.com",
]);
const copy = invoiceCopyMessage({
  orderNumber: 1004,
  hostedUrl: "https://invoice.stripe.com/i/test",
  pdfUrl: "https://pay.stripe.com/invoice/test/pdf",
  totalIncGstCents: 7205,
  gstCents: 655,
});
assert.match(copy.subject, /TraffLabels tax invoice/);
assert.match(copy.text, /Tax invoice|tax invoice/);
assert.match(copy.text, /\$72\.05 inc GST/);
assert.match(copy.text, /\$6\.55 GST/);
assert.match(copy.text, /https:\/\/invoice\.stripe\.com\/i\/test/);
assert.doesNotMatch(`${copy.subject}\n${copy.text}\n${copy.html}`, /Stik Stickers|stikstickers/i);

assert.equal(
  invoiceBoardState(order({ stripeInvoiceId: "in_1", stripeInvoiceStatus: "open" })),
  "sent"
);
assert.equal(
  invoiceBoardState(
    order({
      stripeInvoiceId: "in_1",
      stripeInvoiceStatus: "open",
      stripeInvoiceDueAt: "2020-01-01T00:00:00.000Z",
    }),
    new Date("2026-11-16T00:00:00.000Z")
  ),
  "overdue"
);
assert.equal(
  invoiceBoardState(order({ stripeInvoiceId: "in_1", stripeInvoiceStatus: "paid" })),
  "paid"
);
assert.equal(
  invoiceBoardState(order({ stripeInvoiceId: "in_1", stripeInvoiceStatus: "payment_failed" })),
  "payment_failed"
);
assert.equal(invoiceBoardState(order({ stripeInvoiceError: "Stripe is down." })), "error");

const kept = mergeInvoicePatch(order({ stripeInvoiceId: "in_1" }), {
  stripeInvoiceId: "in_2",
  stripeInvoiceStatus: "open",
});
assert.equal(kept.stripeInvoiceId, "in_1");
const paid = mergeInvoicePatch(order({ stripeInvoiceId: "in_1", stripeInvoiceStatus: "open" }), {
  stripeInvoiceId: "in_1",
  stripeInvoiceStatus: "paid",
  stripeInvoiceError: "",
});
assert.equal(paid.stripeInvoiceId, "in_1");
assert.equal(paid.stripeInvoiceStatus, "paid");
assert.equal(paid.stripeInvoiceError, "");

const paidEvent = invoiceSnapshotFromWebhook("invoice.paid", {
  id: "in_1",
  number: "TL-0001",
  status: "paid",
  hosted_invoice_url: "https://invoice.stripe.com/i/acct/test",
  invoice_pdf: "https://pay.stripe.com/invoice/acct/test/pdf",
  due_date: 1_763_251_200,
  metadata: { trafflabels_order_number: "1004" },
});
assert.equal(paidEvent?.status, "paid");
assert.equal(paidEvent?.snapshot.orderNumber, 1004);
assert.equal(paidEvent?.error, "");
const failedEvent = invoiceSnapshotFromWebhook("invoice.payment_failed", {
  id: "in_1",
  status: "open",
  metadata: { trafflabels_order_number: "1004" },
});
assert.equal(failedEvent?.status, "payment_failed");
assert.match(failedEvent?.error ?? "", /payment failed/i);
assert.equal(invoiceSnapshotFromWebhook("invoice.voided", { id: "in_1", status: "void" })?.status, "void");
assert.equal(
  invoiceSnapshotFromWebhook("invoice.marked_uncollectible", { id: "in_1", status: "uncollectible" })
    ?.status,
  "uncollectible"
);
assert.equal(invoiceSnapshotFromWebhook("charge.succeeded", { id: "ch_1" }), null);

function gatewayFor(requestCheck?: (request: InvoiceRequest) => void) {
  const stored = new Map<string, IssuedInvoice>();
  const inflight = new Map<string, Promise<IssuedInvoice>>();
  let creates = 0;
  const gateway: InvoiceGateway = {
    async findInvoice(orderId) {
      return stored.get(orderId) ?? null;
    },
    async createAndSend(request) {
      requestCheck?.(request);
      const existing = stored.get(request.orderId);
      if (existing) return existing;
      const pending = inflight.get(request.idempotencyKey);
      if (pending) return pending;
      const run = (async () => {
        creates += 1;
        await Promise.resolve();
        const invoice: IssuedInvoice = {
          id: `in_test_${creates}`,
          number: "TL-1004",
          hostedUrl: "https://invoice.stripe.com/i/acct_test/test",
          pdfUrl: "https://pay.stripe.com/invoice/acct_test/test/pdf",
          status: "open",
          dueAt: "2026-11-23T00:00:00.000Z",
          totalCents: invoiceLineTotal(request.lines),
        };
        stored.set(request.orderId, invoice);
        return invoice;
      })();
      inflight.set(request.idempotencyKey, run);
      return run;
    },
    async resume(_invoiceId, request) {
      const existing = stored.get(request.orderId);
      if (!existing) throw new Error("missing invoice");
      return existing;
    },
  };
  return {
    gateway,
    creates: () => creates,
    stored,
  };
}

const idempotent = gatewayFor((request) => {
  assert.equal(invoiceLineTotal(request.lines), 7205);
  assert.equal(request.idempotencyKey, invoiceIdempotencyKey(quoteOrder.id));
});
const first = await createProofInvoice(ready.request, idempotent.gateway);
assert.equal(first.created, true);
assert.equal(first.invoice.totalCents, 7205);
assert.equal(idempotent.creates(), 1);
const second = await createProofInvoice(ready.request, idempotent.gateway);
assert.equal(second.created, false);
assert.equal(second.invoice.id, first.invoice.id);
assert.equal(idempotent.creates(), 1);

const parallel = gatewayFor();
const [left, right] = await Promise.all([
  createProofInvoice(ready.request, parallel.gateway),
  createProofInvoice(ready.request, parallel.gateway),
]);
assert.equal(left.invoice.id, right.invoice.id);
assert.equal(parallel.creates(), 1);

const flaky = gatewayFor();
let failed = false;
const original = flaky.gateway.createAndSend.bind(flaky.gateway);
flaky.gateway.createAndSend = async (request) => {
  if (!failed) {
    failed = true;
    throw new Error("stripe down");
  }
  return original(request);
};
await assert.rejects(() => createProofInvoice(ready.request, flaky.gateway), /stripe down/);
assert.equal(flaky.creates(), 0);
const retried = await createProofInvoice(ready.request, flaky.gateway);
assert.equal(retried.created, true);
assert.equal(retried.invoice.totalCents, 7205);
assert.equal(flaky.creates(), 1);
const again = await createProofInvoice(ready.request, flaky.gateway);
assert.equal(again.created, false);
assert.equal(again.invoice.id, retried.invoice.id);
assert.equal(flaky.creates(), 1);

console.log("lib/invoice.test.ts: ok");
