"use client";

import { useState } from "react";
import {
  COST_CATEGORIES,
  costCategoryLabel,
  costExGstCents,
  perthToday,
  type Cost,
  type CostCategory,
} from "@/lib/costs";
import { formatAud } from "@/lib/pricing";

/** Add-a-cost form. orderNumber set = an order cost, null = general cost. */
export function CostForm({
  orderNumber,
  onAdded,
  defaultCategory = "postage",
}: {
  orderNumber: number | null;
  onAdded: (cost: Cost) => void;
  defaultCategory?: CostCategory;
}) {
  const [date, setDate] = useState(() => perthToday());
  const [amount, setAmount] = useState("");
  const [gstIncluded, setGstIncluded] = useState(true);
  const [category, setCategory] = useState<CostCategory>(defaultCategory);
  const [description, setDescription] = useState("");
  const [receiptRef, setReceiptRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/costs/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date, amount, gstIncluded, category, description, receiptRef, orderNumber }),
      });
      const data = (await response.json()) as { ok: boolean; cost?: Cost; error?: string };
      if (!data.ok || !data.cost) throw new Error(data.error ?? "Could not save the cost.");
      onAdded(data.cost);
      setAmount("");
      setDescription("");
      setReceiptRef("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the cost.");
    } finally {
      setSaving(false);
    }
  }

  const field = "h-9 rounded-lg border border-white/15 bg-black px-2 text-sm";
  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
      <input aria-label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} required />
      <input aria-label="Amount (AUD)" inputMode="decimal" placeholder="$ 0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className={field} required />
      <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value as CostCategory)} className={field}>
        {COST_CATEGORIES.map((item) => (
          <option key={item.id} value={item.id}>{item.label}</option>
        ))}
      </select>
      <input aria-label="Description" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className={`${field} sm:col-span-3`} />
      <input aria-label="Receipt link or file" placeholder="Receipt link / file ref (optional)" value={receiptRef} onChange={(e) => setReceiptRef(e.target.value)} className={`${field} col-span-2 sm:col-span-3`} />
      <label className="flex items-center gap-2 text-sm text-white/80 sm:col-span-2">
        <input type="checkbox" checked={gstIncluded} onChange={(e) => setGstIncluded(e.target.checked)} />
        Amount includes GST
      </label>
      <button type="submit" disabled={saving} className="h-9 rounded-full bg-[#fee100] px-4 text-sm font-medium text-[#12151a] disabled:opacity-50">
        {saving ? "Adding…" : "Add cost"}
      </button>
      {error ? <p role="alert" className="col-span-full text-sm text-red-300">{error}</p> : null}
    </form>
  );
}

export function CostList({ costs, onDeleted }: { costs: Cost[]; onDeleted: (id: number) => void }) {
  const [error, setError] = useState<string | null>(null);
  async function remove(cost: Cost) {
    if (!window.confirm(`Delete this ${cost.description || "cost"}?`)) return;
    setError(null);
    const response = await fetch(`/api/admin/costs/${cost.id}/`, { method: "DELETE" });
    const data = (await response.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string };
    if (data.ok) onDeleted(cost.id);
    else setError(data.error ?? "Could not delete the cost.");
  }
  return <CostRows costs={costs} onRemove={remove} error={error} />;
}

function CostRows({ costs, onRemove, error }: { costs: Cost[]; onRemove: (cost: Cost) => void; error: string | null }) {
  if (costs.length === 0) return <p className="text-sm text-white/60">No costs recorded.</p>;
  return (
    <>
      <ul className="divide-y divide-white/10 text-sm">
        {costs.map((cost) => (
          <li key={cost.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="text-white/60">{cost.date}</span>
            <span className="min-w-0 flex-1">
              {costCategoryLabel(cost.category)}
              {cost.description ? ` · ${cost.description}` : ""}
              {cost.receiptRef ? (
                /^https?:\/\//.test(cost.receiptRef) ? (
                  <a href={cost.receiptRef} target="_blank" rel="noreferrer" className="ml-2 text-[#fee100] hover:underline">receipt</a>
                ) : (
                  <span className="ml-2 text-white/50">({cost.receiptRef})</span>
                )
              ) : null}
            </span>
            <span className="font-mono">
              {formatAud(cost.amountCents)}
              <span className="ml-1 text-xs text-white/50">
                {cost.gstIncluded ? `inc GST (${formatAud(costExGstCents(cost))} ex)` : "no GST"}
              </span>
            </span>
            <button type="button" onClick={() => onRemove(cost)} className="text-xs text-red-300 hover:underline">
              Delete
            </button>
          </li>
        ))}
      </ul>
      {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
    </>
  );
}
