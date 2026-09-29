import {
  dashboardConfigured,
  magicLinkOrigin,
  magicLinkUrl,
  normalizeEmail,
  signMagicLink,
  signOrdersSession,
  verifyMagicLink,
  isAllowlistedEmail,
} from "@/lib/admin-auth";
import type { MagicLinkDelivery } from "@/lib/admin-mail";

export type SignInRequest =
  | { kind: "unconfigured" }
  | { kind: "invalid-email" }
  | { kind: "accepted"; previewUrl?: string };

export async function requestOrdersSignIn(input: {
  email: string;
  requestUrl: string;
  now?: number;
  deliver: (message: { to: string; url: string }) => Promise<MagicLinkDelivery>;
}): Promise<SignInRequest> {
  if (!dashboardConfigured()) return { kind: "unconfigured" };
  const email = normalizeEmail(input.email);
  if (!email) return { kind: "invalid-email" };
  if (!isAllowlistedEmail(email)) return { kind: "accepted" };

  const link = signMagicLink(email, input.now);
  if (!link) return { kind: "accepted" };
  const url = magicLinkUrl(magicLinkOrigin(input.requestUrl), link.token);
  const delivered = await input.deliver({ to: email, url });
  if (delivered === "dev-preview") return { kind: "accepted", previewUrl: url };
  return { kind: "accepted" };
}

export async function completeOrdersSignIn(
  token: string,
  consume: (record: { jti: string; email: string; exp: number }) => Promise<boolean>,
  now = Date.now()
) {
  const verified = verifyMagicLink(token, now);
  if (!verified) return null;
  const fresh = await consume(verified);
  if (!fresh) return null;
  const session = signOrdersSession(verified.email, now);
  if (!session) return null;
  return { email: verified.email, session };
}
