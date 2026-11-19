"use client";

import { useEffect, useState } from "react";
import { AdminHeader } from "@/components/admin/admin-header";
import { perthToday } from "@/lib/costs";
import { formatAud } from "@/lib/pricing";
import {
  STOCK_SHEET_HEIGHT_MM,
  STOCK_SHEET_WIDTH_MM,
  formatAreaCm2,
  formatSheetQuantity,
  latestStockCount,
  purchaseExGstCents,
  stockWastage,
  type StockCount,
  type StockPosition,
  type StockPurchase,
} from "@/lib/stock";

function wastageTone(sheets: number | undefined) {
  if (sheets == null) return "";
  if (sheets > 0.005) return "text-red-300";
  if (sheets < -0.005) return "";
  return "text-[#3ddc97]";
}

type StockPayload = {
  ok: boolean;
  purchases?: StockPurchase[];
  counts?: StockCount[];
  position?: StockPosition;
  error?: string;
};

export function StockBoard({
  initialPurchases,
  initialCounts,
  initialPosition,
  storeError,
  signedInEmail,
}: {
  initialPurchases: StockPurchase[];
  initialCounts: StockCount[];
  initialPosition: StockPosition;
  storeError: string | null;
  signedInEmail?: string;
}) {
  const [purchases, setPurchases] = useState(initialPurchases);
  const [counts, setCounts] = useState(initialCounts);
  const [position, setPosition] = useState(initialPosition);
  const [error, setError] = useState<string | null>(storeError);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (version === 0) return;
    let cancelled = false;
    fetch("/api/admin/stock/")
      .then((response) => response.json())
      .then((data: StockPayload) => {
        if (cancelled) return;
        if (data.ok && data.purchases && data.counts && data.position) {
          setPurchases(data.purchases);
          setCounts(data.counts);
          setPosition(data.position);
          setError(null);
        } else setError(data.error ?? "Could not load sheet stock.");
      })
      .catch(() => !cancelled && setError("Could not load sheet stock."));
    return () => {
      cancelled = true;
    };
  }, [version]);

  const refresh = () => setVersion((value) => value + 1);
  const latest = latestStockCount(counts);
  const wastage = latest ? stockWastage(position, latest.sheetsOnHand) : null;

  return (
    <div
      className="min-h-screen text-paper"
      style={{ backgroundImage: "repeating-linear-gradient(-45deg, #0c0d10 0 14px, #111318 14px 28px)" }}
    >
      <AdminHeader current="stock" signedInEmail={signedInEmail} />
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Sheet stock</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/65">
            Bulk sheet purchases live here. Monthly profit uses each order&apos;s plate area at the
            weighted average landed cost of these purchases. Adding a purchase updates that average
            for every order.
          </p>
        </div>
        {error ? (
          <p role="alert" className="border border-red-400/40 bg-red-950/50 px-4 py-3 text-sm">
            {error}
          </p>
        ) : null}

        <section className="border border-white/15 bg-black/50 p-4">
          <dl className="grid grid-cols-2 gap-4 font-mono sm:grid-cols-3 lg:grid-cols-5">
            <div>
              <dt className="text-xs text-white/55">Purchased</dt>
              <dd className="text-lg">{formatSheetQuantity(position.purchasedSheets)} sheets</dd>
              <dd className="text-xs text-white/55">{formatAud(position.purchasedExGstCents)} ex GST</dd>
            </div>
            <div>
              <dt className="text-xs text-white/55">Used by jobs</dt>
              <dd className="text-lg">{formatAreaCm2(position.usedAreaMm2)} cm²</dd>
              <dd className="text-xs text-white/55">
                {formatSheetQuantity(position.usedSheetEquivalents)} sheets · {formatAud(position.usedExGstCents)} ex GST
              </dd>
            </div>
            <div>
              <dt className="text-xs text-white/55">Should remain</dt>
              <dd className="text-lg">{formatSheetQuantity(position.remainingSheetEquivalents)} sheets</dd>
              <dd className="text-xs text-white/55">{formatAud(position.remainingExGstCents)} ex GST</dd>
            </div>
            <div>
              <dt className="text-xs text-white/55">Counted on hand</dt>
              <dd className="text-lg">
                {latest ? `${formatSheetQuantity(latest.sheetsOnHand)} sheets` : "Not counted"}
              </dd>
              <dd className="text-xs text-white/55">{latest ? latest.date : "Enter a shelf count below"}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/55">Wastage</dt>
              <dd className={`text-lg ${wastageTone(wastage?.sheets)}`}>
                {wastage ? `${formatSheetQuantity(wastage.sheets)} sheets` : "—"}
              </dd>
              <dd className="text-xs text-white/55">
                {wastage ? `${formatAud(wastage.exGstCents)} ex GST` : "Needs a shelf count"}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-white/65">
            Sheet-equivalents are {STOCK_SHEET_WIDTH_MM}×{STOCK_SHEET_HEIGHT_MM} mm. Used dollars are the
            sum of each order&apos;s material cost. Wastage is the book remaining minus the sheets counted
            on the shelf. A positive number means the shelf is short. A negative number means the shelf
            holds more sheets than the book remaining.
            {position.centsPerSheet > 0
              ? ` Average landed cost is ${formatAud(Math.round(position.centsPerSheet))} ex GST per ${STOCK_SHEET_WIDTH_MM}×${STOCK_SHEET_HEIGHT_MM} mm sheet.`
              : ""}
          </p>
        </section>

        <section className="border border-white/15 bg-black/50 p-4">
          <h2 className="font-heading text-lg font-semibold">Jobs drawing stock</h2>
          <p className="mt-1 text-sm text-white/60">
            Plate area on every order is drawn down, including jobs still marked NEW.
          </p>
          {position.jobs.length === 0 ? (
            <p className="mt-3 text-sm text-white/60">No orders with plate area yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-white/55">
                  <tr>
                    <th scope="col" className="py-1 pr-3 font-normal">Order</th>
                    <th scope="col" className="py-1 pr-3 font-normal">Placed</th>
                    <th scope="col" className="py-1 pr-3 font-normal">Status</th>
                    <th scope="col" className="py-1 pr-3 font-normal">Area</th>
                    <th scope="col" className="py-1 pr-3 font-normal">Sheets</th>
                    <th scope="col" className="py-1 font-normal">Material ex GST</th>
                  </tr>
                </thead>
                <tbody>
                  {position.jobs.map((job) => (
                    <tr key={job.orderNumber} className="border-t border-white/10">
                      <td className="py-2 pr-3 font-mono">#{job.orderNumber}</td>
                      <td className="py-2 pr-3">{perthToday(new Date(job.createdAt))}</td>
                      <td className="py-2 pr-3">{job.status}</td>
                      <td className="py-2 pr-3 font-mono">{formatAreaCm2(job.areaMm2)} cm²</td>
                      <td className="py-2 pr-3 font-mono">{formatSheetQuantity(job.sheetEquivalents)}</td>
                      <td className="py-2 font-mono">{formatAud(job.exGstCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {storeError ? null : (
          <>
            <section className="border border-white/15 bg-black/50 p-4">
              <h2 className="font-heading text-lg font-semibold">Purchases ({purchases.length})</h2>
              <PurchaseList purchases={purchases} onChange={refresh} />
              <h3 className="mt-5 font-heading text-base font-semibold">Add a bulk purchase</h3>
              <p className="mt-1 text-sm text-white/60">
                Leave GST unticked for a landed overseas price. Tick it when the amount is an Australian receipt that includes GST.
              </p>
              <div className="mt-3">
                <PurchaseForm onAdded={refresh} />
              </div>
            </section>

            <section className="border border-white/15 bg-black/50 p-4">
              <h2 className="font-heading text-lg font-semibold">Sheets on the shelf</h2>
              <p className="mt-1 text-sm text-white/60">
                Count physical {STOCK_SHEET_WIDTH_MM}×{STOCK_SHEET_HEIGHT_MM} mm sheets. The latest count is the one compared with the book.
              </p>
              <CountList counts={counts} onChange={refresh} />
              <div className="mt-3">
                <CountForm onAdded={refresh} />
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

const field = "h-9 rounded-lg border border-white/15 bg-black px-2 text-sm";

function PurchaseForm({ onAdded }: { onAdded: () => void }) {
  const [date, setDate] = useState(() => perthToday());
  const [sheetCount, setSheetCount] = useState("");
  const [widthMm, setWidthMm] = useState(String(STOCK_SHEET_WIDTH_MM));
  const [heightMm, setHeightMm] = useState(String(STOCK_SHEET_HEIGHT_MM));
  const [colour, setColour] = useState("");
  const [amount, setAmount] = useState("");
  const [gstIncluded, setGstIncluded] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/stock/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "purchase",
          date,
          sheetCount,
          widthMm,
          heightMm,
          colour,
          amount,
          gstIncluded,
          notes,
        }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Could not save the purchase.");
      setSheetCount("");
      setColour("");
      setAmount("");
      setNotes("");
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the purchase.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
      <input aria-label="Purchase date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className={field} required />
      <input aria-label="Sheet count" inputMode="numeric" placeholder="Sheets" value={sheetCount} onChange={(event) => setSheetCount(event.target.value)} className={field} required />
      <input aria-label="Sheet width mm" inputMode="numeric" placeholder="Width mm" value={widthMm} onChange={(event) => setWidthMm(event.target.value)} className={field} required />
      <input aria-label="Sheet height mm" inputMode="numeric" placeholder="Height mm" value={heightMm} onChange={(event) => setHeightMm(event.target.value)} className={field} required />
      <input aria-label="Colour" placeholder="Colour (optional)" value={colour} onChange={(event) => setColour(event.target.value)} className={`${field} sm:col-span-2`} />
      <input aria-label="Landed cost (AUD)" inputMode="decimal" placeholder="$ 0.00 landed" value={amount} onChange={(event) => setAmount(event.target.value)} className={field} required />
      <input aria-label="Notes" placeholder="Notes (optional)" value={notes} onChange={(event) => setNotes(event.target.value)} className={`${field} sm:col-span-3`} />
      <label className="flex items-center gap-2 text-sm text-white/80 sm:col-span-2">
        <input type="checkbox" checked={gstIncluded} onChange={(event) => setGstIncluded(event.target.checked)} />
        Amount includes GST
      </label>
      <button type="submit" disabled={saving} className="h-9 rounded-full bg-[#fee100] px-4 text-sm font-medium text-[#12151a] disabled:opacity-50">
        {saving ? "Adding…" : "Add purchase"}
      </button>
      {error ? <p role="alert" className="col-span-full text-sm text-red-300">{error}</p> : null}
    </form>
  );
}

function PurchaseList({ purchases, onChange }: { purchases: StockPurchase[]; onChange: () => void }) {
  const [error, setError] = useState<string | null>(null);
  async function remove(purchase: StockPurchase) {
    if (!window.confirm(`Delete the ${purchase.date} purchase of ${purchase.sheetCount} sheets?`)) return;
    setError(null);
    const response = await fetch(`/api/admin/stock/purchases/${purchase.id}/`, { method: "DELETE" });
    const data = (await response.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string };
    if (data.ok) onChange();
    else setError(data.error ?? "Could not delete the purchase.");
  }
  if (purchases.length === 0) return <p className="mt-2 text-sm text-white/60">No sheet purchases yet.</p>;
  return (
    <>
      <ul className="mt-2 divide-y divide-white/10 text-sm">
        {purchases.map((purchase) => (
          <li key={purchase.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="text-white/60">{purchase.date}</span>
            <span className="min-w-0 flex-1">
              {purchase.sheetCount} × {purchase.widthMm}×{purchase.heightMm} mm
              {purchase.colour ? ` · ${purchase.colour}` : ""}
              {purchase.notes ? ` · ${purchase.notes}` : ""}
            </span>
            <span className="font-mono">
              {formatAud(purchase.amountCents)}
              <span className="ml-1 text-xs text-white/50">
                {purchase.gstIncluded ? `inc GST (${formatAud(purchaseExGstCents(purchase))} ex)` : "no GST"}
              </span>
            </span>
            <button type="button" onClick={() => remove(purchase)} className="text-xs text-red-300 hover:underline">
              Delete
            </button>
          </li>
        ))}
      </ul>
      {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
    </>
  );
}

function CountForm({ onAdded }: { onAdded: () => void }) {
  const [date, setDate] = useState(() => perthToday());
  const [sheetsOnHand, setSheetsOnHand] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/stock/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "count", date, sheetsOnHand, notes }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Could not save the count.");
      setSheetsOnHand("");
      setNotes("");
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the count.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
      <input aria-label="Count date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className={field} required />
      <input aria-label="Sheets on hand" inputMode="numeric" placeholder="Sheets on hand" value={sheetsOnHand} onChange={(event) => setSheetsOnHand(event.target.value)} className={field} required />
      <input aria-label="Count notes" placeholder="Notes (optional)" value={notes} onChange={(event) => setNotes(event.target.value)} className={`${field} sm:col-span-2`} />
      <button type="submit" disabled={saving} className="h-9 rounded-full bg-[#fee100] px-4 text-sm font-medium text-[#12151a] disabled:opacity-50">
        {saving ? "Saving…" : "Save count"}
      </button>
      {error ? <p role="alert" className="col-span-full text-sm text-red-300">{error}</p> : null}
    </form>
  );
}

function CountList({ counts, onChange }: { counts: StockCount[]; onChange: () => void }) {
  const [error, setError] = useState<string | null>(null);
  async function remove(count: StockCount) {
    if (!window.confirm(`Delete the count of ${count.sheetsOnHand} sheets on ${count.date}?`)) return;
    setError(null);
    const response = await fetch(`/api/admin/stock/counts/${count.id}/`, { method: "DELETE" });
    const data = (await response.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string };
    if (data.ok) onChange();
    else setError(data.error ?? "Could not delete the count.");
  }
  if (counts.length === 0) return null;
  return (
    <>
      <ul className="mt-3 divide-y divide-white/10 text-sm">
        {counts.map((count, index) => (
          <li key={count.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="text-white/60">{count.date}</span>
            <span className="min-w-0 flex-1">
              {count.sheetsOnHand} sheets{index === 0 ? " · latest" : ""}
              {count.notes ? ` · ${count.notes}` : ""}
            </span>
            <button type="button" onClick={() => remove(count)} className="text-xs text-red-300 hover:underline">
              Delete
            </button>
          </li>
        ))}
      </ul>
      {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
    </>
  );
}
