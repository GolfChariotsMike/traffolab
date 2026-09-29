import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createFileOrderStore } from "./order-store-file";
import { ORDER_SCHEMA_SQL } from "./order-schema";
import { paymentFactsFromCheckoutSession } from "./payment-facts";
import {
  applyOrderPatch,
  buildPaidOrder,
  formatPostage,
  orderItemCount,
  parseOrderPatch,
  shouldFulfillCheckout,
  transitionStatus,
  type CheckoutDraft,
  type PaymentFacts,
} from "./orders";

const schemaFile = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
assert.equal(schemaFile, ORDER_SCHEMA_SQL);

assert.equal(shouldFulfillCheckout("checkout.session.completed", "paid"), true);
assert.equal(shouldFulfillCheckout("checkout.session.completed", "unpaid"), false);
assert.equal(shouldFulfillCheckout("checkout.session.completed", "no_payment_required"), false);
assert.equal(shouldFulfillCheckout("checkout.session.async_payment_succeeded", "paid"), true);
assert.equal(shouldFulfillCheckout("checkout.session.async_payment_succeeded", "unpaid"), true);
assert.equal(shouldFulfillCheckout("payment_intent.succeeded", "paid"), false);

assert.equal(transitionStatus("NEW", "CUT"), "CUT");
assert.equal(transitionStatus("CUT", "READY TO SHIP"), "READY TO SHIP");
assert.equal(transitionStatus("READY TO SHIP", "SHIPPED"), "SHIPPED");
assert.equal(transitionStatus("SHIPPED", "NEW"), "NEW");
assert.equal(transitionStatus("NEW", "Printed"), null);
assert.equal(transitionStatus("NEW", "generated"), null);

const draft: CheckoutDraft = {
  id: "draft-1",
  customerEmail: "buyer@example.com",
  shippingMethodId: "express",
  subtotalCents: 2075,
  shippingCents: 1500,
  totalCents: 3575,
  plates: [
    {
      widthMm: 60,
      heightMm: 20,
      qty: 2,
      unitCents: 600,
      lineCents: 1200,
      colourPair: "yellow-black",
      colourLabel: "Yellow / black",
      adhesive3m: false,
      text: "MAIN SWITCH",
      objects: [
        { id: "text-1", text: "MAIN SWITCH", x: 30, y: 12, fontSize: 6, align: "center" },
      ],
    },
    {
      widthMm: 100,
      heightMm: 25,
      qty: 1,
      unitCents: 875,
      lineCents: 875,
      colourPair: "white-black",
      colourLabel: "White / black",
      adhesive3m: true,
      text: "PV ISOLATOR",
      objects: [
        { id: "text-1", text: "PV ISOLATOR", x: 50, y: 16, fontSize: 8, align: "center" },
      ],
    },
  ],
};

const payment: PaymentFacts = {
  sessionId: "cs_test_abc",
  livemode: false,
  createdAt: "2026-09-29T02:00:00.000Z",
  customerEmail: "Alex@Example.com",
  customerName: "Alex Nguyen",
  customerPhone: "+61400000000",
  paymentIntentId: "pi_test_abc",
  receiptUrl: null,
  shipping: {
    name: "Alex Nguyen",
    line1: "12 Workshop Road",
    line2: "",
    city: "Malaga",
    state: "WA",
    postalCode: "6090",
    country: "AU",
  },
};

const paid = buildPaidOrder(draft, payment, new Date("2026-09-29T02:05:00.000Z"));
assert.equal(paid.status, "NEW");
assert.equal(paid.customerEmail, "alex@example.com");
assert.equal(paid.totalCents, 3575);
assert.equal(paid.shippingCents, 1500);
assert.equal(paid.plates.length, 2);
assert.equal(paid.plates[0].text, "MAIN SWITCH");
assert.equal(paid.plates[0].widthMm, 60);
assert.equal(paid.plates[1].heightMm, 25);
assert.equal(orderItemCount(paid.plates), 3);
assert.match(formatPostage(paid), /12 Workshop Road/);
assert.match(formatPostage(paid), /Australia/);

const mapped = paymentFactsFromCheckoutSession({
  id: "cs_test_mapped",
  livemode: false,
  created: 1_758_000_000,
  customer_email: "fallback@example.com",
  metadata: { checkoutDraftId: "draft-9" },
  customer_details: {
    email: "shopper@example.com",
    name: "Billing Name",
    phone: "+61400111222",
    address: null,
  },
  collected_information: {
    shipping_details: {
      name: "Shopper Name",
      address: {
        line1: "1 Laser Lane",
        line2: "Unit 4",
        city: "Welshpool",
        state: "WA",
        postal_code: "6106",
        country: "AU",
      },
    },
  },
  payment_intent: "pi_test_mapped",
});
assert.equal(mapped.draftId, "draft-9");
assert.equal(mapped.facts.customerEmail, "shopper@example.com");
assert.equal(mapped.facts.customerPhone, "+61400111222");
assert.equal(mapped.facts.shipping?.name, "Shopper Name");
assert.equal(mapped.facts.shipping?.line1, "1 Laser Lane");
assert.equal(mapped.facts.shipping?.postalCode, "6106");
assert.equal(mapped.facts.paymentIntentId, "pi_test_mapped");

const badStatus = parseOrderPatch({ status: "Printed" });
assert.equal(badStatus.ok, false);
const cut = parseOrderPatch({ status: "CUT", note: " Nested ", trackingLink: "" });
assert.equal(cut.ok, true);
if (!cut.ok) throw new Error("expected patch");
assert.equal(cut.value.status, "CUT");
assert.equal(cut.value.note, "Nested");

const badLink = parseOrderPatch({ trackingLink: "javascript:alert(1)" });
assert.equal(badLink.ok, false);
const goodLink = parseOrderPatch({
  status: "SHIPPED",
  trackingLink: "https://auspost.com.au/track/ABC",
});
assert.equal(goodLink.ok, true);

const stored = { ...paid, orderNumber: 1001 };
const updated = applyOrderPatch(stored, { status: "READY TO SHIP" }, new Date("2026-09-29T04:00:00.000Z"));
assert.equal(updated.status, "READY TO SHIP");
assert.equal(updated.orderNumber, 1001);
assert.equal(updated.note, "");
assert.notEqual(updated.updatedAt, stored.updatedAt);

const dir = await mkdtemp(path.join(tmpdir(), "trafflabels-orders-"));
const store = createFileOrderStore(path.join(dir, "orders.json"));
await store.saveDraft(draft);
assert.equal((await store.getDraft(draft.id))?.customerEmail, draft.customerEmail);

const first = await store.insertPaidOrder(paid);
assert.equal(first.orderNumber, 1001);
assert.equal(first.status, "NEW");

const replay = await store.insertPaidOrder({
  ...paid,
  id: "other",
  status: "NEW",
  stripeReceiptUrl: "https://pay.stripe.com/receipts/test",
});
assert.equal(replay.orderNumber, 1001);
assert.equal(replay.stripeReceiptUrl, "https://pay.stripe.com/receipts/test");
assert.equal((await store.listOrders()).length, 1);

const secondPayment = buildPaidOrder(
  { ...draft, id: "draft-2" },
  { ...payment, sessionId: "cs_test_second" },
  new Date("2026-09-29T05:00:00.000Z")
);
const second = await store.insertPaidOrder(secondPayment);
assert.equal(second.orderNumber, 1002);

const moved = await store.updateOrder(1001, { status: "CUT" });
assert.equal(moved?.status, "CUT");
const shipped = await store.updateOrder(1001, {
  status: "SHIPPED",
  trackingLink: "https://auspost.com.au/track/ABC",
});
assert.equal(shipped?.status, "SHIPPED");
assert.equal(shipped?.trackingLink, "https://auspost.com.au/track/ABC");
assert.equal((await store.getOrder(1001))?.status, "SHIPPED");
assert.equal(await store.updateOrder(9999, { status: "NEW" }), null);

const listed = await store.listOrders();
assert.equal(listed[0].orderNumber, 1002);
assert.equal(listed[1].status, "SHIPPED");

console.log("lib/orders.test.ts: ok");
