import { applyOrderPatch, type OrderPatch, type SavedOrder } from "@/lib/orders";
import {
  platesApprovalHash,
  PROOF_PLATE_LOCK_MESSAGE,
  proofBlocksPlateEdits,
  proofSummary,
  type ProofRecord,
} from "@/lib/proofs";

/** True when the patch would change what is cut or what the proof hash covers. */
export function orderPatchChangesPlates(order: SavedOrder, patch: OrderPatch) {
  const next = applyOrderPatch(order, patch, new Date(order.updatedAt));
  return platesApprovalHash(next.plates) !== platesApprovalHash(order.plates);
}

/**
 * A live proof blocks plate, text, size, colour, location, and adhesive edits.
 * Status, notes, tracking, and invoice copies are not plate edits.
 * Returns the message for the client, or null when the save may proceed.
 */
export function plateEditLockError(
  order: SavedOrder,
  proof: ProofRecord | null,
  patch: OrderPatch
): string | null {
  if (!proofBlocksPlateEdits(proofSummary(order, proof))) return null;
  if (!orderPatchChangesPlates(order, patch)) return null;
  return PROOF_PLATE_LOCK_MESSAGE;
}

/** Creating another link supersedes the proof the customer already has. */
export function proofReplacementLockError(
  order: SavedOrder,
  proof: ProofRecord | null
): string | null {
  if (!proofBlocksPlateEdits(proofSummary(order, proof))) return null;
  return PROOF_PLATE_LOCK_MESSAGE;
}
