import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { adminAuthMiddleware } from "~/src/middleware/adminAuth";

describe("adminAuthMiddleware", () => {
  const next = vi.fn().mockResolvedValue(new Response("ok"));
  const originalAdminKey = process.env.ADMIN_KEY;

  beforeEach(() => {
    process.env.ADMIN_KEY = "sk-admin-secret";
    next.mockClear();
  });

  afterEach(() => {
    process.env.ADMIN_KEY = originalAdminKey;
  });

  it("应放行当 Bearer 与 ADMIN_KEY 匹配", async () => {
    const req = new Request("https://example.com/admin/keys", {
      headers: { Authorization: "Bearer sk-admin-secret" },
    });
    await adminAuthMiddleware(req, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("应放行当 x-admin-key 与 ADMIN_KEY 匹配", async () => {
    const req = new Request("https://example.com/admin/keys", {
      headers: { "x-admin-key": "sk-admin-secret" },
    });
    await adminAuthMiddleware(req, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("应抛出 401 当无鉴权头", async () => {
    const req = new Request("https://example.com/admin/keys");
    await expect(adminAuthMiddleware(req, next)).rejects.toMatchObject({
      name: "VafastError",
      status: 401,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("应抛出 401 当 key 错误", async () => {
    const req = new Request("https://example.com/admin/keys", {
      headers: { Authorization: "Bearer wrong-key" },
    });
    await expect(adminAuthMiddleware(req, next)).rejects.toMatchObject({
      name: "VafastError",
      status: 401,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("应抛出 401 当 ADMIN_KEY 未配置", async () => {
    process.env.ADMIN_KEY = "";
    const req = new Request("https://example.com/admin/keys", {
      headers: { Authorization: "Bearer sk-admin-secret" },
    });
    await expect(adminAuthMiddleware(req, next)).rejects.toMatchObject({
      name: "VafastError",
      status: 401,
    });
  });
});
