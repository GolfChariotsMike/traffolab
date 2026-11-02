"use client";

import { useEffect, useState } from "react";
import { CostForm, CostList } from "@/components/admin/cost-form";
import { orderProfit, type Cost } from "@/lib/costs";
import { formatAud } from "@/lib/pricing";

export function OrderCosts({ orderNumber, totalCents }: { orderNumber: number; totalCents: number }) {
  const [costs, setCosts] = useState<Cost[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/costs/?orderNumber=${orderNumber}`)
      .then((r) => r.json())
      .then((data: { ok: boolean; costs?: Cost[]; error?: string }) => {
        if (cancelled) return;
        if (data.ok && data.costs) setCosts(data.costs);
        else setError(data.error ?? "Could not load costs.");
      })
      .catch(() => !cancelled && setError("Could not load costs."));
    return () => {
      cancelled = true;
    };
  }, [orderNumber]);

  const profit = orderProfit({ totalCents }, costs ?? []);
  return (
    <section className="mt-5 border-t border-white/10 pt-4">
      <h3 className="font-heading text-base font-semibold">Costs &amp; profit</h3>
      {error ? <p role="alert" className="mt-2 text-sm text-red-300">{error}</p> : null}
      {costs ? (
        <>
          <dl className="mt-2 grid grid-cols-3 gap-2 font-mono text-sm">
            <div><dt className="text-xs text-white/55">Revenue ex GST</dt><dd>{formatAud(profit.revenueExGstCents)}</dd></div>
            <div><dt className="text-xs text-white/55">Costs ex GST</dt><dd>{formatAud(profit.costsExGstCents)}</dd></div>
            <div><dt className="text-xs text-white/55">Gross profit</dt><dd className={profit.profitCents < 0 ? "text-red-300" : "text-[#3ddc97]"}>{formatAud(profit.profitCents)}</dd></div>
          </dl>
          <div className="mt-3"><CostList costs={costs} onDeleted={(id) => setCosts((c) => (c ?? []).filter((x) => x.id !== id))} /></div>
          <div className="mt-3"><CostForm orderNumber={orderNumber} onAdded={(cost) => setCosts((c) => [cost, ...(c ?? [])])} /></div>
        </>
      ) : !error ? (
        <p className="mt-2 text-sm text-white/60">Loading costs…</p>
      ) : null}
    </section>
  );
}
