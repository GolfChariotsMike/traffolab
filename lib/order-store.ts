import "server-only";
import postgres, { type Sql } from "postgres";
import { applyOrderPatch, type CheckoutDraft, type NewPaidOrder, type OrderPatch, type SavedOrder, type ShippingAddress, isOrderStatus } from "@/lib/orders";
import { ORDER_SCHEMA_SQL } from "@/lib/order-schema";
import { databaseUrl, orderStoreMode, type OrderStore } from "@/lib/order-store-types";
import { createFileOrderStore, defaultOrderFilePath } from "@/lib/order-store-file";

type GlobalSql = { trafflabelsSql?: Sql };
const globalForSql = globalThis as typeof globalThis & GlobalSql;

let schemaReady: Promise<void> | null = null;

function shouldUseSsl(url: string) {
  return !/localhost|127\.0\.0\.1/.test(url);
}

export function getSql(): Sql | null {
  const url = databaseUrl();
  if (!url) return null;
  if (!globalForSql.trafflabelsSql) {
    globalForSql.trafflabelsSql = postgres(url, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 15,
      prepare: false,
      ssl: shouldUseSsl(url) ? "require" : false,
    });
  }
  return globalForSql.trafflabelsSql;
}

async function ensureSchema(sql: Sql) {
  if (!schemaReady) {
    schemaReady = sql.unsafe(ORDER_SCHEMA_SQL).then(() => undefined);
  }
  await schemaReady;
}

type OrderRow = {
  id: string;
  order_number: number;
  created_at: Date | string;
  updated_at: Date | string;
  status: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_name: string;
  shipping_line1: string;
  shipping_line2: string;
  shipping_city: string;
  shipping_state: string;
  shipping_postal_code: string;
  shipping_country: string;
  shipping_method: string;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  stripe_session_id: string;
  stripe_payment_intent_id: string | null;
  stripe_receipt_url: string | null;
  stripe_livemode: boolean;
  payment_source?: string | null;
  note: string;
  tracking_link: string;
  plates: SavedOrder["plates"] | string;
};

function iso(value: Date | string) {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function platesOf(value: OrderRow["plates"]): SavedOrder["plates"] {
  if (typeof value === "string") return JSON.parse(value) as SavedOrder["plates"];
  return value;
}

function rowToOrder(row: OrderRow): SavedOrder {
  const shipping: ShippingAddress = {
    name: row.shipping_name,
    line1: row.shipping_line1,
    line2: row.shipping_line2,
    city: row.shipping_city,
    state: row.shipping_state,
    postalCode: row.shipping_postal_code,
    country: row.shipping_country,
  };
  return {
    id: row.id,
    orderNumber: Number(row.order_number),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    status: isOrderStatus(row.status) ? row.status : "NEW",
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    shipping,
    shippingMethodId: row.shipping_method === "express" ? "express" : "standard",
    subtotalCents: row.subtotal_cents,
    shippingCents: row.shipping_cents,
    totalCents: row.total_cents,
    stripeSessionId: row.stripe_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    stripeReceiptUrl: row.stripe_receipt_url,
    stripeLivemode: row.stripe_livemode,
    paymentSource: row.payment_source === "manual" ? "manual" : "stripe",
    note: row.note,
    trackingLink: row.tracking_link,
    plates: platesOf(row.plates),
  };
}

async function insertOrder(sql: Sql, order: NewPaidOrder): Promise<SavedOrder> {
  const rows = await sql<OrderRow[]>`
    INSERT INTO trafflabels_orders (
      id, created_at, updated_at, status,
      customer_name, customer_email, customer_phone,
      shipping_name, shipping_line1, shipping_line2, shipping_city, shipping_state,
      shipping_postal_code, shipping_country, shipping_method,
      subtotal_cents, shipping_cents, total_cents,
      stripe_session_id, stripe_payment_intent_id, stripe_receipt_url, stripe_livemode,
      note, tracking_link, plates, payment_source
    ) VALUES (
      ${order.id},
      ${order.createdAt},
      ${order.updatedAt},
      ${order.status},
      ${order.customerName},
      ${order.customerEmail},
      ${order.customerPhone},
      ${order.shipping.name},
      ${order.shipping.line1},
      ${order.shipping.line2},
      ${order.shipping.city},
      ${order.shipping.state},
      ${order.shipping.postalCode},
      ${order.shipping.country},
      ${order.shippingMethodId},
      ${order.subtotalCents},
      ${order.shippingCents},
      ${order.totalCents},
      ${order.stripeSessionId},
      ${order.stripePaymentIntentId},
      ${order.stripeReceiptUrl},
      ${order.stripeLivemode},
      ${order.note},
      ${order.trackingLink},
      ${sql.json(order.plates)},
      ${order.paymentSource === "manual" ? "manual" : "stripe"}
    )
    ON CONFLICT (stripe_session_id) DO UPDATE
      SET stripe_receipt_url = COALESCE(trafflabels_orders.stripe_receipt_url, EXCLUDED.stripe_receipt_url),
          stripe_payment_intent_id = COALESCE(trafflabels_orders.stripe_payment_intent_id, EXCLUDED.stripe_payment_intent_id),
          updated_at = CASE
            WHEN trafflabels_orders.stripe_receipt_url IS NULL AND EXCLUDED.stripe_receipt_url IS NOT NULL
              THEN now()
            ELSE trafflabels_orders.updated_at
          END
    RETURNING *
  `;
  return rowToOrder(rows[0]);
}

export function createPostgresOrderStore(sql: Sql): OrderStore {
  return {
    async saveDraft(draft: CheckoutDraft) {
      await ensureSchema(sql);
      await sql`
        INSERT INTO trafflabels_checkout_drafts (id, payload)
        VALUES (${draft.id}, ${sql.json(draft)})
        ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload
      `;
    },
    async attachDraftSession(draftId, sessionId) {
      await ensureSchema(sql);
      await sql`
        UPDATE trafflabels_checkout_drafts
        SET stripe_session_id = ${sessionId}
        WHERE id = ${draftId}
      `;
    },
    async getDraft(draftId) {
      await ensureSchema(sql);
      const rows = await sql<{ payload: CheckoutDraft | string }[]>`
        SELECT payload FROM trafflabels_checkout_drafts WHERE id = ${draftId}
      `;
      const payload = rows[0]?.payload;
      if (!payload) return null;
      return typeof payload === "string" ? (JSON.parse(payload) as CheckoutDraft) : payload;
    },
    async insertPaidOrder(order) {
      await ensureSchema(sql);
      return insertOrder(sql, order);
    },
    async findBySessionId(sessionId) {
      await ensureSchema(sql);
      const rows = await sql<OrderRow[]>`
        SELECT * FROM trafflabels_orders WHERE stripe_session_id = ${sessionId}
      `;
      return rows[0] ? rowToOrder(rows[0]) : null;
    },
    async listOrders() {
      await ensureSchema(sql);
      const rows = await sql<OrderRow[]>`
        SELECT * FROM trafflabels_orders
        ORDER BY created_at DESC, order_number DESC
        LIMIT 500
      `;
      return rows.map(rowToOrder);
    },
    async getOrder(orderNumber) {
      await ensureSchema(sql);
      const rows = await sql<OrderRow[]>`
        SELECT * FROM trafflabels_orders WHERE order_number = ${orderNumber}
      `;
      return rows[0] ? rowToOrder(rows[0]) : null;
    },
    async updateOrder(orderNumber, patch: OrderPatch) {
      await ensureSchema(sql);
      const existing = await sql<OrderRow[]>`
        SELECT * FROM trafflabels_orders WHERE order_number = ${orderNumber}
      `;
      if (!existing[0]) return null;
      const next = applyOrderPatch(rowToOrder(existing[0]), patch);
      const rows = await sql<OrderRow[]>`
        UPDATE trafflabels_orders SET
          status = ${next.status},
          note = ${next.note},
          tracking_link = ${next.trackingLink},
          updated_at = ${next.updatedAt}
        WHERE order_number = ${orderNumber}
        RETURNING *
      `;
      return rows[0] ? rowToOrder(rows[0]) : null;
    },
  };
}

let singleton: OrderStore | null | undefined;

/** Null when this deployment cannot store orders (production without DATABASE_URL). */
export function getOrderStore(): OrderStore | null {
  if (singleton !== undefined) return singleton;
  const mode = orderStoreMode();
  if (mode === "unconfigured") {
    singleton = null;
    return singleton;
  }
  if (mode === "postgres") {
    const sql = getSql();
    singleton = sql ? createPostgresOrderStore(sql) : null;
    return singleton;
  }
  singleton = createFileOrderStore(defaultOrderFilePath());
  return singleton;
}
