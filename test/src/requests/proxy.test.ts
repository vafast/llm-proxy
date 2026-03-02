import { describe, it, expect, vi, beforeEach } from "vitest";
import { Providers } from "~/src/providers";
import { getProvider } from "~/src/providers";
import { proxy } from "~/src/requests/proxy";
import { Environments } from "~/src/utils/environments";
import { Secrets } from "~/src/utils/secrets";

vi.mock("~/src/providers", async () => {
  const actual =
    await vi.importActual<typeof import("~/src/providers")>("~/src/providers");
  return {
    ...actual,
    getProvider: vi.fn(),
  };
});
vi.mock("~/src/utils/helpers");
vi.mock("~/src/utils/environments");
vi.mock("~/src/utils/secrets");

describe("proxy", () => {
  const mockProviderClass = {
    endpoint: {
      baseUrl: vi.fn().mockReturnValue("https://api.example.com/test"),
    },
    fetch: vi.fn(),
    getApiKeys: vi.fn().mockReturnValue(["test-key"]),
    getNextApiKeyIndex: vi.fn().mockResolvedValue(0),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Secrets.getAll).mockReturnValue(["test-key"]);
    vi.mocked(Secrets.getNext).mockResolvedValue(0);
    vi.mocked(Environments.all).mockReturnValue({} as any);

    vi.mocked(getProvider).mockImplementation((name) => {
      const ProviderClass = Providers[name];
      return ProviderClass ? new (ProviderClass as any)() : undefined;
    });
  });

  it("should call providerClass.fetch with correct arguments", async () => {
    const providerName = "testProvider";
    Providers[providerName] = vi
      .fn()
      .mockImplementation(() => mockProviderClass);

    const mockRequest = new Request("https://example.com/test/path", {
      method: "GET",
      headers: new Headers(),
    });

    // 签名：proxy(request, providerName, pathname, body?)
    await proxy(mockRequest, providerName, "/test/path");

    expect(mockProviderClass.fetch).toHaveBeenCalledWith(
      "/test/path",
      {
        method: mockRequest.method,
        body: null, // 无 body 参数时 forwardBody = null
        headers: mockRequest.headers,
      },
      0,
    );
  });

  it("should handle duplicate path segments correctly", async () => {
    const providerName = "testProvider";
    Providers[providerName] = vi
      .fn()
      .mockImplementation(() => mockProviderClass);

    const mockRequest = new Request("https://example.com/test/test/path", {
      method: "GET",
      headers: new Headers(),
    });

    await proxy(mockRequest, providerName, "/test/path");

    expect(mockProviderClass.fetch).toHaveBeenCalledWith(
      "/test/path",
      {
        method: mockRequest.method,
        body: null,
        headers: mockRequest.headers,
      },
      0,
    );
  });

  describe("pathname 规范化（baseUrl 已含 /v1 时去除重复）", () => {
    it("should normalize /v1/chat/completions to /chat/completions when baseUrl ends with /v1", async () => {
      const mockProvider = {
        ...mockProviderClass,
        baseUrl: vi.fn().mockReturnValue("https://api.openai.com/v1"),
      };

      vi.mocked(getProvider).mockImplementation(() => mockProvider as any);

      const mockRequest = new Request("https://example.com/openai/v1/chat/completions", {
        method: "POST",
        headers: new Headers(),
      });

      await proxy(mockRequest, "openai", "/v1/chat/completions", { model: "gpt-4o" });

      expect(mockProvider.fetch).toHaveBeenCalledWith(
        "/chat/completions",
        expect.any(Object),
        0,
      );
    });

    it("should preserve leading slash in normalized pathname", async () => {
      const mockProvider = {
        ...mockProviderClass,
        baseUrl: vi.fn().mockReturnValue("https://api.openai.com/v1"),
      };

      vi.mocked(getProvider).mockImplementation(() => mockProvider as any);

      const mockRequest = new Request("https://example.com/", { method: "GET", headers: new Headers() });

      await proxy(mockRequest, "openai", "/v1/models");

      const calledPath = (mockProvider.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(calledPath).toBe("/models");
      expect(calledPath.startsWith("/")).toBe(true);
    });

    it("should NOT normalize when baseUrl does not end with /v1", async () => {
      const mockProvider = {
        ...mockProviderClass,
        baseUrl: vi.fn().mockReturnValue("https://api.anthropic.com"),
      };

      vi.mocked(getProvider).mockImplementation(() => mockProvider as any);

      const mockRequest = new Request("https://example.com/", { method: "GET", headers: new Headers() });

      await proxy(mockRequest, "anthropic", "/v1/messages");

      expect(mockProvider.fetch).toHaveBeenCalledWith(
        "/v1/messages",
        expect.any(Object),
        0,
      );
    });
  });
});
