import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CostsBoard } from "@/components/admin/costs-board";
import { ORDERS_COOKIE, dashboardConfigured, readOrdersSession } from "@/lib/admin-auth";
import { resendConfigured } from "@/lib/admin-mail";
import { getCostStore } from "@/lib/cost-store";
import { CostSchemaError, monthSummary, perthMonth, type Cost, type MonthSummary } from "@/lib/costs";
import { getOrderStore } from "@/lib/order-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Costs | TraffLabels",
  robots: { index: false, follow: false },
};

export default async function AdminCostsPage() {
  const jar = await cookies();
  const session = readOrdersSession(jar.get(ORDERS_COOKIE)?.value);

  if (!dashboardConfigured()) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 px-4">
        <h1 className="font-heading text-2xl font-semibold">TraffLabels costs</h1>
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
        <h1 className="font-heading text-2xl font-semibold">TraffLabels costs</h1>
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
            <h1 className="mt-2 font-heading text-2xl font-semibold">Costs</h1>
            <p className="mt-2 text-sm text-white/65">
              Enter your email. We will send a sign-in link that expires in 20 minutes.
            </p>
          </div>
          <label className="flex flex-col gap-1.5 text-sm" htmlFor="costs-email">
            Email
            <input
              id="costs-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="h-10 rounded-lg border border-white/15 bg-black px-3"
            />
          </label>
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

  const month = perthMonth();
  const store = getCostStore();
  const orders = getOrderStore();
  let costs: Cost[] = [];
  let summary: MonthSummary | null = null;
  let storeError: string | null = null;
  if (!store || !orders) {
    storeError = "Costs are not configured. Set DATABASE_URL (or POSTGRES_URL) for this deployment.";
  } else {
    try {
      const [monthCosts, allOrders] = await Promise.all([store.listForMonth(month), orders.listOrders()]);
      costs = monthCosts;
      summary = monthSummary(month, allOrders, costs);
    } catch (error) {
      if (error instanceof CostSchemaError) storeError = error.message;
      else {
        console.error("[admin] could not load costs", error);
        storeError = "Could not load costs from the database.";
      }
    }
  }

  return (
    <main>
      <CostsBoard
        initialMonth={month}
        initialCosts={costs}
        initialSummary={summary}
        storeError={storeError}
        signedInEmail={session.email}
      />
    </main>
  );
}
