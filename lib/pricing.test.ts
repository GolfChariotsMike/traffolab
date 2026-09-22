import assert from "node:assert/strict";
import {
  PLATE_RATE_TABLE,
  SHIPPING_METHODS,
  formatAud,
  formatPerMm2,
  parseShippingMethod,
  priceForPlate,
  quoteOrder,
  shippingCents,
  tierForArea,
} from "./pricing";

{
  const anchor = priceForPlate(20, 10, 1);
  assert.equal(anchor.areaMm2, 200);
  assert.equal(anchor.tierId, "small");
  assert.equal(anchor.ratePerMm2Aud, 0.0075);
  assert.equal(anchor.minimumApplied, false);
  assert.equal(anchor.unitCents, 150);
  assert.equal(anchor.lineCents, 150);
  assert.equal(formatAud(anchor.unitCents), "$1.50");
}

{
  const belowMinimum = priceForPlate(10, 10, 3);
  assert.equal(belowMinimum.areaMm2, 100);
  assert.equal(belowMinimum.tierId, "small");
  assert.equal(belowMinimum.minimumApplied, true);
  assert.equal(belowMinimum.unitCents, 150);
  assert.equal(belowMinimum.lineCents, 450);
}

{
  const atCap = priceForPlate(30, 10, 1);
  assert.equal(atCap.areaMm2, 300);
  assert.equal(atCap.tierId, "small");
  assert.equal(atCap.unitCents, 225);
  assert.equal(atCap.minimumApplied, false);
}

{
  const mediumStart = priceForPlate(30.1, 10, 1);
  assert.equal(mediumStart.areaMm2, 301);
  assert.equal(mediumStart.tierId, "medium");
  assert.equal(mediumStart.ratePerMm2Aud, 0.005);
  assert.equal(mediumStart.unitCents, 151);
  assert.equal(formatAud(mediumStart.unitCents), "$1.51");
}

{
  const mediumEnd = priceForPlate(100, 20, 1);
  assert.equal(mediumEnd.areaMm2, 2000);
  assert.equal(mediumEnd.tierId, "medium");
  assert.equal(mediumEnd.unitCents, 1000);
}

{
  const largeStart = priceForPlate(200.1, 10, 2);
  assert.equal(largeStart.areaMm2, 2001);
  assert.equal(largeStart.tierId, "large");
  assert.equal(largeStart.ratePerMm2Aud, 0.0035);
  assert.equal(largeStart.unitCents, 700);
  assert.equal(largeStart.lineCents, 1400);
}

{
  assert.equal(priceForPlate(60, 20, 1).unitCents, 600);
  assert.equal(priceForPlate(80, 30, 1).unitCents, 840);
  assert.equal(priceForPlate(100, 50, 1).unitCents, 1750);
  assert.equal(priceForPlate(150, 50, 1).unitCents, 2625);
  assert.equal(priceForPlate(45, 12, 10).lineCents, 2700);
  assert.equal(priceForPlate(100, 25, 4).lineCents, 3500);
  assert.equal(priceForPlate(60, 20, 2).lineCents, 1200);
}

{
  const doubled = priceForPlate(20, 10, 2);
  assert.equal(doubled.unitCents, 150);
  assert.equal(doubled.lineCents, 300);
  assert.equal(priceForPlate(20, 10, 0).qty, 1);
  assert.equal(priceForPlate(20, 10, 1000).qty, 999);
  assert.equal(priceForPlate(20, 10, 1000).lineCents, 150 * 999);
}

{
  const invalid = priceForPlate(0, 10, 2);
  assert.equal(invalid.unitCents, 0);
  assert.equal(invalid.lineCents, 0);
}

{
  assert.equal(tierForArea(300).id, "small");
  assert.equal(tierForArea(300.1).id, "medium");
  assert.equal(tierForArea(2000).id, "medium");
  assert.equal(tierForArea(2000.1).id, "large");
  assert.deepEqual(
    PLATE_RATE_TABLE.map((tier) => tier.ratePerMm2Aud),
    [0.0075, 0.005, 0.0035]
  );
  assert.equal(PLATE_RATE_TABLE[0].minimumAud, 1.5);
  assert.equal(formatPerMm2(0.0075), "$0.0075/mm²");
  assert.equal(formatPerMm2(0.005), "$0.005/mm²");
  assert.equal(formatPerMm2(0.0035), "$0.0035/mm²");
}

{
  assert.deepEqual(
    SHIPPING_METHODS.map((method) => [method.id, method.aud]),
    [
      ["standard", 10],
      ["express", 15],
    ]
  );
  assert.equal(shippingCents("standard"), 1000);
  assert.equal(shippingCents("express"), 1500);
  assert.equal(parseShippingMethod("express"), "express");
  assert.equal(parseShippingMethod("overnight"), "standard");

  const lines = [
    { widthMm: 20, heightMm: 10, qty: 1 },
    { widthMm: 60, heightMm: 20, qty: 1 },
  ];
  const standard = quoteOrder(lines, "standard");
  assert.equal(standard.subtotalCents, 150 + 600);
  assert.equal(standard.shippingCents, 1000);
  assert.equal(standard.totalCents, 1750);
  const express = quoteOrder(lines, "express");
  assert.equal(express.subtotalCents, standard.subtotalCents);
  assert.equal(express.totalCents, 150 + 600 + 1500);

  const template = quoteOrder(
    [
      { widthMm: 45, heightMm: 12, qty: 10 },
      { widthMm: 100, heightMm: 25, qty: 4 },
      { widthMm: 60, heightMm: 20, qty: 2 },
    ],
    "standard"
  );
  assert.equal(template.subtotalCents, 2700 + 3500 + 1200);
  assert.equal(template.totalCents, 7400 + 1000);
  assert.equal(quoteOrder(template.lines, "express").totalCents, 7400 + 1500);
}

console.log("pricing tests passed");
