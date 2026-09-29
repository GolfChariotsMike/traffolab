import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { TEMPLATE_CSV } from "./order-csv";
import { parseManualOrder } from "./manual-order";
import { buildPaidOrder, type CheckoutDraft, type PaymentFacts } from "./orders";
import { createFileOrderStore } from "./order-store-file";
import { quoteOrder } from "./pricing";
import { CUT_STROKE, ENGRAVE_FILL, serializeProductionSvg } from "./production-svg";
import { writeFile, readFile } from "node:fs/promises";

const customer = {
  name: "Alex Nguyen",
  email: "Alex@Example.com",
  phone: "+61400000111",
  line1: "12 Workshop Road",
  line2: "",
  city: "Malaga",
  state: "WA",
  postalCode: "6090",
  country: "Australia",
  shippingMethodId: "standard",
  note: "Trade account",
};

{
  const parsed = parseManualOrder({ ...customer, csv: TEMPLATE_CSV });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) throw new Error("expected ok");
  const expected = quoteOrder(
    [
      { widthMm: 45, heightMm: 12, qty: 10 },
      { widthMm: 100, heightMm: 25, qty: 4 },
      { widthMm: 60, heightMm: 20, qty: 2 },
    ],
    "standard"
  );
  assert.equal(parsed.order.status, "NEW");
  assert.equal(parsed.order.paymentSource, "manual");
  assert.equal(parsed.order.customerEmail, "alex@example.com");
  assert.equal(parsed.order.shipping.country, "AU");
  assert.equal(parsed.order.totalCents, expected.totalCents);
  assert.equal(parsed.order.subtotalCents, expected.subtotalCents);
  assert.equal(parsed.order.shippingCents, expected.shippingCents);
  assert.equal(parsed.order.stripePaymentIntentId, null);
  assert.match(parsed.order.stripeSessionId, /^manual:/);
  assert.equal(parsed.order.plates[0].text, "MAIN SWITCH");
  assert.equal(parsed.order.plates[0].widthMm, 45);
  assert.equal(parsed.order.plates[0].heightMm, 12);
  assert.equal(parsed.order.plates[2].qty, 2);
  const svg = serializeProductionSvg(parsed.order.plates[2]);
  assert.match(svg, /width="60mm"/);
  assert.match(svg, /height="20mm"/);
  assert.match(svg, new RegExp(`fill="${ENGRAVE_FILL}"`));
  assert.match(svg, new RegExp(`stroke="${CUT_STROKE}"`));
}

{
  const csv = "colour,width_mm,height_mm,text,qty\nyellow-black,20,10,\"MAIN, SWITCH\",2\n";
  const parsed = parseManualOrder({ ...customer, csv, shippingMethodId: "express" });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) throw new Error("expected ok");
  assert.equal(parsed.order.plates[0].text, "MAIN, SWITCH");
  assert.equal(parsed.order.plates[0].qty, 2);
  assert.equal(parsed.order.shippingMethodId, "express");
  assert.equal(parsed.order.totalCents, 150 * 2 + 1500);
}

{
  const csv = [
    "colour,width,height,text,qty",
    "yellow-black,20,10,MAIN,1",
    "neon,20,10,BAD,1",
    "yellow-black,0,10,ALSO BAD,1",
  ].join("\n");
  const parsed = parseManualOrder({ ...customer, csv });
  assert.equal(parsed.ok, false);
  if (parsed.ok) throw new Error("expected errors");
  assert.ok(parsed.errors.some((error) => error.line === 3 && /colour/i.test(error.message)));
  assert.ok(parsed.errors.some((error) => error.line === 4));
}

{
  const parsed = parseManualOrder({ ...customer, name: "  ", csv: TEMPLATE_CSV });
  assert.equal(parsed.ok, false);
}

{
  const parsed = parseManualOrder({ ...customer, csv: "" });
  assert.equal(parsed.ok, false);
}

{
  const draft: CheckoutDraft = {
    id: "draft",
    customerEmail: "a@b.co",
    shippingMethodId: "standard",
    subtotalCents: 150,
    shippingCents: 1000,
    totalCents: 1150,
    plates: [],
  };
  const payment: PaymentFacts = {
    sessionId: "cs_test_src",
    livemode: false,
    createdAt: "2026-09-29T00:00:00.000Z",
    customerEmail: "a@b.co",
    customerName: "A",
    customerPhone: null,
    paymentIntentId: "pi_test_src",
    receiptUrl: null,
    shipping: null,
  };
  assert.equal(buildPaidOrder(draft, payment).paymentSource, "stripe");
}

{
  const dir = await mkdtemp(path.join(tmpdir(), "trafflabels-manual-"));
  const file = path.join(dir, "orders.json");
  const store = createFileOrderStore(file);
  const parsed = parseManualOrder({ ...customer, csv: TEMPLATE_CSV });
  if (!parsed.ok) throw new Error("expected ok");
  const saved = await store.insertPaidOrder(parsed.order);
  assert.equal(saved.status, "NEW");
  assert.equal(saved.paymentSource, "manual");
  const cut = await store.updateOrder(saved.orderNumber, { status: "CUT" });
  assert.equal(cut?.status, "CUT");
  assert.equal(cut?.paymentSource, "manual");

  const legacyPath = path.join(dir, "legacy.json");
  await writeFile(
    legacyPath,
    JSON.stringify({
      drafts: {},
      nextNumber: 1003,
      orders: [
        {
          ...saved,
          orderNumber: 1001,
          paymentSource: undefined,
          stripeSessionId: "cs_test_legacy",
        },
      ],
    })
  );
  const legacy = createFileOrderStore(legacyPath);
  const old = await legacy.getOrder(1001);
  assert.equal(old?.paymentSource, "stripe");
  assert.equal((await readFile(legacyPath, "utf8")).includes("cs_test_legacy"), true);
}

console.log("lib/manual-order.test.ts: ok");
