"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, X } from "lucide-react";
import { ImportOrderDialog } from "@/components/admin/import-order-dialog";
import { Button } from "@/components/ui/button";
import {
  applyUniformTextSize,
  restoreIndividualLegendFit,
  uniformTextGroups,
} from "@/lib/label-design";
import {
  ORDER_STATUSES,
  countryLabel,
  formatOrderDate,
  formatPerthDateTime,
  formatPostage,
  orderItemCount,
  paymentSourceLabel,
  stripeDashboardPaymentUrl,
  type OrderStatus,
  type SavedOrder,
} from "@/lib/orders";
import {
  CUT_FILE_HOLD_MESSAGE,
  EMPTY_PROOF_SUMMARY,
  cutFileDownloadHold,
  proofPath,
  proofStatusText,
  type ProofSummary,
} from "@/lib/proofs";
import { SHIPPING_METHODS, formatAud } from "@/lib/pricing";
import { proofPlateSvg } from "@/lib/proof-plate";
import { productionDownloadKind } from "@/lib/production-svg";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<OrderStatus, string> = {
  NEW: "bg-[#fee100] text-[#12151a]",
  CUT: "bg-[#e0a100] text-[#1a1404]",
  "READY TO SHIP": "bg-[#8eb7ff] text-[#0c1b33]",
  SHIPPED: "bg-[#3ddc97] text-[#06281a]",
};

function shippingLabel(id: SavedOrder["shippingMethodId"]) {
  return SHIPPING_METHODS.find((method) => method.id === id)?.label ?? id;
}

function previewPlates(
  plates: SavedOrder["plates"],
  locations: string[],
  uniform: boolean
) {
  const located = plates.map((plate, index) => ({
    ...plate,
    location: locations[index] ?? plate.location ?? "",
  }));
  if (uniform) return applyUniformTextSize(located);
  if (located.some((plate) => plate.uniformTextSize === true)) {
    return restoreIndividualLegendFit(located);
  }
  return located;
}

function proofColumnLabel(summary: ProofSummary | undefined) {
  switch (summary?.state) {
    case "awaiting":
      return "Awaiting";
    case "approved":
      return "Approved";
    case "changes_requested":
      return "Changes";
    case "superseded":
      return "Superseded";
    default:
      return "Not sent";
  }
}

export function OrdersBoard({
  initialOrders,
  initialProofs,
  storeError,
  proofNotice,
  signedInEmail,
}: {
  initialOrders: SavedOrder[];
  initialProofs: Record<string, ProofSummary>;
  storeError: string | null;
  proofNotice: string | null;
  signedInEmail?: string;
}) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [proofs, setProofs] = useState(initialProofs);
  const [filter, setFilter] = useState<OrderStatus | "ALL">("ALL");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [status, setStatus] = useState<OrderStatus>("NEW");
  const [note, setNote] = useState("");
  const [trackingLink, setTrackingLink] = useState("");
  const [locations, setLocations] = useState<string[]>([]);
  const [invoiceUrl, setInvoiceUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [creatingProof, setCreatingProof] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [proofMessage, setProofMessage] = useState<string | null>(null);
  const [copiedProof, setCopiedProof] = useState(false);
  const [origin, setOrigin] = useState("");
  const [uniformText, setUniformText] = useState(false);

  const visible = useMemo(
    () => (filter === "ALL" ? orders : orders.filter((order) => order.status === filter)),
    [orders, filter]
  );
  const selected = orders.find((order) => order.orderNumber === selectedId) ?? null;

  function openOrder(order: SavedOrder) {
    setSelectedId(order.orderNumber);
    setStatus(order.status);
    setNote(order.note);
    setTrackingLink(order.trackingLink);
    setLocations(order.plates.map((plate) => plate.location ?? ""));
    setUniformText(order.uniformTextSize === true);
    setInvoiceUrl("");
    setSaveError(null);
    setSaved(false);
    setCopied(false);
    setProofError(null);
    setProofMessage(null);
    setCopiedProof(false);
    setOrigin(window.location.origin);
  }

  function closeOrder() {
    setSelectedId(null);
    setSaveError(null);
    setSaved(false);
  }

  async function copyAddress(order: SavedOrder) {
    const text = formatPostage({
      shipping: order.shipping,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function saveOrder() {
    if (!selected) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const response = await fetch(`/api/admin/orders/${selected.orderNumber}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          note,
          trackingLink,
          plateLocations: locations,
          uniformTextSize: uniformText,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        order?: SavedOrder;
        proof?: ProofSummary | null;
      } | null;
      if (!response.ok || !payload?.ok || !payload.order) {
        setSaveError(payload?.error || "Could not update the order.");
        setSaving(false);
        return;
      }
      const savedOrder = payload.order;
      setOrders((current) =>
        current.map((order) =>
          order.orderNumber === savedOrder.orderNumber ? savedOrder : order
        )
      );
      setLocations(savedOrder.plates.map((plate) => plate.location ?? ""));
      setUniformText(savedOrder.uniformTextSize === true);
      if (payload.proof) {
        setProofs((current) => ({
          ...current,
          [String(savedOrder.orderNumber)]: payload.proof!,
        }));
      }
      setSaved(true);
      setSaving(false);
      router.refresh();
    } catch {
      setSaveError("Could not update the order.");
      setSaving(false);
    }
  }

  async function createProof() {
    if (!selected) return;
    setCreatingProof(true);
    setProofError(null);
    setProofMessage(null);
    setCopiedProof(false);
    try {
      const response = await fetch(`/api/admin/orders/${selected.orderNumber}/proof/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceUrl, plateLocations: locations }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        order?: SavedOrder;
        proof?: ProofSummary;
      } | null;
      if (!response.ok || !payload?.ok || !payload.order || !payload.proof) {
        setProofError(payload?.error || "Could not create the proof.");
        setCreatingProof(false);
        return;
      }
      const savedOrder = payload.order;
      setOrders((current) =>
        current.map((order) =>
          order.orderNumber === savedOrder.orderNumber ? savedOrder : order
        )
      );
      setLocations(savedOrder.plates.map((plate) => plate.location ?? ""));
      setProofs((current) => ({
        ...current,
        [String(savedOrder.orderNumber)]: payload.proof!,
      }));
      setInvoiceUrl("");
      setProofMessage("Proof link ready. Copy it and send it yourself.");
      setCreatingProof(false);
      router.refresh();
    } catch {
      setProofError("Could not create the proof.");
      setCreatingProof(false);
    }
  }

  async function copyProofLink(token: string) {
    const url = `${window.location.origin}${proofPath(token)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedProof(true);
    } catch {
      setCopiedProof(false);
    }
  }

  const paymentUrl = selected
    ? stripeDashboardPaymentUrl(selected.stripeLivemode, selected.stripePaymentIntentId)
    : null;
  const selectedProof = selected
    ? proofs[String(selected.orderNumber)] ?? EMPTY_PROOF_SUMMARY
    : EMPTY_PROOF_SUMMARY;
  const proofLink =
    origin && selectedProof.token && selectedProof.state !== "superseded" && selectedProof.state !== "not_sent"
      ? `${origin}${proofPath(selectedProof.token)}`
      : "";

  return (
    <div
      className="min-h-screen text-paper"
      style={{
        backgroundImage:
          "repeating-linear-gradient(-45deg, #0c0d10 0 14px, #111318 14px 28px)",
      }}
    >
      <header className="border-b border-white/10 bg-[#12151a]">
        <div className="h-1 bg-[#fee100]" />
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <p className="font-heading text-lg font-semibold tracking-tight">TraffLabels</p>
          <div className="flex items-center gap-3">
            {signedInEmail ? (
              <p className="hidden text-sm text-white/55 sm:block">{signedInEmail}</p>
            ) : null}
            <form action="/api/admin/logout/" method="post">
              <button
                type="submit"
                className="rounded-full border border-white/25 px-3 py-1 text-sm text-white/90 hover:bg-white/10"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Orders{" "}
            <span className="text-white/55">({visible.length})</span>
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="h-9 rounded-full bg-[#fee100] px-4 text-sm font-medium text-[#12151a] hover:bg-[#ffe866]"
              onClick={() => setImportOpen(true)}
            >
              Add Order
            </button>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <span className="font-mono text-[10px] tracking-[0.16em] uppercase">Status</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as OrderStatus | "ALL")}
              className="h-9 rounded-full border border-white/15 bg-black/50 px-3 text-sm text-paper"
            >
              <option value="ALL">All statuses</option>
              {ORDER_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          </div>
        </div>

        {storeError ? (
          <p role="alert" className="border border-red-400/40 bg-red-950/50 px-4 py-3 text-sm">
            {storeError}
          </p>
        ) : null}
        {proofNotice ? (
          <p role="status" className="border border-[#fee100]/40 bg-black/50 px-4 py-3 text-sm">
            {proofNotice}
          </p>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/55 shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
              <thead className="text-[11px] tracking-wide text-white/45 uppercase">
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 font-medium">Order #</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Proof</th>
                  <th className="px-3 py-3 font-medium">Payment</th>
                  <th className="px-3 py-3 font-medium">Customer</th>
                  <th className="px-3 py-3 font-medium">Items</th>
                  <th className="px-3 py-3 font-medium">Total</th>
                  <th className="px-3 py-3 font-medium">Shipping</th>
                  <th className="px-3 py-3 font-medium">Created</th>
                  <th className="px-3 py-3 font-medium">File</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-sm text-white/55">
                      {orders.length === 0
                        ? "No orders yet. A Stripe payment or an order you add appears here as NEW."
                        : "No orders in this status."}
                    </td>
                  </tr>
                ) : (
                  visible.map((order) => {
                    const kind = productionDownloadKind(order.plates);
                    const downloadHold = cutFileDownloadHold(proofs[String(order.orderNumber)]);
                    return (
                        <tr
                        key={order.orderNumber}
                        className="cursor-pointer border-b border-white/10 hover:bg-white/5"
                        onClick={() => openOrder(order)}
                      >
                        <td className="px-4 py-3 font-mono text-paper">{order.orderNumber}</td>
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
                              STATUS_CLASS[order.status]
                            )}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-white/70">
                          {proofColumnLabel(proofs[String(order.orderNumber)])}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
                              order.paymentSource === "manual"
                                ? "bg-white/10 text-[#fee100]"
                                : "bg-white/10 text-white/70"
                            )}
                          >
                            {paymentSourceLabel(order.paymentSource)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="block text-paper">
                            {order.customerName || order.customerEmail || "—"}
                          </span>
                          {order.customerName && order.customerEmail ? (
                            <span className="block text-xs text-white/45">{order.customerEmail}</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 font-mono">{orderItemCount(order.plates)}</td>
                        <td className="px-3 py-3 font-mono">{formatAud(order.totalCents)}</td>
                        <td className="px-3 py-3">{shippingLabel(order.shippingMethodId)}</td>
                        <td className="px-3 py-3 text-white/75">{formatOrderDate(order.createdAt)}</td>
                        <td className="px-3 py-3">
                          {downloadHold ? (
                            <div
                              className="flex max-w-[11rem] flex-col items-start gap-1"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <button
                                type="button"
                                disabled
                                className="inline-flex size-8 cursor-not-allowed items-center justify-center rounded-full bg-white/10 text-white/35"
                                aria-label={`${CUT_FILE_HOLD_MESSAGE}. Download unavailable for order ${order.orderNumber}`}
                                title={CUT_FILE_HOLD_MESSAGE}
                              >
                                <Download className="size-4" />
                              </button>
                              <span className="text-[11px] leading-snug text-white/50">
                                {CUT_FILE_HOLD_MESSAGE}
                              </span>
                            </div>
                          ) : (
                            <a
                              href={`/api/admin/orders/${order.orderNumber}/files/`}
                              className="inline-flex size-8 items-center justify-center rounded-full bg-[#fee100] text-[#12151a] hover:bg-[#ffe866]"
                              aria-label={`Download ${kind === "zip" ? "ZIP" : "SVG"} for order ${order.orderNumber}`}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <Download className="size-4" />
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {importOpen ? (
        <ImportOrderDialog
          onClose={() => setImportOpen(false)}
          onCreated={(order) => {
            setOrders((current) => [order, ...current.filter((item) => item.orderNumber !== order.orderNumber)]);
            setImportOpen(false);
            setFilter("ALL");
            openOrder(order);
          }}
        />
      ) : null}

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-8"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeOrder();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-dialog-title"
            className="w-full max-w-lg rounded-xl border border-white/10 bg-[#0e0e10] p-5 text-paper shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="order-dialog-title" className="font-heading text-lg font-semibold">
                Update order #{selected.orderNumber}
              </h2>
              <button
                type="button"
                className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white"
                onClick={closeOrder}
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <section className="mt-4">
              <h3 className="text-sm font-semibold">Customer</h3>
              <dl className="mt-2 grid grid-cols-[9rem_1fr] gap-y-1 text-sm">
                <dt className="text-white/45">Name</dt>
                <dd>{selected.customerName || "—"}</dd>
                <dt className="text-white/45">Order date</dt>
                <dd>{formatOrderDate(selected.createdAt)}</dd>
                <dt className="text-white/45">Shipping method</dt>
                <dd>{shippingLabel(selected.shippingMethodId)}</dd>
                <dt className="text-white/45">Payment</dt>
                <dd>{paymentSourceLabel(selected.paymentSource)}</dd>
              </dl>
              <div className="mt-3 flex flex-col gap-1 text-sm">
                {selected.paymentSource === "manual" ? (
                  <span className="text-[#fee100]">Manual CSV import. No Stripe payment.</span>
                ) : paymentUrl ? (
                  <a className="text-[#fee100] underline-offset-2 hover:underline" href={paymentUrl} target="_blank" rel="noreferrer">
                    Stripe payment
                  </a>
                ) : (
                  <span className="text-white/40">Stripe payment link unavailable</span>
                )}
                {selected.stripeReceiptUrl ? (
                  <a
                    className="text-[#fee100] underline-offset-2 hover:underline"
                    href={selected.stripeReceiptUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Receipt link
                  </a>
                ) : null}
              </div>
            </section>

            <section className="mt-4 text-sm leading-relaxed">
              <h3 className="text-sm font-semibold">Shipping</h3>
              <p className="mt-2 whitespace-pre-line">
                {formatPostage({
                  shipping: selected.shipping,
                  customerPhone: selected.customerPhone,
                  customerEmail: selected.customerEmail,
                }) || "No postal address was returned by Stripe."}
              </p>
              <p className="mt-1 text-xs text-white/40">
                {countryLabel(selected.shipping.country) || "Country not set"}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 border-white/15 bg-transparent text-paper hover:bg-white/10"
                onClick={() => copyAddress(selected)}
              >
                <Copy />
                {copied ? "Copied" : "Copy"}
              </Button>
            </section>

            <section className="mt-5 border border-white/10 p-3">
              <h3 className="text-sm font-semibold">Proof</h3>
              <p className="mt-2 text-sm whitespace-pre-wrap">{proofStatusText(selectedProof)}</p>
              {selectedProof.state === "awaiting" && selectedProof.createdAt ? (
                <p className="mt-1 text-xs text-white/45">
                  Link created {formatPerthDateTime(selectedProof.createdAt)}
                </p>
              ) : null}
              {proofLink ? (
                <label className="mt-3 flex flex-col gap-1.5 text-xs text-white/55">
                  Customer link
                  <input
                    readOnly
                    value={proofLink}
                    onFocus={(event) => event.currentTarget.select()}
                    className="h-9 rounded-lg border border-white/15 bg-black px-2 font-mono text-[11px] text-paper"
                  />
                </label>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedProof.token && selectedProof.state !== "not_sent" && selectedProof.state !== "superseded" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-white/15 bg-transparent text-paper hover:bg-white/10"
                    onClick={() => copyProofLink(selectedProof.token!)}
                  >
                    <Copy />
                    {copiedProof ? "Copied" : "Copy link"}
                  </Button>
                ) : null}
              </div>
              <label className="mt-3 flex flex-col gap-1.5 text-sm">
                Stripe invoice URL
                <input
                  value={invoiceUrl}
                  onChange={(event) => setInvoiceUrl(event.target.value)}
                  placeholder="https://invoice.stripe.com/…"
                  className="h-10 rounded-lg border border-white/15 bg-black px-3"
                />
              </label>
              <p className="mt-2 text-xs text-white/40">
                {selectedProof.state === "not_sent" || selectedProof.state === "superseded"
                  ? "Creates a link you can send. Customers are not emailed."
                  : "A new link replaces the current one. The previous link can no longer be approved."}
              </p>
              {proofError ? (
                <p role="alert" className="mt-2 text-sm text-red-300">
                  {proofError}
                </p>
              ) : null}
              {proofMessage ? (
                <p role="status" className="mt-2 text-sm text-[#3ddc97]">
                  {proofMessage}
                </p>
              ) : null}
              <Button
                type="button"
                className="mt-3 bg-[#fee100] text-[#12151a] hover:bg-[#ffe866]"
                disabled={creatingProof || Boolean(proofNotice)}
                onClick={createProof}
              >
                {creatingProof
                  ? "Creating…"
                  : selectedProof.state === "not_sent" || selectedProof.state === "superseded"
                    ? "Create proof link"
                    : "Create a new proof link"}
              </Button>
            </section>

            <section className="mt-5">
              <h3 className="text-sm font-semibold">
                Items ({orderItemCount(selected.plates)})
              </h3>
              <label className="mt-3 flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-[#fee100]"
                  checked={uniformText}
                  onChange={(event) => {
                    setUniformText(event.target.checked);
                    setSaved(false);
                  }}
                />
                <span>
                  <span className="block font-medium">Uniform text size per plate size</span>
                  <span className="mt-1 block text-xs text-white/50">
                    Every plate of the same dimensions uses the largest text that still fits
                    every legend of that size. Turning this on replaces a proof that was already
                    sent.
                  </span>
                </span>
              </label>
              {uniformText ? (
                <ul className="mt-2 text-xs text-white/55">
                  {uniformTextGroups(selected.plates).map((group) => (
                    <li key={`${group.widthMm}x${group.heightMm}`}>
                      {group.widthMm} × {group.heightMm} mm text {group.fontSize} mm
                      {group.limitingTexts.length > 0
                        ? `, limited by ${group.limitingTexts.join(", ")}`
                        : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
              <ul className="mt-2 flex flex-col gap-3">
                {previewPlates(selected.plates, locations, uniformText).map((plate, index) => (
                  <li key={`${plate.text}-${index}`} className="flex gap-3 text-sm">
                    <span
                      className="mt-0.5 shrink-0 border border-white/20 bg-white [&_svg]:h-auto [&_svg]:w-full"
                      style={{ width: Math.min(160, Math.max(72, plate.widthMm * 4)) }}
                      dangerouslySetInnerHTML={{ __html: proofPlateSvg(plate) }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        {selected.plates[index]?.text.split("\n")[0] || "Untitled plate"}
                      </span>
                      <span className="block text-xs text-white/50">
                        {plate.widthMm} × {plate.heightMm} mm · {plate.colourLabel}
                        {plate.adhesive3m ? " · 3M adhesive" : ""} · qty {plate.qty} ·{" "}
                        {formatAud(plate.unitCents)} each · {formatAud(plate.lineCents)}
                      </span>
                      <label className="mt-2 flex flex-col gap-1 text-xs text-white/55">
                        Location
                        <input
                          value={locations[index] ?? ""}
                          onChange={(event) => {
                            const next = selected.plates.map((_, plateIndex) =>
                              plateIndex === index
                                ? event.target.value
                                : locations[plateIndex] ?? ""
                            );
                            setLocations(next);
                            setSaved(false);
                          }}
                          placeholder="e.g. DB room"
                          maxLength={80}
                          className="h-8 rounded-lg border border-white/15 bg-black px-2 text-sm text-paper"
                        />
                      </label>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-right font-mono text-sm text-white/70">
                Plates {formatAud(selected.subtotalCents)} · Shipping {formatAud(selected.shippingCents)} ·{" "}
                <span className="text-paper">{formatAud(selected.totalCents)}</span>
              </p>
            </section>

            <label className="mt-5 flex flex-col gap-1.5 text-sm">
              Status
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as OrderStatus);
                  setSaved(false);
                }}
                className="h-10 rounded-lg border border-white/15 bg-black px-3"
              >
                {ORDER_STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 flex flex-col gap-1.5 text-sm">
              Note
              <textarea
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                  setSaved(false);
                }}
                rows={3}
                className="rounded-lg border border-white/15 bg-black px-3 py-2"
              />
            </label>

            <label className="mt-4 flex flex-col gap-1.5 text-sm">
              Tracking link
              <input
                value={trackingLink}
                onChange={(event) => {
                  setTrackingLink(event.target.value);
                  setSaved(false);
                }}
                placeholder="https://"
                className="h-10 rounded-lg border border-white/15 bg-black px-3"
              />
            </label>

            {saveError ? (
              <p role="alert" className="mt-3 text-sm text-red-300">
                {saveError}
              </p>
            ) : null}
            {saved ? (
              <p role="status" className="mt-3 text-sm text-[#3ddc97]">
                Order updated.
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-white/15 bg-transparent text-paper hover:bg-white/10"
                onClick={closeOrder}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-[#fee100] text-[#12151a] hover:bg-[#ffe866]"
                disabled={saving}
                onClick={saveOrder}
              >
                {saving ? "Updating…" : "Update"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
