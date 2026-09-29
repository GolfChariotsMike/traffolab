import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { CANONICAL_CHECKOUT_ORIGIN } from "@/lib/checkout-return";

export const ORDERS_COOKIE = "trafflabels_orders";
export const MAGIC_LINK_MS = 20 * 60 * 1000;
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_ADMIN_EMAIL = "info@stikstickers.com";
const DEV_AUTH_SECRET = "trafflabels-dev-auth-secret";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const JTI_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!email || email.length > 200 || !EMAIL_RE.test(email)) return null;
  return email;
}

/**
 * Comma-separated ORDERS_ADMIN_EMAILS. When the variable is unset, the
 * starting allowlist is info@stikstickers.com. An empty value allows nobody.
 */
export function adminEmails() {
  const raw = process.env.ORDERS_ADMIN_EMAILS;
  const source = raw === undefined ? DEFAULT_ADMIN_EMAIL : raw;
  const seen = new Set<string>();
  for (const part of source.split(/[,;]/)) {
    const email = normalizeEmail(part);
    if (email) seen.add(email);
  }
  return [...seen];
}

export function isAllowlistedEmail(value: string) {
  const email = normalizeEmail(value);
  if (!email) return false;
  return adminEmails().includes(email);
}

export function authSecret() {
  const configured = process.env.ORDERS_AUTH_SECRET?.trim() ?? "";
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") return "";
  return DEV_AUTH_SECRET;
}

export function dashboardConfigured() {
  return authSecret().length > 0 && adminEmails().length > 0;
}

function sign(payload: string) {
  return createHmac("sha256", authSecret()).update(payload).digest("base64url");
}

function signaturesMatch(actual: string, expected: string) {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

function encodeEmail(email: string) {
  return Buffer.from(email).toString("base64url");
}

function decodeEmail(value: string) {
  try {
    return normalizeEmail(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export type MagicLink = {
  token: string;
  jti: string;
  email: string;
  exp: number;
};

export function signMagicLink(email: string, now = Date.now()): MagicLink | null {
  if (!authSecret()) return null;
  const normalized = normalizeEmail(email);
  if (!normalized || !isAllowlistedEmail(normalized)) return null;
  const jti = randomUUID();
  const exp = now + MAGIC_LINK_MS;
  const payload = `ml1.${jti}.${encodeEmail(normalized)}.${exp}`;
  return { token: `${payload}.${sign(payload)}`, jti, email: normalized, exp };
}

export type VerifiedMagicLink = {
  jti: string;
  email: string;
  exp: number;
};

export function verifyMagicLink(token: string, now = Date.now()): VerifiedMagicLink | null {
  if (!authSecret() || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 5) return null;
  const [version, jti, emailPart, expText, signature] = parts;
  if (version !== "ml1" || !JTI_RE.test(jti)) return null;
  const exp = Number(expText);
  if (!Number.isFinite(exp) || exp <= now) return null;
  const payload = `${version}.${jti}.${emailPart}.${expText}`;
  if (!signaturesMatch(signature, sign(payload))) return null;
  const email = decodeEmail(emailPart);
  if (!email || !isAllowlistedEmail(email)) return null;
  return { jti, email, exp };
}

export function signOrdersSession(email: string, now = Date.now()) {
  if (!authSecret()) return null;
  const normalized = normalizeEmail(email);
  if (!normalized || !isAllowlistedEmail(normalized)) return null;
  const exp = now + SESSION_MS;
  const payload = `v2.${encodeEmail(normalized)}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function readOrdersSession(token: string | undefined, now = Date.now()) {
  if (!authSecret() || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [version, emailPart, expText, signature] = parts;
  if (version !== "v2") return null;
  const exp = Number(expText);
  if (!Number.isFinite(exp) || exp <= now) return null;
  if (!signaturesMatch(signature, sign(`${version}.${emailPart}.${expText}`))) return null;
  const email = decodeEmail(emailPart);
  if (!email || !isAllowlistedEmail(email)) return null;
  return { email };
}

export function verifyOrdersSession(token: string | undefined, now = Date.now()) {
  return readOrdersSession(token, now) !== null;
}

export function ordersCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_MS / 1000),
  };
}

export function tokenFromCookieHeader(header: string | null) {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    if (trimmed.slice(0, eq) !== ORDERS_COOKIE) continue;
    return decodeURIComponent(trimmed.slice(eq + 1));
  }
  return undefined;
}

/** Production links always use the public site. Local dev keeps the browser host. */
export function magicLinkOrigin(requestUrl: string) {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return CANONICAL_CHECKOUT_ORIGIN;
  }
  const hostname = url.hostname.toLowerCase();
  const local = hostname === "localhost" || hostname === "127.0.0.1";
  if (local && process.env.NODE_ENV !== "production") {
    if (url.protocol !== "http:" && url.protocol !== "https:") return CANONICAL_CHECKOUT_ORIGIN;
    return url.origin;
  }
  return CANONICAL_CHECKOUT_ORIGIN;
}

export function magicLinkUrl(origin: string, token: string) {
  const base = origin.replace(/\/$/, "");
  return `${base}/api/admin/login/verify/?token=${encodeURIComponent(token)}`;
}
