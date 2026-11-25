import { NextResponse } from "next/server";
import { tokenFromCookieHeader, verifyOrdersSession } from "@/lib/admin-auth";
import { cutFileHoldForOrder } from "@/lib/cut-file-access";
import { planCutDownload } from "@/lib/custom-cut-file";
import { CutFileStorageError, cutFileStorageFromEnv, loadCustomCutDownload } from "@/lib/cut-file-storage";
import { buildProductionDownload } from "@/lib/production-download";
import { getOrderStore } from "@/lib/order-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function orderNumberFrom(id: string) {
  if (!/^[0-9]+$/.test(id)) return null;
  const value = Number(id);
  if (!Number.isInteger(value) || value < 1 || value > 99_999_999) return null;
  return value;
}

function attachmentName(filename: string) {
  return filename.replace(/["\r\n\\]/g, "");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyOrdersSession(tokenFromCookieHeader(request.headers.get("cookie")))) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  const { id } = await params;
  const orderNumber = orderNumberFrom(id);
  if (!orderNumber) {
    return NextResponse.json({ ok: false, error: "Unknown order." }, { status: 404 });
  }

  const store = getOrderStore();
  if (!store) {
    return NextResponse.json(
      { ok: false, error: "Orders database is not configured." },
      { status: 503 }
    );
  }

  const order = await store.getOrder(orderNumber);
  if (!order) {
    return NextResponse.json({ ok: false, error: "Unknown order." }, { status: 404 });
  }

  const hold = await cutFileHoldForOrder(store, order);
  if (hold) {
    return NextResponse.json({ ok: false, error: hold }, { status: 409 });
  }

  const url = new URL(request.url);
  const plan = planCutDownload({
    customCutFiles: order.customCutFiles,
    source: url.searchParams.get("source"),
    file: url.searchParams.get("file"),
  });
  if (plan.kind === "missing") {
    return NextResponse.json({ ok: false, error: "That cut file is not on this order." }, { status: 404 });
  }
  if (plan.kind === "custom") {
    const storage = cutFileStorageFromEnv();
    if (!storage) {
      return NextResponse.json(
        {
          ok: false,
          error: "Cut file storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 503 }
      );
    }
    try {
      const download = await loadCustomCutDownload(storage, order.orderNumber, plan.files);
      if (download.kind === "redirect") {
        const response = NextResponse.redirect(download.url, 302);
        response.headers.set("Cache-Control", "private, no-store");
        response.headers.set("Referrer-Policy", "no-referrer");
        return response;
      }
      return new NextResponse(Buffer.from(download.body), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${attachmentName(download.filename)}"`,
          "Cache-Control": "private, no-store",
        },
      });
    } catch (error) {
      console.error(
        "[admin] custom cut file download failed",
        error instanceof CutFileStorageError ? error.message : "error"
      );
      return NextResponse.json({ ok: false, error: "Could not download that cut file." }, { status: 502 });
    }
  }

  const file = buildProductionDownload(order.orderNumber, order.plates);
  if (!file) {
    return NextResponse.json({ ok: false, error: "This order has no plates." }, { status: 404 });
  }

  return new NextResponse(Buffer.from(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
