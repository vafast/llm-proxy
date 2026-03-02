import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Server } from "vafast";
import { adminRoutes } from "~/src/routes/admin";

vi.mock("~/src/db/keys", () => ({
  createKey: vi.fn(),
  listKeys: vi.fn(),
  updateKey: vi.fn(),
  deleteKey: vi.fn(),
}));

/** 用于 redis-ping 成功测试：mock 中通过 getter 动态返回 */
let mockRedisConfigUrl: string | undefined = undefined;
vi.mock("~/src/common/env", () => ({
  redisConfig: {
    get url() {
      return mockRedisConfigUrl;
    },
  },
}));

vi.mock("~/src/utils/key_rotation", () => ({
  getNextIndex: vi.fn(),
}));

const keysDb = await import("~/src/db/keys");
const keyRotation = await import("~/src/utils/key_rotation");

describe("admin routes", () => {
  const ADMIN_KEY = "mock-admin-key";
  let server: Server;
  const originalAdminKey = process.env.ADMIN_KEY;

  beforeEach(() => {
    process.env.ADMIN_KEY = ADMIN_KEY;
    vi.mocked(keysDb.createKey).mockResolvedValue({
      id: "uuid-1",
      key: "mock-created-key",
      name: "test",
      created_at: new Date("2025-01-01"),
    });
    vi.mocked(keysDb.listKeys).mockResolvedValue([
      { id: "uuid-1", name: "test", enabled: true, created_at: new Date("2025-01-01") },
    ]);
    vi.mocked(keysDb.updateKey).mockResolvedValue(true);
    vi.mocked(keysDb.deleteKey).mockResolvedValue(true);
    server = new Server(adminRoutes);
  });

  afterEach(() => {
    process.env.ADMIN_KEY = originalAdminKey;
  });

  function authHeaders() {
    return { Authorization: `Bearer ${ADMIN_KEY}` };
  }

  it("GET /admin/keys 应返回 keys 列表", async () => {
    const res = await server.fetch(
      new Request("https://example.com/admin/keys", {
        headers: authHeaders(),
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.keys).toHaveLength(1);
    expect(data.keys[0].id).toBe("uuid-1");
  });

  it("GET /admin/keys 无鉴权应返回 401", async () => {
    const res = await server.fetch(new Request("https://example.com/admin/keys"));
    expect(res.status).toBe(401);
  });

  it("POST /admin/keys 应创建 key", async () => {
    const res = await server.fetch(
      new Request("https://example.com/admin/keys", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ name: "my-key" }),
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe("uuid-1");
    expect(data.key).toBe("mock-created-key");
    expect(keysDb.createKey).toHaveBeenCalledWith("my-key");
  });

  it("PATCH /admin/keys/:id 应更新 key", async () => {
    const res = await server.fetch(
      new Request("https://example.com/admin/keys/uuid-1", {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      }),
    );
    expect(res.status).toBe(200);
    expect(keysDb.updateKey).toHaveBeenCalledWith("uuid-1", { enabled: false });
  });

  it("DELETE /admin/keys/:id 应删除 key", async () => {
    const res = await server.fetch(
      new Request("https://example.com/admin/keys/uuid-1", {
        method: "DELETE",
        headers: authHeaders(),
      }),
    );
    expect(res.status).toBe(200);
    expect(keysDb.deleteKey).toHaveBeenCalledWith("uuid-1");
  });

  it("GET /admin/redis-ping 无 Redis 配置时应返回 503", async () => {
    mockRedisConfigUrl = undefined;
    const res = await server.fetch(
      new Request("https://example.com/admin/redis-ping", {
        headers: authHeaders(),
      }),
    );
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.code).toBe(503);
    expect(data.message).toContain("Redis 未配置");
  });

  it("GET /admin/redis-ping Redis 已配置时应返回轮询结果 [0, 1]", async () => {
    mockRedisConfigUrl = "redis://localhost";
    vi.mocked(keyRotation.getNextIndex)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);

    const res = await server.fetch(
      new Request("https://example.com/admin/redis-ping", {
        headers: authHeaders(),
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.indices).toEqual([0, 1]);
    expect(data.message).toContain("两个相同 key 轮询应返回 [0, 1]");
    expect(keyRotation.getNextIndex).toHaveBeenCalledWith("redis-ping-test", 2);
    expect(keyRotation.getNextIndex).toHaveBeenCalledTimes(2);
  });
});
