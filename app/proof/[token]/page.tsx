import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { ProofDecision } from "@/components/proof/proof-decision";
import { proofPlateSvg } from "@/lib/proof-plate";
import { getOrderStore } from "@/lib/order-store";
import { formatPerthDateTime, orderItemCount, type StoredPlate } from "@/lib/orders";
import {
  cleanInvoiceUrl,
  groupPlates,
  isProofToken,
  proofAddressLines,
  type ProofRecord,
} from "@/lib/proofs";
import { productName } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: `Proof | ${productName}`,
  description: "Check and approve a TraffLabels engraving proof.",
  robots: { index: false, follow: false },
};

function PlateFigure({ plate }: { plate: StoredPlate }) {
  const svg = proofPlateSvg(plate);
  const width = Math.min(560, Math.max(180, plate.widthMm * 5));
  return (
    <figure className="flex flex-col gap-2">
      <div
        className="border border-neutral-200 bg-white [&_svg]:h-auto [&_svg]:w-full"
        style={{ width: `min(100%, ${width}px)` }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <figcaption className="text-sm">
        <span className="block font-medium whitespace-pre-wrap">{plate.text || "Untitled plate"}</span>
        <span className="mt-0.5 block text-neutral-600">
          {plate.widthMm} × {plate.heightMm} mm · qty {plate.qty}
        </span>
      </figcaption>
    </figure>
  );
}

function statusBanner(proof: ProofRecord) {
  if (proof.status === "approved" && proof.approvedAt) {
    return (
      <p role="status" className="border border-emerald-700/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
        Approved by {proof.approvedName} on {formatPerthDateTime(proof.approvedAt)} (Perth).
      </p>
    );
  }
  if (proof.status === "changes_requested") {
    return (
      <div role="status" className="border border-amber-700/30 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p>
          Change request received
          {proof.changeRequestedAt ? ` on ${formatPerthDateTime(proof.changeRequestedAt)} (Perth)` : ""}.
        </p>
        {proof.changeComment ? (
          <p className="mt-2 whitespace-pre-wrap">{proof.changeComment}</p>
        ) : null}
      </div>
    );
  }
  if (proof.status === "superseded") {
    return (
      <p role="status" className="border border-red-700/30 bg-red-50 px-4 py-3 text-sm text-red-950">
        This proof is out of date. The plates changed after it was sent, so it can no longer be
        approved. Ask TraffLabels for a new link.
      </p>
    );
  }
  return null;
}

export default async function ProofPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!isProofToken(token)) notFound();
  const store = getOrderStore();
  if (!store) notFound();

  let opened: Awaited<ReturnType<typeof store.openProof>> = null;
  try {
    opened = await store.openProof(token);
  } catch (error) {
    console.error("[proof] could not open proof", error);
    notFound();
  }
  if (!opened) notFound();

  const { proof } = opened;
  const groups = groupPlates(proof.plates);
  const showGroups = groups.some((group) => group.location);
  const totalQty = orderItemCount(proof.plates);
  const invoice = cleanInvoiceUrl(proof.invoiceUrl);
  const address = proofAddressLines(proof.shipping);
  const banner = statusBanner(proof);

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="h-1 bg-[#fee100]" />
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4">
          <BrandLogo className="h-8" priority />
        </div>
      </header>
      <article className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8">
        <header className="flex flex-col gap-2">
          <p className="font-mono text-[11px] tracking-[0.16em] text-neutral-500 uppercase">
            Production proof · Order #{proof.orderNumber}
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {proof.customerName ? proof.customerName : "Your TraffLabels proof"}
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-neutral-600">
            White Traffolyte, black engraving, adhesive-backed. Each plate is drawn with the same
            legend fit as the cut file.
          </p>
        </header>

        <section className="grid gap-6 border bg-white p-4 sm:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold">Customer</h2>
            <p className="mt-1 text-sm">{proof.customerName || "—"}</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold">Delivery</h2>
            {proof.shipping.name && proof.shipping.name !== proof.customerName ? (
              <p className="mt-1 text-sm">{proof.shipping.name}</p>
            ) : null}
            {address.length > 0 ? (
              <p className="mt-1 text-sm whitespace-pre-line">{address.join("\n")}</p>
            ) : (
              <p className="mt-1 text-sm text-neutral-500">No delivery address on this order.</p>
            )}
          </div>
          {invoice ? (
            <p className="sm:col-span-2">
              <a
                href={invoice}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium underline underline-offset-2"
              >
                View invoice
              </a>
            </p>
          ) : null}
        </section>

        <section className="flex flex-col gap-8">
          {groups.map((group, groupIndex) => (
            <div key={`${group.location}-${groupIndex}`} className="flex flex-col gap-4">
              {showGroups ? (
                <h2 className="font-heading text-xl font-semibold">
                  {group.location || "No location"}
                </h2>
              ) : null}
              <ul className="flex flex-col gap-6">
                {group.plates.map(({ plate, index }) => (
                  <li key={`${plate.text}-${index}`}>
                    <PlateFigure plate={plate} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="border-t pt-4 text-sm font-medium">
            Total: {totalQty} {totalQty === 1 ? "plate" : "plates"}
            {proof.plates.length !== totalQty
              ? ` · ${proof.plates.length} ${proof.plates.length === 1 ? "legend" : "legends"}`
              : ""}
          </p>
        </section>

        <section className="flex flex-col gap-4">
          {banner}
          {proof.status === "pending" ? <ProofDecision token={proof.token} /> : null}
        </section>
      </article>
    </div>
  );
}
