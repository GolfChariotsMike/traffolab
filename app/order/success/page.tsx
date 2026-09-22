import type { Metadata } from "next";
import Link from "next/link";
import { ClearPaidDraft } from "@/components/order/clear-paid-draft";
import { Button } from "@/components/ui/button";
import { absoluteUrl, productName, routes } from "@/lib/site";
import { shouldClearOrderDraft } from "@/lib/checkout-return";
import { checkoutSessionPaymentStatus } from "@/lib/stripe";

export const metadata: Metadata = {
  title: `Payment received | ${productName}`,
  description: "Thanks for your TraffLabels order.",
  alternates: { canonical: absoluteUrl("/order/success/") },
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const sessionId = firstParam(params.session_id).trim();
  const paymentStatus = sessionId
    ? await checkoutSessionPaymentStatus(sessionId)
    : null;
  const paid = shouldClearOrderDraft(paymentStatus);

  return (
    <section className="border-b bg-ink text-primary-foreground">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12 md:py-16">
        <p className="font-mono text-[11px] tracking-[0.18em] text-signal uppercase">
          {productName}
        </p>
        <ClearPaidDraft paymentStatus={paymentStatus} />
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          {sessionId && !paid ? "Payment not confirmed" : "Thanks — payment received"}
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-primary-foreground/75 md:text-base">
          {sessionId && !paid
            ? "Stripe has not confirmed a paid Checkout Session. Your order draft is still in this browser — return to the summary and try Pay now again."
            : "Stripe has confirmed the Checkout Session for this TraffLabels order. We will follow up by email with production and shipping details."}
        </p>
        {sessionId ? (
          <p className="font-mono text-xs break-all text-primary-foreground/55">
            Session: {sessionId}
          </p>
        ) : (
          <p className="text-sm text-primary-foreground/55">
            No session id was returned. If you paid just now, keep the Stripe
            receipt email as your reference.
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button asChild className="bg-laser text-charcoal hover:bg-laser/90">
            <Link href={routes.order}>Back to order</Link>
          </Button>
          <Button asChild variant="outline" className="border-white/20">
            <Link href={routes.home}>Home</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
