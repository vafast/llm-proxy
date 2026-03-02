import { describe, it, expect, beforeEach, vi } from "vitest";
import { authenticate } from "~/src/utils/authorization";
import { Config } from "~/src/utils/config";

vi.mock("~/src/utils/config");

describe("authenticate", () => {
  // Mock Config.apiKeys 返回有效 API key
  beforeEach(() => {
    vi.mocked(Config.apiKeys).mockReturnValue(["valid-key"]);
  });

  // 环境未配置 API key 时
  it("should return true when no PROXY_API_KEY is set", async () => {
    vi.mocked(Config.apiKeys).mockReturnValue(undefined);
    const request = new Request("https://example.com");

    expect(await authenticate(request)).toBe(true);
  });

  // Authorization 头鉴权成功
  it("should return true when valid Authorization header is provided", async () => {
    const request = new Request("https://example.com", {
      headers: {
        Authorization: "Bearer valid-key",
      },
    });

    expect(await authenticate(request)).toBe(true);
  });

  // x-api-key 头鉴权成功
  it("should return true when valid x-api-key header is provided", async () => {
    const request = new Request("https://example.com", {
      headers: {
        "x-api-key": "valid-key",
      },
    });

    expect(await authenticate(request)).toBe(true);
  });

  // x-goog-api-key 头鉴权成功
  it("should return true when valid x-goog-api-key header is provided", async () => {
    const request = new Request("https://example.com", {
      headers: {
        "x-goog-api-key": "valid-key",
      },
    });

    expect(await authenticate(request)).toBe(true);
  });

  // key 查询参数鉴权成功
  it("should return true when valid 'key' query parameter is provided", async () => {
    const request = new Request("https://example.com?key=valid-key");

    expect(await authenticate(request)).toBe(true);
  });

  // 无鉴权头时失败
  it("should return false when no authorization header or query key is provided", async () => {
    const request = new Request("https://example.com");

    expect(await authenticate(request)).toBe(false);
  });

  // API key 错误时失败
  it("should return false when invalid API key is provided", async () => {
    const request = new Request("https://example.com", {
      headers: {
        Authorization: "Bearer invalid-key",
      },
    });

    expect(await authenticate(request)).toBe(false);
  });
});
