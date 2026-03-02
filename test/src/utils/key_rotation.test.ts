import { describe, it, expect, vi, beforeEach } from "vitest";
import { getNextIndex } from "~/src/utils/key_rotation";

/** 内存分支：无 Redis 时使用 */
let mockRedisConfigUrl: string | undefined = undefined;
vi.mock("~/src/common/env", () => ({
  redisConfig: {
    get url() {
      return mockRedisConfigUrl;
    },
  },
}));

const mockIncr = vi.fn();
const mockQuit = vi.fn();
vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({
    incr: mockIncr,
    quit: mockQuit,
  })),
}));

describe("key_rotation", () => {
  beforeEach(() => {
    mockRedisConfigUrl = undefined;
    vi.clearAllMocks();
    mockIncr.mockReset();
    mockQuit.mockResolvedValue(undefined);
  });

  describe("getNextIndex", () => {
    it("length <= 1 时应返回 0", async () => {
      expect(await getNextIndex("any-key", 0)).toBe(0);
      expect(await getNextIndex("any-key", 1)).toBe(0);
    });

    it("无 Redis 时使用内存轮询，应依次返回 0, 1, 0, 1...", async () => {
      mockRedisConfigUrl = undefined;

      expect(await getNextIndex("mem-key", 2)).toBe(0);
      expect(await getNextIndex("mem-key", 2)).toBe(1);
      expect(await getNextIndex("mem-key", 2)).toBe(0);
      expect(await getNextIndex("mem-key", 2)).toBe(1);
    });

    it("不同 key 应独立计数", async () => {
      mockRedisConfigUrl = undefined;

      expect(await getNextIndex("key-a", 2)).toBe(0);
      expect(await getNextIndex("key-b", 2)).toBe(0);
      expect(await getNextIndex("key-a", 2)).toBe(1);
      expect(await getNextIndex("key-b", 2)).toBe(1);
    });

    it("length=3 时内存轮询应返回 0, 1, 2, 0, 1, 2...", async () => {
      mockRedisConfigUrl = undefined;

      expect(await getNextIndex("tri", 3)).toBe(0);
      expect(await getNextIndex("tri", 3)).toBe(1);
      expect(await getNextIndex("tri", 3)).toBe(2);
      expect(await getNextIndex("tri", 3)).toBe(0);
    });

    it("有 Redis 时应调用 ioredis incr 并返回 (current-1)%length", async () => {
      mockRedisConfigUrl = "redis://localhost";
      mockIncr
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3);

      const r0 = await getNextIndex("redis-key", 2);
      expect(r0).toBe(0); // (1-1)%2 = 0

      const r1 = await getNextIndex("redis-key", 2);
      expect(r1).toBe(1); // (2-1)%2 = 1

      const r2 = await getNextIndex("redis-key", 2);
      expect(r2).toBe(0); // (3-1)%2 = 0

      expect(mockIncr).toHaveBeenCalledWith("key-rotation:redis-key");
      expect(mockIncr).toHaveBeenCalledTimes(3);
      expect(mockQuit).toHaveBeenCalledTimes(3);
    });
  });
});
