import { NextResponse } from "next/server";
import { ORDERS_COOKIE, ordersCookieOptions } from "@/lib/admin-auth";
import { completeOrdersSignIn } from "@/lib/admin-login";
import { consumeLoginToken } from "@/lib/login-token-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const failed = NextResponse.redirect(new URL("/admin/orders/?error=link", request.url), 303);

  try {
    const session = await completeOrdersSignIn(token, consumeLoginToken);
    if (!session) return failed;
    const response = NextResponse.redirect(new URL("/admin/orders/", request.url), 303);
    response.cookies.set(ORDERS_COOKIE, session.session, ordersCookieOptions());
    return response;
  } catch (error) {
    console.error("[admin] magic link sign-in failed", error);
    return failed;
  }
}
