import "server-only";
import type { Sql } from "postgres";
import { createFileLoginTokens, defaultLoginTokenFilePath } from "@/lib/login-token-file";
import { getSql } from "@/lib/order-store";
import { orderStoreMode } from "@/lib/order-store-types";

const LOGIN_TOKEN_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS trafflabels_login_tokens (
  jti text PRIMARY KEY,
  email text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now()
);
`;

let schemaReady: Promise<void> | null = null;

async function ensureSchema(sql: Sql) {
  if (!schemaReady) {
    schemaReady = sql.unsafe(LOGIN_TOKEN_SCHEMA_SQL).then(() => undefined);
  }
  await schemaReady;
}

async function consumePostgres(
  sql: Sql,
  record: { jti: string; email: string; exp: number },
  now: number
) {
  if (record.exp <= now) return false;
  await ensureSchema(sql);
  const rows = await sql<{ jti: string }[]>`
    INSERT INTO trafflabels_login_tokens (jti, email, expires_at)
    VALUES (${record.jti}, ${record.email}, ${new Date(record.exp).toISOString()})
    ON CONFLICT (jti) DO NOTHING
    RETURNING jti
  `;
  return rows.length > 0;
}

export async function consumeLoginToken(
  record: { jti: string; email: string; exp: number },
  now = Date.now()
) {
  const mode = orderStoreMode();
  if (mode === "postgres") {
    const sql = getSql();
    if (!sql) return false;
    return consumePostgres(sql, record, now);
  }
  if (mode === "file") {
    return createFileLoginTokens(defaultLoginTokenFilePath()).consume(record, now);
  }
  return false;
}
