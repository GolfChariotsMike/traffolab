import "server-only";
import Stripe from "stripe";
import {
  httpsOrNull,
  isSearchableOrderId,
  type InvoiceGateway,
  type InvoiceRequest,
  type IssuedInvoice,
} from "@/lib/invoice";

/**
 * Stripe invoices for an approved proof. One invoice per order: create uses a
 * stable idempotency key, and a later call resumes the same invoice instead
 * of opening another. GST is a line item, not Stripe Tax, so the total stays
 * equal to the approved proof.
 */
export function createStripeInvoiceGateway(stripe: Stripe): InvoiceGateway {
  return {
    async findInvoice(orderId) {
      if (!isSearchableOrderId(orderId)) return null;
      const found = await stripe.invoices.search({
        query: `metadata['trafflabels_order_id']:'${orderId}'`,
        limit: 10,
      });
      const matches = found.data.filter(
        (invoice) =>
          invoice.metadata?.trafflabels_order_id === orderId && invoice.status !== "void"
      );
      matches.sort((a, b) => invoiceRank(a.status) - invoiceRank(b.status));
      return matches[0] ? snapshot(matches[0]) : null;
    },
    async resume(invoiceId, request) {
      const invoice = await stripe.invoices.retrieve(invoiceId);
      return finishInvoice(stripe, invoice, request, customerIdOf(invoice));
    },
    async createAndSend(request) {
      const customerId = await findOrCreateCustomer(stripe, request);
      const shipping = shippingDetails(request);
      const created = await stripe.invoices.create(
        {
          customer: customerId,
          collection_method: "send_invoice",
          days_until_due: request.daysUntilDue,
          auto_advance: false,
          currency: "aud",
          description: request.description,
          footer: request.footer,
          custom_fields: [{ name: "Document", value: "Tax Invoice" }],
          metadata: {
            trafflabels_order_id: request.orderId,
            trafflabels_order_number: String(request.orderNumber),
            trafflabels_proof_id: request.proofId,
          },
          pending_invoice_items_behavior: "exclude",
          discounts: "",
          statement_descriptor: "TRAFFLABELS",
          ...(shipping ? { shipping_details: shipping } : {}),
        },
        { idempotencyKey: request.idempotencyKey }
      );

      const invoice = await stripe.invoices.retrieve(created.id);
      return finishInvoice(stripe, invoice, request, customerId);
    },
  };
}

async function finishInvoice(
  stripe: Stripe,
  invoice: Stripe.Invoice,
  request: InvoiceRequest,
  customerId: string
) {
  if (invoice.status === "void") {
    throw new Error("The Stripe invoice for this order was voided.");
  }
  if (invoice.status === "draft") {
    if ((invoice.lines?.data.length ?? 0) === 0) {
      await addLines(stripe, customerId, invoice.id, request);
      invoice = await stripe.invoices.retrieve(invoice.id);
    }
    if (invoice.total !== request.expectedTotalCents) {
      throw new Error(
        `Stripe draft total does not match the approved proof (${request.expectedTotalCents} cents).`
      );
    }
    invoice = await stripe.invoices.finalizeInvoice(invoice.id, undefined, {
      idempotencyKey: `${request.idempotencyKey}-finalize`,
    });
  }
  if (invoice.status === "open") {
    invoice = await stripe.invoices.sendInvoice(invoice.id, undefined, {
      idempotencyKey: `${request.idempotencyKey}-send`,
    });
  }
  return snapshot(invoice);
}

function customerIdOf(invoice: Stripe.Invoice) {
  const customer = invoice.customer;
  if (typeof customer === "string") return customer;
  if (customer && "id" in customer && !customer.deleted) return customer.id;
  throw new Error("The Stripe invoice has no customer.");
}

function invoiceRank(status: string | null) {
  if (status === "paid" || status === "open" || status === "uncollectible") return 0;
  if (status === "draft") return 1;
  return 2;
}

async function findOrCreateCustomer(stripe: Stripe, request: InvoiceRequest) {
  const existing = await stripe.customers.list({ email: request.customerEmail, limit: 1 });
  if (existing.data[0]) return existing.data[0].id;
  const created = await stripe.customers.create(
    {
      email: request.customerEmail,
      name: request.customerName,
      phone: request.customerPhone || undefined,
      address: stripeAddress(request),
      metadata: { trafflabels_order_id: request.orderId },
    },
    { idempotencyKey: `trafflabels-customer-${request.customerEmail}` }
  );
  return created.id;
}

async function addLines(
  stripe: Stripe,
  customerId: string,
  invoiceId: string,
  request: InvoiceRequest
) {
  for (const [index, line] of request.lines.entries()) {
    const params: Stripe.InvoiceItemCreateParams = {
      customer: customerId,
      invoice: invoiceId,
      currency: "aud",
      description: line.description,
      discountable: false,
      metadata: { trafflabels_kind: line.kind },
    };
    if (line.unitAmountCents < 0) {
      params.amount = line.quantity * line.unitAmountCents;
    } else {
      params.quantity = line.quantity;
      params.unit_amount_decimal = Stripe.Decimal.from(line.unitAmountCents);
    }
    await stripe.invoiceItems.create(params, {
      idempotencyKey: `${request.idempotencyKey}-line-${index}`,
    });
  }
}

function stripeAddress(request: InvoiceRequest): Stripe.AddressParam | undefined {
  const shipping = request.shipping;
  const country = shipping.country.trim().toUpperCase();
  const address: Stripe.AddressParam = {};
  if (shipping.line1.trim()) address.line1 = shipping.line1.trim();
  if (shipping.line2.trim()) address.line2 = shipping.line2.trim();
  if (shipping.city.trim()) address.city = shipping.city.trim();
  if (shipping.state.trim()) address.state = shipping.state.trim();
  if (shipping.postalCode.trim()) address.postal_code = shipping.postalCode.trim();
  if (/^[A-Z]{2}$/.test(country)) address.country = country;
  return address.line1 || address.city || address.postal_code ? address : undefined;
}

function shippingDetails(request: InvoiceRequest): Stripe.InvoiceCreateParams.ShippingDetails | undefined {
  const address = stripeAddress(request);
  const name = request.shipping.name.trim() || request.customerName;
  if (!address || !name) return undefined;
  const phone = request.customerPhone.trim();
  return { name, address, phone: phone || undefined };
}

function snapshot(invoice: Stripe.Invoice): IssuedInvoice {
  return {
    id: invoice.id ?? "",
    number: invoice.number ?? null,
    hostedUrl: httpsOrNull(invoice.hosted_invoice_url),
    pdfUrl: httpsOrNull(invoice.invoice_pdf),
    status: invoice.status ?? "open",
    dueAt: typeof invoice.due_date === "number" ? new Date(invoice.due_date * 1000).toISOString() : null,
    totalCents: typeof invoice.total === "number" ? invoice.total : null,
  };
}
