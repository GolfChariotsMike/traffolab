import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NewStockCount, NewStockPurchase, StockCount, StockPurchase } from "@/lib/stock";

export type StockStore = {
  insertPurchase(purchase: NewStockPurchase): Promise<StockPurchase>;
  removePurchase(id: number): Promise<boolean>;
  listPurchases(): Promise<StockPurchase[]>;
  insertCount(count: NewStockCount): Promise<StockCount>;
  removeCount(id: number): Promise<boolean>;
  listCounts(): Promise<StockCount[]>;
};

type FileDb = {
  nextPurchaseId: number;
  nextCountId: number;
  purchases: StockPurchase[];
  counts: StockCount[];
};

function byDateDesc<T extends { date: string; id: number }>(rows: T[]) {
  return [...rows].sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1));
}

export function createFileStockStore(filePath: string): StockStore {
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
      const parsed = JSON.parse(await readFile(filePath, "utf8")) as Partial<FileDb>;
      const purchases = Array.isArray(parsed.purchases) ? parsed.purchases : [];
      const counts = Array.isArray(parsed.counts) ? parsed.counts : [];
      return {
        purchases,
        counts,
        nextPurchaseId:
          typeof parsed.nextPurchaseId === "number"
            ? parsed.nextPurchaseId
            : purchases.reduce((max, row) => Math.max(max, row.id), 0) + 1,
        nextCountId:
          typeof parsed.nextCountId === "number"
            ? parsed.nextCountId
            : counts.reduce((max, row) => Math.max(max, row.id), 0) + 1,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { nextPurchaseId: 1, nextCountId: 1, purchases: [], counts: [] };
      }
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
    insertPurchase: (purchase) =>
      locked(async () => {
        const db = await read();
        const saved: StockPurchase = { ...purchase, id: db.nextPurchaseId, createdAt: new Date().toISOString() };
        db.nextPurchaseId += 1;
        db.purchases.push(saved);
        await write(db);
        return { ...saved };
      }),
    removePurchase: (id) =>
      locked(async () => {
        const db = await read();
        const before = db.purchases.length;
        db.purchases = db.purchases.filter((row) => row.id !== id);
        if (db.purchases.length === before) return false;
        await write(db);
        return true;
      }),
    listPurchases: () => locked(async () => byDateDesc((await read()).purchases)),
    insertCount: (count) =>
      locked(async () => {
        const db = await read();
        const saved: StockCount = { ...count, id: db.nextCountId, createdAt: new Date().toISOString() };
        db.nextCountId += 1;
        db.counts.push(saved);
        await write(db);
        return { ...saved };
      }),
    removeCount: (id) =>
      locked(async () => {
        const db = await read();
        const before = db.counts.length;
        db.counts = db.counts.filter((row) => row.id !== id);
        if (db.counts.length === before) return false;
        await write(db);
        return true;
      }),
    listCounts: () => locked(async () => byDateDesc((await read()).counts)),
  };
}

export function defaultStockFilePath() {
  const override = process.env.STOCK_STORE_PATH?.trim();
  if (override) return override;
  return path.join(process.cwd(), ".data", "trafflabels-stock.json");
}
