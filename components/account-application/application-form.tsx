"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import {
  AUTHORISATION_STATEMENT,
  FOOTER_LINE,
  HONEYPOT_FIELD,
  INTRO_LINE,
  PDF_PUBLIC_PATH,
  SIGNATURE_NOTE,
  SUPPLIER_ABN,
  SUPPLIER_CONTACT,
  SUPPLIER_NAME,
  TRADING_TERMS,
} from "@/lib/account-application-copy";

const inputClass =
  "h-9 w-full rounded-sm border border-neutral-500 bg-neutral-50 px-2 text-sm font-normal text-[#12151a]";
const areaClass =
  "min-h-20 w-full rounded-sm border border-neutral-500 bg-neutral-50 px-2 py-1.5 text-sm font-normal text-[#12151a]";

type FormState = {
  registeredCompanyName: string;
  acn: string;
  tradingName: string;
  abn: string;
  billingAddress: string;
  deliveryAddress: string;
  mainPhone: string;
  website: string;
  apName: string;
  apEmail: string;
  apPhone: string;
  purchasingName: string;
  purchasingEmail: string;
  purchasingPhone: string;
  poRequired: "" | "yes" | "no";
  authorisedName: string;
  position: string;
  confirmed: boolean;
  companyWebsiteConfirm: string;
};

const EMPTY: FormState = {
  registeredCompanyName: "",
  acn: "",
  tradingName: "",
  abn: "",
  billingAddress: "",
  deliveryAddress: "",
  mainPhone: "",
  website: "",
  apName: "",
  apEmail: "",
  apPhone: "",
  purchasingName: "",
  purchasingEmail: "",
  purchasingPhone: "",
  poRequired: "",
  authorisedName: "",
  position: "",
  confirmed: false,
  companyWebsiteConfirm: "",
};

function SectionTitle({ children }: { children: string }) {
  return (
    <div className="flex bg-[#12151a] text-white">
      <span className="w-2 shrink-0 bg-[#fee100]" aria-hidden="true" />
      <h2 className="px-3 py-1.5 text-xs font-semibold tracking-[0.14em]">{children}</h2>
    </div>
  );
}

function Field({
  label,
  required = false,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-xs font-semibold ${className}`}>
      <span>
        {label}
        {required ? (
          <span className="text-red-700" aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

export function ApplicationForm() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/account-application/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registeredCompanyName: form.registeredCompanyName,
          acn: form.acn,
          tradingName: form.tradingName,
          abn: form.abn,
          billingAddress: form.billingAddress,
          deliveryAddress: form.deliveryAddress,
          mainPhone: form.mainPhone,
          website: form.website,
          apName: form.apName,
          apEmail: form.apEmail,
          apPhone: form.apPhone,
          purchasingName: form.purchasingName,
          purchasingEmail: form.purchasingEmail,
          purchasingPhone: form.purchasingPhone,
          poRequired: form.poRequired === "" ? null : form.poRequired === "yes",
          authorisedName: form.authorisedName,
          position: form.position,
          confirmed: form.confirmed,
          [HONEYPOT_FIELD]: form.companyWebsiteConfirm,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!response.ok || !payload?.ok) {
        setError(payload?.error || "Could not send the application.");
        setPending(false);
        return;
      }
      setDone(true);
      setPending(false);
    } catch {
      setError("Could not send the application.");
      setPending(false);
    }
  }

  return (
    <main className="bg-[#f3f0e6] px-3 py-6 text-[#12151a] sm:px-6 sm:py-10">
      <article className="relative mx-auto max-w-3xl border border-neutral-800 bg-white">
        <div className="h-1.5 bg-[#fee100]" />
        <header className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <BrandLogo className="h-9 sm:h-11" priority />
          <div className="sm:text-right">
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-[1.65rem]">
              Trade Account Application
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-neutral-700">{SUPPLIER_NAME}</p>
            <p className="text-xs text-neutral-700">{SUPPLIER_ABN}</p>
            <p className="text-xs text-neutral-700">{SUPPLIER_CONTACT}</p>
          </div>
        </header>
        <div className="h-1.5 bg-[#fee100]" />

        {done ? (
          <div className="px-4 py-8 sm:px-6" role="status">
            <h2 className="font-heading text-xl font-semibold">Thank you</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed">
              We have received the trade account application for {form.registeredCompanyName}. We
              will reply to {form.apEmail}.
            </p>
            <p className="mt-4 text-sm">
              <a className="font-medium underline underline-offset-2" href={PDF_PUBLIC_PATH}>
                Download PDF version
              </a>
            </p>
          </div>
        ) : (
          <form className="flex flex-col" onSubmit={onSubmit}>
            <div className="flex flex-col gap-2 px-4 py-3 text-xs leading-relaxed text-neutral-700 sm:px-6">
              <p>{INTRO_LINE}</p>
              <p>
                <a className="font-semibold text-[#12151a] underline underline-offset-2" href={PDF_PUBLIC_PATH}>
                  Download PDF version
                </a>
              </p>
            </div>

            <div
              className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden"
              aria-hidden="true"
            >
              <label htmlFor="company-website-confirm">Leave this field blank</label>
              <input
                id="company-website-confirm"
                name={HONEYPOT_FIELD}
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={form.companyWebsiteConfirm}
                onChange={(event) => set("companyWebsiteConfirm", event.target.value)}
              />
            </div>

            <SectionTitle>CUSTOMER DETAILS</SectionTitle>
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-6">
              <Field label="Registered company name" required className="sm:col-span-1">
                <input
                  className={inputClass}
                  required
                  maxLength={200}
                  autoComplete="organization"
                  value={form.registeredCompanyName}
                  onChange={(event) => set("registeredCompanyName", event.target.value)}
                />
              </Field>
              <Field label="ACN">
                <input
                  className={inputClass}
                  inputMode="numeric"
                  maxLength={11}
                  autoComplete="off"
                  value={form.acn}
                  onChange={(event) => set("acn", event.target.value)}
                />
              </Field>
              <Field label="Trading name (if different)">
                <input
                  className={inputClass}
                  maxLength={200}
                  value={form.tradingName}
                  onChange={(event) => set("tradingName", event.target.value)}
                />
              </Field>
              <Field label="ABN" required>
                <input
                  className={inputClass}
                  required
                  inputMode="numeric"
                  maxLength={14}
                  autoComplete="off"
                  value={form.abn}
                  onChange={(event) => set("abn", event.target.value)}
                />
              </Field>
              <Field label="Billing address" required>
                <textarea
                  className={areaClass}
                  required
                  maxLength={1000}
                  autoComplete="billing street-address"
                  value={form.billingAddress}
                  onChange={(event) => set("billingAddress", event.target.value)}
                />
              </Field>
              <Field label="Delivery address">
                <textarea
                  className={areaClass}
                  maxLength={1000}
                  autoComplete="shipping street-address"
                  value={form.deliveryAddress}
                  onChange={(event) => set("deliveryAddress", event.target.value)}
                />
              </Field>
              <Field label="Main phone" required>
                <input
                  className={inputClass}
                  required
                  type="tel"
                  maxLength={40}
                  autoComplete="tel"
                  value={form.mainPhone}
                  onChange={(event) => set("mainPhone", event.target.value)}
                />
              </Field>
              <Field label="Website (optional)">
                <input
                  className={inputClass}
                  maxLength={200}
                  inputMode="url"
                  autoComplete="url"
                  value={form.website}
                  onChange={(event) => set("website", event.target.value)}
                />
              </Field>
            </div>

            <SectionTitle>ACCOUNTS PAYABLE CONTACT</SectionTitle>
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-3 sm:px-6">
              <Field label="Name" required>
                <input
                  className={inputClass}
                  required
                  maxLength={120}
                  autoComplete="name"
                  value={form.apName}
                  onChange={(event) => set("apName", event.target.value)}
                />
              </Field>
              <Field label="Email for invoices" required>
                <input
                  className={inputClass}
                  required
                  type="email"
                  maxLength={200}
                  autoComplete="email"
                  value={form.apEmail}
                  onChange={(event) => set("apEmail", event.target.value)}
                />
              </Field>
              <Field label="Phone">
                <input
                  className={inputClass}
                  type="tel"
                  maxLength={40}
                  autoComplete="tel"
                  value={form.apPhone}
                  onChange={(event) => set("apPhone", event.target.value)}
                />
              </Field>
            </div>

            <SectionTitle>PURCHASING CONTACT</SectionTitle>
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-3 sm:px-6">
              <Field label="Name">
                <input
                  className={inputClass}
                  maxLength={120}
                  value={form.purchasingName}
                  onChange={(event) => set("purchasingName", event.target.value)}
                />
              </Field>
              <Field label="Email">
                <input
                  className={inputClass}
                  type="email"
                  maxLength={200}
                  value={form.purchasingEmail}
                  onChange={(event) => set("purchasingEmail", event.target.value)}
                />
              </Field>
              <Field label="Phone">
                <input
                  className={inputClass}
                  type="tel"
                  maxLength={40}
                  value={form.purchasingPhone}
                  onChange={(event) => set("purchasingPhone", event.target.value)}
                />
              </Field>
            </div>
            <fieldset className="px-4 pb-4 text-sm sm:px-6">
              <legend className="text-xs font-semibold">
                Is a purchase order number required on invoices?
              </legend>
              <div className="mt-2 flex gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="poRequired"
                    className="size-4 accent-[#12151a]"
                    checked={form.poRequired === "yes"}
                    onChange={() => set("poRequired", "yes")}
                    required
                  />
                  Yes
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="poRequired"
                    className="size-4 accent-[#12151a]"
                    checked={form.poRequired === "no"}
                    onChange={() => set("poRequired", "no")}
                  />
                  No
                </label>
              </div>
            </fieldset>

            <SectionTitle>TRADING TERMS</SectionTitle>
            <ul className="flex flex-col gap-2 px-4 py-4 text-sm leading-relaxed sm:px-6">
              {TRADING_TERMS.map((term) => (
                <li key={term} className="flex gap-2.5">
                  <span className="mt-1.5 size-2.5 shrink-0 bg-[#fee100]" aria-hidden="true" />
                  <span>{term}</span>
                </li>
              ))}
            </ul>

            <SectionTitle>AUTHORISATION</SectionTitle>
            <div className="flex flex-col gap-4 px-4 py-4 sm:px-6">
              <label className="flex items-start gap-3 text-sm leading-relaxed">
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-[#12151a]"
                  checked={form.confirmed}
                  onChange={(event) => set("confirmed", event.target.checked)}
                  required
                />
                <span>{AUTHORISATION_STATEMENT}</span>
              </label>
              <p className="text-xs text-neutral-600">{SIGNATURE_NOTE}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Full name" required>
                  <input
                    className={inputClass}
                    required
                    maxLength={120}
                    autoComplete="name"
                    value={form.authorisedName}
                    onChange={(event) => set("authorisedName", event.target.value)}
                  />
                </Field>
                <Field label="Position" required>
                  <input
                    className={inputClass}
                    required
                    maxLength={120}
                    autoComplete="organization-title"
                    value={form.position}
                    onChange={(event) => set("position", event.target.value)}
                  />
                </Field>
              </div>
              <p className="text-xs text-neutral-600">Date: recorded when you submit this form.</p>
              {error ? (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={pending}
                className="h-11 bg-[#12151a] text-sm font-semibold text-white disabled:opacity-60"
              >
                {pending ? "Submitting…" : "Submit application"}
              </button>
            </div>
          </form>
        )}

        <footer className="px-4 py-4 text-center text-[11px] leading-relaxed text-neutral-600 sm:px-6">
          {FOOTER_LINE}
        </footer>
      </article>
    </main>
  );
}
