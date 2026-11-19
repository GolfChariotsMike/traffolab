import "server-only";
import type { Sql } from "postgres";
import { createFileStockStore, defaultStockFilePath, type StockStore } from "@/lib/stock-file";
import { StockSchemaError, type StockCount, type StockPurchase } from "@/lib/stock";
import { getSql } from "@/lib/order-store";
import { orderStoreMode } from "@/lib/order-store-types";

type PurchaseRow = {
  id: string | number;
  purchased_on: Date | string;
  sheet_count: number;
  width_mm: number;
  height_mm: number;
  colour: string;
  amount_cents: number;
  gst_included: boolean;
  notes: string;
  created_by: string;
  created_at: Date | string;
};

type CountRow = {
  id: string | number;
  counted_on: Date | string;
  sheets_on_hand: number;
  notes: string;
  created_by: string;
  created_at: Date | string;
};

function dateText(value: Date | string) {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  return String(value).slice(0, 10);
}

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function rowToPurchase(row: PurchaseRow): StockPurchase {
  return {
    id: Number(row.id),
    date: dateText(row.purchased_on),
    sheetCount: row.sheet_count,
    widthMm: row.width_mm,
    heightMm: row.height_mm,
    colour: row.colour,
    amountCents: row.amount_cents,
    gstIncluded: row.gst_included,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: iso(row.created_at),
  };
}

function rowToCount(row: CountRow): StockCount {
  return {
    id: Number(row.id),
    date: dateText(row.counted_on),
    sheetsOnHand: row.sheets_on_hand,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: iso(row.created_at),
  };
}

function rethrow(error: unknown): never {
  if (typeof error === "object" && error && (error as { code?: string }).code === "42P01") {
    throw new StockSchemaError();
  }
  throw error;
}

const PURCHASE_COLUMNS =
  "id, purchased_on::text AS purchased_on, sheet_count, width_mm, height_mm, colour, amount_cents, gst_included, notes, created_by, created_at";
const COUNT_COLUMNS = "id, counted_on::text AS counted_on, sheets_on_hand, notes, created_by, created_at";

export function createPostgresStockStore(sql: Sql): StockStore {
  return {
    async insertPurchase(purchase) {
      try {
        const rows = await sql<PurchaseRow[]>`
          INSERT INTO trafflabels_stock_purchases
            (purchased_on, sheet_count, width_mm, height_mm, colour, amount_cents, gst_included, notes, created_by)
          VALUES
            (${purchase.date}, ${purchase.sheetCount}, ${purchase.widthMm}, ${purchase.heightMm},
             ${purchase.colour}, ${purchase.amountCents}, ${purchase.gstIncluded}, ${purchase.notes},
             ${purchase.createdBy})
          RETURNING ${sql.unsafe(PURCHASE_COLUMNS)}
        `;
        return rowToPurchase(rows[0]);
      } catch (error) {
        rethrow(error);
      }
    },
    async removePurchase(id) {
      try {
        const rows = await sql`DELETE FROM trafflabels_stock_purchases WHERE id = ${id} RETURNING id`;
        return rows.length > 0;
      } catch (error) {
        rethrow(error);
      }
    },
    async listPurchases() {
      try {
        const rows = await sql<PurchaseRow[]>`
          SELECT ${sql.unsafe(PURCHASE_COLUMNS)} FROM trafflabels_stock_purchases
          ORDER BY purchased_on DESC, id DESC
        `;
        return rows.map(rowToPurchase);
      } catch (error) {
        rethrow(error);
      }
    },
    async insertCount(count) {
      try {
        const rows = await sql<CountRow[]>`
          INSERT INTO trafflabels_stock_counts
            (counted_on, sheets_on_hand, notes, created_by)
          VALUES
            (${count.date}, ${count.sheetsOnHand}, ${count.notes}, ${count.createdBy})
          RETURNING ${sql.unsafe(COUNT_COLUMNS)}
        `;
        return rowToCount(rows[0]);
      } catch (error) {
        rethrow(error);
      }
    },
    async removeCount(id) {
      try {
        const rows = await sql`DELETE FROM trafflabels_stock_counts WHERE id = ${id} RETURNING id`;
        return rows.length > 0;
      } catch (error) {
        rethrow(error);
      }
    },
    async listCounts() {
      try {
        const rows = await sql<CountRow[]>`
          SELECT ${sql.unsafe(COUNT_COLUMNS)} FROM trafflabels_stock_counts
          ORDER BY counted_on DESC, id DESC
        `;
        return rows.map(rowToCount);
      } catch (error) {
        rethrow(error);
      }
    },
  };
}

let singleton: StockStore | null | undefined;

export function getStockStore(): StockStore | null {
  if (singleton !== undefined) return singleton;
  const mode = orderStoreMode();
  if (mode === "unconfigured") singleton = null;
  else if (mode === "file") singleton = createFileStockStore(defaultStockFilePath());
  else {
    const sql = getSql();
    singleton = sql ? createPostgresStockStore(sql) : null;
  }
  return singleton;
}

/** null when the stock tables are not installed yet. An empty list means they are, with no purchases. */
export async function loadStockPurchases(): Promise<StockPurchase[] | null> {
  const store = getStockStore();
  if (!store) return null;
  try {
    return await store.listPurchases();
  } catch (error) {
    if (error instanceof StockSchemaError) return null;
    throw error;
  }
}
