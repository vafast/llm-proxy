import { describe, it, expect, vi, beforeEach } from "vitest";
import { Providers } from "~/src/providers";
import { getAllProviders } from "~/src/providers";
import { status } from "~/src/requests/status";
import { Config } from "~/src/utils/config";
import { Environments } from "~/src/utils/environments";
import { Secrets } from "~/src/utils/secrets";

vi.mock("~/src/providers", async () => {
  const actual =
    await vi.importActual<typeof import("~/src/providers")>("~/src/providers");
  return {
    ...actual,
    getAllProviders: vi.fn(),
  };
});
vi.mock("~/src/utils/config");
vi.mock("~/src/utils/environments");
vi.mock("~/src/utils/secrets");

describe("status", () => {
  const mockProviderClass = {
    apiKeyName: "OPENAI_API_KEY",
    modelsPath: "/models",
    available: vi.fn(),
    buildModelsRequest: vi.fn(),
    fetch: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    Object.keys(Providers).forEach((key) => {
      delete Providers[key];
    });

    vi.mocked(Config.isDevelopment).mockReturnValue(false);
    vi.mocked(Config.defaultModel).mockReturnValue("gpt-4");
    vi.mocked(Config.isGlobalRoundRobinEnabled).mockReturnValue(true);

    vi.mocked(Environments.all).mockReturnValue({} as any);

    Providers.openai = vi.fn().mockImplementation(() => {
      const instance = Object.create(mockProviderClass);
      instance.apiKeyName = "OPENAI_API_KEY";
      return instance;
    });

    vi.mocked(getAllProviders).mockImplementation(() => {
      return Object.fromEntries(
        Object.keys(Providers).map((key) => [
          key,
          new (Providers[key] as any)(),
        ]),
      );
    });

    mockProviderClass.available.mockReturnValue(true);
    mockProviderClass.buildModelsRequest.mockReturnValue([
      "/models",
      { method: "GET" },
    ]);
  });

  it("should return structured JSON with config and provider status", async () => {
    vi.mocked(Secrets.getAll).mockReturnValue(["mock-key-789", "mock-key-ghi"]);
    mockProviderClass.fetch.mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    // status() 返回普通对象 { config, providers }
    const result = await status();

    expect(result.config).toEqual({
      DEV: false,
      DEFAULT_MODEL: "gpt-4",
      GLOBAL_ROUND_ROBIN: true,
    });

    expect(result.providers.openai).toBeDefined();
    expect(result.providers.openai.available).toBe(true);
    expect(result.providers.openai.keys).toHaveLength(2);
    expect(result.providers.openai.keys[0]).toEqual({
      key: "*********789",
      status: "valid",
    });
    expect(result.providers.openai.keys[1]).toEqual({
      key: "*********ghi",
      status: "valid",
    });
  });

  it("should handle invalid API keys", async () => {
    vi.mocked(Secrets.getAll).mockReturnValue(["invalid-key"]);
    mockProviderClass.fetch.mockResolvedValue(
      new Response(null, { status: 401 }),
    );

    const result = await status();

    expect(result.providers.openai.keys[0].status).toBe("invalid");
  });

  it("should handle unknown status for other error codes", async () => {
    vi.mocked(Secrets.getAll).mockReturnValue(["unknown-key"]);
    mockProviderClass.fetch.mockResolvedValue(
      new Response(null, { status: 500 }),
    );

    const result = await status();

    expect(result.providers.openai.keys[0].status).toBe("unknown");
  });

  it("should handle providers without API keys", async () => {
    Providers.nokeys = vi.fn().mockImplementation(() => ({
      apiKeyName: undefined,
      available: vi.fn().mockReturnValue(true),
    }));

    const result = await status();

    expect(result.providers.nokeys).toEqual({
      available: true,
      keys: [],
    });
  });

  it("should mask long and short keys correctly", async () => {
    vi.mocked(Secrets.getAll).mockReturnValue([
      "short",
      "longest-key-ever-123",
    ]);
    mockProviderClass.fetch.mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    const result = await status();

    expect(result.providers.openai.keys[0].key).toBe("**ort");
    expect(result.providers.openai.keys[1].key).toBe("**********123");
  });

  it("should skip connectivity check when modelsPath is missing", async () => {
    Providers.skip = vi.fn().mockImplementation(() => ({
      apiKeyName: "SKIP_API_KEY",
      modelsPath: "",
      available: vi.fn().mockReturnValue(true),
    }));
    vi.mocked(Secrets.getAll).mockReturnValue(["any-key"]);

    const result = await status();

    expect(result.providers.skip.keys[0].status).toBe("unknown");
  });
});
