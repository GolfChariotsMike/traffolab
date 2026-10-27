/**
 * Customer proof links. Pure helpers — no database.
 * The token is the access control. It is not the order id.
 */

import { createHash, randomBytes } from "node:crypto";
import {
  countryLabel,
  formatPerthDateTime,
  type SavedOrder,
  type ShippingAddress,
  type StoredPlate,
} from "@/lib/orders";

export const PROOF_STATUSES = [
  "pending",
  "approved",
  "changes_requested",
  "superseded",
] as const;
export type ProofStatus = (typeof PROOF_STATUSES)[number];

export const APPROVAL_STATEMENT =
  "I've checked the spelling, wording, sizes and quantities and approve this proof for production";

export const PROOF_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export class ProofSchemaError extends Error {
  constructor() {
    super("Proofs table is missing");
    this.name = "ProofSchemaError";
  }
}

export const PROOF_MIGRATION_HINT =
  "Proofs are not available until db/migrations/20261027_trafflabels_proofs.sql is applied.";

export type ProofRecord = {
  id: string;
  orderId: string;
  orderNumber: number;
  token: string;
  createdAt: string;
  status: ProofStatus;
  plates: StoredPlate[];
  platesHash: string;
  customerName: string;
  shipping: ShippingAddress;
  invoiceUrl: string;
  approvedName: string;
  approvedAt: string | null;
  approvedIp: string;
  approvedUserAgent: string;
  approvalStatement: string;
  changeComment: string;
  changeRequestedAt: string | null;
  changeIp: string;
  changeUserAgent: string;
};

export type ProofSummaryState =
  | "not_sent"
  | "awaiting"
  | "approved"
  | "changes_requested"
  | "superseded";

export type ProofSummary = {
  state: ProofSummaryState;
  token: string | null;
  createdAt: string | null;
  approvedName: string;
  approvedAt: string | null;
  changeComment: string;
  changeRequestedAt: string | null;
  invoiceUrl: string;
};

export const EMPTY_PROOF_SUMMARY: ProofSummary = {
  state: "not_sent",
  token: null,
  createdAt: null,
  approvedName: "",
  approvedAt: null,
  changeComment: "",
  changeRequestedAt: null,
  invoiceUrl: "",
};

export type PlateGroup = {
  location: string;
  plates: Array<{ plate: StoredPlate; index: number }>;
};

export type ProofDecisionInput =
  | { action: "approve"; name: string; ip: string; userAgent: string }
  | { action: "changes"; comment: string; ip: string; userAgent: string };

export type ProofDecisionResult =
  | { ok: true; proof: ProofRecord; changed: boolean }
  | { ok: false; code: "not_found" | "superseded" | "closed" };

export function newProofToken() {
  return randomBytes(32).toString("base64url");
}

export function isProofToken(value: string) {
  return PROOF_TOKEN_RE.test(value);
}

export function proofPath(token: string) {
  return `/proof/${token}`;
}

/** Plate fields that change what is cut or how the proof is grouped. Prices are excluded. */
export function canonicalPlates(plates: StoredPlate[]) {
  return plates.map((plate) => ({
    widthMm: plate.widthMm,
    heightMm: plate.heightMm,
    qty: plate.qty,
    text: plate.text,
    location: (plate.location ?? "").trim(),
    colourPair: plate.colourPair,
    adhesive3m: plate.adhesive3m === true,
    objects: plate.objects.map((object) => ({
      text: object.text,
      x: object.x,
      y: object.y,
      fontSize: object.fontSize,
      align: object.align,
    })),
  }));
}

export function platesApprovalHash(plates: StoredPlate[]) {
  return createHash("sha256").update(JSON.stringify(canonicalPlates(plates))).digest("hex");
}

export function platesMatchProof(orderPlates: StoredPlate[], proof: Pick<ProofRecord, "plates" | "platesHash">) {
  return (
    platesApprovalHash(orderPlates) === proof.platesHash &&
    platesApprovalHash(proof.plates) === proof.platesHash
  );
}

export function proofSummary(order: SavedOrder, proof: ProofRecord | null): ProofSummary {
  if (!proof) return { ...EMPTY_PROOF_SUMMARY };
  const base: ProofSummary = {
    state: "awaiting",
    token: proof.token,
    createdAt: proof.createdAt,
    approvedName: proof.approvedName,
    approvedAt: proof.approvedAt,
    changeComment: proof.changeComment,
    changeRequestedAt: proof.changeRequestedAt,
    invoiceUrl: proof.invoiceUrl,
  };
  if (proof.status === "superseded" || !platesMatchProof(order.plates, proof)) {
    return { ...base, state: "superseded" };
  }
  if (proof.status === "approved") return { ...base, state: "approved" };
  if (proof.status === "changes_requested") return { ...base, state: "changes_requested" };
  return base;
}

export function proofStatusText(summary: ProofSummary) {
  if (summary.state === "not_sent") return "Not sent";
  if (summary.state === "awaiting") return "Awaiting approval";
  if (summary.state === "approved") {
    const when = summary.approvedAt ? formatPerthDateTime(summary.approvedAt) : "";
    const name = summary.approvedName || "the customer";
    return when ? `Approved by ${name} on ${when} (Perth)` : `Approved by ${name}`;
  }
  if (summary.state === "changes_requested") {
    const comment = summary.changeComment.trim();
    return comment ? `Changes requested — ${comment}` : "Changes requested";
  }
  return "Superseded — send a new proof";
}

export function groupPlates(plates: StoredPlate[]): PlateGroup[] {
  const groups: PlateGroup[] = [];
  const indexByKey = new Map<string, number>();
  plates.forEach((plate, index) => {
    const location = (plate.location ?? "").trim();
    const key = location.toLocaleLowerCase("en-AU");
    const existing = indexByKey.get(key);
    if (existing === undefined) {
      indexByKey.set(key, groups.length);
      groups.push({ location, plates: [{ plate, index }] });
    } else {
      groups[existing].plates.push({ plate, index });
    }
  });
  const named = groups.filter((group) => group.location);
  if (named.length === 0) return groups;
  const unnamed = groups.filter((group) => !group.location);
  return [...named, ...unnamed];
}

export function proofAddressLines(shipping: ShippingAddress) {
  return [
    shipping.line1,
    shipping.line2,
    [shipping.city, shipping.state, shipping.postalCode].filter(Boolean).join(" "),
    countryLabel(shipping.country),
  ]
    .map((line) => line.trim())
    .filter(Boolean);
}

/** https URL on stripe.com or a stripe.com subdomain. Blank is allowed. */
export function cleanInvoiceUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length > 500) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (host !== "stripe.com" && !host.endsWith(".stripe.com")) return null;
  return url.toString();
}

export function cleanApproverName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/\s+/g, " ").trim();
  if (name.length < 3 || name.length > 120) return null;
  if (!/^[\p{L}\p{M}][\p{L}\p{M}'. -]*[\p{L}\p{M}.]$/u.test(name)) return null;
  const words = name.split(" ").filter(Boolean);
  if (words.length < 2) return null;
  return name;
}

export function cleanChangeComment(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const comment = value.replace(/\r\n/g, "\n").trim();
  if (!comment || comment.length > 2000) return null;
  return comment;
}

export function requestClientMeta(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = (forwarded.split(",")[0] || request.headers.get("x-real-ip") || "")
    .trim()
    .slice(0, 200);
  const userAgent = (request.headers.get("user-agent") ?? "").trim().slice(0, 500);
  return { ip, userAgent };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function proofNotificationCopy(input: {
  kind: "approved" | "changes";
  orderNumber: number;
  customerName: string;
  actorName: string;
  comment: string;
  at: string;
  proofUrl: string;
  ip: string;
  userAgent: string;
}) {
  const when = formatPerthDateTime(input.at);
  const who = input.customerName || "Customer";
  const subject =
    input.kind === "approved"
      ? `TraffLabels proof approved — order #${input.orderNumber}`
      : `TraffLabels proof changes requested — order #${input.orderNumber}`;
  const lead =
    input.kind === "approved"
      ? `${input.actorName} approved the proof for ${who} (order #${input.orderNumber}) on ${when} (Perth).`
      : `${who} requested changes on the proof for order #${input.orderNumber} on ${when} (Perth).`;
  const lines = [
    lead,
    "",
    input.kind === "changes" ? `Comment: ${input.comment}` : `Approved name: ${input.actorName}`,
    "",
    `Proof: ${input.proofUrl}`,
    `IP: ${input.ip || "(not recorded)"}`,
    `Browser: ${input.userAgent || "(not recorded)"}`,
    "",
    "This notice went to the workshop only. The customer was not emailed.",
  ];
  const text = lines.filter((line, index) => !(line === "" && lines[index - 1] === "")).join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#12151a;">
<p>${escapeHtml(lead)}</p>
${
  input.kind === "changes"
    ? `<p style="white-space:pre-wrap;">${escapeHtml(input.comment)}</p>`
    : `<p>Approved name: ${escapeHtml(input.actorName)}</p>`
}
<p><a href="${escapeHtml(input.proofUrl)}">Open the proof</a></p>
<p style="color:#64748b;font-size:13px;">IP: ${escapeHtml(input.ip || "(not recorded)")}<br>Browser: ${escapeHtml(input.userAgent || "(not recorded)")}</p>
<p style="color:#64748b;font-size:13px;">This notice went to the workshop only. The customer was not emailed.</p>
</div>`;
  return { subject, text, html };
}
