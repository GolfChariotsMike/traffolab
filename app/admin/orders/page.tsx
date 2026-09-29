import type { Metadata } from "next";
import { cookies } from "next/headers";
import { OrdersBoard } from "@/components/admin/orders-board";
import { ORDERS_COOKIE, dashboardConfigured, readOrdersSession } from "@/lib/admin-auth";
import { resendConfigured } from "@/lib/admin-mail";
import { getOrderStore } from "@/lib/order-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Orders | TraffLabels",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function localPreview(value: string) {
  if (process.env.NODE_ENV === "production" || !value) return null;
  try {
    const url = new URL(value);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (!local) return null;
    if (!url.pathname.startsWith("/api/admin/login/verify")) return null;
    if (!url.searchParams.get("token")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const error = firstParam(params.error);
  const sent = firstParam(params.sent) === "1";
  const preview = localPreview(firstParam(params.preview));
  const jar = await cookies();
  const session = readOrdersSession(jar.get(ORDERS_COOKIE)?.value);

  if (!dashboardConfigured()) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 px-4">
        <h1 className="font-heading text-2xl font-semibold">TraffLabels orders</h1>
        <p className="text-sm leading-relaxed text-white/70">
          The production dashboard is not configured. Set ORDERS_AUTH_SECRET and
          ORDERS_ADMIN_EMAILS on this deployment, then sign in here.
        </p>
      </main>
    );
  }

  if (process.env.NODE_ENV === "production" && !resendConfigured()) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 px-4">
        <h1 className="font-heading text-2xl font-semibold">TraffLabels orders</h1>
        <p className="text-sm leading-relaxed text-white/70">
          Sign-in email is not configured. Set RESEND_API_KEY and RESEND_FROM on this
          deployment.
        </p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
        <form
          action="/api/admin/login/"
          method="post"
          className="flex flex-col gap-4 rounded-xl border border-white/10 bg-black/50 p-6"
        >
          <div>
            <p className="font-mono text-[11px] tracking-[0.16em] text-[#fee100] uppercase">
              TraffLabels
            </p>
            <h1 className="mt-2 font-heading text-2xl font-semibold">Orders</h1>
            <p className="mt-2 text-sm text-white/65">
              Enter your email. We will send a sign-in link that expires in 20 minutes.
            </p>
          </div>
          <label className="flex flex-col gap-1.5 text-sm" htmlFor="orders-email">
            Email
            <input
              id="orders-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="h-10 rounded-lg border border-white/15 bg-black px-3"
            />
          </label>
          {error === "email" ? (
            <p role="alert" className="text-sm text-red-300">
              Enter a valid email address.
            </p>
          ) : null}
          {error === "link" ? (
            <p role="alert" className="text-sm text-red-300">
              That sign-in link has expired or was already used. Request a new one.
            </p>
          ) : null}
          {sent ? (
            <p role="status" className="text-sm text-[#3ddc97]">
              If that address can access orders, we sent a sign-in link. It expires in 20 minutes
              and works once.
            </p>
          ) : null}
          {preview ? (
            <p className="text-sm text-white/70">
              Local development only:{" "}
              <a className="text-[#fee100] underline-offset-2 hover:underline" href={preview}>
                open the sign-in link
              </a>
            </p>
          ) : null}
          <button
            type="submit"
            className="h-10 rounded-lg bg-[#fee100] font-medium text-[#12151a]"
          >
            Email me a link
          </button>
        </form>
      </main>
    );
  }

  const store = getOrderStore();
  let orders: Awaited<ReturnType<NonNullable<typeof store>["listOrders"]>> = [];
  let storeError: string | null = null;
  if (!store) {
    storeError =
      "Orders database is not configured. Set DATABASE_URL (or POSTGRES_URL) for this deployment.";
  } else {
    try {
      orders = await store.listOrders();
    } catch (loadError) {
      console.error("[admin] could not list orders", loadError);
      storeError = "Could not load orders from the database.";
    }
  }

  return (
    <main>
      <OrdersBoard initialOrders={orders} storeError={storeError} signedInEmail={session.email} />
    </main>
  );
}
