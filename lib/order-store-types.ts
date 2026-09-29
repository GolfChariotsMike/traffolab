import type { CheckoutDraft, NewPaidOrder, OrderPatch, SavedOrder } from "@/lib/orders";

export type OrderStore = {
  saveDraft(draft: CheckoutDraft): Promise<void>;
  attachDraftSession(draftId: string, sessionId: string): Promise<void>;
  getDraft(draftId: string): Promise<CheckoutDraft | null>;
  /**
   * Insert a paid order. A second call with the same Stripe session id
   * returns the existing row and does not reset status.
   * A later receipt URL is filled in when the first insert had none.
   */
  insertPaidOrder(order: NewPaidOrder): Promise<SavedOrder>;
  findBySessionId(sessionId: string): Promise<SavedOrder | null>;
  listOrders(): Promise<SavedOrder[]>;
  getOrder(orderNumber: number): Promise<SavedOrder | null>;
  updateOrder(orderNumber: number, patch: OrderPatch): Promise<SavedOrder | null>;
};

export function databaseUrl() {
  return process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim() || "";
}

/**
 * Postgres when DATABASE_URL or POSTGRES_URL is set.
 * A JSON file when ORDER_STORE=file, or in local development.
 * Production without a database URL is unconfigured so Checkout refuses to charge.
 */
export function orderStoreMode(): "postgres" | "file" | "unconfigured" {
  if (databaseUrl()) return "postgres";
  if (process.env.ORDER_STORE === "file" || process.env.NODE_ENV !== "production") {
    return "file";
  }
  return "unconfigured";
}
