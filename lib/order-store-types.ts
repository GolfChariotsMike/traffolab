import type { CheckoutDraft, NewPaidOrder, OrderPatch, SavedOrder } from "@/lib/orders";
import type { ProofDecisionInput, ProofDecisionResult, ProofRecord } from "@/lib/proofs";

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
  createProof(orderNumber: number, input: { invoiceUrl: string }): Promise<ProofRecord | null>;
  openProof(token: string): Promise<{ proof: ProofRecord; order: SavedOrder } | null>;
  listLatestProofs(): Promise<ProofRecord[]>;
  getLatestProof(orderId: string): Promise<ProofRecord | null>;
  decideProof(token: string, decision: ProofDecisionInput): Promise<ProofDecisionResult>;
  /**
   * Sets reminder_sent_at once, and only while the proof is still pending.
   * A second call returns null so overlapping cron runs cannot both send.
   */
  claimProofReminder(proofId: string, sentAt: string): Promise<ProofRecord | null>;
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
