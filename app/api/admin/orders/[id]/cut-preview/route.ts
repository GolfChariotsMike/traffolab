import { NextResponse } from "next/server";
import { loadCutPreview, previewListBody } from "./load";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const loaded = await loadCutPreview(request, id);
  if ("error" in loaded && loaded.error) {
    return loaded.error;
  }
  if (!("sheets" in loaded)) {
    return NextResponse.json({ ok: false, error: "Could not preview that cut file." }, { status: 502 });
  }
  return NextResponse.json(
    previewListBody(loaded.order.orderNumber, loaded.sheets, loaded.message ?? undefined),
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
