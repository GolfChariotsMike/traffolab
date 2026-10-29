import type { OrderStore } from "@/lib/order-store-types";
import {
  customerReminderEmail,
  proofReminderDue,
  proofReminderMessage,
  proofReminderUrl,
} from "@/lib/proof-reminder";
import { platesMatchProof, proofPriceSummary, ProofSchemaError } from "@/lib/proofs";

export type ProofReminderDelivery = "sent" | "failed" | "dev-preview";

export type ProofReminderSend = (
  message: ReturnType<typeof proofReminderMessage> & { to: string }
) => Promise<ProofReminderDelivery>;

export type ProofReminderRunResult = {
  sent: number;
  failed: number;
  skipped: number;
  results: Array<{ orderNumber: number; result: ProofReminderDelivery | "skipped" | "claimed-by-other" }>;
};

/**
 * Claims each due proof before sending. The claim is kept if sending fails,
 * so a retry or an overlapping run cannot email the customer twice.
 */
export async function runProofReminders(input: {
  store: OrderStore;
  now: Date;
  notBefore: Date | null;
  send: ProofReminderSend;
}): Promise<ProofReminderRunResult> {
  const [orders, latest] = await Promise.all([
    input.store.listOrders(),
    input.store.listLatestProofs(),
  ]);
  const byId = new Map(orders.map((order) => [order.id, order]));
  const result: ProofReminderRunResult = { sent: 0, failed: 0, skipped: 0, results: [] };

  for (const proof of latest) {
    let order = byId.get(proof.orderId) ?? null;
    if (!order) order = await input.store.getOrder(proof.orderNumber);
    if (!order) continue;
    const due = proofReminderDue({
      status: proof.status,
      createdAt: proof.createdAt,
      reminderSentAt: proof.reminderSentAt,
      autoReminder: proof.autoReminder,
      isLatest: true,
      platesMatch: platesMatchProof(order.plates, proof),
      now: input.now.getTime(),
      notBefore: input.notBefore ? input.notBefore.getTime() : null,
    });
    if (!due) continue;

    const to = customerReminderEmail(order.customerEmail);
    if (!to) {
      result.skipped += 1;
      result.results.push({ orderNumber: order.orderNumber, result: "skipped" });
      continue;
    }

    const claimed = await input.store.claimProofReminder(proof.id, new Date().toISOString());
    if (!claimed) {
      result.skipped += 1;
      result.results.push({ orderNumber: order.orderNumber, result: "claimed-by-other" });
      continue;
    }

    const message = proofReminderMessage({
      customerName: order.customerName || claimed.customerName,
      orderNumber: order.orderNumber,
      proofUrl: proofReminderUrl(claimed.token),
      totalIncGstCents: proofPriceSummary(claimed.plates, order).totalIncGstCents,
    });
    try {
      const delivery = await input.send({ ...message, to });
      if (delivery === "failed") result.failed += 1;
      else result.sent += 1;
      result.results.push({ orderNumber: order.orderNumber, result: delivery });
    } catch (error) {
      if (error instanceof ProofSchemaError) throw error;
      console.error("[proof-reminder] send failed", order.orderNumber, error);
      result.failed += 1;
      result.results.push({ orderNumber: order.orderNumber, result: "failed" });
    }
  }

  return result;
}
