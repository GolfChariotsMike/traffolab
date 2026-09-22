import assert from "node:assert/strict";
import {
  buildCheckout,
  checkoutTotalCents,
  parseCheckoutBody,
} from "./checkout";
import { priceForPlate, quoteOrder, shippingCents } from "./pricing";

{
  const bad = parseCheckoutBody(null);
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.status, 400);
}

{
  const bad = parseCheckoutBody({
    customerEmail: "not-an-email",
    shippingMethodId: "standard",
    lines: [{ widthMm: 20, heightMm: 10, qty: 1 }],
  });
  assert.equal(bad.ok, false);
}

{
  const bad = parseCheckoutBody({
    customerEmail: "buyer@example.com",
    shippingMethodId: "overnight",
    lines: [{ widthMm: 20, heightMm: 10, qty: 1 }],
  });
  assert.equal(bad.ok, false);
}

{
  const bad = parseCheckoutBody({
    customerEmail: "buyer@example.com",
    shippingMethodId: "standard",
    lines: [],
  });
  assert.equal(bad.ok, false);
}

{
  // Server must recalculate: client cannot underpay by sending fake totals.
  const parsed = parseCheckoutBody({
    customerEmail: " Buyer@Example.com ",
    shippingMethodId: "express",
    lines: [
      {
        widthMm: 20,
        heightMm: 10,
        qty: 2,
        designSummary: "PANEL A",
        unitCents: 1,
        lineCents: 1,
        totalCents: 1,
      },
      { widthMm: 80, heightMm: 30, qty: 1 },
    ],
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) throw new Error("expected ok");

  const expected = quoteOrder(
    [
      { widthMm: 20, heightMm: 10, qty: 2 },
      { widthMm: 80, heightMm: 30, qty: 1 },
    ],
    "express"
  );

  assert.equal(parsed.value.request.customerEmail, "buyer@example.com");
  assert.equal(parsed.value.quote.subtotalCents, expected.subtotalCents);
  assert.equal(parsed.value.quote.shippingCents, shippingCents("express"));
  assert.equal(parsed.value.quote.totalCents, expected.totalCents);
  assert.equal(parsed.value.quote.totalCents, 150 * 2 + 840 + 1500);
  assert.equal(parsed.value.lineItems.length, 3);

  const plateA = parsed.value.lineItems[0];
  assert.equal(plateA.quantity, 2);
  assert.equal(plateA.price_data.currency, "aud");
  assert.equal(plateA.price_data.unit_amount, priceForPlate(20, 10, 1).unitCents);
  assert.match(plateA.price_data.product_data.name, /plate 1/);
  assert.match(plateA.price_data.product_data.description ?? "", /PANEL A/);

  const shipping = parsed.value.lineItems[2];
  assert.equal(shipping.quantity, 1);
  assert.equal(shipping.price_data.unit_amount, 1500);
  assert.match(shipping.price_data.product_data.name, /Express/);
}

{
  const built = buildCheckout({
    customerEmail: "a@b.co",
    shippingMethodId: "standard",
    lines: [{ widthMm: 60, heightMm: 20, qty: 1 }],
  });
  assert.equal(built.quote.totalCents, 600 + 1000);
  assert.equal(
    checkoutTotalCents({
      customerEmail: "a@b.co",
      shippingMethodId: "standard",
      lines: [{ widthMm: 60, heightMm: 20, qty: 1 }],
    }),
    1600
  );
  assert.equal(built.metadata.totalCents, "1600");
  assert.equal(built.metadata.shippingMethodId, "standard");
}

{
  // Minimum plate pricing must flow into Checkout line_items.
  const built = buildCheckout({
    customerEmail: "a@b.co",
    shippingMethodId: "standard",
    lines: [{ widthMm: 10, heightMm: 10, qty: 3 }],
  });
  assert.equal(built.quote.subtotalCents, 450);
  assert.equal(built.lineItems[0].price_data.unit_amount, 150);
  assert.equal(built.lineItems[0].quantity, 3);
  assert.match(
    built.lineItems[0].price_data.product_data.description ?? "",
    /minimum/
  );
}

console.log("lib/checkout.test.ts: ok");
