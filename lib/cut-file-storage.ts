import { zipStore } from "@/lib/zip";
import {
  CUSTOM_CUT_BUCKET,
  CUSTOM_CUT_SIGN_SECONDS,
  customCutObjectPath,
  type CustomCutFile,
} from "@/lib/custom-cut-file";

export class CutFileStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CutFileStorageError";
  }
}

export type CutFileStorage = {
  url: string;
  serviceRoleKey: string;
  fetchImpl?: typeof fetch;
};

export function cutFileStorageFromEnv(): CutFileStorage | null {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).trim().replace(/\/$/, "");
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !serviceRoleKey) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  } catch {
    return null;
  }
  return { url, serviceRoleKey };
}

function originOf(url: string) {
  return new URL(url).origin;
}

function encodeObjectPath(path: string) {
  return path.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

function authHeaders(storage: CutFileStorage, extra?: Record<string, string>) {
  return {
    Authorization: `Bearer ${storage.serviceRoleKey}`,
    apikey: storage.serviceRoleKey,
    ...extra,
  };
}

function caller(storage: CutFileStorage) {
  return storage.fetchImpl ?? fetch;
}

/**
 * Turn the Storage sign response into an absolute signed URL on this project.
 * Public object URLs and any other host are refused.
 */
export function signedCutFileUrl(supabaseUrl: string, payload: unknown, filename: string) {
  if (!payload || typeof payload !== "object") {
    throw new CutFileStorageError("Cut-file signing did not return a URL.");
  }
  const record = payload as { signedURL?: unknown; signedUrl?: unknown };
  const relative = typeof record.signedURL === "string" ? record.signedURL : "";
  const absoluteRaw = typeof record.signedUrl === "string" ? record.signedUrl : "";
  const raw = relative || absoluteRaw;
  if (!raw) throw new CutFileStorageError("Cut-file signing did not return a URL.");

  const origin = originOf(supabaseUrl);
  let absolute: URL;
  if (raw.startsWith("https://") || raw.startsWith("http://")) {
    absolute = new URL(raw);
  } else if (raw.startsWith("/storage/v1/")) {
    absolute = new URL(raw, origin);
  } else if (raw.startsWith("/object/")) {
    absolute = new URL(`/storage/v1${raw}`, origin);
  } else {
    throw new CutFileStorageError("Cut-file URL was not a signed URL.");
  }

  if (absolute.origin !== origin) {
    throw new CutFileStorageError("Cut-file URL was not a signed URL.");
  }
  if (absolute.pathname.includes("/object/public/")) {
    throw new CutFileStorageError("Refusing a public cut-file URL.");
  }
  if (!absolute.pathname.includes("/storage/v1/object/sign/")) {
    throw new CutFileStorageError("Cut-file URL was not a signed URL.");
  }
  if (!absolute.searchParams.get("download")) {
    absolute.searchParams.set("download", filename);
  }
  return absolute.toString();
}

function assertOwned(orderNumber: number, file: CustomCutFile) {
  if (file.path !== customCutObjectPath(orderNumber, file.filename)) {
    throw new CutFileStorageError("Cut file path does not belong to this order.");
  }
}

export async function createCutFileSignedUrl(
  storage: CutFileStorage,
  orderNumber: number,
  file: CustomCutFile
) {
  assertOwned(orderNumber, file);
  const signUrl = `${originOf(storage.url)}/storage/v1/object/sign/${CUSTOM_CUT_BUCKET}/${encodeObjectPath(file.path)}`;
  const response = await caller(storage)(signUrl, {
    method: "POST",
    headers: authHeaders(storage, { "Content-Type": "application/json" }),
    body: JSON.stringify({ expiresIn: CUSTOM_CUT_SIGN_SECONDS }),
  });
  if (!response.ok) {
    throw new CutFileStorageError("Could not sign the cut file.");
  }
  const payload = (await response.json().catch(() => null)) as unknown;
  return signedCutFileUrl(storage.url, payload, file.filename);
}

export async function uploadCutFileObject(
  storage: CutFileStorage,
  orderNumber: number,
  file: CustomCutFile,
  bytes: Uint8Array,
  contentType: string
) {
  assertOwned(orderNumber, file);
  const url = `${originOf(storage.url)}/storage/v1/object/${CUSTOM_CUT_BUCKET}/${encodeObjectPath(file.path)}`;
  const response = await caller(storage)(url, {
    method: "POST",
    headers: authHeaders(storage, {
      "Content-Type": contentType,
      "x-upsert": "true",
      "cache-control": "private, max-age=0",
    }),
    body: Buffer.from(bytes),
  });
  if (!response.ok) {
    throw new CutFileStorageError("Could not store that cut file.");
  }
}

export async function deleteCutFileObjects(
  storage: CutFileStorage,
  orderNumber: number,
  files: CustomCutFile[]
) {
  const prefixes = files.map((file) => {
    assertOwned(orderNumber, file);
    return file.path;
  });
  if (prefixes.length === 0) return;
  const url = `${originOf(storage.url)}/storage/v1/object/${CUSTOM_CUT_BUCKET}`;
  const response = await caller(storage)(url, {
    method: "DELETE",
    headers: authHeaders(storage, { "Content-Type": "application/json" }),
    body: JSON.stringify({ prefixes }),
  });
  if (!response.ok) {
    throw new CutFileStorageError("Could not remove the previous cut file.");
  }
}

export async function downloadCutFileObject(
  storage: CutFileStorage,
  orderNumber: number,
  file: CustomCutFile
) {
  assertOwned(orderNumber, file);
  const url = `${originOf(storage.url)}/storage/v1/object/${CUSTOM_CUT_BUCKET}/${encodeObjectPath(file.path)}`;
  const response = await caller(storage)(url, {
    headers: authHeaders(storage),
  });
  if (!response.ok) {
    throw new CutFileStorageError("Could not read that cut file.");
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function loadCustomCutDownload(
  storage: CutFileStorage,
  orderNumber: number,
  files: CustomCutFile[]
): Promise<
  | { kind: "redirect"; url: string }
  | { kind: "zip"; filename: string; body: Uint8Array }
> {
  if (files.length === 0) {
    throw new CutFileStorageError("This order has no custom cut file.");
  }
  if (files.length === 1) {
    return {
      kind: "redirect",
      url: await createCutFileSignedUrl(storage, orderNumber, files[0]),
    };
  }
  const entries = [];
  for (const file of files) {
    entries.push({
      name: file.filename,
      data: await downloadCutFileObject(storage, orderNumber, file),
    });
  }
  return {
    kind: "zip",
    filename: `trafflabels-order-${orderNumber}-custom-cut-files.zip`,
    body: zipStore(entries),
  };
}
