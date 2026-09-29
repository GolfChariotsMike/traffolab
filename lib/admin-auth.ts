import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const ORDERS_COOKIE = "trafflabels_orders";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

export function dashboardPassword() {
  return process.env.ORDERS_DASHBOARD_PASSWORD?.trim() ?? "";
}

export function dashboardConfigured() {
  return dashboardPassword().length > 0;
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function passwordsMatch(input: string) {
  const password = dashboardPassword();
  if (!password || !input) return false;
  return timingSafeEqual(digest(input), digest(password));
}

export function signOrdersSession(now = Date.now()) {
  const password = dashboardPassword();
  if (!password) return null;
  const exp = now + SESSION_MS;
  const payload = `v1.${exp}`;
  const signature = createHmac("sha256", password).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyOrdersSession(token: string | undefined, now = Date.now()) {
  const password = dashboardPassword();
  if (!password || !token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [version, expText, signature] = parts;
  if (version !== "v1") return false;
  const exp = Number(expText);
  if (!Number.isFinite(exp) || exp <= now) return false;
  const expected = createHmac("sha256", password)
    .update(`${version}.${expText}`)
    .digest("base64url");
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length) return false;
  return timingSafeEqual(actual, wanted);
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
