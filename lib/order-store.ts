import "server-only";
import postgres, { type Sql } from "postgres";
import { applyOrderPatch, OrderUpdateError, type CheckoutDraft, type NewPaidOrder, type OrderPatch, type SavedOrder, type ShippingAddress, isOrderStatus } from "@/lib/orders";
import {
  approvalStatement,
  newProofToken,
  platesApprovalHash,
  platesMatchProof,
  proofPriceSummary,
  ProofSchemaError,
  type ProofDecisionInput,
  type ProofRecord,
  type ProofStatus,
} from "@/lib/proofs";
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
  uniform_text_size?: boolean | null;
  uniform_text_mm?: number | string | null;
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
    ...uniformFieldsFrom(row),
  };
}

function uniformFieldsFrom(row: OrderRow): { uniformTextSize: boolean; uniformTextMm?: number } {
  const plates = platesOf(row.plates);
  const fromPlate = plates.find((plate) => typeof plate.uniformTextMm === "number")?.uniformTextMm;
  const fromColumn = mmOrUndefined(row.uniform_text_mm);
  const uniformTextMm = fromPlate ?? fromColumn;
  if (uniformTextMm != null) return { uniformTextSize: false, uniformTextMm };
  return {
    uniformTextSize:
      row.uniform_text_size === true || plates.some((plate) => plate.uniformTextSize === true),
  };
}

function mmOrUndefined(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
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
  const saved = rowToOrder(rows[0]);
  await rememberUniformTextSize(sql, saved.id, saved.uniformTextSize === true, saved.uniformTextMm);
  return saved;
}

async function rememberUniformTextSize(
  sql: Sql | postgres.TransactionSql,
  orderId: string,
  enabled: boolean,
  fontMm?: number
) {
  const write = async (query: Sql | postgres.TransactionSql) => {
    await query`
      UPDATE trafflabels_orders
      SET uniform_text_size = ${enabled},
          uniform_text_mm = ${fontMm ?? null}
      WHERE id = ${orderId}
    `;
  };
  if ("savepoint" in sql) {
    try {
      await sql.savepoint(async (sp) => {
        await write(sp);
      });
    } catch (error) {
      if (!isUndefinedColumn(error)) throw error;
    }
    return;
  }
  try {
    await write(sql);
  } catch (error) {
    if (!isUndefinedColumn(error)) throw error;
  }
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
      return sql.begin(async (tx) => {
          const existing = await tx<OrderRow[]>`
            SELECT * FROM trafflabels_orders WHERE order_number = ${orderNumber}
          `;
          if (!existing[0]) return null;
          const current = rowToOrder(existing[0]);
          if (patch.plateLocations && patch.plateLocations.length !== current.plates.length) {
            throw new OrderUpdateError(
              "Location list does not match the plates on this order."
            );
          }
          const beforeHash = platesApprovalHash(current.plates);
          const next = applyOrderPatch(current, patch);
          const rows = await tx<OrderRow[]>`
            UPDATE trafflabels_orders SET
              status = ${next.status},
              note = ${next.note},
              tracking_link = ${next.trackingLink},
              plates = ${tx.json(next.plates)},
              updated_at = ${next.updatedAt}
            WHERE order_number = ${orderNumber}
            RETURNING *
          `;
          await rememberUniformTextSize(tx, next.id, next.uniformTextSize === true, next.uniformTextMm);
          if (platesApprovalHash(next.plates) !== beforeHash) {
            try {
              await tx`
                UPDATE trafflabels_proofs
                SET status = 'superseded'
                WHERE order_id = ${next.id} AND status <> 'superseded'
              `;
            } catch (error) {
              if (!isMissingRelation(error)) throw error;
            }
          }
          return rows[0] ? rowToOrder(rows[0]) : null;
        });
    },
    async createProof(orderNumber, input) {
      await ensureSchema(sql);
      try {
        return await sql.begin(async (tx) => {
          const existing = await tx<OrderRow[]>`
            SELECT * FROM trafflabels_orders WHERE order_number = ${orderNumber}
          `;
          if (!existing[0]) return null;
          const order = rowToOrder(existing[0]);
          await tx`
            UPDATE trafflabels_proofs
            SET status = 'superseded'
            WHERE order_id = ${order.id} AND status <> 'superseded'
          `;
          const plates = order.plates;
          const token = newProofToken();
          const createdAt = new Date().toISOString();
          const record: ProofRecord = {
            id: crypto.randomUUID(),
            orderId: order.id,
            orderNumber: order.orderNumber,
            token,
            createdAt,
            status: "pending",
            plates,
            platesHash: platesApprovalHash(plates),
            customerName: order.customerName,
            shipping: order.shipping,
            invoiceUrl: input.invoiceUrl,
            approvedName: "",
            approvedAt: null,
            approvedIp: "",
            approvedUserAgent: "",
            approvalStatement: "",
            approvedTotalCents: null,
            changeComment: "",
            changeRequestedAt: null,
            changeIp: "",
            changeUserAgent: "",
          };
          const rows = await tx<ProofRow[]>`
            INSERT INTO trafflabels_proofs (
              id, order_id, order_number, token, created_at, status,
              plates_snapshot, plates_hash, customer_name, shipping, invoice_url
            ) VALUES (
              ${record.id},
              ${record.orderId},
              ${record.orderNumber},
              ${record.token},
              ${record.createdAt},
              ${record.status},
              ${tx.json(record.plates)},
              ${record.platesHash},
              ${record.customerName},
              ${tx.json(record.shipping)},
              ${record.invoiceUrl}
            )
            RETURNING *
          `;
          return rows[0] ? proofFromRow(rows[0]) : null;
        });
      } catch (error) {
        rethrowProof(error);
      }
    },
    async openProof(token) {
      await ensureSchema(sql);
      try {
        return await sql.begin(async (tx) => {
          const proofs = await tx<ProofRow[]>`
            SELECT * FROM trafflabels_proofs WHERE token = ${token} FOR UPDATE
          `;
          if (!proofs[0]) return null;
          const orders = await tx<OrderRow[]>`
            SELECT * FROM trafflabels_orders WHERE id = ${proofs[0].order_id}
          `;
          if (!orders[0]) return null;
          let proof = proofFromRow(proofs[0]);
          const order = rowToOrder(orders[0]);
          if (proof.status !== "superseded" && !platesMatchProof(order.plates, proof)) {
            const updated = await tx<ProofRow[]>`
              UPDATE trafflabels_proofs
              SET status = 'superseded'
              WHERE id = ${proof.id}
              RETURNING *
            `;
            if (updated[0]) proof = proofFromRow(updated[0]);
          }
          return { proof, order };
        });
      } catch (error) {
        rethrowProof(error);
      }
    },
    async listLatestProofs() {
      await ensureSchema(sql);
      try {
        const rows = await sql<ProofRow[]>`
          SELECT DISTINCT ON (order_id) *
          FROM trafflabels_proofs
          ORDER BY order_id, created_at DESC, id DESC
        `;
        return rows.map(proofFromRow);
      } catch (error) {
        rethrowProof(error);
      }
    },
    async getLatestProof(orderId) {
      await ensureSchema(sql);
      try {
        const rows = await sql<ProofRow[]>`
          SELECT * FROM trafflabels_proofs
          WHERE order_id = ${orderId}
          ORDER BY created_at DESC, id DESC
          LIMIT 1
        `;
        return rows[0] ? proofFromRow(rows[0]) : null;
      } catch (error) {
        rethrowProof(error);
      }
    },
    async decideProof(token, decision: ProofDecisionInput) {
      await ensureSchema(sql);
      try {
        return await sql.begin(async (tx) => {
          const proofs = await tx<ProofRow[]>`
            SELECT * FROM trafflabels_proofs WHERE token = ${token} FOR UPDATE
          `;
          if (!proofs[0]) return { ok: false as const, code: "not_found" as const };
          const orders = await tx<OrderRow[]>`
            SELECT * FROM trafflabels_orders WHERE id = ${proofs[0].order_id}
          `;
          if (!orders[0]) return { ok: false as const, code: "not_found" as const };
          const proof = proofFromRow(proofs[0]);
          const order = rowToOrder(orders[0]);
          if (!platesMatchProof(order.plates, proof)) {
            await tx`
              UPDATE trafflabels_proofs SET status = 'superseded' WHERE id = ${proof.id}
            `;
            return { ok: false as const, code: "superseded" as const };
          }
          if (proof.status === "superseded") {
            return { ok: false as const, code: "superseded" as const };
          }
          if (decision.action === "approve") {
            if (proof.status === "approved") {
              return { ok: true as const, proof, changed: false };
            }
            if (proof.status !== "pending") {
              return { ok: false as const, code: "closed" as const };
            }
            const approvedAt = new Date().toISOString();
            const price = proofPriceSummary(proof.plates, order);
            const statement = approvalStatement(price.totalIncGstCents);
            const rows = await approveProofRow(tx, {
              id: proof.id,
              approvedAt,
              name: decision.name,
              ip: decision.ip,
              userAgent: decision.userAgent,
              statement,
              totalIncGstCents: price.totalIncGstCents,
            });
            if (!rows[0]) return { ok: false as const, code: "closed" as const };
            return { ok: true as const, proof: proofFromRow(rows[0]), changed: true };
          }
          if (proof.status !== "pending") {
            return { ok: false as const, code: "closed" as const };
          }
          const changeRequestedAt = new Date().toISOString();
          const rows = await tx<ProofRow[]>`
            UPDATE trafflabels_proofs SET
              status = 'changes_requested',
              change_comment = ${decision.comment},
              change_requested_at = ${changeRequestedAt},
              change_ip = ${decision.ip},
              change_user_agent = ${decision.userAgent}
            WHERE id = ${proof.id} AND status = 'pending'
            RETURNING *
          `;
          if (!rows[0]) return { ok: false as const, code: "closed" as const };
          return { ok: true as const, proof: proofFromRow(rows[0]), changed: true };
        });
      } catch (error) {
        rethrowProof(error);
      }
    },
  };
}

type ProofRow = {
  id: string;
  order_id: string;
  order_number: number;
  token: string;
  created_at: Date | string;
  status: string;
  plates_snapshot: StoredPlateJson;
  plates_hash: string;
  customer_name: string;
  shipping: ShippingAddress | string;
  invoice_url: string;
  approved_name: string;
  approved_at: Date | string | null;
  approved_ip: string;
  approved_user_agent: string;
  approval_statement: string;
  approved_total_cents?: number | string | null;
  change_comment: string;
  change_requested_at: Date | string | null;
  change_ip: string;
  change_user_agent: string;
};

type StoredPlateJson = SavedOrder["plates"] | string;

function jsonValue<T>(value: T | string): T {
  return typeof value === "string" ? (JSON.parse(value) as T) : value;
}

function isProofStatus(value: string): value is ProofStatus {
  return (
    value === "pending" ||
    value === "approved" ||
    value === "changes_requested" ||
    value === "superseded"
  );
}

function proofFromRow(row: ProofRow): ProofRecord {
  return {
    id: row.id,
    orderId: row.order_id,
    orderNumber: Number(row.order_number),
    token: row.token,
    createdAt: iso(row.created_at),
    status: isProofStatus(row.status) ? row.status : "pending",
    plates: jsonValue<SavedOrder["plates"]>(row.plates_snapshot),
    platesHash: row.plates_hash,
    customerName: row.customer_name,
    shipping: jsonValue<ShippingAddress>(row.shipping),
    invoiceUrl: row.invoice_url,
    approvedName: row.approved_name,
    approvedAt: row.approved_at ? iso(row.approved_at) : null,
    approvedIp: row.approved_ip,
    approvedUserAgent: row.approved_user_agent,
    approvalStatement: row.approval_statement ?? "",
    approvedTotalCents: wholeCentsOrNull(row.approved_total_cents),
    changeComment: row.change_comment,
    changeRequestedAt: row.change_requested_at ? iso(row.change_requested_at) : null,
    changeIp: row.change_ip,
    changeUserAgent: row.change_user_agent,
  };
}

function wholeCentsOrNull(value: unknown): number | null {
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && Number.isSafeInteger(value)) {
    return value;
  }
  return null;
}

async function approveProofRow(
  tx: postgres.TransactionSql,
  input: {
    id: string;
    approvedAt: string;
    name: string;
    ip: string;
    userAgent: string;
    statement: string;
    totalIncGstCents: number;
  }
) {
  const withoutTotal = () => tx<ProofRow[]>`
    UPDATE trafflabels_proofs SET
      status = 'approved',
      approved_name = ${input.name},
      approved_at = ${input.approvedAt},
      approved_ip = ${input.ip},
      approved_user_agent = ${input.userAgent},
      approval_statement = ${input.statement}
    WHERE id = ${input.id} AND status = 'pending'
    RETURNING *
  `;
  try {
    return await tx.savepoint((sp) => {
      return sp<ProofRow[]>`
        UPDATE trafflabels_proofs SET
          status = 'approved',
          approved_name = ${input.name},
          approved_at = ${input.approvedAt},
          approved_ip = ${input.ip},
          approved_user_agent = ${input.userAgent},
          approval_statement = ${input.statement},
          approved_total_cents = ${input.totalIncGstCents}
        WHERE id = ${input.id} AND status = 'pending'
        RETURNING *
      `;
    });
  } catch (error) {
    if (!isUndefinedColumn(error)) throw error;
    return withoutTotal();
  }
}

function isUndefinedColumn(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "42703"
  );
}

function isMissingRelation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "42P01"
  );
}

function rethrowProof(error: unknown): never {
  if (isMissingRelation(error)) throw new ProofSchemaError();
  throw error;
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
