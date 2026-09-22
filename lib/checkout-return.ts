/**
 * Stripe Checkout success_url / cancel_url must land on the same origin that
 * holds the order draft in localStorage.
 *
 * On Vercel, VERCEL_URL is the deployment hostname
 * (traffolab-<id>-….vercel.app). That is a different origin from
 * https://www.trafflabels.com.au, so a cancel_url built from VERCEL_URL
 * shows "Checkout was cancelled" and an empty draft. The browser's Origin
 * for the checkout POST is the shopper's real site.
 */

export const CANONICAL_CHECKOUT_ORIGIN = "https://www.trafflabels.com.au";

const SESSION_PLACEHOLDER = "{CHECKOUT_SESSION_ID}";

/** Drop the draft only after Stripe confirms the session is paid. */
export function shouldClearOrderDraft(
  paymentStatus: string | null | undefined
): boolean {
  return paymentStatus === "paid";
}

export function checkoutReturnUrls(origin: string): {
  successUrl: string;
  cancelUrl: string;
} {
  const base = origin.replace(/\/$/, "");
  return {
    successUrl: `${base}/order/success/?session_id=${SESSION_PLACEHOLDER}`,
    cancelUrl: `${base}/order/?mode=checkout&cancelled=1`,
  };
}

function isTraffolabVercelHost(hostname: string): boolean {
  return (
    hostname === "traffolab.vercel.app" ||
    (hostname.startsWith("traffolab-") && hostname.endsWith(".vercel.app"))
  );
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/**
 * Return a safe origin for Checkout redirects, or null when the value is not
 * one of our hosts. Apex trafflabels.com.au canonicalises to www, which is
 * where the 308 sends browsers (and where the draft is stored).
 */
export function allowCheckoutOrigin(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.username || url.password || url.search || url.hash) return null;
  if (url.pathname !== "/" && url.pathname !== "") return null;

  const hostname = url.hostname.toLowerCase();
  if (hostname === "www.trafflabels.com.au" || hostname === "trafflabels.com.au") {
    if (url.protocol !== "https:") return null;
    return CANONICAL_CHECKOUT_ORIGIN;
  }

  if (isLocalHost(hostname)) {
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const port = url.port ? `:${url.port}` : "";
    return `${url.protocol}//${hostname}${port}`;
  }

  if (isTraffolabVercelHost(hostname)) {
    if (url.protocol !== "https:") return null;
    return `https://${hostname}`;
  }

  return null;
}

export function resolveCheckoutReturnOrigin(input: {
  originHeader?: string | null;
  requestedOrigin?: unknown;
  forwardedHost?: string | null;
  host?: string | null;
  forwardedProto?: string | null;
}): string {
  const candidates: string[] = [];
  if (typeof input.originHeader === "string" && input.originHeader.trim()) {
    candidates.push(input.originHeader.trim());
  }
  if (typeof input.requestedOrigin === "string" && input.requestedOrigin.trim()) {
    candidates.push(input.requestedOrigin.trim());
  }

  for (const candidate of candidates) {
    const allowed = allowCheckoutOrigin(candidate);
    if (allowed) return allowed;
  }

  const forwarded = input.forwardedHost?.split(",")[0]?.trim();
  const host = input.host?.split(",")[0]?.trim();
  const proto = (input.forwardedProto?.split(",")[0]?.trim() || "https").toLowerCase();
  const candidateHost = forwarded || host;
  if (candidateHost) {
    const scheme = proto === "http" ? "http" : "https";
    const fromHost = allowCheckoutOrigin(`${scheme}://${candidateHost}`);
    if (fromHost) return fromHost;
  }

  return CANONICAL_CHECKOUT_ORIGIN;
}
