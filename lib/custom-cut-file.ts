/**
 * Hand-made LightBurn files stored in the private trafflabels-cut-files bucket.
 * Paths are always orders/<order number>/<filename>. The browser never receives
 * a public object URL.
 */

export const CUSTOM_CUT_BUCKET = "trafflabels-cut-files";
export const CUSTOM_CUT_MAX_FILES = 8;
/** Matches the bucket file_size_limit (10 MiB). */
export const CUSTOM_CUT_MAX_BYTES = 10 * 1024 * 1024;
export const CUSTOM_CUT_NOTE_MAX = 500;
export const CUSTOM_CUT_SIGN_SECONDS = 120;

const EXTENSIONS = [".lbrn2", ".lbrn", ".svg", ".zip"] as const;
const FILENAME_RE = /^[A-Za-z0-9][A-Za-z0-9._ -]{0,179}$/;

export type CustomCutFile = {
  path: string;
  filename: string;
  uploadedAt: string;
  note: string;
};

export function cutFileExtension(filename: string) {
  const lower = filename.toLowerCase();
  return EXTENSIONS.find((ext) => lower.endsWith(ext)) ?? null;
}

/** Basename only. Rejects traversal and anything that is not SVG, LBRN, or zip. */
export function cleanCutFilename(value: string): string | null {
  const base = value.replace(/\\/g, "/").split("/").pop()?.trim() ?? "";
  if (!base || base.length > 180 || !FILENAME_RE.test(base)) return null;
  if (base.includes("..")) return null;
  if (!cutFileExtension(base)) return null;
  return base;
}

export function customCutObjectPath(orderNumber: number, filename: string) {
  return `orders/${orderNumber}/${filename}`;
}

/**
 * Content-Type the private bucket accepts.
 * Zip is sent as application/octet-stream because the bucket allow-list does
 * not include application/zip.
 */
export function customCutContentType(filename: string): string | null {
  const ext = cutFileExtension(filename);
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".lbrn" || ext === ".lbrn2") return "application/xml";
  if (ext === ".zip") return "application/octet-stream";
  return null;
}

export function cleanCutNote(value: unknown): string | null {
  if (value == null) return "";
  if (typeof value !== "string") return null;
  const note = value.replace(/\s+/g, " ").trim();
  if (note.length > CUSTOM_CUT_NOTE_MAX) return null;
  return note;
}

export function cutFileBytesLookValid(filename: string, bytes: Uint8Array) {
  const ext = cutFileExtension(filename);
  if (!ext || bytes.length < 1 || bytes.length > CUSTOM_CUT_MAX_BYTES) return false;
  if (ext === ".zip") {
    return (
      bytes.length >= 4 &&
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)
    );
  }
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.subarray(0, 4096))
    .trimStart()
    .toLowerCase();
  if (ext === ".svg") return head.includes("<svg");
  return head.startsWith("<");
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function parseOne(item: unknown, orderNumber: number): CustomCutFile | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const filename = typeof record.filename === "string" ? cleanCutFilename(record.filename) : null;
  if (!filename || !Number.isInteger(orderNumber) || orderNumber < 1) return null;
  const path = customCutObjectPath(orderNumber, filename);
  if (record.path !== path) return null;
  const uploaded = record.uploaded_at ?? record.uploadedAt;
  const uploadedAt = typeof uploaded === "string" ? uploaded.trim().slice(0, 40) : "";
  const note = cleanCutNote(typeof record.note === "string" ? record.note : "");
  if (note === null) return null;
  return { path, filename, uploadedAt, note };
}

/** Drops entries whose path is not this order's object key. */
export function parseCustomCutFiles(value: unknown, orderNumber: number): CustomCutFile[] {
  const raw = typeof value === "string" ? safeJson(value) : value;
  if (!Array.isArray(raw)) return [];
  const files: CustomCutFile[] = [];
  for (const item of raw) {
    const parsed = parseOne(item, orderNumber);
    if (!parsed) continue;
    if (files.some((file) => file.filename === parsed.filename)) continue;
    files.push(parsed);
    if (files.length >= CUSTOM_CUT_MAX_FILES) break;
  }
  return files;
}

export function customCutFileToDb(file: CustomCutFile) {
  return {
    path: file.path,
    filename: file.filename,
    uploaded_at: file.uploadedAt,
    note: file.note,
  };
}

export function mergeCustomCutFile(
  current: CustomCutFile[],
  added: CustomCutFile,
  mode: "add" | "replace"
):
  | { ok: true; files: CustomCutFile[]; removed: CustomCutFile[] }
  | { ok: false; error: string } {
  if (mode === "replace") {
    return {
      ok: true,
      files: [added],
      removed: current.filter((file) => file.path !== added.path),
    };
  }
  const next = [...current.filter((file) => file.filename !== added.filename), added];
  if (next.length > CUSTOM_CUT_MAX_FILES) {
    return {
      ok: false,
      error: `An order can have at most ${CUSTOM_CUT_MAX_FILES} custom cut files.`,
    };
  }
  return {
    ok: true,
    files: next,
    removed: current.filter((file) => file.filename === added.filename && file.path !== added.path),
  };
}

export function withoutCustomCutFile(current: CustomCutFile[], filename: string) {
  return {
    files: current.filter((file) => file.filename !== filename),
    removed: current.filter((file) => file.filename === filename),
  };
}

/**
 * Custom files win unless the caller explicitly asks for the auto-generated zip.
 * An unknown filename is missing, so the route cannot fall through to Arial.
 */
export function planCutDownload(input: {
  customCutFiles: CustomCutFile[] | null | undefined;
  source: string | null;
  file: string | null;
}): { kind: "auto" } | { kind: "custom"; files: CustomCutFile[] } | { kind: "missing" } {
  if (input.source === "auto") return { kind: "auto" };
  const custom = input.customCutFiles ?? [];
  if (custom.length === 0) return { kind: "auto" };
  const requested = input.file?.trim() ?? "";
  if (!requested) return { kind: "custom", files: custom };
  const match = custom.filter((item) => item.filename === requested);
  if (match.length !== 1) return { kind: "missing" };
  return { kind: "custom", files: match };
}

export function customCutFilesHref(orderNumber: number, filename?: string) {
  const params = new URLSearchParams();
  if (filename) params.set("file", filename);
  const query = params.toString();
  return `/api/admin/orders/${orderNumber}/files/${query ? `?${query}` : ""}`;
}

export function autoGeneratedCutHref(orderNumber: number) {
  return `/api/admin/orders/${orderNumber}/files/?source=auto`;
}
