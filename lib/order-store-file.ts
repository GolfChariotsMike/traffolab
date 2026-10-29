import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  applyOrderPatch,
  OrderUpdateError,
  type CheckoutDraft,
  type OrderPatch,
  type SavedOrder,
} from "@/lib/orders";
import {
  approvalStatement,
  newProofToken,
  platesApprovalHash,
  platesMatchProof,
  proofPriceSummary,
  type ProofDecisionInput,
  type ProofRecord,
} from "@/lib/proofs";
import type { OrderStore } from "@/lib/order-store-types";

type FileDb = {
  drafts: Record<string, CheckoutDraft & { stripeSessionId?: string }>;
  orders: SavedOrder[];
  proofs: ProofRecord[];
  nextNumber: number;
};

const EMPTY: FileDb = { drafts: {}, orders: [], proofs: [], nextNumber: 1001 };

function normalizeOrder(order: SavedOrder): SavedOrder {
  const fromPlates = order.plates?.some((plate) => plate.uniformTextSize === true) === true;
  return {
    ...order,
    paymentSource: order.paymentSource === "manual" ? "manual" : "stripe",
    uniformTextSize: order.uniformTextSize === true || fromPlates,
  };
}

function normalizeProof(proof: ProofRecord): ProofRecord {
  const total = proof.approvedTotalCents;
  return {
    ...proof,
    approvedTotalCents:
      typeof total === "number" && Number.isInteger(total) && total >= 0 ? total : null,
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
        proofs: Array.isArray(parsed.proofs)
          ? (parsed.proofs as ProofRecord[]).map((proof) => normalizeProof(proof))
          : [],
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
        const existing = db.orders[index];
        if (
          patch.plateLocations &&
          patch.plateLocations.length !== existing.plates.length
        ) {
          throw new OrderUpdateError(
            "Location list does not match the plates on this order."
          );
        }
        const beforeHash = platesApprovalHash(existing.plates);
        const next = applyOrderPatch(existing, patch);
        db.orders[index] = next;
        if (platesApprovalHash(next.plates) !== beforeHash) {
          for (const proof of db.proofs) {
            if (proof.orderId === next.id && proof.status !== "superseded") {
              proof.status = "superseded";
            }
          }
        }
        await write(db);
        return clone(next);
      });
    },
    async createProof(orderNumber, input) {
      return locked(async () => {
        const db = await read();
        const order = db.orders.find((item) => item.orderNumber === orderNumber);
        if (!order) return null;
        for (const proof of db.proofs) {
          if (proof.orderId === order.id && proof.status !== "superseded") {
            proof.status = "superseded";
          }
        }
        const plates = clone(order.plates);
        let token = newProofToken();
        while (db.proofs.some((proof) => proof.token === token)) token = newProofToken();
        const record: ProofRecord = {
          id: crypto.randomUUID(),
          orderId: order.id,
          orderNumber: order.orderNumber,
          token,
          createdAt: new Date().toISOString(),
          status: "pending",
          plates,
          platesHash: platesApprovalHash(plates),
          customerName: order.customerName,
          shipping: clone(order.shipping),
          invoiceUrl: input.invoiceUrl,
          approvedName: "",
          approvedAt: null,
          approvedIp: "",
          approvedUserAgent: "",
          approvalStatement: "",
          approvedTotalCents: null,
          changeComment: "",
          changeRequestedAt: null,
          changeIp: "",
          changeUserAgent: "",
        };
        db.proofs.push(record);
        await write(db);
        return clone(record);
      });
    },
    async openProof(token) {
      return locked(async () => {
        const db = await read();
        const proof = db.proofs.find((item) => item.token === token);
        if (!proof) return null;
        const order = db.orders.find((item) => item.id === proof.orderId);
        if (!order) return null;
        if (proof.status !== "superseded" && !platesMatchProof(order.plates, proof)) {
          proof.status = "superseded";
          await write(db);
        }
        return { proof: clone(proof), order: clone(order) };
      });
    },
    async listLatestProofs() {
      const db = await read();
      return latestProofs(db.proofs).map((proof) => clone(proof));
    },
    async getLatestProof(orderId) {
      const db = await read();
      const found = latestProofs(db.proofs).find((proof) => proof.orderId === orderId);
      return found ? clone(found) : null;
    },
    async decideProof(token, decision: ProofDecisionInput) {
      return locked(async () => {
        const db = await read();
        const proof = db.proofs.find((item) => item.token === token);
        if (!proof) return { ok: false as const, code: "not_found" as const };
        const order = db.orders.find((item) => item.id === proof.orderId);
        if (!order) return { ok: false as const, code: "not_found" as const };
        if (!platesMatchProof(order.plates, proof)) {
          proof.status = "superseded";
          await write(db);
          return { ok: false as const, code: "superseded" as const };
        }
        if (proof.status === "superseded") {
          return { ok: false as const, code: "superseded" as const };
        }
        if (decision.action === "approve") {
          if (proof.status === "approved") {
            return { ok: true as const, proof: clone(proof), changed: false };
          }
          if (proof.status !== "pending") {
            return { ok: false as const, code: "closed" as const };
          }
          proof.status = "approved";
          proof.approvedName = decision.name;
          proof.approvedAt = new Date().toISOString();
          proof.approvedIp = decision.ip;
          proof.approvedUserAgent = decision.userAgent;
          const price = proofPriceSummary(proof.plates, order);
          proof.approvalStatement = approvalStatement(price.totalIncGstCents);
          proof.approvedTotalCents = price.totalIncGstCents;
          await write(db);
          return { ok: true as const, proof: clone(proof), changed: true };
        }
        if (proof.status !== "pending") {
          return { ok: false as const, code: "closed" as const };
        }
        proof.status = "changes_requested";
        proof.changeComment = decision.comment;
        proof.changeRequestedAt = new Date().toISOString();
        proof.changeIp = decision.ip;
        proof.changeUserAgent = decision.userAgent;
        await write(db);
        return { ok: true as const, proof: clone(proof), changed: true };
      });
    },
  };
}

function latestProofs(proofs: ProofRecord[]) {
  const latest = new Map<string, ProofRecord>();
  for (const proof of proofs) {
    const current = latest.get(proof.orderId);
    if (
      !current ||
      current.createdAt < proof.createdAt ||
      (current.createdAt === proof.createdAt && current.id < proof.id)
    ) {
      latest.set(proof.orderId, proof);
    }
  }
  return [...latest.values()];
}

export function defaultOrderFilePath() {
  const override = process.env.ORDER_STORE_PATH?.trim();
  if (override) return override;
  return path.join(process.cwd(), ".data", "trafflabels-orders.json");
}
