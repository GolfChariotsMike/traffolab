import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createFileStockStore } from "./stock-file";
import {
  STOCK_SHEET_AREA_MM2,
  StockValidationError,
  formatAreaCm2,
  formatSheetQuantity,
  latestStockCount,
  orderMaterial,
  parseNewCount,
  parseNewPurchase,
  plateAreaMm2,
  presentMonth,
  stockPosition,
  stockWastage,
  type StockPurchase,
} from "./stock";
import type { Cost } from "./costs";

const purchase: StockPurchase = {
  id: 1,
  date: "2026-11-17",
  sheetCount: 180,
  widthMm: 300,
  heightMm: 200,
  colour: "Red/White, White/Black, Yellow/Black",
  amountCents: 84238,
  gstIncluded: false,
  notes: "180 ABS sheets",
  createdBy: "mike",
  createdAt: "2026-11-17T03:58:48.617Z",
};

const areas: Record<number, number> = {
  1001: 136800,
  1002: 25000,
  1003: 12800,
  1004: 79400,
  1005: 9600,
  1006: 60000,
};
const created: Record<number, string> = {
  1001: "2026-09-30T10:58:05.909Z",
  1002: "2026-10-19T02:45:38.119Z",
  1003: "2026-10-27T05:53:45.672Z",
  1004: "2026-11-06T07:33:33.246Z",
  1005: "2026-11-10T02:13:11.997Z",
  1006: "2026-11-16T06:01:33.079Z",
};
const status: Record<number, string> = {
  1001: "SHIPPED",
  1002: "SHIPPED",
  1003: "SHIPPED",
  1004: "SHIPPED",
  1005: "SHIPPED",
  1006: "NEW",
};

const orders = Object.keys(areas).map((key) => {
  const orderNumber = Number(key);
  return {
    orderNumber,
    createdAt: created[orderNumber],
    status: status[orderNumber],
    totalCents: 1000,
    plates: [{ widthMm: 10, heightMm: 10, qty: areas[orderNumber] / 100 }],
  };
});

assert.equal(plateAreaMm2([{ widthMm: 300, heightMm: 200, qty: 1 }, { widthMm: 0, heightMm: 10, qty: 1 }]), 60000);
assert.equal(STOCK_SHEET_AREA_MM2, 60000);

const position = stockPosition([purchase], orders);
assert.equal(position.purchasedSheets, 180);
assert.equal(position.purchasedAreaMm2, 180 * 300 * 200);
assert.equal(position.purchasedExGstCents, 84238);
assert.equal(position.purchasedSheetEquivalents, 180);
assert.equal(position.usedAreaMm2, 323600);
assert.equal(position.usedExGstCents, 2524);
assert.equal(position.remainingExGstCents, 81714);
assert.equal(position.jobs.find((job) => job.orderNumber === 1001)?.exGstCents, 1067);
assert.equal(position.jobs.find((job) => job.orderNumber === 1002)?.exGstCents, 195);
assert.equal(position.jobs.find((job) => job.orderNumber === 1003)?.exGstCents, 100);
assert.equal(position.jobs.find((job) => job.orderNumber === 1004)?.exGstCents, 619);
assert.equal(position.jobs.find((job) => job.orderNumber === 1005)?.exGstCents, 75);
assert.equal(position.jobs.find((job) => job.orderNumber === 1006)?.exGstCents, 468);
assert.equal(position.jobs.find((job) => job.orderNumber === 1006)?.sheetEquivalents, 1);
assert.ok(Math.abs(position.usedSheetEquivalents - 323600 / 60000) < 1e-9);
assert.ok(Math.abs(position.remainingSheetEquivalents - (180 - 323600 / 60000)) < 1e-9);
assert.equal(Math.round(position.centsPerSheet), 468);

const short = stockWastage(position, 170);
assert.ok(Math.abs(short.sheets - 691 / 150) < 1e-9);
assert.equal(short.exGstCents, 2156);
const extra = stockWastage(position, 176);
assert.equal(extra.exGstCents, 81714 - Math.round((176 * 84238) / 180));
assert.ok(extra.sheets < 0);

assert.equal(formatSheetQuantity(position.usedSheetEquivalents), "5.39");
assert.equal(formatSheetQuantity(position.remainingSheetEquivalents), "174.61");
assert.equal(formatAreaCm2(position.usedAreaMm2), "3,236.0");

const november = presentMonth("2026-11", orders, [], [purchase]);
assert.equal(november.summary.orderCostsExGstCents, 619 + 75 + 468);
assert.equal(november.stockActive, true);

const loggedMaterials: Cost = {
  id: 2,
  date: "2026-11-17",
  amountCents: 84238,
  gstIncluded: false,
  category: "materials",
  description: "bulk",
  orderId: null,
  receiptRef: "",
  createdBy: "mike",
  createdAt: "",
};
const withRows = presentMonth("2026-11", orders, [loggedMaterials], [purchase]);
assert.equal(withRows.costs.length, 0);
assert.equal(withRows.summary.generalCostsExGstCents, 0);
assert.equal(withRows.summary.orderCostsExGstCents, 1162);
const legacy = presentMonth("2026-11", orders, [loggedMaterials], null);
assert.equal(legacy.costs.length, 1);
assert.equal(legacy.summary.generalCostsExGstCents, 84238);
assert.equal(legacy.summary.orderCostsExGstCents, 0);

const dearer: StockPurchase = {
  ...purchase,
  id: 2,
  sheetCount: 10,
  amountCents: 6000,
  date: "2026-12-01",
};
const mixed = orderMaterial([{ widthMm: 300, heightMm: 200, qty: 1 }], [purchase, dearer]);
assert.equal(mixed.exGstCents, 475);

const gstPurchase: StockPurchase = {
  ...purchase,
  id: 3,
  sheetCount: 100,
  amountCents: 11000,
  gstIncluded: true,
};
assert.equal(orderMaterial([{ widthMm: 300, heightMm: 200, qty: 1 }], [gstPurchase]).exGstCents, 100);

assert.throws(() => parseNewPurchase({ amount: "0", sheetCount: 1, widthMm: 300, heightMm: 200, date: "2026-11-17" }, "a"), StockValidationError);
assert.throws(() => parseNewPurchase({ amount: "1", sheetCount: 0, widthMm: 300, heightMm: 200, date: "2026-11-17" }, "a"), StockValidationError);
const parsed = parseNewPurchase(
  {
    amount: "842.38",
    sheetCount: "180",
    widthMm: 300,
    heightMm: 200,
    date: "2026-11-17",
    colour: " Red/White ",
    notes: " landed ",
    gstIncluded: false,
  },
  "mike@x"
);
assert.equal(parsed.amountCents, 84238);
assert.equal(parsed.sheetCount, 180);
assert.equal(parsed.colour, "Red/White");
assert.equal(parsed.notes, "landed");
assert.equal(parsed.gstIncluded, false);
assert.equal(parseNewCount({ sheetsOnHand: "0", date: "2026-11-19" }, "leanne@x").sheetsOnHand, 0);
assert.throws(() => parseNewCount({ sheetsOnHand: "-1", date: "2026-11-19" }, "a"), StockValidationError);

const newest = latestStockCount([
  { id: 1, date: "2026-11-18", sheetsOnHand: 180, notes: "", createdBy: "", createdAt: "" },
  { id: 2, date: "2026-11-19", sheetsOnHand: 170, notes: "", createdBy: "", createdAt: "" },
  { id: 3, date: "2026-11-19", sheetsOnHand: 169, notes: "", createdBy: "", createdAt: "" },
]);
assert.equal(newest?.sheetsOnHand, 169);

const dir = await mkdtemp(path.join(tmpdir(), "stock-"));
const store = createFileStockStore(path.join(dir, "stock.json"));
const saved = await store.insertPurchase(parsed);
const count = await store.insertCount(parseNewCount({ sheetsOnHand: 170, date: "2026-11-19", notes: "shelf" }, "mike"));
assert.equal(saved.id, 1);
assert.equal((await store.listPurchases()).length, 1);
assert.equal((await store.listCounts())[0].sheetsOnHand, 170);
assert.equal(count.notes, "shelf");
assert.equal(await store.removePurchase(1), true);
assert.equal(await store.removePurchase(1), false);
assert.equal(await store.removeCount(count.id), true);
assert.equal((await store.listCounts()).length, 0);

console.log("stock tests passed");
