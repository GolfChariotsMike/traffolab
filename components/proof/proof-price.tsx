import { formatAud } from "@/lib/pricing";
import {
  formatProofShippingLine,
  formatProofSizeLine,
  type ProofPriceSummary,
} from "@/lib/proofs";

export function ProofPrice({ summary }: { summary: ProofPriceSummary }) {
  return (
    <section aria-labelledby="proof-price-heading" className="border bg-white p-4">
      <h2 id="proof-price-heading" className="font-heading text-lg font-semibold">
        Price
      </h2>
      <ul className="mt-3 flex flex-col gap-1.5 text-sm">
        {summary.lines.map((line) => (
          <li key={`${line.widthMm}-${line.heightMm}-${line.unitCents}`}>{formatProofSizeLine(line)}</li>
        ))}
        <li>{formatProofShippingLine(summary)}</li>
      </ul>
      <dl className="mt-4 flex flex-col gap-1.5 border-t pt-3 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt>Subtotal ex GST</dt>
          <dd className="font-mono">{formatAud(summary.exGstCents)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt>GST 10%</dt>
          <dd className="font-mono">{formatAud(summary.gstCents)}</dd>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-4 border-t pt-3 font-semibold">
          <dt>Total inc GST</dt>
          <dd className="font-mono">{formatAud(summary.totalIncGstCents)}</dd>
        </div>
      </dl>
    </section>
  );
}
