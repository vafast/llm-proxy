/**
 * Key 轮询管理器
 *
 * 支持 Redis（redis:// URL）和内存（单进程）两种实现
 */
import { redisConfig } from "../common/env";

const memoryCounters = new Map<string, number>();

/**
 * 获取下一个轮询索引（0 到 length-1）
 * 启用 ENABLE_GLOBAL_ROUND_ROBIN 且配置了 REDIS_URL 时使用 Redis，否则使用内存
 */
export async function getNextIndex(
  keyName: string,
  length: number,
): Promise<number> {
  if (length <= 1) return 0;

  if (redisConfig.url) {
    return redisGetNextIndex(keyName, length);
  }

  return memoryGetNextIndex(keyName, length);
}

async function redisGetNextIndex(
  keyName: string,
  length: number,
): Promise<number> {
  const Redis = (await import("ioredis")).default;
  const redis = new Redis(redisConfig.url!);

  const key = `key-rotation:${keyName}`;
  const current = await redis.incr(key);
  await redis.quit();
  return (current - 1) % length;
}

function memoryGetNextIndex(keyName: string, length: number): number {
  const current = memoryCounters.get(keyName) ?? 0;
  const next = (current + 1) % length;
  memoryCounters.set(keyName, next);
  return current;
}
