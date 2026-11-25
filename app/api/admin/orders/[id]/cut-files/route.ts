import { NextResponse } from "next/server";
import { tokenFromCookieHeader, verifyOrdersSession } from "@/lib/admin-auth";
import {
  cleanCutFilename,
  cleanCutNote,
  customCutContentType,
  customCutObjectPath,
  cutFileBytesLookValid,
  CUSTOM_CUT_MAX_BYTES,
  mergeCustomCutFile,
  withoutCustomCutFile,
  type CustomCutFile,
} from "@/lib/custom-cut-file";
import {
  CutFileStorageError,
  cutFileStorageFromEnv,
  deleteCutFileObjects,
  uploadCutFileObject,
} from "@/lib/cut-file-storage";
import { OrderUpdateError } from "@/lib/orders";
import { getOrderStore } from "@/lib/order-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function orderNumberFrom(id: string) {
  if (!/^[0-9]+$/.test(id)) return null;
  const value = Number(id);
  if (!Number.isInteger(value) || value < 1 || value > 99_999_999) return null;
  return value;
}

async function authorizedOrder(request: Request, id: string) {
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
  const storage = cutFileStorageFromEnv();
  if (!storage) {
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
  return { order, store, storage };
}

function storageFailure(error: unknown) {
  if (error instanceof OrderUpdateError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  console.error(
    "[admin] custom cut file save failed",
    error instanceof CutFileStorageError ? error.message : "error"
  );
  const message =
    error instanceof CutFileStorageError ? error.message : "Could not save that cut file.";
  return NextResponse.json({ ok: false, error: message }, { status: 502 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ready = await authorizedOrder(request, id);
  if ("error" in ready) return ready.error;
  const { order, store, storage } = ready;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const uploaded = form.get("file");
  if (!(uploaded instanceof File) || uploaded.size < 1) {
    return NextResponse.json(
      { ok: false, error: "Choose an SVG, LightBurn, or zip file." },
      { status: 400 }
    );
  }
  if (uploaded.size > CUSTOM_CUT_MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "Cut files must be 10 MB or smaller." }, { status: 400 });
  }
  const filename = cleanCutFilename(uploaded.name);
  const contentType = filename ? customCutContentType(filename) : null;
  if (!filename || !contentType) {
    return NextResponse.json(
      { ok: false, error: "Use an SVG, LightBurn (.lbrn or .lbrn2), or zip file." },
      { status: 400 }
    );
  }
  const note = cleanCutNote(form.get("note"));
  if (note === null) {
    return NextResponse.json(
      { ok: false, error: "The cut-file note must be 500 characters or fewer." },
      { status: 400 }
    );
  }
  const bytes = new Uint8Array(await uploaded.arrayBuffer());
  if (!cutFileBytesLookValid(filename, bytes)) {
    return NextResponse.json(
      { ok: false, error: "That file does not look like an SVG, LightBurn file, or zip." },
      { status: 400 }
    );
  }

  const mode = form.get("mode") === "add" ? "add" : "replace";
  const added: CustomCutFile = {
    path: customCutObjectPath(order.orderNumber, filename),
    filename,
    uploadedAt: new Date().toISOString(),
    note,
  };
  const merged = mergeCustomCutFile(order.customCutFiles ?? [], added, mode);
  if (!merged.ok) {
    return NextResponse.json({ ok: false, error: merged.error }, { status: 400 });
  }

  try {
    await uploadCutFileObject(storage, order.orderNumber, added, bytes, contentType);
    const saved = await store.setCustomCutFiles(order.orderNumber, merged.files);
    if (!saved) {
      return NextResponse.json({ ok: false, error: "Unknown order." }, { status: 404 });
    }
    if (merged.removed.length > 0) {
      try {
        await deleteCutFileObjects(storage, order.orderNumber, merged.removed);
      } catch (error) {
        console.error(
          "[admin] could not delete the replaced cut file",
          error instanceof CutFileStorageError ? error.message : "error"
        );
      }
    }
    return NextResponse.json({ ok: true, order: saved });
  } catch (error) {
    return storageFailure(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ready = await authorizedOrder(request, id);
  if ("error" in ready) return ready.error;
  const { order, store, storage } = ready;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const filename =
    body && typeof body === "object" && "filename" in body && typeof body.filename === "string"
      ? cleanCutFilename(body.filename)
      : null;
  if (!filename) {
    return NextResponse.json({ ok: false, error: "Unknown cut file." }, { status: 400 });
  }
  const next = withoutCustomCutFile(order.customCutFiles ?? [], filename);
  if (next.removed.length === 0) {
    return NextResponse.json({ ok: false, error: "That cut file is not on this order." }, { status: 404 });
  }

  try {
    const saved = await store.setCustomCutFiles(order.orderNumber, next.files);
    if (!saved) {
      return NextResponse.json({ ok: false, error: "Unknown order." }, { status: 404 });
    }
    try {
      await deleteCutFileObjects(storage, order.orderNumber, next.removed);
    } catch (error) {
      console.error(
        "[admin] could not delete the removed cut file",
        error instanceof CutFileStorageError ? error.message : "error"
      );
    }
    return NextResponse.json({ ok: true, order: saved });
  } catch (error) {
    return storageFailure(error);
  }
}
