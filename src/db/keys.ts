/**
 * 代理 Key 管理
 *
 * Key 存 hash，创建时返回明文一次
 */
import { createHash, randomBytes } from "node:crypto";
import { query, getPool } from "./index";

export interface ProxyKeyRecord {
  id: string;
  key_hash: string;
  name: string | null;
  enabled: boolean;
  created_at: Date;
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function generateKey(): string {
  return "sk-" + randomBytes(32).toString("hex");
}

/** 校验 key 是否有效 */
export async function validateKey(plainKey: string): Promise<boolean> {
  const p = getPool();
  if (!p) return false;

  const keyHash = hashKey(plainKey);
  const r = await query<{ id: string }>(
    "SELECT id FROM proxy_keys WHERE key_hash = $1 AND enabled = true",
    [keyHash],
  );
  return (r.rowCount ?? 0) > 0;
}

function ensurePool(): void {
  if (!getPool()) {
    throw new Error("DATABASE_URL 或 DATABASE_PUBLIC_URL 未配置");
  }
}

/** 创建 key，返回明文（仅此一次） */
export async function createKey(name?: string): Promise<{
  id: string;
  key: string;
  name: string | null;
  created_at: Date;
}> {
  ensurePool();
  const plainKey = generateKey();
  const keyHash = hashKey(plainKey);
  const r = await query<{ id: string; name: string | null; created_at: Date }>(
    "INSERT INTO proxy_keys (key_hash, name) VALUES ($1, $2) RETURNING id, name, created_at",
    [keyHash, name || null],
  );
  const row = r.rows[0];
  if (!row) throw new Error("创建 key 失败");
  return {
    id: row.id,
    key: plainKey,
    name: row.name,
    created_at: row.created_at,
  };
}

/** 列表（不含 key 明文） */
export async function listKeys(): Promise<
  { id: string; name: string | null; enabled: boolean; created_at: Date }[]
> {
  ensurePool();
  const r = await query<ProxyKeyRecord>(
    "SELECT id, name, enabled, created_at FROM proxy_keys ORDER BY created_at DESC",
  );
  return r.rows;
}

/** 更新（启用/禁用、改名） */
export async function updateKey(
  id: string,
  updates: { enabled?: boolean; name?: string },
): Promise<boolean> {
  ensurePool();
  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (updates.enabled !== undefined) {
    sets.push(`enabled = $${i++}`);
    params.push(updates.enabled);
  }
  if (updates.name !== undefined) {
    sets.push(`name = $${i++}`);
    params.push(updates.name);
  }
  if (sets.length === 0) return false;
  params.push(id);
  const r = await query(
    `UPDATE proxy_keys SET ${sets.join(", ")} WHERE id = $${i} RETURNING id`,
    params,
  );
  return (r.rowCount ?? 0) > 0;
}

/** 删除 */
export async function deleteKey(id: string): Promise<boolean> {
  ensurePool();
  const r = await query("DELETE FROM proxy_keys WHERE id = $1 RETURNING id", [
    id,
  ]);
  return (r.rowCount ?? 0) > 0;
}
