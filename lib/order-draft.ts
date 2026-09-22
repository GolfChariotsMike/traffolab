/**
 * Browser order draft: plate lines, shipping choice, and checkout email.
 * Cancelled Checkout must leave these keys in place. Clear them only after
 * Stripe reports the session as paid.
 */

import { shouldClearOrderDraft } from "@/lib/checkout-return";
import { ORDER_STORAGE_KEY } from "@/lib/label-design";
import { SHIPPING_STORAGE_KEY } from "@/lib/pricing";

export const CHECKOUT_EMAIL_STORAGE_KEY = "trafflabels.checkout-email.v1";

export type DraftStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function readCheckoutEmail(storage: DraftStorage): string {
  const value = storage.getItem(CHECKOUT_EMAIL_STORAGE_KEY) ?? "";
  const trimmed = value.trim();
  return trimmed.length > 200 ? trimmed.slice(0, 200) : trimmed;
}

export function writeCheckoutEmail(storage: DraftStorage, email: string) {
  storage.setItem(CHECKOUT_EMAIL_STORAGE_KEY, email.trim().slice(0, 200));
}

/** Remove plate lines, shipping, and checkout email. Leaves the designer canvas. */
export function clearOrderDraft(storage: DraftStorage) {
  storage.removeItem(ORDER_STORAGE_KEY);
  storage.removeItem(SHIPPING_STORAGE_KEY);
  storage.removeItem(CHECKOUT_EMAIL_STORAGE_KEY);
}

/**
 * Apply a Checkout return to the stored draft.
 * Cancel / unpaid does not clear. Paid does.
 */
export function applyCheckoutOutcome(
  storage: DraftStorage,
  paymentStatus: string | null | undefined
) {
  if (shouldClearOrderDraft(paymentStatus)) {
    clearOrderDraft(storage);
  }
}
