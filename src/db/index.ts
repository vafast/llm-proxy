/**
 * PostgreSQL 连接
 *
 * 优先 DATABASE_URL（Railway 私网），否则 DATABASE_PUBLIC_URL（本地开发）
 */
import pg from "pg";

const connectionString =
  process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool | null {
  if (!connectionString) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  const p = getPool();
  if (!p) throw new Error("DATABASE_URL 或 DATABASE_PUBLIC_URL 未配置");
  return p.query<T>(text, params);
}

export async function initDb(): Promise<void> {
  const p = getPool();
  if (!p) return;

  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS proxy_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key_hash TEXT NOT NULL UNIQUE,
        name TEXT,
        enabled BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  } catch (err) {
    console.warn("DB 初始化失败（admin keys 不可用）:", err instanceof Error ? err.message : err);
  }
}
