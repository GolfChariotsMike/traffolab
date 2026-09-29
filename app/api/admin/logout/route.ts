import { NextResponse } from "next/server";
import { ORDERS_COOKIE, ordersCookieOptions } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/admin/orders/", request.url), { status: 303 });
  response.cookies.set(ORDERS_COOKIE, "", { ...ordersCookieOptions(), maxAge: 0 });
  return response;
}
