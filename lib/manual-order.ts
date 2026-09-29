/**
 * Manual / trade orders created from the same plate CSV the public upload uses:
 * colour, width, height, text, qty (millimetres). Customer and shipping are
 * entered beside the file. Nothing is stored unless every row is valid.
 */

import { COLOUR_PAIRS } from "@/lib/label-design";
import {
  TEMPLATE_CSV,
  loadCsvDocument,
  orderLinesFromPreview,
  previewMappedRows,
  resolveMapping,
} from "@/lib/order-csv";
import {
  type NewPaidOrder,
  type PaymentSource,
  type StoredPlate,
} from "@/lib/orders";
import { isShippingMethodId, quoteOrder, type ShippingMethodId } from "@/lib/pricing";

export { TEMPLATE_CSV };

const MAX_CSV_CHARS = 500_000;
const MAX_ROWS = 200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ManualOrderError = {
  /** 1-based line in the file when the problem is a plate row. */
  line?: number;
  message: string;
};

export type ManualOrderOk = {
  ok: true;
  order: NewPaidOrder;
  plateCount: number;
};

export type ManualOrderFail = {
  ok: false;
  errors: ManualOrderError[];
};

function text(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function fileLine(headerless: boolean, sourceIndex: number) {
  return headerless ? sourceIndex + 1 : sourceIndex + 2;
}

export function parseManualOrder(body: unknown, now = new Date()): ManualOrderOk | ManualOrderFail {
  if (!body || typeof body !== "object") {
    return { ok: false, errors: [{ message: "Invalid request." }] };
  }
  const raw = body as Record<string, unknown>;
  const errors: ManualOrderError[] = [];

  const name = text(raw.name, 200);
  if (!name) errors.push({ message: "Enter the customer name." });

  const emailRaw = text(raw.email, 200).toLowerCase();
  if (emailRaw && !EMAIL_RE.test(emailRaw)) {
    errors.push({ message: "Enter a valid email, or leave it blank." });
  }

  const phone = text(raw.phone, 40);
  const line1 = text(raw.line1, 200);
  const line2 = text(raw.line2, 200);
  const city = text(raw.city, 120);
  const state = text(raw.state, 80);
  const postalCode = text(raw.postalCode, 20);
  const countryRaw = text(raw.country, 80);
  const country =
    !countryRaw || countryRaw.toLowerCase() === "australia" ? "AU" : countryRaw.toUpperCase();
  if (!line1) errors.push({ message: "Enter address line 1." });
  if (!city) errors.push({ message: "Enter the suburb or city." });
  if (!state) errors.push({ message: "Enter the state." });
  if (!postalCode) errors.push({ message: "Enter the postcode." });

  let shippingMethodId: ShippingMethodId = "standard";
  if (!isShippingMethodId(raw.shippingMethodId)) {
    errors.push({ message: "Choose Standard or Express shipping." });
  } else {
    shippingMethodId = raw.shippingMethodId;
  }

  const note = text(raw.note, 4000);
  if (typeof raw.note === "string" && raw.note.trim().length > 4000) {
    errors.push({ message: "Note is too long." });
  }

  const csv = typeof raw.csv === "string" ? raw.csv : "";
  if (!csv.trim()) {
    errors.push({ message: "Choose a CSV file." });
  } else if (csv.length > MAX_CSV_CHARS) {
    errors.push({ message: "That CSV is too large." });
  }

  let plates: StoredPlate[] = [];
  let subtotalCents = 0;
  let shippingCents = 0;
  let totalCents = 0;

  if (csv.trim() && csv.length <= MAX_CSV_CHARS) {
    let document;
    try {
      document = loadCsvDocument(csv);
    } catch (error) {
      errors.push({
        message: error instanceof Error ? error.message : "Could not read that CSV.",
      });
      document = null;
    }

    if (document) {
      if (document.rows.length === 0) {
        errors.push({ message: "Add at least one plate row." });
      } else if (document.rows.length > MAX_ROWS) {
        errors.push({ message: `CSV supports up to ${MAX_ROWS} plate rows.` });
      } else {
        const mapping = resolveMapping(document.headers);
        const preview = previewMappedRows(document, mapping);
        const rowErrors = preview.filter((row) => row.errors.length > 0);
        if (rowErrors.length > 0) {
          for (const row of rowErrors) {
            const line = fileLine(document.headerless, row.sourceIndex);
            for (const problem of row.errors) {
              errors.push({ line, message: `Line ${line}: ${problem.message}` });
            }
          }
        } else {
          const lines = orderLinesFromPreview(preview);
          if (lines.length !== preview.length) {
            errors.push({ message: "Every plate row must be valid before an order is created." });
          } else {
            const quote = quoteOrder(
              lines.map((line) => ({
                widthMm: line.design.widthMm,
                heightMm: line.design.heightMm,
                qty: line.qty,
              })),
              shippingMethodId
            );
            plates = quote.lines.map((priced, index) => {
              const design = lines[index].design;
              return {
                widthMm: priced.widthMm,
                heightMm: priced.heightMm,
                qty: priced.qty,
                unitCents: priced.unitCents,
                lineCents: priced.lineCents,
                colourPair: design.colourPair,
                colourLabel: COLOUR_PAIRS[design.colourPair].label,
                adhesive3m: design.adhesive3m,
                text: design.objects
                  .map((object) => object.text.trim())
                  .filter(Boolean)
                  .join("\n"),
                objects: design.objects.map((object) => ({
                  id: object.id,
                  text: object.text,
                  x: object.x,
                  y: object.y,
                  fontSize: object.fontSize,
                  align: object.align,
                })),
              };
            });
            subtotalCents = quote.subtotalCents;
            shippingCents = quote.shippingCents;
            totalCents = quote.totalCents;
          }
        }
      }
    }
  }

  if (errors.length > 0 || plates.length === 0) {
    return {
      ok: false,
      errors: errors.length > 0 ? errors : [{ message: "Add at least one plate row." }],
    };
  }

  const createdAt = now.toISOString();
  const paymentSource: PaymentSource = "manual";
  return {
    ok: true,
    plateCount: plates.reduce((sum, plate) => sum + plate.qty, 0),
    order: {
      id: crypto.randomUUID(),
      createdAt,
      updatedAt: createdAt,
      status: "NEW",
      customerName: name,
      customerEmail: emailRaw,
      customerPhone: phone,
      shipping: {
        name,
        line1,
        line2,
        city,
        state,
        postalCode,
        country,
      },
      shippingMethodId,
      subtotalCents,
      shippingCents,
      totalCents,
      stripeSessionId: `manual:${crypto.randomUUID()}`,
      stripePaymentIntentId: null,
      stripeReceiptUrl: null,
      stripeLivemode: false,
      paymentSource,
      note,
      trackingLink: "",
      plates,
    },
  };
}
