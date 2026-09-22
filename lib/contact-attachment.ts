/** Optional file on a TraffLabels contact enquiry. Sent as a Resend attachment. */

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const ATTACHMENT_TYPES = [
  { ext: "csv", contentType: "text/csv" },
  { ext: "xls", contentType: "application/vnd.ms-excel" },
  { ext: "xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  { ext: "pdf", contentType: "application/pdf" },
  { ext: "png", contentType: "image/png" },
  { ext: "jpg", contentType: "image/jpeg" },
  { ext: "jpeg", contentType: "image/jpeg" },
  { ext: "txt", contentType: "text/plain" },
  { ext: "svg", contentType: "image/svg+xml" },
] as const;

export const ATTACHMENT_ACCEPT = ATTACHMENT_TYPES.map((type) => `.${type.ext}`).join(",");

export const ATTACHMENT_HELP =
  "Optional. CSV, Excel, PDF, PNG, JPG, TXT, or SVG. Up to 10 MB.";

export const ATTACHMENT_TYPE_ERROR =
  "Attach a CSV, Excel, PDF, PNG, JPG, TXT, or SVG file.";

export const ATTACHMENT_SIZE_ERROR =
  "That file is larger than 10 MB. Send a smaller file.";

export const ATTACHMENT_EMPTY_ERROR = "That file is empty.";

export type AttachmentCheck =
  | { ok: true; filename: string; contentType: string }
  | { ok: false; error: string };

export type OutboundAttachment = {
  filename: string;
  contentType: string;
  content: Buffer;
};

export type ResendAttachment = {
  filename: string;
  content: string;
  contentType: string;
};

export function attachmentExtension(filename: string) {
  const base = filename.split(/[/\\]/).pop() ?? "";
  const match = /\.([a-z0-9]+)$/i.exec(base.trim());
  return match ? match[1].toLowerCase() : "";
}

export function safeAttachmentFilename(filename: string, ext: string) {
  const base = (filename.split(/[/\\]/).pop() ?? "attachment").replace(/[\r\n\0]/g, "");
  const stem = base
    .replace(/\.[^.]+$/, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return `${stem || "attachment"}.${ext}`;
}

export function validateAttachment(file: {
  name: string;
  size: number;
}): AttachmentCheck {
  const name = file.name.trim();
  if (!name || file.size <= 0) {
    return { ok: false, error: ATTACHMENT_EMPTY_ERROR };
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, error: ATTACHMENT_SIZE_ERROR };
  }
  const ext = attachmentExtension(name);
  const type = ATTACHMENT_TYPES.find((item) => item.ext === ext);
  if (!type) {
    return { ok: false, error: ATTACHMENT_TYPE_ERROR };
  }
  return {
    ok: true,
    filename: safeAttachmentFilename(name, ext),
    contentType: type.contentType,
  };
}

/** Resend expects attachment bytes as base64, not a JSON-encoded Buffer. */
export function toResendAttachment(file: OutboundAttachment): ResendAttachment {
  return {
    filename: file.filename,
    content: file.content.toString("base64"),
    contentType: file.contentType,
  };
}
