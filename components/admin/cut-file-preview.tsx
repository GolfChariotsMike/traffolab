"use client";

import { useEffect, useId, useState } from "react";
import { Download, X } from "lucide-react";
import { CUT_PREVIEW_FONT_NOTE, CUT_PREVIEW_LOCKED } from "@/lib/cut-file-preview";

type PreviewSheet = {
  name: string;
  href: string;
};

type PreviewPayload = {
  ok?: boolean;
  error?: string;
  fontNote?: string;
  message?: string | null;
  sheets?: PreviewSheet[];
};

export function CutFilePreview({
  orderNumber,
  downloadHold,
}: {
  orderNumber: number;
  downloadHold: string | null;
}) {
  const titleId = useId();
  const [payload, setPayload] = useState<PreviewPayload | null>(null);
  const [loading, setLoading] = useState(!downloadHold);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (downloadHold) return;
    let cancelled = false;
    fetch(`/api/admin/orders/${orderNumber}/cut-preview/`)
      .then((response) => response.json().catch(() => null))
      .then((data: PreviewPayload | null) => {
        if (cancelled) return;
        setPayload(data ?? { ok: false, error: "Could not preview that cut file." });
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPayload({ ok: false, error: "Could not preview that cut file." });
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderNumber, downloadHold]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const sheets = payload?.sheets ?? [];
  const fontNote = payload?.fontNote || CUT_PREVIEW_FONT_NOTE;
  const thumb = sheets[0];

  return (
    <section className="mt-4">
      <h3 className="text-sm font-semibold">Cut file</h3>
      {downloadHold ? (
        <div className="mt-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled
            className="inline-flex size-10 cursor-not-allowed items-center justify-center rounded-full bg-white/10 text-white/35"
            aria-label={`${downloadHold}. Download unavailable for order ${orderNumber}`}
            title={downloadHold}
          >
            <Download className="size-4" />
          </button>
          <p className="text-sm text-white/70">{CUT_PREVIEW_LOCKED}</p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          {thumb ? (
            <button
              type="button"
              className="w-28 shrink-0 border border-white/20 bg-white p-1 sm:w-32"
              onClick={() => setOpen(true)}
              aria-label={`Preview cut file for order ${orderNumber}`}
            >
              {/* The img is the cut file itself. next/image would reprocess those bytes. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumb.href}
                alt=""
                className="h-16 w-full bg-white object-contain sm:h-20"
              />
            </button>
          ) : (
            <span className="inline-flex h-16 w-28 shrink-0 items-center justify-center border border-white/15 bg-white/5 text-[11px] text-white/40 sm:h-20 sm:w-32">
              {loading ? "Loading…" : "No preview"}
            </span>
          )}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <a
              href={`/api/admin/orders/${orderNumber}/files/`}
              className="inline-flex size-10 items-center justify-center rounded-full bg-[#fee100] text-[#12151a] hover:bg-[#ffe866]"
              aria-label={`Download cut file for order ${orderNumber}`}
            >
              <Download className="size-4" />
            </a>
            <button
              type="button"
              className="h-10 rounded-lg border border-white/20 px-3 text-sm text-paper hover:bg-white/10"
              onClick={() => setOpen(true)}
              aria-expanded={open}
            >
              Preview cut file
            </button>
          </div>
        </div>
      )}
      {!downloadHold && payload?.message ? (
        <p className="mt-2 text-sm text-white/70">{payload.message}</p>
      ) : null}
      {!downloadHold && payload && payload.ok === false ? (
        <p role="alert" className="mt-2 text-sm text-red-300">
          {payload.error || "Could not preview that cut file."}
        </p>
      ) : null}
      {!downloadHold && sheets.length > 0 ? (
        <p className="mt-2 text-xs text-white/50">{fontNote}</p>
      ) : null}

      {open && !downloadHold ? (
        <div
          className="fixed inset-0 z-[60] overflow-y-auto bg-[#0e0e10] px-3 py-4 sm:px-6 sm:py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="mx-auto w-full max-w-4xl">
            <div className="flex items-start justify-between gap-3">
              <h2 id={titleId} className="font-heading text-lg font-semibold text-paper">
                Cut file preview
              </h2>
              <button
                type="button"
                className="rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white"
                onClick={() => setOpen(false)}
                aria-label="Close preview"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-2 text-sm text-white/70">{fontNote}</p>
            {sheets.length === 0 ? (
              <p className="mt-4 text-sm text-white/70">
                {loading ? "Loading…" : payload?.message || payload?.error || "No preview."}
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-4">
                {sheets.map((sheet) => (
                  <figure key={sheet.href} className="min-w-0">
                    <figcaption className="mb-1 font-mono text-xs break-all text-white/60">
                      {sheet.name}
                    </figcaption>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={sheet.href}
                      alt={sheet.name}
                      className="h-auto w-full bg-white"
                    />
                  </figure>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
