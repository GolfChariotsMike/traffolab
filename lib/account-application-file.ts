import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  AccountApplicationRateError,
  isAccountApplicationStatus,
  isRateLimited,
  type AccountApplication,
  type AccountApplicationStatus,
  type NewAccountApplication,
} from "@/lib/account-application";

export type AccountApplicationPatch = {
  status?: AccountApplicationStatus;
  decidedBy?: string;
  linkedOrderId?: string | null;
  linkedOrderNumber?: number | null;
};

export type AccountApplicationStore = {
  insert(application: NewAccountApplication): Promise<AccountApplication>;
  list(): Promise<AccountApplication[]>;
  update(id: string, patch: AccountApplicationPatch): Promise<AccountApplication | null>;
};

type FileDb = { applications: AccountApplication[] };

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalize(value: AccountApplication): AccountApplication | null {
  if (!value || typeof value.id !== "string" || !isAccountApplicationStatus(value.status)) {
    return null;
  }
  return {
    ...value,
    linkedOrderId: value.linkedOrderId ?? null,
    linkedOrderNumber:
      typeof value.linkedOrderNumber === "number" ? value.linkedOrderNumber : null,
    decidedAt: value.decidedAt ?? null,
    decidedBy: value.decidedBy ?? "",
  };
}

export function createFileAccountApplicationStore(filePath: string): AccountApplicationStore {
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
      const applications = Array.isArray(parsed.applications) ? parsed.applications : [];
      return {
        applications: applications
          .map((item) => normalize(item as AccountApplication))
          .filter((item): item is AccountApplication => item !== null),
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return { applications: [] };
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
    async insert(application) {
      return locked(async () => {
        const db = await read();
        const now = Date.now();
        if (isRateLimited(db.applications, application.authorisedIp, now)) {
          throw new AccountApplicationRateError();
        }
        const saved: AccountApplication = {
          ...application,
          id: randomUUID(),
          createdAt: new Date(now).toISOString(),
          status: "new",
          linkedOrderId: null,
          linkedOrderNumber: null,
          decidedAt: null,
          decidedBy: "",
        };
        db.applications.unshift(saved);
        await write(db);
        return clone(saved);
      });
    },
    async list() {
      return locked(async () => {
        const db = await read();
        return clone(
          [...db.applications].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        );
      });
    },
    async update(id, patch) {
      return locked(async () => {
        const db = await read();
        const current = db.applications.find((item) => item.id === id);
        if (!current) return null;
        if (patch.status) current.status = patch.status;
        if (patch.status === "new") {
          current.decidedAt = null;
          current.decidedBy = patch.decidedBy ?? current.decidedBy;
        } else if (patch.status === "approved" || patch.status === "declined") {
          current.decidedAt = new Date().toISOString();
          current.decidedBy = patch.decidedBy ?? current.decidedBy;
        }
        if ("linkedOrderId" in patch) current.linkedOrderId = patch.linkedOrderId ?? null;
        if ("linkedOrderNumber" in patch) {
          current.linkedOrderNumber = patch.linkedOrderNumber ?? null;
        }
        await write(db);
        return clone(current);
      });
    },
  };
}

export function defaultAccountApplicationFilePath() {
  const override = process.env.ACCOUNT_APPLICATION_STORE_PATH?.trim();
  if (override) return override;
  return path.join(process.cwd(), ".data", "trafflabels-account-applications.json");
}
