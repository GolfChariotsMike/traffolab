"use client";

import { useEffect } from "react";
import { shouldClearOrderDraft } from "@/lib/checkout-return";
import { clearOrderDraft } from "@/lib/order-draft";

/** Clears the browser order draft only when Stripe has confirmed payment. */
export function ClearPaidDraft({
  paymentStatus,
}: {
  paymentStatus: string | null;
}) {
  useEffect(() => {
    if (!shouldClearOrderDraft(paymentStatus)) return;
    try {
      clearOrderDraft(localStorage);
    } catch {
      // Ignore private-mode storage failures.
    }
  }, [paymentStatus]);

  return null;
}
