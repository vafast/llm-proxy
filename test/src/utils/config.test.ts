import { describe, it, expect, vi, beforeEach } from "vitest";
import { Config } from "~/src/utils/config";
import { Environments } from "~/src/utils/environments";

vi.mock("~/src/utils/environments");

describe("Config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isDevelopment", () => {
    it("should return true when DEV is true", () => {
      vi.mocked(Environments.get).mockReturnValue("true");

      const result = Config.isDevelopment();

      expect(result).toBe(true);
      expect(Environments.get).toHaveBeenCalledWith("DEV", false);
    });

    it("should return true when DEV is 'true'", () => {
      vi.mocked(Environments.get).mockReturnValue("true");

      const result = Config.isDevelopment();

      expect(result).toBe(true);
    });

    it("should return false when DEV is 'false'", () => {
      vi.mocked(Environments.get).mockReturnValue("false");

      const result = Config.isDevelopment();

      expect(result).toBe(false);
    });

    it("should return false when DEV is 'False'", () => {
      vi.mocked(Environments.get).mockReturnValue("False");

      const result = Config.isDevelopment();

      expect(result).toBe(false);
    });

    it("should return false when DEV is undefined", () => {
      vi.mocked(Environments.get).mockReturnValue(undefined);

      const result = Config.isDevelopment();

      expect(result).toBe(false);
    });

    it("should return true when DEV is any other string", () => {
      vi.mocked(Environments.get).mockReturnValue("development");

      const result = Config.isDevelopment();

      expect(result).toBe(true);
    });
  });

  describe("apiKeys", () => {
    it("should return array when PROXY_API_KEY is a string", () => {
      vi.mocked(Environments.get).mockReturnValue("test-key");

      const result = Config.apiKeys();

      expect(result).toEqual(["test-key"]);
      expect(Environments.get).toHaveBeenCalledWith("PROXY_API_KEY");
    });

    it("should return array when PROXY_API_KEY is an array", () => {
      vi.mocked(Environments.get).mockReturnValue(["key1", "key2"]);

      const result = Config.apiKeys();

      expect(result).toEqual(["key1", "key2"]);
    });

    it("should return undefined when PROXY_API_KEY is undefined", () => {
      vi.mocked(Environments.get).mockReturnValue(undefined);

      const result = Config.apiKeys();

      expect(result).toBeUndefined();
    });

    it("should return undefined when PROXY_API_KEY is not a string or array", () => {
      vi.mocked(Environments.get).mockReturnValue(123);

      const result = Config.apiKeys();

      expect(result).toBeUndefined();
    });

    it("should return undefined when PROXY_API_KEY is an object", () => {
      vi.mocked(Environments.get).mockReturnValue({ key: "value" });

      const result = Config.apiKeys();

      expect(result).toBeUndefined();
    });

    it("should return undefined when PROXY_API_KEY is null", () => {
      vi.mocked(Environments.get).mockReturnValue(undefined);

      const result = Config.apiKeys();

      expect(result).toBeUndefined();
    });
  });

  describe("defaultModel", () => {
    it("should return default model when set", () => {
      vi.mocked(Environments.get).mockReturnValue("openai/gpt-4");

      const result = Config.defaultModel();

      expect(result).toBe("openai/gpt-4");
      expect(Environments.get).toHaveBeenCalledWith("DEFAULT_MODEL", false);
    });

    it("should return undefined when not set", () => {
      vi.mocked(Environments.get).mockReturnValue(undefined);

      const result = Config.defaultModel();

      expect(result).toBeUndefined();
    });

    it("should handle empty string", () => {
      vi.mocked(Environments.get).mockReturnValue("");

      const result = Config.defaultModel();

      expect(result).toBe("");
    });
  });
});
