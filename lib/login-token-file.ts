import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

type UsedTokens = Record<string, number>;

type TokenFile = {
  used: UsedTokens;
};

const EMPTY: TokenFile = { used: {} };

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function defaultLoginTokenFilePath() {
  return path.join(process.cwd(), ".data", "trafflabels-login-tokens.json");
}

export function createFileLoginTokens(filePath: string) {
  let chain: Promise<unknown> = Promise.resolve();

  function locked<T>(fn: () => Promise<T>): Promise<T> {
    const run = chain.then(fn, fn);
    chain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  async function read(): Promise<TokenFile> {
    try {
      const parsed = JSON.parse(await readFile(filePath, "utf8")) as Partial<TokenFile>;
      const used: UsedTokens = {};
      if (parsed.used && typeof parsed.used === "object") {
        for (const [jti, exp] of Object.entries(parsed.used)) {
          if (typeof exp === "number" && Number.isFinite(exp)) used[jti] = exp;
        }
      }
      return { used };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return clone(EMPTY);
      throw error;
    }
  }

  async function write(db: TokenFile) {
    await mkdir(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(db), "utf8");
    await rename(tmp, filePath);
  }

  return {
    async consume(record: { jti: string; exp: number }, now = Date.now()) {
      return locked(async () => {
        if (record.exp <= now) return false;
        const db = await read();
        const cutoff = now - 24 * 60 * 60 * 1000;
        for (const [jti, exp] of Object.entries(db.used)) {
          if (exp < cutoff) delete db.used[jti];
        }
        if (db.used[record.jti] !== undefined) {
          await write(db);
          return false;
        }
        db.used[record.jti] = record.exp;
        await write(db);
        return true;
      });
    },
  };
}
