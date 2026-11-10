import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand-logo";
import { ID_TAG_HOLE, rotech1005Plates, rotech1005TagBand } from "@/lib/fixtures/rotech-1005";
import { capHeightMm } from "@/lib/label-design";
import { orderItemCount, type StoredPlate } from "@/lib/orders";
import { proofPlateSvg } from "@/lib/proof-plate";
import { productName } from "@/lib/site";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: `Review · Order #1005 | ${productName}`,
  description: "Internal preview of the proposed TraffLabels #1005 proof layout.",
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

export default function Rotech1005ReviewPage() {
  const plates = rotech1005Plates();
  const band = rotech1005TagBand();
  const totalQty = orderItemCount(plates);
  const cap = capHeightMm(6.8);

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
            Internal review · Order #1005
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Rotech Water — Paul Calneggia
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-neutral-600">
            Proposed layout for job 10257. This is not the live customer proof and cannot be
            approved here. White Traffolyte, black engraving, adhesive-backed. Price is unchanged
            at $72.05 inc GST including $10 standard postage.
          </p>
        </header>

        <section className="border bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p>
            ID tags show a {ID_TAG_HOLE.diameterMm} mm cable-tie hole, centre {ID_TAG_HOLE.cx} mm
            from the left and {ID_TAG_HOLE.cy} mm from the top (vertically centred). The drawing
            did not dimension the hole. A 4 mm centre does not leave enough width for NRV-01 or
            NRV-02 at {cap} mm cap height, so the hole is 0.7 mm closer to the left edge. Legend
            text is centred in the remaining band ({band.left}–{band.right} mm).
          </p>
          <p className="mt-2">
            The nameplate keeps the specified 100 × 75 mm size. Title and company name are bold;
            the other lines follow the drawing&apos;s grouping and vertical rhythm, scaled onto
            the taller 75 mm plate (the drawing itself is not to scale).
          </p>
        </section>

        <section className="flex flex-col gap-6">
          <ul className="flex flex-col gap-6">
            {plates.map((plate, index) => (
              <li key={`${plate.text}-${index}`}>
                <PlateFigure plate={plate} />
              </li>
            ))}
          </ul>
          <p className="border-t pt-4 text-sm font-medium">
            Total: {totalQty} plates · {plates.length} legends
          </p>
        </section>
      </article>
    </div>
  );
}
