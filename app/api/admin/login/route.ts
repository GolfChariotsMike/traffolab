import { NextResponse } from "next/server";
import { requestOrdersSignIn } from "@/lib/admin-login";
import { sendMagicLinkEmail } from "@/lib/admin-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectTo(request: Request, query: Record<string, string>) {
  const url = new URL("/admin/orders/", request.url);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "");
  const result = await requestOrdersSignIn({
    email,
    requestUrl: request.url,
    deliver: sendMagicLinkEmail,
  });

  if (result.kind === "unconfigured") return redirectTo(request, { error: "config" });
  if (result.kind === "invalid-email") return redirectTo(request, { error: "email" });

  const query: Record<string, string> = { sent: "1" };
  if (result.previewUrl && process.env.NODE_ENV !== "production") {
    query.preview = result.previewUrl;
  }
  return redirectTo(request, query);
}
