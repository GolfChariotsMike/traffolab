import type { SavedOrder } from "@/lib/orders";
import {
  cutFileDownloadHold,
  proofSummary,
  ProofSchemaError,
  type ProofRecord,
} from "@/lib/proofs";

/**
 * Null when LightBurn and nested-sheet files may be downloaded.
 * A proof that is pending, has changes requested, or no longer matches the
 * plates returns the hold message. No proof at all does not hold the files.
 * A missing proofs table is treated as no proof so checkout orders keep downloading.
 */
export async function cutFileHoldForOrder(
  store: { getLatestProof(orderId: string): Promise<ProofRecord | null> },
  order: SavedOrder
) {
  let latest: ProofRecord | null = null;
  try {
    latest = await store.getLatestProof(order.id);
  } catch (error) {
    if (!(error instanceof ProofSchemaError)) throw error;
  }
  return cutFileDownloadHold(proofSummary(order, latest));
}
