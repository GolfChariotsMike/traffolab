import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies/index.js";
import {
  MAGIC_LINK_MS,
  ORDERS_COOKIE,
  ORDERS_SESSION_MS,
  adminEmails,
  authSecret,
  clearOrdersCookieOptions,
  dashboardConfigured,
  isAllowlistedEmail,
  magicLinkOrigin,
  magicLinkUrl,
  ordersCookieOptions,
  readOrdersSession,
  signMagicLink,
  signOrdersSession,
  tokenFromCookieHeader,
  verifyMagicLink,
  verifyOrdersSession,
} from "./admin-auth";
import { completeOrdersSignIn, requestOrdersSignIn } from "./admin-login";
import { magicLinkMessage } from "./admin-mail";
import { createFileLoginTokens } from "./login-token-file";

const previousEmails = process.env.ORDERS_ADMIN_EMAILS;
const previousSecret = process.env.ORDERS_AUTH_SECRET;
const previousNodeEnv = process.env.NODE_ENV;
const previousPassword = process.env.ORDERS_DASHBOARD_PASSWORD;

function setNodeEnv(value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = value;
}

function restoreEnv() {
  if (previousEmails === undefined) delete process.env.ORDERS_ADMIN_EMAILS;
  else process.env.ORDERS_ADMIN_EMAILS = previousEmails;
  if (previousSecret === undefined) delete process.env.ORDERS_AUTH_SECRET;
  else process.env.ORDERS_AUTH_SECRET = previousSecret;
  setNodeEnv(previousNodeEnv);
  if (previousPassword === undefined) delete process.env.ORDERS_DASHBOARD_PASSWORD;
  else process.env.ORDERS_DASHBOARD_PASSWORD = previousPassword;
}

process.env.ORDERS_AUTH_SECRET = "test-auth-secret";
delete process.env.ORDERS_ADMIN_EMAILS;
process.env.ORDERS_DASHBOARD_PASSWORD = "old-shared-password";
setNodeEnv("test");

assert.deepEqual(adminEmails(), ["info@stikstickers.com"]);
assert.equal(isAllowlistedEmail("Info@StikStickers.com"), true);
assert.equal(isAllowlistedEmail("other@example.com"), false);
assert.equal(dashboardConfigured(), true);
assert.equal(authSecret(), "test-auth-secret");

process.env.ORDERS_ADMIN_EMAILS = "Leanne@Example.com, info@stikstickers.com";
assert.deepEqual(adminEmails(), ["leanne@example.com", "info@stikstickers.com"]);
process.env.ORDERS_ADMIN_EMAILS = "   ";
assert.deepEqual(adminEmails(), []);
assert.equal(dashboardConfigured(), false);
assert.equal(signMagicLink("info@stikstickers.com"), null);
delete process.env.ORDERS_ADMIN_EMAILS;

const now = Date.parse("2026-09-29T00:00:00.000Z");
const link = signMagicLink("info@stikstickers.com", now);
assert.ok(link);
assert.equal(link!.email, "info@stikstickers.com");
assert.equal(link!.exp, now + MAGIC_LINK_MS);
const verified = verifyMagicLink(link!.token, now + 1000);
assert.deepEqual(verified, { jti: link!.jti, email: link!.email, exp: link!.exp });
assert.equal(verifyMagicLink(link!.token, now + MAGIC_LINK_MS), null);
assert.equal(verifyMagicLink(`${link!.token}x`, now + 1000), null);
assert.equal(signMagicLink("stranger@example.com", now), null);

process.env.ORDERS_ADMIN_EMAILS = "leanne@example.com";
assert.equal(verifyMagicLink(link!.token, now + 1000), null);
delete process.env.ORDERS_ADMIN_EMAILS;

const session = signOrdersSession("info@stikstickers.com", now);
assert.ok(session);
assert.equal(ORDERS_SESSION_MS, 30 * 24 * 60 * 60 * 1000);
assert.equal(verifyOrdersSession(session!, now + 1000), true);
assert.equal(readOrdersSession(session!, now + 1000)?.email, "info@stikstickers.com");
assert.equal(verifyOrdersSession(session!, now + 8 * 24 * 60 * 60 * 1000), true);
assert.equal(verifyOrdersSession(session!, now + ORDERS_SESSION_MS - 1000), true);
assert.equal(verifyOrdersSession(session!, now + ORDERS_SESSION_MS), false);
assert.equal(verifyOrdersSession("v1.9999999999999.not-a-password-session", now + 1000), false);
assert.equal(verifyOrdersSession(undefined, now), false);

const cookie = ordersCookieOptions(now);
assert.equal(cookie.httpOnly, true);
assert.equal(cookie.sameSite, "lax");
assert.equal(cookie.path, "/");
assert.equal(cookie.secure, false);
assert.equal(cookie.maxAge, ORDERS_SESSION_MS / 1000);
assert.equal(cookie.expires.getTime(), now + ORDERS_SESSION_MS);
setNodeEnv("production");
assert.equal(ordersCookieOptions(now).secure, true);
setNodeEnv("test");

const cleared = clearOrdersCookieOptions();
assert.equal(cleared.maxAge, 0);
assert.equal(cleared.expires.getTime(), 0);
assert.equal(cleared.path, "/");
assert.equal(cleared.httpOnly, true);

{
  setNodeEnv("production");
  const headers = new Headers();
  const jar = new ResponseCookies(headers);
  jar.set(ORDERS_COOKIE, session!, ordersCookieOptions(now));
  const setCookie = headers.getSetCookie().find((value) => value.startsWith(`${ORDERS_COOKIE}=`));
  assert.ok(setCookie);
  assert.match(setCookie!, /Max-Age=2592000/);
  assert.match(setCookie!, /Expires=/);
  assert.match(setCookie!, /HttpOnly/);
  assert.match(setCookie!, /Secure/);
  assert.match(setCookie!, /Path=\//);
  assert.match(setCookie!, /SameSite=lax/);
  assert.doesNotMatch(setCookie!, /Max-Age=604800/);

  const logoutHeaders = new Headers();
  const logoutJar = new ResponseCookies(logoutHeaders);
  logoutJar.set(ORDERS_COOKIE, "", clearOrdersCookieOptions());
  const clearedCookie = logoutHeaders.getSetCookie().find((value) => value.startsWith(`${ORDERS_COOKIE}=`));
  assert.ok(clearedCookie);
  assert.match(clearedCookie!, /Max-Age=0/);
  assert.match(clearedCookie!, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
  assert.match(clearedCookie!, /Secure/);
  assert.match(clearedCookie!, /HttpOnly/);
  setNodeEnv("test");
}

const header = `other=1; ${ORDERS_COOKIE}=${encodeURIComponent(session!)}`;
assert.equal(tokenFromCookieHeader(header), session);

process.env.ORDERS_AUTH_SECRET = "rotated";
assert.equal(verifyOrdersSession(session!, now + 1000), false);
assert.equal(verifyMagicLink(link!.token, now + 1000), null);
process.env.ORDERS_AUTH_SECRET = "test-auth-secret";

delete process.env.ORDERS_AUTH_SECRET;
setNodeEnv("production");
assert.equal(authSecret(), "");
assert.equal(dashboardConfigured(), false);
assert.equal(signOrdersSession("info@stikstickers.com", now), null);
setNodeEnv("test");
process.env.ORDERS_AUTH_SECRET = "test-auth-secret";

setNodeEnv("development");
assert.equal(
  magicLinkOrigin("http://localhost:3000/admin/orders/"),
  "http://localhost:3000"
);
assert.equal(
  magicLinkOrigin("http://127.0.0.1:3000/api/admin/login/"),
  "http://127.0.0.1:3000"
);
setNodeEnv("production");
assert.equal(
  magicLinkOrigin("http://localhost:3000/admin/orders/"),
  "https://www.trafflabels.com.au"
);
assert.equal(
  magicLinkOrigin("https://traffolab-abc.vercel.app/admin/orders/"),
  "https://www.trafflabels.com.au"
);
setNodeEnv("test");
const built = magicLinkUrl("http://localhost:3000", link!.token);
assert.match(built, /^http:\/\/localhost:3000\/api\/admin\/login\/verify\/\?token=/);

const message = magicLinkMessage({ to: "info@stikstickers.com", url: built });
assert.match(message.text, /20 minutes/);
assert.match(message.html, /href="http:\/\/localhost:3000\/api\/admin\/login\/verify\//);
assert.equal(message.subject, "TraffLabels orders sign-in");

{
  const accepted = await requestOrdersSignIn({
    email: "Stranger@Example.com",
    requestUrl: "http://localhost:3000/admin/orders/",
    now,
    deliver: async () => {
      throw new Error("non-allowlisted addresses must not be emailed");
    },
  });
  assert.deepEqual(accepted, { kind: "accepted" });
}

{
  let sentTo = "";
  const accepted = await requestOrdersSignIn({
    email: " INFO@stikstickers.com ",
    requestUrl: "http://localhost:3000/admin/orders/",
    now,
    deliver: async (mail) => {
      sentTo = mail.to;
      assert.match(mail.url, /localhost:3000\/api\/admin\/login\/verify\//);
      return "dev-preview";
    },
  });
  assert.equal(sentTo, "info@stikstickers.com");
  assert.equal(accepted.kind, "accepted");
  if (accepted.kind === "accepted") assert.match(accepted.previewUrl ?? "", /token=/);
}

{
  const invalid = await requestOrdersSignIn({
    email: "not-an-email",
    requestUrl: "http://localhost:3000/admin/orders/",
    deliver: async () => "sent",
  });
  assert.deepEqual(invalid, { kind: "invalid-email" });
}

{
  const dir = await mkdtemp(path.join(tmpdir(), "trafflabels-login-"));
  const tokens = createFileLoginTokens(path.join(dir, "tokens.json"));
  const issued = signMagicLink("info@stikstickers.com", now);
  assert.ok(issued);
  const first = await completeOrdersSignIn(issued!.token, (record) => tokens.consume(record, now + 1000), now + 1000);
  assert.equal(first?.email, "info@stikstickers.com");
  assert.equal(verifyOrdersSession(first?.session, now + 1000), true);
  const second = await completeOrdersSignIn(
    issued!.token,
    (record) => tokens.consume(record, now + 2000),
    now + 2000
  );
  assert.equal(second, null);
}

restoreEnv();
console.log("lib/admin-auth.test.ts: ok");
