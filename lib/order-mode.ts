export const ORDER_MODES = ["chooser", "designer", "upload", "checkout"] as const;

export type OrderMode = (typeof ORDER_MODES)[number];

/** Query `mode` on /order/. Anything else is the chooser, including a missing value. */
export function orderMode(raw: string | undefined): OrderMode {
  if (raw === "designer" || raw === "upload" || raw === "checkout") return raw;
  return "chooser";
}
