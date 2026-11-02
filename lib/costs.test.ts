import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createFileCostStore } from "./cost-file";
import {
  CostValidationError,
  SPLIT_RULES,
  costExGstCents,
  monthSummary,
  orderProfit,
  parseAmountToCents,
  parseNewCost,
  perthMonthOf,
  splitProfit,
  type Cost,
} from "./costs";

assert.equal(parseAmountToCents("7.20"), 720);
assert.equal(parseAmountToCents("$1,234.5"), 123450);
assert.equal(parseAmountToCents("0"), null);
assert.equal(parseAmountToCents("-3"), null);
assert.equal(parseAmountToCents("abc"), null);

assert.equal(costExGstCents({ amountCents: 720, gstIncluded: true }), 655);
assert.equal(costExGstCents({ amountCents: 720, gstIncluded: false }), 720);

assert.throws(() => parseNewCost({ amount: "x", category: "postage", date: "2026-11-02" }, null, "a"), CostValidationError);
assert.throws(() => parseNewCost({ amount: "1", category: "beer", date: "2026-11-02" }, null, "a"), CostValidationError);
assert.throws(() => parseNewCost({ amount: "1", category: "postage", date: "2026-02-30" }, null, "a"), CostValidationError);
const parsed = parseNewCost({ amount: "7.20", category: "postage", date: "2026-11-02", description: " post " }, "o1", "mike@x");
assert.deepEqual(parsed, {
  date: "2026-11-02", amountCents: 720, gstIncluded: true, category: "postage",
  description: "post", orderId: "o1", receiptRef: "", createdBy: "mike@x",
});

// Perth month boundary: 31 Oct 17:00 UTC is 1 Nov 01:00 Perth.
assert.equal(perthMonthOf("2026-10-31T17:00:00Z"), "2026-11");
assert.equal(perthMonthOf("2026-10-31T15:00:00Z"), "2026-10");

const base = { gstIncluded: false, description: "", receiptRef: "", createdBy: "", createdAt: "" };
const costs: Cost[] = [
  { ...base, id: 1, date: "2026-11-02", amountCents: 720, gstIncluded: true, category: "postage", orderId: "o1" },
  { ...base, id: 2, date: "2026-11-05", amountCents: 5000, category: "materials", orderId: null },
  { ...base, id: 3, date: "2026-10-30", amountCents: 999, category: "other", orderId: null },
];
assert.deepEqual(orderProfit({ totalCents: 8400 }, [costs[0]]), {
  revenueExGstCents: 8400, costsExGstCents: 655, profitCents: 7745,
});
const summary = monthSummary(
  "2026-11",
  [
    { createdAt: "2026-11-01T02:00:00Z", totalCents: 8400 },
    { createdAt: "2026-10-20T02:00:00Z", totalCents: 100000 },
  ],
  costs
);
assert.equal(summary.orderCount, 1);
assert.equal(summary.revenueExGstCents, 8400);
assert.equal(summary.orderCostsExGstCents, 655);
assert.equal(summary.generalCostsExGstCents, 5000);
assert.equal(summary.profitCents, 8400 - 5655);
assert.deepEqual(summary.byCategory.map((r) => r.category), ["postage", "materials"]);

// Split is not decided: no rules shipped, but the maths is configurable.
assert.equal(SPLIT_RULES, null);
const split = splitProfit(10000, { leanne: 2 }, { labourRateCents: 1000, profitSharePercent: { leanne: 40, mike: 60 } });
assert.deepEqual(split, { labour: { leanne: 2000 }, remainingCents: 8000, share: { leanne: 3200, mike: 4800 } });

const dir = await mkdtemp(path.join(tmpdir(), "costs-"));
const store = createFileCostStore(path.join(dir, "costs.json"));
const a = await store.insert(parsed);
const b = await store.insert({ ...parsed, orderId: null, date: "2026-12-01" });
assert.equal(a.id, 1);
assert.equal(b.id, 2);
assert.equal((await store.listForOrder("o1")).length, 1);
assert.equal((await store.listForMonth("2026-11")).length, 1);
assert.equal(await store.remove(1), true);
assert.equal(await store.remove(1), false);
assert.equal((await store.listForOrder("o1")).length, 0);

console.log("costs tests passed");
