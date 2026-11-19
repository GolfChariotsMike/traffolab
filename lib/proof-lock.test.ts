import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { rotech1005Nameplate } from "./fixtures/rotech-1005";
import { applyFixedTextSize, applyUniformTextSize } from "./label-design";
import { createFileOrderStore } from "./order-store-file";
import {
  adminOrderUpdateBody,
  applyOrderPatch,
  parseOrderPatch,
  type NewPaidOrder,
  type SavedOrder,
  type StoredPlate,
} from "./orders";
import { plateEditLockError, proofReplacementLockError } from "./proof-lock";
import {
  platesApprovalHash,
  platesMatchProof,
  PROOF_PLATE_LOCK_MESSAGE,
  type ProofRecord,
} from "./proofs";

const updateRoute = readFileSync(
  new URL("../app/api/admin/orders/[id]/route.ts", import.meta.url),
  "utf8"
);
const lockAt = updateRoute.indexOf("plateEditLockError(");
const writeAt = updateRoute.indexOf("store.updateOrder(");
assert.ok(lockAt > 0 && writeAt > lockAt, "order update must reject a plate edit before it writes");

const proofRoute = readFileSync(
  new URL("../app/api/admin/orders/[id]/proof/route.ts", import.meta.url),
  "utf8"
);
const replaceAt = proofRoute.indexOf("proofReplacementLockError(");
const createAt = proofRoute.indexOf("store.createProof(");
const proofWriteAt = proofRoute.indexOf("store.updateOrder(");
assert.ok(
  replaceAt > 0 && replaceAt < createAt && replaceAt < proofWriteAt,
  "a new proof link must be refused before it can supersede the current one"
);

const board = readFileSync(new URL("../components/admin/orders-board.tsx", import.meta.url), "utf8");
assert.match(board, /adminOrderUpdateBody\(/);
assert.match(board, /PROOF_PLATE_LOCK_MESSAGE/);
assert.match(board, /platesLocked\s*\?\s*selected\.plates/);
assert.match(board, /!platesLocked/);
assert.doesNotMatch(board, /Saving this replaces a proof that was already sent/);

const lockedBody = adminOrderUpdateBody({
  platesLocked: true,
  status: "SHIPPED",
  note: "left with the courier",
  trackingLink: "https://auspost.com.au/track/ABC",
  locations: ["Switchroom"],
  uniformText: true,
  uniformTextMm: "6.438",
  invoiceCc: "accounts@rotech.example",
});
assert.equal(lockedBody.ok, true);
if (!lockedBody.ok) throw new Error("expected a locked save body");
assert.equal("plateLocations" in lockedBody.body, false);
assert.equal("uniformTextSize" in lockedBody.body, false);
assert.equal("uniformTextMm" in lockedBody.body, false);
assert.equal(lockedBody.body.status, "SHIPPED");
assert.equal(lockedBody.body.note, "left with the courier");
assert.equal(lockedBody.body.trackingLink, "https://auspost.com.au/track/ABC");
assert.equal(lockedBody.body.invoiceCc, "accounts@rotech.example");

const openBody = adminOrderUpdateBody({
  platesLocked: false,
  status: "NEW",
  note: "",
  trackingLink: "",
  locations: ["Switchroom"],
  uniformText: true,
  uniformTextMm: "6.438",
  invoiceCc: "",
});
assert.equal(openBody.ok, true);
if (!openBody.ok) throw new Error("expected an open save body");
assert.deepEqual(openBody.body.plateLocations, ["Switchroom"]);
assert.equal(openBody.body.uniformTextSize, false);
assert.equal(openBody.body.uniformTextMm, 6.4);

const badSize = adminOrderUpdateBody({
  platesLocked: false,
  status: "NEW",
  note: "",
  trackingLink: "",
  locations: [],
  uniformText: true,
  uniformTextMm: "80",
  invoiceCc: "",
});
assert.equal(badSize.ok, false);

function idTag(): StoredPlate {
  return {
    widthMm: 30,
    heightMm: 10,
    qty: 1,
    unitCents: 225,
    lineCents: 225,
    colourPair: "white-black",
    colourLabel: "White / black",
    adhesive3m: false,
    text: "IV-01",
    location: "",
    uniformTextMm: 6.438,
    objects: [
      { id: "text-1", text: "IV-01", x: 15, y: 6.2, fontSize: 6.438, align: "center" },
    ],
  };
}

function nameplate(): StoredPlate {
  return { ...rotech1005Nameplate(), location: "" };
}

const tag = idTag();
const plate = nameplate();
assert.equal(plate.objects.length, 9);

const collapsed = applyFixedTextSize([plate], 6.4);
assert.ok(collapsed[0].objects.every((object) => object.fontSize === 6.4));
assert.notEqual(collapsed[0].objects[0].y, plate.objects[0].y);
assert.notDeepEqual(collapsed[0].objects, plate.objects);

const shipping = {
  name: "Rotech Water",
  line1: "3/15 Emplacement Cres",
  line2: "",
  city: "Hamilton Hill",
  state: "WA",
  postalCode: "6163",
  country: "AU",
};

function newOrder(plates: StoredPlate[], extra: Partial<NewPaidOrder> = {}): SavedOrder {
  const subtotalCents = plates.reduce((sum, item) => sum + item.lineCents, 0);
  return {
    id: crypto.randomUUID(),
    createdAt: "2026-10-29T08:00:00.000Z",
    updatedAt: "2026-10-29T08:00:00.000Z",
    status: "NEW",
    customerName: "Rotech Water",
    customerEmail: "accounts@rotech.example",
    customerPhone: "",
    shipping,
    shippingMethodId: "standard",
    subtotalCents,
    shippingCents: 0,
    totalCents: subtotalCents,
    stripeSessionId: `manual:${crypto.randomUUID()}`,
    stripePaymentIntentId: null,
    stripeReceiptUrl: null,
    stripeLivemode: false,
    paymentSource: "manual",
    note: "",
    trackingLink: "",
    plates,
    uniformTextMm: 6.438,
    orderNumber: 1005,
    ...extra,
  };
}

const roteOrder = newOrder([tag, plate]);
const noted = applyOrderPatch(roteOrder, { note: "opened and saved" });
assert.equal(noted.plates, roteOrder.plates);
assert.equal(noted.note, "opened and saved");
assert.equal(noted.uniformTextMm, 6.438);

const roundTrip = parseOrderPatch({
  status: "CUT",
  note: "opened and saved",
  trackingLink: "https://auspost.com.au/track/ABC",
  plateLocations: ["", ""],
  uniformTextSize: false,
  uniformTextMm: 6.4,
  invoiceCc: "accounts@rotech.example",
});
assert.equal(roundTrip.ok, true);
if (!roundTrip.ok) throw new Error("expected the dashboard payload to parse");
const kept = applyOrderPatch(roteOrder, roundTrip.value);
assert.deepEqual(kept.plates[1].objects, plate.objects);
assert.equal(kept.plates[0].objects[0].fontSize, 6.438);
assert.equal(kept.uniformTextMm, 6.438);
assert.equal(platesApprovalHash(kept.plates), platesApprovalHash(roteOrder.plates));
assert.ok(new Set(kept.plates[1].objects.map((object) => object.y)).size > 1);

const sharedOrder = newOrder([plate], { uniformTextMm: undefined, uniformTextSize: true });
const sharedAgain = applyOrderPatch(sharedOrder, { uniformTextSize: true, uniformTextMm: null });
assert.equal(sharedAgain.plates, sharedOrder.plates);
const sharedRewritten = applyUniformTextSize([plate]);
assert.notEqual(sharedRewritten[0].objects[0].fontSize, plate.objects[0].fontSize);

const sized = applyFixedTextSize(
  [
    {
      ...tag,
      uniformTextMm: undefined,
      objects: [{ ...tag.objects[0], fontSize: 8 }],
    },
  ],
  3.4
);
assert.equal(sized[0].uniformTextMm, 3.4);
const restored = applyOrderPatch(newOrder(sized, { uniformTextMm: 3.4 }), {
  uniformTextSize: false,
  uniformTextMm: null,
});
assert.equal(restored.uniformTextMm, undefined);
assert.equal(restored.plates[0].uniformTextMm, undefined);

const dir = await mkdtemp(path.join(tmpdir(), "trafflabels-proof-lock-"));
const store = createFileOrderStore(path.join(dir, "orders.json"));

async function saveLikeTheDashboard(
  orderNumber: number,
  body: Record<string, unknown>
) {
  const parsed = parseOrderPatch(body);
  if (!parsed.ok) return { status: 400 as const, error: parsed.error, order: null };
  const existing = await store.getOrder(orderNumber);
  if (!existing) return { status: 404 as const, error: "Unknown order.", order: null };
  const latest = await store.getLatestProof(existing.id);
  const lock = plateEditLockError(existing, latest, parsed.value);
  if (lock) return { status: 400 as const, error: lock, order: existing };
  const order = await store.updateOrder(orderNumber, parsed.value);
  return { status: 200 as const, error: null, order };
}

async function replaceLikeTheDashboard(orderNumber: number) {
  const existing = await store.getOrder(orderNumber);
  if (!existing) return { status: 404 as const, error: "Unknown order.", proof: null };
  const latest = await store.getLatestProof(existing.id);
  const lock = proofReplacementLockError(existing, latest);
  if (lock) return { status: 400 as const, error: lock, proof: null };
  const proof = await store.createProof(orderNumber, { invoiceUrl: "" });
  return { status: 200 as const, error: null, proof };
}

const approvedOrder = await store.insertPaidOrder(newOrder([idTag(), nameplate()]));
const approvedProof = await store.createProof(approvedOrder.orderNumber, { invoiceUrl: "" });
assert.ok(approvedProof);
const approved = await store.decideProof(approvedProof.token, {
  action: "approve",
  name: "Alex Nguyen",
  ip: "203.0.113.8",
  userAgent: "TestBrowser",
});
assert.equal(approved.ok, true);

const before = await store.getOrder(approvedOrder.orderNumber);
assert.ok(before);
const stray = await saveLikeTheDashboard(approvedOrder.orderNumber, {
  status: "CUT",
  note: "Night check",
  trackingLink: "https://auspost.com.au/track/ABC",
  plateLocations: ["", ""],
  uniformTextSize: false,
  uniformTextMm: 6.4,
  invoiceCc: "accounts@rotech.example",
});
assert.equal(stray.status, 200);
assert.equal(stray.order?.status, "CUT");
assert.equal(stray.order?.note, "Night check");
assert.equal(stray.order?.trackingLink, "https://auspost.com.au/track/ABC");
assert.deepEqual(stray.order?.invoiceCcEmails, ["accounts@rotech.example"]);
assert.deepEqual(stray.order?.plates[1].objects, before.plates[1].objects);
assert.equal(stray.order?.plates[0].objects[0].fontSize, 6.438);
assert.equal(stray.order?.plates[1].objects.length, 9);
const stillApproved = await store.getLatestProof(approvedOrder.id);
assert.equal(stillApproved?.status, "approved");
assert.equal(platesMatchProof(stray.order!.plates, stillApproved as ProofRecord), true);

const hostileSize = await saveLikeTheDashboard(approvedOrder.orderNumber, { uniformTextMm: 5 });
assert.equal(hostileSize.status, 400);
assert.equal(hostileSize.error, PROOF_PLATE_LOCK_MESSAGE);
const hostileLocation = await saveLikeTheDashboard(approvedOrder.orderNumber, {
  plateLocations: ["Switchroom", "Nameplate"],
});
assert.equal(hostileLocation.status, 400);
assert.equal(hostileLocation.error, PROOF_PLATE_LOCK_MESSAGE);
const afterHostile = await store.getOrder(approvedOrder.orderNumber);
assert.deepEqual(afterHostile?.plates, stray.order?.plates);
assert.equal((await store.getLatestProof(approvedOrder.id))?.status, "approved");
const replacement = await replaceLikeTheDashboard(approvedOrder.orderNumber);
assert.equal(replacement.status, 400);
assert.equal(replacement.error, PROOF_PLATE_LOCK_MESSAGE);
assert.equal((await store.getLatestProof(approvedOrder.id))?.token, approvedProof.token);

const pendingOrder = await store.insertPaidOrder(
  newOrder([
    {
      widthMm: 40,
      heightMm: 20,
      qty: 1,
      unitCents: 400,
      lineCents: 400,
      colourPair: "yellow-black",
      colourLabel: "Yellow / black",
      adhesive3m: true,
      text: "MAIN SWITCH",
      location: "DB room",
      objects: [
        { id: "text-1", text: "MAIN SWITCH", x: 20, y: 12, fontSize: 8, align: "center" },
      ],
    },
  ], { uniformTextMm: undefined })
);
const pendingProof = await store.createProof(pendingOrder.orderNumber, { invoiceUrl: "" });
assert.ok(pendingProof);
const pendingEdit = await saveLikeTheDashboard(pendingOrder.orderNumber, {
  uniformTextSize: true,
  plateLocations: ["Workshop"],
});
assert.equal(pendingEdit.status, 400);
assert.equal(pendingEdit.error, PROOF_PLATE_LOCK_MESSAGE);
const pendingStatus = await saveLikeTheDashboard(pendingOrder.orderNumber, {
  status: "READY TO SHIP",
  note: "waiting on the customer",
  trackingLink: "https://auspost.com.au/track/WAIT",
});
assert.equal(pendingStatus.status, 200);
assert.equal(pendingStatus.order?.status, "READY TO SHIP");
assert.equal(pendingStatus.order?.note, "waiting on the customer");
assert.equal(pendingStatus.order?.trackingLink, "https://auspost.com.au/track/WAIT");
assert.equal(pendingStatus.order?.plates[0].location, "DB room");
assert.equal(pendingStatus.order?.plates[0].objects[0].fontSize, 8);
assert.equal((await store.getLatestProof(pendingOrder.id))?.status, "pending");
assert.equal(
  platesApprovalHash(pendingStatus.order!.plates),
  platesApprovalHash(pendingOrder.plates)
);

const openOrder = await store.insertPaidOrder(
  newOrder(
    [
      {
        widthMm: 40,
        heightMm: 20,
        qty: 1,
        unitCents: 400,
        lineCents: 400,
        colourPair: "white-black",
        colourLabel: "White / black",
        adhesive3m: false,
        text: "UPS",
        location: "",
        objects: [{ id: "text-1", text: "UPS", x: 20, y: 12, fontSize: 12, align: "center" }],
      },
    ],
    { uniformTextMm: undefined }
  )
);
assert.equal(await store.getLatestProof(openOrder.id), null);
const opened = await saveLikeTheDashboard(openOrder.orderNumber, {
  uniformTextMm: 5,
  plateLocations: ["Workshop"],
  note: "before a proof",
});
assert.equal(opened.status, 200);
assert.equal(opened.order?.note, "before a proof");
assert.equal(opened.order?.plates[0].location, "Workshop");
assert.equal(opened.order?.plates[0].objects[0].fontSize, 5);
assert.equal(opened.order?.uniformTextMm, 5);
const firstLink = await replaceLikeTheDashboard(openOrder.orderNumber);
assert.equal(firstLink.status, 200);
assert.equal(firstLink.proof?.status, "pending");

const changesOrder = await store.insertPaidOrder(
  newOrder([idTag(), nameplate()])
);
const changesProof = await store.createProof(changesOrder.orderNumber, { invoiceUrl: "" });
assert.ok(changesProof);
const changes = await store.decideProof(changesProof.token, {
  action: "changes",
  comment: "Nameplate lines are stacked",
  ip: "203.0.113.9",
  userAgent: "TestBrowser",
});
assert.equal(changes.ok, true);
const changesEdit = await saveLikeTheDashboard(changesOrder.orderNumber, { uniformTextMm: 4 });
assert.equal(changesEdit.status, 400);
assert.equal(changesEdit.error, PROOF_PLATE_LOCK_MESSAGE);
assert.equal((await replaceLikeTheDashboard(changesOrder.orderNumber)).status, 400);
assert.equal((await store.getLatestProof(changesOrder.id))?.status, "changes_requested");

const supersededOrder = await store.insertPaidOrder(newOrder([idTag(), nameplate()]));
const live = await store.createProof(supersededOrder.orderNumber, { invoiceUrl: "" });
assert.ok(live);
const ownerEdit = await store.updateOrder(supersededOrder.orderNumber, {
  plateLocations: ["Outside the dashboard", "Nameplate"],
});
assert.equal(ownerEdit?.plates[0].location, "Outside the dashboard");
assert.equal((await store.openProof(live.token))?.proof.status, "superseded");
const afterOwner = await saveLikeTheDashboard(supersededOrder.orderNumber, {
  plateLocations: ["Switchroom", "Nameplate"],
  note: "proof was already superseded",
});
assert.equal(afterOwner.status, 200);
assert.equal(afterOwner.order?.plates[0].location, "Switchroom");
assert.equal(afterOwner.order?.note, "proof was already superseded");
assert.equal(afterOwner.order?.plates[1].objects[0].fontSize, plate.objects[0].fontSize);

console.log("lib/proof-lock.test.ts: ok");
