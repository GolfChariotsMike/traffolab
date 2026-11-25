import { NextResponse } from "next/server";
import { tokenFromCookieHeader, verifyOrdersSession } from "@/lib/admin-auth";
import { cutFileHoldForOrder } from "@/lib/cut-file-access";
import {
  collectCutPreview,
  CUT_PREVIEW_FONT_NOTE,
  CUT_PREVIEW_UNPREVIEWABLE,
  type CutPreviewSheet,
} from "@/lib/cut-file-preview";
import { downloadCutFileObject, cutFileStorageFromEnv } from "@/lib/cut-file-storage";
import { getOrderStore } from "@/lib/order-store";
import type { SavedOrder } from "@/lib/orders";

function orderNumberFrom(id: string) {
  if (!/^[0-9]+$/.test(id)) return null;
  const value = Number(id);
  if (!Number.isInteger(value) || value < 1 || value > 99_999_999) return null;
  return value;
}

export async function loadCutPreview(
  request: Request,
  id: string
): Promise<
  { error: NextResponse } | { order: SavedOrder; sheets: CutPreviewSheet[]; message: string | null }
> {
  if (!verifyOrdersSession(tokenFromCookieHeader(request.headers.get("cookie")))) {
    return { error: NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 }) };
  }
  const orderNumber = orderNumberFrom(id);
  if (!orderNumber) {
    return { error: NextResponse.json({ ok: false, error: "Unknown order." }, { status: 404 }) };
  }
  const store = getOrderStore();
  if (!store) {
    return {
      error: NextResponse.json(
        { ok: false, error: "Orders database is not configured." },
        { status: 503 }
      ),
    };
  }
  const order = await store.getOrder(orderNumber);
  if (!order) {
    return { error: NextResponse.json({ ok: false, error: "Unknown order." }, { status: 404 }) };
  }
  const hold = await cutFileHoldForOrder(store, order);
  if (hold) {
    return { error: NextResponse.json({ ok: false, error: hold }, { status: 409 }) };
  }
  const custom = order.customCutFiles ?? [];
  const storage = custom.length > 0 ? cutFileStorageFromEnv() : null;
  if (custom.length > 0 && !storage) {
    return {
      error: NextResponse.json(
        {
          ok: false,
          error: "Cut file storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 503 }
      ),
    };
  }
  try {
    const preview = await collectCutPreview({
      orderNumber: order.orderNumber,
      plates: order.plates,
      customCutFiles: order.customCutFiles,
      readObject: storage
        ? (file) => downloadCutFileObject(storage, order.orderNumber, file)
        : undefined,
    });
    if (!preview.ok) {
      if (preview.code === "storage") {
        return {
          error: NextResponse.json(
            {
              ok: false,
              error: "Cut file storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
            },
            { status: 503 }
          ),
        };
      }
      if (preview.code === "empty") {
        return { error: NextResponse.json({ ok: false, error: "This order has no plates." }, { status: 404 }) };
      }
      return { order, sheets: [], message: CUT_PREVIEW_UNPREVIEWABLE };
    }
    return { order, sheets: preview.sheets, message: null };
  } catch (error) {
    console.error("[admin] cut file preview failed", error instanceof Error ? error.message : "error");
    return {
      error: NextResponse.json({ ok: false, error: "Could not preview that cut file." }, { status: 502 }),
    };
  }
}

export function previewSheetHref(orderNumber: number, index: number) {
  return `/api/admin/orders/${orderNumber}/cut-preview/${index}/`;
}

export function previewListBody(orderNumber: number, sheets: CutPreviewSheet[], message?: string) {
  return {
    ok: true as const,
    fontNote: CUT_PREVIEW_FONT_NOTE,
    message: message ?? null,
    sheets: sheets.map((sheet, index) => ({
      name: sheet.name,
      href: previewSheetHref(orderNumber, index),
    })),
  };
}
