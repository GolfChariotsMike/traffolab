import type { Metadata } from "next";
import { cookies } from "next/headers";
import { OrdersBoard } from "@/components/admin/orders-board";
import { ORDERS_COOKIE, dashboardConfigured, verifyOrdersSession } from "@/lib/admin-auth";
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

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const error = firstParam(params.error);
  const jar = await cookies();
  const signedIn = verifyOrdersSession(jar.get(ORDERS_COOKIE)?.value);

  if (!dashboardConfigured()) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 px-4">
        <h1 className="font-heading text-2xl font-semibold">TraffLabels orders</h1>
        <p className="text-sm leading-relaxed text-white/70">
          The production dashboard is not configured. Set ORDERS_DASHBOARD_PASSWORD
          on this deployment, then sign in here.
        </p>
      </main>
    );
  }

  if (!signedIn) {
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
              Production sign-in for Mike and Leanne.
            </p>
          </div>
          <label className="flex flex-col gap-1.5 text-sm" htmlFor="orders-password">
            Password
            <input
              id="orders-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="h-10 rounded-lg border border-white/15 bg-black px-3"
            />
          </label>
          {error === "1" ? (
            <p role="alert" className="text-sm text-red-300">
              That password did not match.
            </p>
          ) : null}
          <button
            type="submit"
            className="h-10 rounded-lg bg-[#fee100] font-medium text-[#12151a]"
          >
            Sign in
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
      <OrdersBoard initialOrders={orders} storeError={storeError} />
    </main>
  );
}
