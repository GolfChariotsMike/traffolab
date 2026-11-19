/**
 * Sheet stock: bulk purchases, plate-area drawdown, and a physical count.
 * Pure helpers. No server imports.
 *
 * A purchase is the hard cost of sheets on the shelf. It is not a monthly
 * cost. Each order's material cost is its plate area at the weighted average
 * landed cost per mm² of every purchase. Logged "materials" rows are the old
 * way of writing that down and are left out once purchases are in use.
 */

import {
  costExGstCents,
  isValidDate,
  monthSummary,
  orderProfit,
  parseAmountToCents,
  perthMonthOf,
  sumCostsExGst,
  type Cost,
  type MonthSummary,
} from "@/lib/costs";

export const STOCK_SHEET_WIDTH_MM = 300;
export const STOCK_SHEET_HEIGHT_MM = 200;
export const STOCK_SHEET_AREA_MM2 = STOCK_SHEET_WIDTH_MM * STOCK_SHEET_HEIGHT_MM;

const MAX_SHEETS = 1_000_000;
const MAX_MM = 5_000;
const MAX_COLOUR = 200;
const MAX_NOTES = 2_000;

export class StockSchemaError extends Error {
  constructor() {
    super(
      "The sheet stock tables are missing. Apply db/migrations/20261119_trafflabels_stock.sql."
    );
  }
}

export class StockValidationError extends Error {}

export type StockPurchase = {
  id: number;
  /** YYYY-MM-DD, Perth calendar date. */
  date: string;
  sheetCount: number;
  widthMm: number;
  heightMm: number;
  colour: string;
  amountCents: number;
  gstIncluded: boolean;
  notes: string;
  createdBy: string;
  createdAt: string;
};

export type NewStockPurchase = Omit<StockPurchase, "id" | "createdAt">;

export type StockCount = {
  id: number;
  /** YYYY-MM-DD. */
  date: string;
  sheetsOnHand: number;
  notes: string;
  createdBy: string;
  createdAt: string;
};

export type NewStockCount = Omit<StockCount, "id" | "createdAt">;

export type PlateArea = { widthMm: number; heightMm: number; qty: number };

export type OrderMaterial = {
  areaMm2: number;
  sheetEquivalents: number;
  exGstCents: number;
};

export type StockJob = {
  orderNumber: number;
  createdAt: string;
  status: string;
  areaMm2: number;
  sheetEquivalents: number;
  exGstCents: number;
};

export type StockPosition = {
  purchasedSheets: number;
  purchasedAreaMm2: number;
  purchasedExGstCents: number;
  purchasedSheetEquivalents: number;
  usedAreaMm2: number;
  usedSheetEquivalents: number;
  usedExGstCents: number;
  remainingSheetEquivalents: number;
  remainingExGstCents: number;
  /** Ex-GST cents for one 300×200 mm sheet at the weighted average. 0 when nothing is purchased. */
  centsPerSheet: number;
  jobs: StockJob[];
};

export type StockWastage = { sheets: number; exGstCents: number };

type MoneyPurchase = Pick<StockPurchase, "sheetCount" | "widthMm" | "heightMm" | "amountCents" | "gstIncluded">;

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);

function roundDiv(numerator: bigint, denominator: bigint): number {
  const negative = numerator < ZERO;
  const num = negative ? -numerator : numerator;
  const den = denominator < ZERO ? -denominator : denominator;
  if (den === ZERO) return 0;
  const q = num / den;
  const r = num % den;
  const rounded = r * TWO >= den ? q + ONE : q;
  const signed = negative ? -rounded : rounded;
  return Number(signed);
}

/** Nearest cent for (part / whole) * cents. part, whole and cents are rounded to integers first. */
function roundRatio(part: number, cents: number, whole: number) {
  if (!Number.isFinite(part) || !Number.isFinite(cents) || !Number.isFinite(whole)) return 0;
  if (part <= 0 || cents <= 0 || whole <= 0) return 0;
  const p = BigInt(Math.round(part));
  const c = BigInt(Math.round(cents));
  const w = BigInt(Math.round(whole));
  if (w === ZERO) return 0;
  return roundDiv(p * c, w);
}

function plateUnits(plate: PlateArea): bigint {
  const raw = plate.widthMm * plate.heightMm * plate.qty;
  if (!Number.isFinite(raw) || raw <= 0) return ZERO;
  return BigInt(Math.round(raw));
}

function purchaseUnits(purchase: Pick<StockPurchase, "sheetCount" | "widthMm" | "heightMm">): bigint {
  return BigInt(purchase.sheetCount) * BigInt(purchase.widthMm) * BigInt(purchase.heightMm);
}

export function plateAreaMm2(plates: PlateArea[]) {
  return Number(plates.reduce((sum, plate) => sum + plateUnits(plate), ZERO));
}

function stockPool(purchases: MoneyPurchase[]) {
  const area = purchases.reduce((sum, purchase) => sum + purchaseUnits(purchase), ZERO);
  return { area, exGstCents: sumCostsExGst(purchases) };
}

/** Plate area priced at the weighted average landed cost of every purchase. */
export function orderMaterial(plates: PlateArea[], purchases: MoneyPurchase[]): OrderMaterial {
  const units = plates.reduce((sum, plate) => sum + plateUnits(plate), ZERO);
  const pool = stockPool(purchases);
  const exGstCents =
    pool.area > ZERO && units > ZERO ? roundDiv(units * BigInt(pool.exGstCents), pool.area) : 0;
  const areaMm2 = Number(units);
  return {
    areaMm2,
    sheetEquivalents: areaMm2 / STOCK_SHEET_AREA_MM2,
    exGstCents,
  };
}

export function stockPosition(
  purchases: MoneyPurchase[],
  orders: Array<{ orderNumber: number; createdAt: string; status: string; plates: PlateArea[] }>
): StockPosition {
  const purchasedArea = purchases.reduce((sum, purchase) => sum + purchaseUnits(purchase), ZERO);
  const purchasedExGstCents = sumCostsExGst(purchases);
  const purchasedSheets = purchases.reduce((sum, purchase) => sum + purchase.sheetCount, 0);
  const jobs = orders
    .map((order) => {
      const material = orderMaterial(order.plates, purchases);
      return {
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        status: order.status,
        areaMm2: material.areaMm2,
        sheetEquivalents: material.sheetEquivalents,
        exGstCents: material.exGstCents,
      };
    })
    .filter((job) => job.areaMm2 > 0)
    .sort((a, b) => a.orderNumber - b.orderNumber);
  const usedAreaMm2 = jobs.reduce((sum, job) => sum + job.areaMm2, 0);
  const usedExGstCents = jobs.reduce((sum, job) => sum + job.exGstCents, 0);
  const purchasedAreaMm2 = Number(purchasedArea);
  const purchasedSheetEquivalents = purchasedAreaMm2 / STOCK_SHEET_AREA_MM2;
  const usedSheetEquivalents = usedAreaMm2 / STOCK_SHEET_AREA_MM2;
  return {
    purchasedSheets,
    purchasedAreaMm2,
    purchasedExGstCents,
    purchasedSheetEquivalents,
    usedAreaMm2,
    usedSheetEquivalents,
    usedExGstCents,
    remainingSheetEquivalents: purchasedSheetEquivalents - usedSheetEquivalents,
    remainingExGstCents: purchasedExGstCents - usedExGstCents,
    centsPerSheet:
      purchasedSheetEquivalents > 0 ? purchasedExGstCents / purchasedSheetEquivalents : 0,
    jobs,
  };
}

/**
 * Book remaining minus a physical count of 300×200 mm sheets.
 * Positive means the shelf is short of the plate-area balance.
 */
export function stockWastage(position: StockPosition, sheetsOnHand: number): StockWastage {
  const sheets = position.remainingSheetEquivalents - sheetsOnHand;
  if (position.purchasedAreaMm2 <= 0 || position.purchasedExGstCents <= 0) {
    return { sheets, exGstCents: 0 };
  }
  const onHandCents = roundRatio(
    sheetsOnHand * STOCK_SHEET_AREA_MM2,
    position.purchasedExGstCents,
    position.purchasedAreaMm2
  );
  return { sheets, exGstCents: position.remainingExGstCents - onHandCents };
}

export function latestStockCount(counts: StockCount[]): StockCount | null {
  if (counts.length === 0) return null;
  return [...counts].sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1))[0];
}

export function formatSheetQuantity(value: number) {
  return new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 }).format(value);
}

export function formatAreaCm2(areaMm2: number) {
  return new Intl.NumberFormat("en-AU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(areaMm2 / 100);
}

function parseWholeNumber(value: unknown, min: number, max: number): number | null {
  let text: string;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) return null;
    text = String(value);
  } else if (typeof value === "string") {
    text = value.trim();
  } else {
    return null;
  }
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  if (!Number.isSafeInteger(n) || n < min || n > max) return null;
  return n;
}

export function parseNewPurchase(body: Record<string, unknown>, createdBy: string): NewStockPurchase {
  const sheetCount = parseWholeNumber(body.sheetCount, 1, MAX_SHEETS);
  if (sheetCount == null) throw new StockValidationError("Enter how many sheets were bought.");
  const widthMm = parseWholeNumber(body.widthMm, 1, MAX_MM);
  const heightMm = parseWholeNumber(body.heightMm, 1, MAX_MM);
  if (widthMm == null || heightMm == null) {
    throw new StockValidationError("Enter the sheet width and height in millimetres.");
  }
  const amountCents = parseAmountToCents(body.amount);
  if (amountCents == null || amountCents > 100_000_000) {
    throw new StockValidationError("Enter an amount in dollars, like 842.38.");
  }
  const date = body.date ?? "";
  if (!isValidDate(date)) throw new StockValidationError("Enter a valid date.");
  const colour = typeof body.colour === "string" ? body.colour.trim() : "";
  if (colour.length > MAX_COLOUR) throw new StockValidationError("Colour is too long.");
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (notes.length > MAX_NOTES) throw new StockValidationError("Notes are too long.");
  return {
    date,
    sheetCount,
    widthMm,
    heightMm,
    colour,
    amountCents,
    gstIncluded: body.gstIncluded === true,
    notes,
    createdBy,
  };
}

export function parseNewCount(body: Record<string, unknown>, createdBy: string): NewStockCount {
  const sheetsOnHand = parseWholeNumber(body.sheetsOnHand, 0, MAX_SHEETS);
  if (sheetsOnHand == null) throw new StockValidationError("Enter how many sheets are on the shelf.");
  const date = body.date ?? "";
  if (!isValidDate(date)) throw new StockValidationError("Enter a valid date.");
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (notes.length > MAX_NOTES) throw new StockValidationError("Notes are too long.");
  return { date, sheetsOnHand, notes, createdBy };
}

export function purchaseExGstCents(purchase: Pick<StockPurchase, "amountCents" | "gstIncluded">) {
  return costExGstCents(purchase);
}

type JobOrder = {
  orderNumber: number;
  createdAt: string;
  status: string;
  totalCents: number;
  plates: PlateArea[];
};

/** null purchases means the stock tables are not there yet, so logged materials still count. */
export function presentOrderCosts(
  order: { totalCents: number; plates: PlateArea[] },
  costs: Cost[],
  purchases: StockPurchase[] | null
) {
  const stockActive = purchases != null;
  const logged = stockActive ? costs.filter((cost) => cost.category !== "materials") : costs;
  const material = stockActive ? orderMaterial(order.plates, purchases) : null;
  return {
    costs: logged,
    material,
    profit: orderProfit(order, logged, material?.exGstCents ?? 0),
    stockActive,
  };
}

export function monthMaterialExGstCents(month: string, orders: JobOrder[], purchases: MoneyPurchase[]) {
  return orders
    .filter((order) => perthMonthOf(order.createdAt) === month)
    .reduce((sum, order) => sum + orderMaterial(order.plates, purchases).exGstCents, 0);
}

export function presentMonth(
  month: string,
  orders: JobOrder[],
  costs: Cost[],
  purchases: StockPurchase[] | null
): { costs: Cost[]; summary: MonthSummary; stockActive: boolean } {
  const stockActive = purchases != null;
  const summary = monthSummary(
    month,
    orders,
    costs,
    stockActive
      ? {
          materialExGstCents: monthMaterialExGstCents(month, orders, purchases),
          excludeCategory: "materials",
        }
      : undefined
  );
  return {
    costs: stockActive ? costs.filter((cost) => cost.category !== "materials") : costs,
    summary,
    stockActive,
  };
}
