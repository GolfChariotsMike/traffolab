import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  applyUniformTextSize,
  fitTextToPlate,
  legendFitFontMm,
  restoreIndividualLegendFit,
  uniformTextGroups,
} from "./label-design";
import { createFileOrderStore } from "./order-store-file";
import { applyOrderPatch, type NewPaidOrder, type StoredPlate } from "./orders";
import { platesApprovalHash } from "./proofs";
import { serializeProductionSvg } from "./production-svg";
import { nestPlates, serializeNestSheetSvg } from "./sheet-nest";

const migration = readFileSync(
  new URL("../db/migrations/20261029_trafflabels_uniform_text.sql", import.meta.url),
  "utf8"
);
assert.match(migration, /ADD COLUMN IF NOT EXISTS uniform_text_size boolean NOT NULL DEFAULT false/);
assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
assert.match(migration, /GRANT ALL ON TABLE public\.trafflabels_orders TO service_role/);
assert.match(migration, /REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public\.trafflabels_orders FROM anon/);
assert.match(
  migration,
  /REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public\.trafflabels_orders FROM authenticated/
);
assert.doesNotMatch(migration, /GRANT\b[^;]*\bTO anon\b/);
assert.doesNotMatch(migration, /GRANT\b[^;]*\bTO authenticated\b/);
assert.doesNotMatch(migration, /CREATE POLICY/i);

function plate(text: string, widthMm: number, heightMm: number, fontSize = 8): StoredPlate {
  return {
    widthMm,
    heightMm,
    qty: 1,
    unitCents: 150,
    lineCents: 150,
    colourPair: "white-black",
    colourLabel: "White / black",
    adhesive3m: true,
    text,
    objects: [
      {
        id: "text-1",
        text,
        x: widthMm / 2,
        y: heightMm / 2,
        fontSize,
        align: "center",
      },
    ],
  };
}

const short = plate("AC", 20, 10, 10.9);
const long = plate("CONTROL CIRCUIT", 20, 10, 3.4);
const large = plate("UPS", 40, 20, 16);
const alone = platesApprovalHash([short, long, large]);
assert.equal(platesApprovalHash([{ ...short }, { ...long }, { ...large }]), alone);

const shared = applyUniformTextSize([short, long, large]);
assert.equal(shared[0].uniformTextSize, true);
assert.equal(shared[1].uniformTextSize, true);
assert.equal(shared[0].objects[0].fontSize, shared[1].objects[0].fontSize);
assert.ok(shared[0].objects[0].fontSize < short.objects[0].fontSize);
assert.equal(shared[0].objects[0].fontSize, legendFitFontMm("CONTROL CIRCUIT", short));
assert.notEqual(shared[2].objects[0].fontSize, shared[0].objects[0].fontSize);
assert.equal(shared[2].objects[0].fontSize, legendFitFontMm("UPS", large));
assert.notEqual(platesApprovalHash(shared), alone);

const restored = restoreIndividualLegendFit(shared);
assert.equal(restored[0].uniformTextSize, undefined);
assert.ok(restored[0].objects[0].fontSize > restored[1].objects[0].fontSize);

const hyphen = plate("ADMIN-AC7-THEATRE", 20, 10, 3);
const wrapped = applyUniformTextSize([hyphen, short]);
assert.match(wrapped[0].objects[0].text, /\n/);
assert.equal(wrapped[0].objects[0].fontSize, wrapped[1].objects[0].fontSize);
const svg = serializeProductionSvg(wrapped[0]);
const other = serializeProductionSvg(wrapped[1]);
assert.match(svg, new RegExp(`font-size="${wrapped[0].objects[0].fontSize}"`));
assert.match(other, new RegExp(`font-size="${wrapped[0].objects[0].fontSize}"`));
assert.doesNotMatch(svg, />ADMIN-AC7-THEATRE</);
const nested = serializeNestSheetSvg(1, nestPlates(wrapped).sheets[0]);
assert.match(nested, new RegExp(`font-size="${wrapped[0].objects[0].fontSize}"`));

const fitted = fitTextToPlate({ ...short.objects[0], type: "text" }, short);
const unchanged = applyOrderPatch(
  {
    id: "order",
    orderNumber: 1,
    createdAt: "2026-10-29T00:00:00.000Z",
    updatedAt: "2026-10-29T00:00:00.000Z",
    status: "NEW",
    customerName: "A",
    customerEmail: "a@example.com",
    customerPhone: "",
    shipping: {
      name: "A",
      line1: "1",
      line2: "",
      city: "Fremantle",
      state: "WA",
      postalCode: "6160",
      country: "AU",
    },
    shippingMethodId: "standard",
    subtotalCents: 150,
    shippingCents: 0,
    totalCents: 150,
    stripeSessionId: "manual:1",
    stripePaymentIntentId: null,
    stripeReceiptUrl: null,
    stripeLivemode: false,
    paymentSource: "manual",
    note: "",
    trackingLink: "",
    plates: [{ ...short, objects: [fitted] }],
  },
  { note: "leave the type alone" }
);
assert.equal(unchanged.uniformTextSize, false);
assert.equal(unchanged.plates[0].objects[0].fontSize, fitted.fontSize);
assert.equal(unchanged.plates[0].uniformTextSize, undefined);

const groups = uniformTextGroups([
  { widthMm: 20, heightMm: 10, text: "AC" },
  { widthMm: 20, heightMm: 10, text: "CONTROL CIRCUIT" },
  { widthMm: 40, heightMm: 20, text: "UPS" },
]);
assert.equal(groups.find((group) => group.widthMm === 20)?.limitingTexts[0], "CONTROL CIRCUIT");

const dir = await mkdtemp(path.join(tmpdir(), "trafflabels-uniform-"));
const store = createFileOrderStore(path.join(dir, "orders.json"));
const paid: NewPaidOrder = {
  id: crypto.randomUUID(),
  createdAt: "2026-10-29T00:00:00.000Z",
  updatedAt: "2026-10-29T00:00:00.000Z",
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
  subtotalCents: 300,
  shippingCents: 0,
  totalCents: 300,
  stripeSessionId: `manual:${crypto.randomUUID()}`,
  stripePaymentIntentId: null,
  stripeReceiptUrl: null,
  stripeLivemode: false,
  paymentSource: "manual",
  note: "",
  trackingLink: "",
  plates: [short, long],
};
const saved = await store.insertPaidOrder(paid);
const proof = await store.createProof(saved.orderNumber, { invoiceUrl: "" });
assert.ok(proof);
const turnedOn = await store.updateOrder(saved.orderNumber, { uniformTextSize: true });
assert.equal(turnedOn?.uniformTextSize, true);
assert.equal(turnedOn?.plates[0].objects[0].fontSize, turnedOn?.plates[1].objects[0].fontSize);
const opened = await store.openProof(proof.token);
assert.equal(opened?.proof.status, "superseded");

console.log("lib/uniform-text.test.ts: ok");
