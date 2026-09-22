/**
 * TraffLabels plate pricing and Australia-wide shipping.
 * Area is width × height in mm². Money is integer cents so line totals stay exact.
 *
 * Tiers (inclusive upper bound, except the open top tier):
 * - ≤ 300 mm²: $0.0075/mm², minimum $1.50 per plate
 * - ≤ 2000 mm² (the 301–2000 band, including fractional areas just over 300): $0.005/mm²
 * - > 2000 mm²: $0.0035/mm²
 *
 * Anchor: 20 × 10 mm = 200 mm² → $1.50.
 */

export const PLATE_RATE_TABLE = [
  {
    id: "small",
    label: "Up to 300 mm²",
    maxAreaMm2: 300,
    ratePerMm2Aud: 0.0075,
    minimumAud: 1.5,
  },
  {
    id: "medium",
    label: "301–2000 mm²",
    maxAreaMm2: 2000,
    ratePerMm2Aud: 0.005,
    minimumAud: null,
  },
  {
    id: "large",
    label: "Over 2000 mm²",
    maxAreaMm2: Number.POSITIVE_INFINITY,
    ratePerMm2Aud: 0.0035,
    minimumAud: null,
  },
] as const;

export type PlateRateTierId = (typeof PLATE_RATE_TABLE)[number]["id"];
export type PlateRateTier = (typeof PLATE_RATE_TABLE)[number];

export const SHIPPING_METHODS = [
  {
    id: "standard",
    label: "Standard",
    region: "Australia-wide",
    aud: 10,
  },
  {
    id: "express",
    label: "Express",
    region: "Australia-wide",
    aud: 15,
  },
] as const;

export type ShippingMethodId = (typeof SHIPPING_METHODS)[number]["id"];

export const SHIPPING_STORAGE_KEY = "trafflabels.shipping.v1";

const QTY_MIN = 1;
const QTY_MAX = 999;
/** Milli-cents per dollar, so $0.0075/mm² becomes 750. */
const RATE_SCALE = 100_000;

export type PlateQuote = {
  widthMm: number;
  heightMm: number;
  areaMm2: number;
  tierId: PlateRateTierId;
  ratePerMm2Aud: number;
  minimumApplied: boolean;
  qty: number;
  unitCents: number;
  lineCents: number;
};

export type OrderQuote = {
  lines: PlateQuote[];
  subtotalCents: number;
  shippingId: ShippingMethodId;
  shippingCents: number;
  totalCents: number;
};

const audFormat = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatAud(cents: number) {
  return audFormat.format(cents / 100);
}

export function formatPerMm2(ratePerMm2Aud: number) {
  const text = ratePerMm2Aud.toFixed(4).replace(/0+$/, "");
  return `$${text}/mm²`;
}

export function formatAreaMm2(areaMm2: number) {
  if (Number.isInteger(areaMm2)) return String(areaMm2);
  return areaMm2.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function isShippingMethodId(value: unknown): value is ShippingMethodId {
  return SHIPPING_METHODS.some((method) => method.id === value);
}

export function parseShippingMethod(value: unknown): ShippingMethodId {
  return isShippingMethodId(value) ? value : "standard";
}

export function shippingCents(id: ShippingMethodId) {
  const method = SHIPPING_METHODS.find((item) => item.id === id);
  if (!method) return SHIPPING_METHODS[0].aud * 100;
  return method.aud * 100;
}

export function clampOrderQty(qty: number) {
  if (!Number.isFinite(qty)) return QTY_MIN;
  return Math.min(QTY_MAX, Math.max(QTY_MIN, Math.round(qty)));
}

export function tierForArea(areaMm2: number): PlateRateTier {
  return (
    PLATE_RATE_TABLE.find((tier) => areaMm2 <= tier.maxAreaMm2) ??
    PLATE_RATE_TABLE[PLATE_RATE_TABLE.length - 1]
  );
}

function pricedSize(widthMm: number, heightMm: number) {
  const widthTenths = Math.round(widthMm * 10);
  const heightTenths = Math.round(heightMm * 10);
  const areaHundredths = widthTenths * heightTenths;
  return {
    widthMm: widthTenths / 10,
    heightMm: heightTenths / 10,
    areaMm2: areaHundredths / 100,
    areaHundredths,
  };
}

function centsForArea(areaHundredths: number, tier: PlateRateTier) {
  const milliCentsPerMm2 = Math.round(tier.ratePerMm2Aud * RATE_SCALE);
  const ratedCents = Math.round((areaHundredths * milliCentsPerMm2) / RATE_SCALE);
  const minimumCents =
    tier.minimumAud == null ? 0 : Math.round(tier.minimumAud * 100);
  return {
    unitCents: Math.max(ratedCents, minimumCents),
    minimumApplied: ratedCents < minimumCents,
  };
}

export function priceForPlate(
  widthMm: number,
  heightMm: number,
  qty = 1
): PlateQuote {
  const safeQty = clampOrderQty(qty);
  if (
    !(widthMm > 0) ||
    !(heightMm > 0) ||
    !Number.isFinite(widthMm) ||
    !Number.isFinite(heightMm)
  ) {
    const tier = PLATE_RATE_TABLE[0];
    return {
      widthMm: 0,
      heightMm: 0,
      areaMm2: 0,
      tierId: tier.id,
      ratePerMm2Aud: tier.ratePerMm2Aud,
      minimumApplied: false,
      qty: safeQty,
      unitCents: 0,
      lineCents: 0,
    };
  }

  const size = pricedSize(widthMm, heightMm);
  const tier = tierForArea(size.areaMm2);
  const money = centsForArea(size.areaHundredths, tier);
  return {
    widthMm: size.widthMm,
    heightMm: size.heightMm,
    areaMm2: size.areaMm2,
    tierId: tier.id,
    ratePerMm2Aud: tier.ratePerMm2Aud,
    minimumApplied: money.minimumApplied,
    qty: safeQty,
    unitCents: money.unitCents,
    lineCents: money.unitCents * safeQty,
  };
}

export function subtotalCents(
  lines: Array<{ widthMm: number; heightMm: number; qty: number }>
) {
  return lines.reduce(
    (sum, line) => sum + priceForPlate(line.widthMm, line.heightMm, line.qty).lineCents,
    0
  );
}

export function quoteOrder(
  lines: Array<{ widthMm: number; heightMm: number; qty: number }>,
  shippingId: ShippingMethodId
): OrderQuote {
  const priced = lines.map((line) =>
    priceForPlate(line.widthMm, line.heightMm, line.qty)
  );
  const platesCents = priced.reduce((sum, line) => sum + line.lineCents, 0);
  const freightCents = shippingCents(shippingId);
  return {
    lines: priced,
    subtotalCents: platesCents,
    shippingId,
    shippingCents: freightCents,
    totalCents: platesCents + freightCents,
  };
}
