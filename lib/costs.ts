/** Cost tracking: pure types, validation and profit maths (no server imports). */

export const COST_CATEGORIES = [
  { id: "postage", label: "Postage" },
  { id: "materials", label: "Materials / Traffolyte" },
  { id: "stripe_fees", label: "Stripe fees" },
  { id: "tools", label: "Tools / consumables" },
  { id: "software", label: "Software" },
  { id: "other", label: "Other" },
] as const;

export type CostCategory = (typeof COST_CATEGORIES)[number]["id"];

export function isCostCategory(value: unknown): value is CostCategory {
  return COST_CATEGORIES.some((item) => item.id === value);
}

export function costCategoryLabel(id: string) {
  return COST_CATEGORIES.find((item) => item.id === id)?.label ?? id;
}

export type Cost = {
  id: number;
  /** YYYY-MM-DD, Perth calendar date. */
  date: string;
  amountCents: number;
  gstIncluded: boolean;
  category: CostCategory;
  description: string;
  orderId: string | null;
  receiptRef: string;
  createdBy: string;
  createdAt: string;
};

export type NewCost = Omit<Cost, "id" | "createdAt">;

export class CostSchemaError extends Error {
  constructor() {
    super(
      "The trafflabels_costs table is missing. Apply db/migrations/20261102_trafflabels_costs.sql."
    );
  }
}

export class CostValidationError extends Error {}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** "7.20", "$7.20", "7" -> cents. Null when not a positive amount. */
export function parseAmountToCents(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    return Math.round(value * 100);
  }
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  return cents > 0 ? cents : null;
}

export function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isValidMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH_RE.test(value);
}

/** Today's Perth date as YYYY-MM-DD. */
export function perthToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Perth",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function perthMonth(now = new Date()) {
  return perthToday(now).slice(0, 7);
}

/** Perth month (YYYY-MM) an ISO timestamp falls in. */
export function perthMonthOf(iso: string) {
  return perthToday(new Date(iso)).slice(0, 7);
}

/** Validate an admin's add-cost body. orderId is resolved by the caller. */
export function parseNewCost(
  body: Record<string, unknown>,
  orderId: string | null,
  createdBy: string
): NewCost {
  const amountCents = parseAmountToCents(body.amount);
  if (amountCents == null || amountCents > 100_000_000) {
    throw new CostValidationError("Enter an amount in dollars, like 7.20.");
  }
  if (!isCostCategory(body.category)) throw new CostValidationError("Choose a category.");
  const date = body.date ?? "";
  if (!isValidDate(date)) throw new CostValidationError("Enter a valid date.");
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (description.length > 500) throw new CostValidationError("Description is too long.");
  const receiptRef = typeof body.receiptRef === "string" ? body.receiptRef.trim() : "";
  if (receiptRef.length > 1000) throw new CostValidationError("Receipt link is too long.");
  return {
    date,
    amountCents,
    gstIncluded: body.gstIncluded !== false,
    category: body.category,
    description,
    orderId,
    receiptRef,
    createdBy,
  };
}

/** Ex-GST cost. A GST-inclusive amount has 1/11 removed (claimable as a credit). */
export function costExGstCents(cost: Pick<Cost, "amountCents" | "gstIncluded">) {
  return cost.gstIncluded ? Math.round((cost.amountCents * 10) / 11) : cost.amountCents;
}

export function sumCostsExGst(costs: Pick<Cost, "amountCents" | "gstIncluded">[]) {
  return costs.reduce((total, cost) => total + costExGstCents(cost), 0);
}

/**
 * Order revenue ex GST. Orders store GST-exclusive cents (plates + shipping);
 * GST is added on top at proof / invoice time, so totalCents is already ex GST.
 */
export function orderRevenueExGstCents(order: { totalCents: number }) {
  return order.totalCents;
}

export type OrderProfit = { revenueExGstCents: number; costsExGstCents: number; profitCents: number };

export function orderProfit(order: { totalCents: number }, costs: Cost[]): OrderProfit {
  const revenueExGstCents = orderRevenueExGstCents(order);
  const costsExGstCents = sumCostsExGst(costs);
  return { revenueExGstCents, costsExGstCents, profitCents: revenueExGstCents - costsExGstCents };
}

export type MonthSummary = {
  month: string;
  orderCount: number;
  revenueExGstCents: number;
  orderCostsExGstCents: number;
  generalCostsExGstCents: number;
  totalCostsExGstCents: number;
  profitCents: number;
  byCategory: { category: CostCategory; exGstCents: number }[];
};

/**
 * Orders count in the Perth month they were created. Costs count in the month
 * of their own date (so postage paid in December for a November order lands in December).
 */
export function monthSummary(
  month: string,
  orders: { createdAt: string; totalCents: number }[],
  costs: Cost[]
): MonthSummary {
  const monthOrders = orders.filter((order) => perthMonthOf(order.createdAt) === month);
  const monthCosts = costs.filter((cost) => cost.date.slice(0, 7) === month);
  const revenueExGstCents = monthOrders.reduce((t, o) => t + orderRevenueExGstCents(o), 0);
  const orderCostsExGstCents = sumCostsExGst(monthCosts.filter((c) => c.orderId));
  const generalCostsExGstCents = sumCostsExGst(monthCosts.filter((c) => !c.orderId));
  const totalCostsExGstCents = orderCostsExGstCents + generalCostsExGstCents;
  const byCategory = COST_CATEGORIES.map((item) => ({
    category: item.id,
    exGstCents: sumCostsExGst(monthCosts.filter((c) => c.category === item.id)),
  })).filter((row) => row.exGstCents > 0);
  return {
    month,
    orderCount: monthOrders.length,
    revenueExGstCents,
    orderCostsExGstCents,
    generalCostsExGstCents,
    totalCostsExGstCents,
    profitCents: revenueExGstCents - totalCostsExGstCents,
    byCategory,
  };
}

/**
 * Profit split rules. Not agreed yet, so SPLIT_RULES is null and the admin
 * shows "Split rules not set yet". When agreed, set e.g.
 * { labourRateCents: 3500, profitSharePercent: { leanne: 50, mike: 50 } }
 * and log labour hours; splitProfit then does the maths.
 */
export type SplitRules = {
  /** Paid per logged production hour before profit is shared. 0 = no labour pay. */
  labourRateCents: number;
  /** Percent of profit after labour, per person. Should add up to 100. */
  profitSharePercent: Record<string, number>;
};

export const SPLIT_RULES: SplitRules | null = null;

export function splitProfit(
  profitCents: number,
  labourHours: Record<string, number>,
  rules: SplitRules
) {
  const labour: Record<string, number> = {};
  let labourTotal = 0;
  for (const [person, hours] of Object.entries(labourHours)) {
    labour[person] = Math.round(hours * rules.labourRateCents);
    labourTotal += labour[person];
  }
  const remaining = profitCents - labourTotal;
  const share: Record<string, number> = {};
  for (const [person, percent] of Object.entries(rules.profitSharePercent)) {
    share[person] = Math.round((remaining * percent) / 100);
  }
  return { labour, remainingCents: remaining, share };
}
