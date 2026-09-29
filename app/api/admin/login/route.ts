import { NextResponse } from "next/server";
import {
  ORDERS_COOKIE,
  ordersCookieOptions,
  passwordsMatch,
  signOrdersSession,
  dashboardConfigured,
} from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const failed = (error: string) => {
    const response = NextResponse.redirect(new URL("/admin/orders/?error=" + error, request.url), {
      status: 303,
    });
    return response;
  };

  if (!dashboardConfigured()) return failed("config");
  if (!passwordsMatch(password)) return failed("1");

  const token = signOrdersSession();
  if (!token) return failed("config");

  const response = NextResponse.redirect(new URL("/admin/orders/", request.url), { status: 303 });
  response.cookies.set(ORDERS_COOKIE, token, ordersCookieOptions());
  return response;
}
