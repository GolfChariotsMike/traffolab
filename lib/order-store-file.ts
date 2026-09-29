import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyOrderPatch, type CheckoutDraft, type OrderPatch, type SavedOrder } from "@/lib/orders";
import type { OrderStore } from "@/lib/order-store-types";

type FileDb = {
  drafts: Record<string, CheckoutDraft & { stripeSessionId?: string }>;
  orders: SavedOrder[];
  nextNumber: number;
};

const EMPTY: FileDb = { drafts: {}, orders: [], nextNumber: 1001 };

function normalizeOrder(order: SavedOrder): SavedOrder {
  return {
    ...order,
    paymentSource: order.paymentSource === "manual" ? "manual" : "stripe",
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createFileOrderStore(filePath: string): OrderStore {
  let chain: Promise<unknown> = Promise.resolve();

  function locked<T>(fn: () => Promise<T>): Promise<T> {
    const run = chain.then(fn, fn);
    chain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  async function read(): Promise<FileDb> {
    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<FileDb>;
      return {
        drafts: parsed.drafts ?? {},
        orders: (Array.isArray(parsed.orders) ? parsed.orders : []).map((order) =>
          normalizeOrder(order as SavedOrder)
        ),
        nextNumber:
          typeof parsed.nextNumber === "number" && parsed.nextNumber >= 1001
            ? parsed.nextNumber
            : 1001,
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return clone(EMPTY);
      throw error;
    }
  }

  async function write(db: FileDb) {
    await mkdir(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(db), "utf8");
    await rename(tmp, filePath);
  }

  return {
    async saveDraft(draft) {
      await locked(async () => {
        const db = await read();
        db.drafts[draft.id] = clone(draft);
        await write(db);
      });
    },
    async attachDraftSession(draftId, sessionId) {
      await locked(async () => {
        const db = await read();
        const draft = db.drafts[draftId];
        if (!draft) return;
        draft.stripeSessionId = sessionId;
        await write(db);
      });
    },
    async getDraft(draftId) {
      const db = await read();
      const draft = db.drafts[draftId];
      if (!draft) return null;
      const copy = clone(draft);
      delete copy.stripeSessionId;
      return copy;
    },
    async insertPaidOrder(order) {
      return locked(async () => {
        const db = await read();
        const existing = db.orders.find((item) => item.stripeSessionId === order.stripeSessionId);
        if (existing) {
          if (!existing.stripeReceiptUrl && order.stripeReceiptUrl) {
            existing.stripeReceiptUrl = order.stripeReceiptUrl;
            if (!existing.stripePaymentIntentId && order.stripePaymentIntentId) {
              existing.stripePaymentIntentId = order.stripePaymentIntentId;
            }
            existing.updatedAt = new Date().toISOString();
            await write(db);
          }
          return clone(existing);
        }
        const saved: SavedOrder = { ...clone(order), orderNumber: db.nextNumber };
        db.nextNumber += 1;
        db.orders.push(saved);
        await write(db);
        return clone(saved);
      });
    },
    async findBySessionId(sessionId) {
      const db = await read();
      const found = db.orders.find((item) => item.stripeSessionId === sessionId);
      return found ? clone(found) : null;
    },
    async listOrders() {
      const db = await read();
      return clone(db.orders)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.orderNumber - a.orderNumber))
        .slice(0, 500);
    },
    async getOrder(orderNumber) {
      const db = await read();
      const found = db.orders.find((item) => item.orderNumber === orderNumber);
      return found ? clone(found) : null;
    },
    async updateOrder(orderNumber, patch: OrderPatch) {
      return locked(async () => {
        const db = await read();
        const index = db.orders.findIndex((item) => item.orderNumber === orderNumber);
        if (index < 0) return null;
        const next = applyOrderPatch(db.orders[index], patch);
        db.orders[index] = next;
        await write(db);
        return clone(next);
      });
    },
  };
}

export function defaultOrderFilePath() {
  const override = process.env.ORDER_STORE_PATH?.trim();
  if (override) return override;
  return path.join(process.cwd(), ".data", "trafflabels-orders.json");
}
