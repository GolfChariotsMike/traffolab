import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Cost, NewCost } from "@/lib/costs";

export type CostStore = {
  insert(cost: NewCost): Promise<Cost>;
  remove(id: number): Promise<boolean>;
  listForOrder(orderId: string): Promise<Cost[]>;
  /** month = YYYY-MM by cost date. */
  listForMonth(month: string): Promise<Cost[]>;
};

type FileDb = { nextId: number; costs: Cost[] };

function sortCosts(costs: Cost[]) {
  return [...costs].sort((a, b) =>
    a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1
  );
}

export function createFileCostStore(filePath: string): CostStore {
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
      const costs = Array.isArray(parsed.costs) ? parsed.costs : [];
      const nextId =
        typeof parsed.nextId === "number"
          ? parsed.nextId
          : costs.reduce((max, c) => Math.max(max, c.id), 0) + 1;
      return { nextId, costs };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { nextId: 1, costs: [] };
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
    insert: (cost) =>
      locked(async () => {
        const db = await read();
        const saved: Cost = { ...cost, id: db.nextId, createdAt: new Date().toISOString() };
        db.nextId += 1;
        db.costs.push(saved);
        await write(db);
        return { ...saved };
      }),
    remove: (id) =>
      locked(async () => {
        const db = await read();
        const before = db.costs.length;
        db.costs = db.costs.filter((c) => c.id !== id);
        if (db.costs.length === before) return false;
        await write(db);
        return true;
      }),
    listForOrder: (orderId) =>
      locked(async () => sortCosts((await read()).costs.filter((c) => c.orderId === orderId))),
    listForMonth: (month) =>
      locked(async () => sortCosts((await read()).costs.filter((c) => c.date.startsWith(month)))),
  };
}

export function defaultCostFilePath() {
  const override = process.env.COST_STORE_PATH?.trim();
  if (override) return override;
  return path.join(process.cwd(), ".data", "trafflabels-costs.json");
}
