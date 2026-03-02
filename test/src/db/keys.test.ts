import { describe, it, expect, beforeEach, vi } from "vitest";
import * as keysDb from "~/src/db/keys";

vi.mock("~/src/db/index", () => ({
  getPool: vi.fn(),
  query: vi.fn(),
}));

const { getPool, query } = await import("~/src/db/index");

describe("validateKey", () => {
  beforeEach(() => {
    vi.mocked(getPool).mockReturnValue({} as never);
  });

  it("应返回 false 当 getPool 为 null", async () => {
    vi.mocked(getPool).mockReturnValue(null);
    expect(await keysDb.validateKey("sk-xxx")).toBe(false);
  });

  it("应返回 true 当 key 在 DB 中且 enabled", async () => {
    vi.mocked(query).mockResolvedValue({ rowCount: 1, rows: [{ id: "uuid" }] } as never);
    expect(await keysDb.validateKey("sk-valid")).toBe(true);
  });

  it("应返回 false 当 key 不在 DB 中", async () => {
    vi.mocked(query).mockResolvedValue({ rowCount: 0, rows: [] } as never);
    expect(await keysDb.validateKey("sk-invalid")).toBe(false);
  });

  it("应返回 false 当 rowCount 为 null", async () => {
    vi.mocked(query).mockResolvedValue({ rowCount: null, rows: [] } as never);
    expect(await keysDb.validateKey("sk-xxx")).toBe(false);
  });
});

describe("createKey", () => {
  beforeEach(() => {
    vi.mocked(getPool).mockReturnValue({} as never);
    vi.mocked(query).mockResolvedValue({
      rows: [
        {
          id: "test-uuid",
          name: "my-key",
          created_at: new Date("2025-01-01"),
        },
      ],
    } as never);
  });

  it("应返回 id、key、name、created_at", async () => {
    const result = await keysDb.createKey("my-key");
    expect(result.id).toBe("test-uuid");
    expect(result.key).toMatch(/^sk-[a-f0-9]{64}$/);
    expect(result.name).toBe("my-key");
    expect(result.created_at).toEqual(new Date("2025-01-01"));
  });

  it("应调用 INSERT 且 name 可为 undefined", async () => {
    await keysDb.createKey();
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO proxy_keys"),
      [expect.any(String), null],
    );
  });

  it("应抛出当 getPool 为 null", async () => {
    vi.mocked(getPool).mockReturnValue(null);
    await expect(keysDb.createKey()).rejects.toThrow("未配置");
  });
});

describe("listKeys", () => {
  beforeEach(() => {
    vi.mocked(getPool).mockReturnValue({} as never);
    vi.mocked(query).mockResolvedValue({
      rows: [
        {
          id: "id1",
          name: "key1",
          enabled: true,
          created_at: new Date("2025-01-01"),
        },
      ],
    } as never);
  });

  it("应返回 keys 列表", async () => {
    const list = await keysDb.listKeys();
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual({
      id: "id1",
      name: "key1",
      enabled: true,
      created_at: new Date("2025-01-01"),
    });
  });

  it("应抛出当 getPool 为 null", async () => {
    vi.mocked(getPool).mockReturnValue(null);
    await expect(keysDb.listKeys()).rejects.toThrow("未配置");
  });
});

describe("updateKey", () => {
  beforeEach(() => {
    vi.mocked(getPool).mockReturnValue({} as never);
  });

  it("应返回 true 当更新成功", async () => {
    vi.mocked(query).mockResolvedValue({ rowCount: 1 } as never);
    expect(await keysDb.updateKey("id1", { enabled: false })).toBe(true);
  });

  it("应返回 false 当无匹配行", async () => {
    vi.mocked(query).mockResolvedValue({ rowCount: 0 } as never);
    expect(await keysDb.updateKey("id1", { enabled: false })).toBe(false);
  });

  it("应返回 false 当 updates 为空", async () => {
    vi.mocked(query).mockClear();
    expect(await keysDb.updateKey("id1", {})).toBe(false);
    expect(query).not.toHaveBeenCalled();
  });
});

describe("deleteKey", () => {
  beforeEach(() => {
    vi.mocked(getPool).mockReturnValue({} as never);
  });

  it("应返回 true 当删除成功", async () => {
    vi.mocked(query).mockResolvedValue({ rowCount: 1 } as never);
    expect(await keysDb.deleteKey("id1")).toBe(true);
  });

  it("应返回 false 当无匹配行", async () => {
    vi.mocked(query).mockResolvedValue({ rowCount: 0 } as never);
    expect(await keysDb.deleteKey("id1")).toBe(false);
  });
});
