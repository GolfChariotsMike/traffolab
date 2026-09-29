import assert from "node:assert/strict";
import {
  dashboardConfigured,
  passwordsMatch,
  signOrdersSession,
  tokenFromCookieHeader,
  verifyOrdersSession,
  ORDERS_COOKIE,
} from "./admin-auth";

const previous = process.env.ORDERS_DASHBOARD_PASSWORD;
process.env.ORDERS_DASHBOARD_PASSWORD = "leanne-workshop-secret";

assert.equal(dashboardConfigured(), true);
assert.equal(passwordsMatch("leanne-workshop-secret"), true);
assert.equal(passwordsMatch("wrong"), false);
assert.equal(passwordsMatch(""), false);

const now = Date.parse("2026-09-29T00:00:00.000Z");
const token = signOrdersSession(now);
assert.ok(token);
assert.equal(verifyOrdersSession(token!, now + 1000), true);
assert.equal(verifyOrdersSession(token!, now + 8 * 24 * 60 * 60 * 1000), false);
assert.equal(verifyOrdersSession(`${token}x`, now + 1000), false);
assert.equal(verifyOrdersSession(undefined, now), false);

const header = `other=1; ${ORDERS_COOKIE}=${encodeURIComponent(token!)}`;
assert.equal(tokenFromCookieHeader(header), token);

process.env.ORDERS_DASHBOARD_PASSWORD = "rotated";
assert.equal(verifyOrdersSession(token!, now + 1000), false);

delete process.env.ORDERS_DASHBOARD_PASSWORD;
assert.equal(signOrdersSession(), null);
assert.equal(verifyOrdersSession(token!, now + 1000), false);

if (previous === undefined) delete process.env.ORDERS_DASHBOARD_PASSWORD;
else process.env.ORDERS_DASHBOARD_PASSWORD = previous;

console.log("lib/admin-auth.test.ts: ok");
