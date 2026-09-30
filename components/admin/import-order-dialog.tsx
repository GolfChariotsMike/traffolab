"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadTemplateCsv } from "@/lib/order-csv";
import { parseManualOrder, type ManualOrderError } from "@/lib/manual-order";
import type { SavedOrder } from "@/lib/orders";
import { SHIPPING_METHODS, formatAud } from "@/lib/pricing";

const fieldClass = "h-10 rounded-lg border border-white/15 bg-black px-3 text-sm";

export function ImportOrderDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (order: SavedOrder) => void;
}) {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("WA");
  const [postalCode, setPostalCode] = useState("");
  const [shippingMethodId, setShippingMethodId] = useState<"standard" | "express">("standard");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const draft = useMemo(
    () =>
      parseManualOrder({
        csv,
        name,
        email,
        phone,
        line1,
        line2,
        city,
        state,
        postalCode,
        country: "AU",
        shippingMethodId,
        note,
      }),
    [csv, name, email, phone, line1, line2, city, state, postalCode, shippingMethodId, note]
  );

  const errors: ManualOrderError[] = draft.ok ? [] : draft.errors;

  async function onFile(file: File | null) {
    setServerError(null);
    if (!file) {
      setCsv("");
      setFileName("");
      return;
    }
    setFileName(file.name);
    setCsv(await file.text());
  }

  async function createOrder() {
    if (!draft.ok) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const response = await fetch("/api/admin/orders/import/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csv,
          name,
          email,
          phone,
          line1,
          line2,
          city,
          state,
          postalCode,
          country: "AU",
          shippingMethodId,
          note,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        errors?: ManualOrderError[];
        order?: SavedOrder;
      } | null;
      if (!response.ok || !payload?.ok || !payload.order) {
        const lines = payload?.errors?.map((error) => error.message).filter(Boolean) ?? [];
        setServerError(lines[0] || payload?.error || "Could not create the order.");
        setSubmitting(false);
        return;
      }
      onCreated(payload.order);
    } catch {
      setServerError("Could not create the order.");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-8"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-order-title"
        className="w-full max-w-lg rounded-xl border border-white/10 bg-[#0e0e10] p-5 text-paper shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="add-order-title" className="font-heading text-lg font-semibold">
              Add Order
            </h2>
            <p className="mt-1 text-sm text-white/60">
              Creates a TraffLabels order with status NEW. No Stripe payment. Plate columns match the public list: colour, width, height, text, qty (mm).
            </p>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-white/70">Plate CSV</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="block text-sm text-white/80 file:mr-3 file:rounded-full file:border-0 file:bg-[#fee100] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[#12151a]"
              onChange={(event) => onFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="button"
            className="text-sm text-[#fee100] underline-offset-2 hover:underline"
            onClick={() => downloadTemplateCsv()}
          >
            Download template
          </button>
        </div>
        {fileName ? <p className="mt-2 text-xs text-white/45">{fileName}</p> : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Name
            <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Email
            <input className={fieldClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Phone
            <input className={fieldClass} value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Address
            <input className={fieldClass} value={line1} onChange={(event) => setLine1(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Address line 2
            <input className={fieldClass} value={line2} onChange={(event) => setLine2(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Suburb
            <input className={fieldClass} value={city} onChange={(event) => setCity(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            State
            <input className={fieldClass} value={state} onChange={(event) => setState(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Postcode
            <input className={fieldClass} value={postalCode} onChange={(event) => setPostalCode(event.target.value)} />
          </label>
          <fieldset className="flex flex-col gap-1 text-sm">
            <legend>Shipping</legend>
            <div className="flex gap-2">
              {SHIPPING_METHODS.map((method) => (
                <label key={method.id} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="manual-shipping"
                    checked={shippingMethodId === method.id}
                    onChange={() => setShippingMethodId(method.id)}
                  />
                  {method.label} {formatAud(method.aud * 100)}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Note
            <textarea
              className="rounded-lg border border-white/15 bg-black px-3 py-2 text-sm"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
        </div>

        {draft.ok ? (
          <p className="mt-4 text-sm text-[#3ddc97]">
            {draft.order.plates.length} plate {draft.order.plates.length === 1 ? "line" : "lines"} ·{" "}
            {draft.plateCount} plates · {formatAud(draft.order.totalCents)} including shipping. Status will be NEW.
          </p>
        ) : errors.length > 0 && (csv || name || line1) ? (
          <ul className="mt-4 flex flex-col gap-1 text-sm text-red-300" role="alert">
            {errors.slice(0, 8).map((error, index) => (
              <li key={`${error.line ?? "form"}-${index}`}>{error.message}</li>
            ))}
            {errors.length > 8 ? <li>And {errors.length - 8} more.</li> : null}
          </ul>
        ) : null}
        {serverError ? (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {serverError}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-white/15 bg-transparent text-paper hover:bg-white/10"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-[#fee100] text-[#12151a] hover:bg-[#ffe866]"
            disabled={!draft.ok || submitting}
            onClick={createOrder}
          >
            {submitting ? "Creating…" : "Create order"}
          </Button>
        </div>
      </div>
    </div>
  );
}
