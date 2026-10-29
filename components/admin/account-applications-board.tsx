"use client";

import { useState } from "react";
import {
  formatAbn,
  type AccountApplication,
  type AccountApplicationStatus,
} from "@/lib/account-application-model";
import { formatPerthDateTime } from "@/lib/orders";

const STATUS_LABEL: Record<AccountApplicationStatus, string> = {
  new: "New",
  approved: "Approved",
  declined: "Declined",
};

export function AccountApplicationsBoard({
  initialApplications,
  storeError,
  signedInEmail,
}: {
  initialApplications: AccountApplication[];
  storeError: string | null;
  signedInEmail?: string;
}) {
  const [applications, setApplications] = useState(initialApplications);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orderDrafts, setOrderDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialApplications.map((item) => [
        item.id,
        item.linkedOrderNumber ? String(item.linkedOrderNumber) : "",
      ])
    )
  );

  async function patch(id: string, body: { status?: AccountApplicationStatus; orderNumber?: number | null }) {
    setError(null);
    setPendingId(id);
    try {
      const response = await fetch(`/api/admin/account-applications/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; application?: AccountApplication }
        | null;
      if (!response.ok || !payload?.ok || !payload.application) {
        setError(payload?.error || "Could not update that application.");
        setPendingId(null);
        return;
      }
      const saved = payload.application;
      setApplications((current) => current.map((item) => (item.id === id ? saved : item)));
      setOrderDrafts((current) => ({
        ...current,
        [id]: saved.linkedOrderNumber ? String(saved.linkedOrderNumber) : "",
      }));
      setPendingId(null);
    } catch {
      setError("Could not update that application.");
      setPendingId(null);
    }
  }

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
            <a href="/admin/orders/" className="text-sm text-[#fee100] hover:underline">
              Orders
            </a>
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
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Account applications{" "}
          <span className="text-white/55">({applications.length})</span>
        </h1>
        {storeError ? (
          <p role="alert" className="border border-red-400/40 bg-red-950/50 px-4 py-3 text-sm">
            {storeError}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="border border-red-400/40 bg-red-950/50 px-4 py-3 text-sm">
            {error}
          </p>
        ) : null}
        {applications.length === 0 && !storeError ? (
          <p className="text-sm text-white/70">No account applications yet.</p>
        ) : null}
        <ul className="flex flex-col gap-4">
          {applications.map((item) => (
            <li key={item.id} className="border border-white/15 bg-black/50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-heading text-lg font-semibold">{item.registeredCompanyName}</p>
                  <p className="mt-1 text-sm text-white/70">
                    ABN {formatAbn(item.abn)} · {STATUS_LABEL[item.status]} ·{" "}
                    {formatPerthDateTime(item.createdAt)} (Perth)
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pendingId === item.id || item.status === "approved"}
                    className="h-9 rounded-full bg-[#fee100] px-4 text-sm font-medium text-[#12151a] disabled:opacity-50"
                    onClick={() => void patch(item.id, { status: "approved" })}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={pendingId === item.id || item.status === "declined"}
                    className="h-9 rounded-full border border-white/30 px-4 text-sm disabled:opacity-50"
                    onClick={() => void patch(item.id, { status: "declined" })}
                  >
                    Decline
                  </button>
                </div>
              </div>
              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-white/50">ACN</dt>
                  <dd>{item.acn || "—"}</dd>
                </div>
                <div>
                  <dt className="text-white/50">Trading name</dt>
                  <dd>{item.tradingName || "—"}</dd>
                </div>
                <div>
                  <dt className="text-white/50">Billing address</dt>
                  <dd className="whitespace-pre-wrap">{item.billingAddress}</dd>
                </div>
                <div>
                  <dt className="text-white/50">Delivery address</dt>
                  <dd className="whitespace-pre-wrap">{item.deliveryAddress || "—"}</dd>
                </div>
                <div>
                  <dt className="text-white/50">Main phone</dt>
                  <dd>{item.mainPhone}</dd>
                </div>
                <div>
                  <dt className="text-white/50">Website</dt>
                  <dd>{item.website || "—"}</dd>
                </div>
                <div>
                  <dt className="text-white/50">Accounts payable</dt>
                  <dd>
                    {item.apName}
                    <span className="block text-white/70">{item.apEmail}</span>
                    {item.apPhone ? <span className="block text-white/70">{item.apPhone}</span> : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-white/50">Purchasing contact</dt>
                  <dd>
                    {item.purchasingName || "—"}
                    {item.purchasingEmail ? (
                      <span className="block text-white/70">{item.purchasingEmail}</span>
                    ) : null}
                    {item.purchasingPhone ? (
                      <span className="block text-white/70">{item.purchasingPhone}</span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-white/50">PO number on invoices</dt>
                  <dd>{item.poRequired ? "Yes" : "No"}</dd>
                </div>
                <div>
                  <dt className="text-white/50">Authorised by</dt>
                  <dd>
                    {item.authorisedName}, {item.position}
                    <span className="block text-white/70">
                      {formatPerthDateTime(item.authorisedAt)} (Perth)
                    </span>
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-white/50">Declaration</dt>
                  <dd>{item.authorisationStatement}</dd>
                </div>
                <div>
                  <dt className="text-white/50">IP</dt>
                  <dd>{item.authorisedIp || "—"}</dd>
                </div>
                <div>
                  <dt className="text-white/50">Browser</dt>
                  <dd className="break-all">{item.authorisedUserAgent || "—"}</dd>
                </div>
                {item.decidedAt ? (
                  <div className="sm:col-span-2">
                    <dt className="text-white/50">Decision</dt>
                    <dd>
                      {STATUS_LABEL[item.status]} by {item.decidedBy || "—"} on{" "}
                      {formatPerthDateTime(item.decidedAt)} (Perth)
                    </dd>
                  </div>
                ) : null}
              </dl>
              <form
                className="mt-4 flex flex-wrap items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const raw = (orderDrafts[item.id] ?? "").trim();
                  if (!raw) {
                    void patch(item.id, { orderNumber: null });
                    return;
                  }
                  const orderNumber = Number(raw);
                  void patch(item.id, { orderNumber });
                }}
              >
                <label className="flex flex-col gap-1 text-xs text-white/60">
                  Link to order number
                  <input
                    inputMode="numeric"
                    value={orderDrafts[item.id] ?? ""}
                    onChange={(event) =>
                      setOrderDrafts((current) => ({ ...current, [item.id]: event.target.value }))
                    }
                    className="h-9 w-36 rounded-full border border-white/15 bg-black px-3 text-sm text-paper"
                  />
                </label>
                <button
                  type="submit"
                  disabled={pendingId === item.id}
                  className="h-9 rounded-full border border-white/30 px-4 text-sm disabled:opacity-50"
                >
                  {item.linkedOrderNumber ? `Linked to #${item.linkedOrderNumber}` : "Save link"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
