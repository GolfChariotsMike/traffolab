import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { cutFileHoldForOrder } from "./cut-file-access";
import { createFileOrderStore } from "./order-store-file";
import type { NewPaidOrder, StoredPlate } from "./orders";
import {
  CUT_FILE_HOLD_MESSAGE,
  EMPTY_PROOF_SUMMARY,
  ProofSchemaError,
  cutFileDownloadHold,
} from "./proofs";

assert.equal(cutFileDownloadHold(null), null);
assert.equal(cutFileDownloadHold(undefined), null);
assert.equal(cutFileDownloadHold(EMPTY_PROOF_SUMMARY), null);
assert.equal(cutFileDownloadHold({ state: "not_sent" }), null);
assert.equal(cutFileDownloadHold({ state: "approved" }), null);
assert.equal(cutFileDownloadHold({ state: "awaiting" }), CUT_FILE_HOLD_MESSAGE);
assert.equal(cutFileDownloadHold({ state: "changes_requested" }), CUT_FILE_HOLD_MESSAGE);
assert.equal(cutFileDownloadHold({ state: "superseded" }), CUT_FILE_HOLD_MESSAGE);

const route = readFileSync(
  new URL("../app/api/admin/orders/[id]/files/route.ts", import.meta.url),
  "utf8"
);
const board = readFileSync(
  new URL("../components/admin/orders-board.tsx", import.meta.url),
  "utf8"
);
assert.match(route, /cutFileHoldForOrder/);
assert.match(route, /status: 409/);
assert.match(board, /cutFileDownloadHold/);
assert.match(board, /CUT_FILE_HOLD_MESSAGE/);
assert.match(board, /disabled/);

const plate: StoredPlate = {
  widthMm: 40,
  heightMm: 20,
  qty: 2,
  unitCents: 400,
  lineCents: 800,
  colourPair: "white-black",
  colourLabel: "White / black",
  adhesive3m: true,
  text: "DB 12",
  objects: [{ id: "text-1", text: "DB 12", x: 20, y: 10, fontSize: 4, align: "center" }],
};

function order(patch: Partial<NewPaidOrder> = {}): NewPaidOrder {
  return {
    id: crypto.randomUUID(),
    createdAt: "2026-10-27T06:00:00.000Z",
    updatedAt: "2026-10-27T06:00:00.000Z",
    status: "NEW",
    customerName: "Harbour Electrical",
    customerEmail: "accounts@harbour.example",
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
    subtotalCents: 800,
    shippingCents: 0,
    totalCents: 800,
    stripeSessionId: `manual:${crypto.randomUUID()}`,
    stripePaymentIntentId: null,
    stripeReceiptUrl: null,
    stripeLivemode: false,
    paymentSource: "manual",
    note: "",
    trackingLink: "",
    plates: [{ ...plate }],
    ...patch,
  };
}

const dir = await mkdtemp(path.join(tmpdir(), "trafflabels-cut-"));
const store = createFileOrderStore(path.join(dir, "orders.json"));

const checkout = await store.insertPaidOrder(
  order({ paymentSource: "stripe", stripeSessionId: "cs_test_checkout", customerName: "Walk-in" })
);
assert.equal(await cutFileHoldForOrder(store, checkout), null);

const quoted = await store.insertPaidOrder(order({ customerName: "Order 1003" }));
assert.equal(await cutFileHoldForOrder(store, quoted), null);

const pending = await store.createProof(quoted.orderNumber, { invoiceUrl: "" });
assert.ok(pending);
assert.equal(await cutFileHoldForOrder(store, quoted), CUT_FILE_HOLD_MESSAGE);
assert.equal(await cutFileHoldForOrder(store, checkout), null);

const approved = await store.decideProof(pending.token, {
  action: "approve",
  name: "Alex Nguyen",
  ip: "203.0.113.8",
  userAgent: "TestBrowser",
});
assert.equal(approved.ok, true);
const approvedOrder = await store.getOrder(quoted.orderNumber);
assert.ok(approvedOrder);
assert.equal(await cutFileHoldForOrder(store, approvedOrder), null);

const moved = await store.updateOrder(quoted.orderNumber, { plateLocations: ["Switchroom"] });
assert.ok(moved);
assert.equal(await cutFileHoldForOrder(store, moved), CUT_FILE_HOLD_MESSAGE);

const changesOrder = await store.insertPaidOrder(order());
const changesProof = await store.createProof(changesOrder.orderNumber, { invoiceUrl: "" });
assert.ok(changesProof);
const changes = await store.decideProof(changesProof.token, {
  action: "changes",
  comment: "Spelling of generator",
  ip: "203.0.113.9",
  userAgent: "TestBrowser",
});
assert.equal(changes.ok, true);
assert.equal(await cutFileHoldForOrder(store, changesOrder), CUT_FILE_HOLD_MESSAGE);

assert.equal(
  await cutFileHoldForOrder(
    {
      async getLatestProof() {
        throw new ProofSchemaError();
      },
    },
    checkout
  ),
  null
);
await assert.rejects(
  () =>
    cutFileHoldForOrder(
      {
        async getLatestProof() {
          throw new Error("database unavailable");
        },
      },
      checkout
    ),
  /database unavailable/
);

console.log("lib/cut-file-access.test.ts: ok");
