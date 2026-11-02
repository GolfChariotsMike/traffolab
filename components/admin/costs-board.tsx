"use client";

import { useEffect, useState } from "react";
import { CostForm, CostList } from "@/components/admin/cost-form";
import { SPLIT_RULES, costCategoryLabel, type Cost, type MonthSummary } from "@/lib/costs";
import { formatAud } from "@/lib/pricing";

export function CostsBoard({
  initialMonth,
  initialCosts,
  initialSummary,
  storeError,
  signedInEmail,
}: {
  initialMonth: string;
  initialCosts: Cost[];
  initialSummary: MonthSummary | null;
  storeError: string | null;
  signedInEmail?: string;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [costs, setCosts] = useState(initialCosts);
  const [summary, setSummary] = useState(initialSummary);
  const [error, setError] = useState<string | null>(storeError);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (version === 0 && month === initialMonth) return;
    let cancelled = false;
    fetch(`/api/admin/costs/?month=${month}`)
      .then((r) => r.json())
      .then((data: { ok: boolean; costs?: Cost[]; summary?: MonthSummary; error?: string }) => {
        if (cancelled) return;
        if (data.ok && data.costs && data.summary) {
          setCosts(data.costs);
          setSummary(data.summary);
          setError(null);
        } else setError(data.error ?? "Could not load costs.");
      })
      .catch(() => !cancelled && setError("Could not load costs."));
    return () => {
      cancelled = true;
    };
  }, [month, version, initialMonth]);

  const refresh = () => setVersion((v) => v + 1);

  return (
    <div className="min-h-screen text-paper" style={{ backgroundImage: "repeating-linear-gradient(-45deg, #0c0d10 0 14px, #111318 14px 28px)" }}>
      <header className="border-b border-white/10 bg-[#12151a]">
        <div className="h-1 bg-[#fee100]" />
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <p className="font-heading text-lg font-semibold tracking-tight">TraffLabels</p>
          <div className="flex items-center gap-3">
            <a href="/admin/orders/" className="text-sm text-[#fee100] hover:underline">Orders</a>
            <a href="/admin/account-applications/" className="text-sm text-[#fee100] hover:underline">Account applications</a>
            {signedInEmail ? <p className="hidden text-sm text-white/55 sm:block">{signedInEmail}</p> : null}
            <form action="/api/admin/logout/" method="post">
              <button type="submit" className="rounded-full border border-white/25 px-3 py-1 text-sm text-white/90 hover:bg-white/10">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Costs &amp; profit</h1>
          <label className="flex items-center gap-2 text-sm">
            Month
            <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-9 rounded-lg border border-white/15 bg-black px-2" />
          </label>
        </div>
        {error ? <p role="alert" className="border border-red-400/40 bg-red-950/50 px-4 py-3 text-sm">{error}</p> : null}

        {summary ? (
          <section className="border border-white/15 bg-black/50 p-4">
            <dl className="grid grid-cols-2 gap-4 font-mono sm:grid-cols-5">
              <div><dt className="text-xs text-white/55">Revenue ex GST ({summary.orderCount} orders)</dt><dd className="text-lg">{formatAud(summary.revenueExGstCents)}</dd></div>
              <div><dt className="text-xs text-white/55">Order costs ex GST</dt><dd className="text-lg">{formatAud(summary.orderCostsExGstCents)}</dd></div>
              <div><dt className="text-xs text-white/55">General costs ex GST</dt><dd className="text-lg">{formatAud(summary.generalCostsExGstCents)}</dd></div>
              <div><dt className="text-xs text-white/55">Total costs ex GST</dt><dd className="text-lg">{formatAud(summary.totalCostsExGstCents)}</dd></div>
              <div><dt className="text-xs text-white/55">Profit</dt><dd className={`text-lg ${summary.profitCents < 0 ? "text-red-300" : "text-[#3ddc97]"}`}>{formatAud(summary.profitCents)}</dd></div>
            </dl>
            {summary.byCategory.length > 0 ? (
              <p className="mt-3 text-sm text-white/65">
                {summary.byCategory.map((row) => `${costCategoryLabel(row.category)} ${formatAud(row.exGstCents)}`).join(" · ")}
              </p>
            ) : null}
            <p className="mt-3 text-sm text-white/65">
              {SPLIT_RULES ? "Split rules are configured in lib/costs.ts." : "Split rules not set yet."} Revenue counts orders by the Perth month they were placed; costs count by their own date.
            </p>
          </section>
        ) : null}

        <section className="border border-white/15 bg-black/50 p-4">
          <h2 className="font-heading text-lg font-semibold">Add a general cost</h2>
          <p className="mt-1 text-sm text-white/60">Not tied to one order (Traffolyte stock, software, tools). Add order costs from the order on the Orders board.</p>
          <div className="mt-3"><CostForm orderNumber={null} defaultCategory="materials" onAdded={refresh} /></div>
        </section>

        <section className="border border-white/15 bg-black/50 p-4">
          <h2 className="font-heading text-lg font-semibold">All costs this month ({costs.length})</h2>
          <div className="mt-2"><CostList costs={costs} onDeleted={refresh} /></div>
        </section>
      </div>
    </div>
  );
}
