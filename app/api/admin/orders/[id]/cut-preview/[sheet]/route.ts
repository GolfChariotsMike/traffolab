import { NextResponse } from "next/server";
import { loadCutPreview } from "../load";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sheetIndex(value: string) {
  if (!/^[0-9]+$/.test(value)) return null;
  const index = Number(value);
  if (!Number.isInteger(index) || index < 0 || index > 23) return null;
  return index;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; sheet: string }> }
) {
  const { id, sheet } = await params;
  const index = sheetIndex(sheet);
  if (index === null) {
    return NextResponse.json({ ok: false, error: "Unknown sheet." }, { status: 404 });
  }
  const loaded = await loadCutPreview(request, id);
  if ("error" in loaded && loaded.error) {
    return loaded.error;
  }
  if (!("sheets" in loaded)) {
    return NextResponse.json({ ok: false, error: "Could not preview that cut file." }, { status: 502 });
  }
  const chosen = loaded.sheets[index];
  if (!chosen) {
    return NextResponse.json({ ok: false, error: "Unknown sheet." }, { status: 404 });
  }
  return new NextResponse(Buffer.from(chosen.body), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `inline; filename="${chosen.name.split("/").pop()?.replace(/["\r\n\\]/g, "") ?? "sheet.svg"}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:",
      "Referrer-Policy": "no-referrer",
    },
  });
}
