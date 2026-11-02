import "server-only";
import type { Sql } from "postgres";
import { createFileCostStore, defaultCostFilePath, type CostStore } from "@/lib/cost-file";
import { CostSchemaError, isCostCategory, type Cost } from "@/lib/costs";
import { getSql } from "@/lib/order-store";
import { orderStoreMode } from "@/lib/order-store-types";

type CostRow = {
  id: string | number;
  cost_date: Date | string;
  amount_cents: number;
  gst_included: boolean;
  category: string;
  description: string;
  order_id: string | null;
  receipt_ref: string;
  created_by: string;
  created_at: Date | string;
};

function rowToCost(row: CostRow): Cost {
  if (!isCostCategory(row.category)) throw new Error(`Unexpected cost category: ${row.category}`);
  const date =
    row.cost_date instanceof Date
      ? // postgres.js parses DATE at local midnight; rebuild from local parts.
        `${row.cost_date.getFullYear()}-${String(row.cost_date.getMonth() + 1).padStart(2, "0")}-${String(row.cost_date.getDate()).padStart(2, "0")}`
      : String(row.cost_date).slice(0, 10);
  const created = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
  return {
    id: Number(row.id),
    date,
    amountCents: row.amount_cents,
    gstIncluded: row.gst_included,
    category: row.category,
    description: row.description,
    orderId: row.order_id,
    receiptRef: row.receipt_ref,
    createdBy: row.created_by,
    createdAt: created.toISOString(),
  };
}

function rethrow(error: unknown): never {
  if (typeof error === "object" && error && (error as { code?: string }).code === "42P01") {
    throw new CostSchemaError();
  }
  throw error;
}

const COLUMNS = "id, cost_date::text AS cost_date, amount_cents, gst_included, category, description, order_id, receipt_ref, created_by, created_at";

export function createPostgresCostStore(sql: Sql): CostStore {
  return {
    async insert(cost) {
      try {
        const rows = await sql<CostRow[]>`
          INSERT INTO trafflabels_costs
            (cost_date, amount_cents, gst_included, category, description, order_id, receipt_ref, created_by)
          VALUES
            (${cost.date}, ${cost.amountCents}, ${cost.gstIncluded}, ${cost.category},
             ${cost.description}, ${cost.orderId}, ${cost.receiptRef}, ${cost.createdBy})
          RETURNING ${sql.unsafe(COLUMNS)}
        `;
        return rowToCost(rows[0]);
      } catch (error) {
        rethrow(error);
      }
    },
    async remove(id) {
      try {
        const rows = await sql`DELETE FROM trafflabels_costs WHERE id = ${id} RETURNING id`;
        return rows.length > 0;
      } catch (error) {
        rethrow(error);
      }
    },
    async listForOrder(orderId) {
      try {
        const rows = await sql<CostRow[]>`
          SELECT ${sql.unsafe(COLUMNS)} FROM trafflabels_costs
          WHERE order_id = ${orderId} ORDER BY cost_date DESC, id DESC
        `;
        return rows.map(rowToCost);
      } catch (error) {
        rethrow(error);
      }
    },
    async listForMonth(month) {
      const start = `${month}-01`;
      try {
        const rows = await sql<CostRow[]>`
          SELECT ${sql.unsafe(COLUMNS)} FROM trafflabels_costs
          WHERE cost_date >= ${start}::date AND cost_date < (${start}::date + interval '1 month')
          ORDER BY cost_date DESC, id DESC
        `;
        return rows.map(rowToCost);
      } catch (error) {
        rethrow(error);
      }
    },
  };
}

let singleton: CostStore | null | undefined;

export function getCostStore(): CostStore | null {
  if (singleton !== undefined) return singleton;
  const mode = orderStoreMode();
  if (mode === "unconfigured") singleton = null;
  else if (mode === "file") singleton = createFileCostStore(defaultCostFilePath());
  else {
    const sql = getSql();
    singleton = sql ? createPostgresCostStore(sql) : null;
  }
  return singleton;
}
