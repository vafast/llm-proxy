/**
 * API 集成测试（HTTP 路由 + 透传）
 *
 * 覆盖 api-http.sh 和 passthrough-http.sh 的用例。
 * 运行：npm run test:integration
 */
import { describe, it, expect, beforeAll } from "vitest";

const BASE = process.env.LLM_PROXY_BASE ?? "https://llm.huyooo.com";

function getAuth(): string {
  const key = process.env.PROXY_API_KEY;
  if (!key) {
    throw new Error("PROXY_API_KEY 未配置，请使用 dotenvx run -f .env.development 运行");
  }
  return `Bearer ${key}`;
}

async function fetchStatus(
  url: string,
  options: RequestInit = {},
): Promise<{ status: number; body?: string }> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await res.text();
  return { status: res.status, body: body || undefined };
}

describe("API 集成测试", () => {
  beforeAll(() => {
    if (!process.env.PROXY_API_KEY) {
      throw new Error("PROXY_API_KEY 未配置。请运行: npm run test:integration");
    }
  });

  describe("公开路由", () => {
    it("GET /ping 无鉴权 200", async () => {
      const { status } = await fetchStatus(`${BASE}/ping`, { method: "GET" });
      expect(status).toBe(200);
    });
  });

  describe("健康检查", () => {
    it("GET /status 需鉴权 200", async () => {
      const { status } = await fetchStatus(`${BASE}/status`, {
        method: "GET",
        headers: { Authorization: getAuth() },
      });
      expect(status).toBe(200);
    });

    it("GET /status 无鉴权应 401", async () => {
      const { status } = await fetchStatus(`${BASE}/status`, { method: "GET" });
      expect(status).toBe(401);
    });
  });

  describe("Models", () => {
    it("GET /models 200", async () => {
      const { status } = await fetchStatus(`${BASE}/models`, {
        method: "GET",
        headers: { Authorization: getAuth() },
      });
      expect(status).toBe(200);
    });

    it("GET /v1/models 200", async () => {
      const { status } = await fetchStatus(`${BASE}/v1/models`, {
        method: "GET",
        headers: { Authorization: getAuth() },
      });
      expect(status).toBe(200);
    });
  });

  describe("Chat Completions（统一路径）", () => {
    it("POST /chat/completions 200", async () => {
      const { status } = await fetchStatus(`${BASE}/chat/completions`, {
        method: "POST",
        headers: { Authorization: getAuth() },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 5,
        }),
      });
      expect(status).toBe(200);
    });

    it("POST /v1/chat/completions 200", async () => {
      const { status } = await fetchStatus(`${BASE}/v1/chat/completions`, {
        method: "POST",
        headers: { Authorization: getAuth() },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 5,
        }),
      });
      expect(status).toBe(200);
    });
  });

  describe("Proxy 透传", () => {
    it("POST /openai/v1/chat/completions 无透传 200", async () => {
      const { status } = await fetchStatus(`${BASE}/openai/v1/chat/completions`, {
        method: "POST",
        headers: { Authorization: getAuth() },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 5,
        }),
      });
      expect(status).toBe(200);
    });

    it.skipIf(!process.env.OPENAI_API_KEY)(
      "POST /openai/v1/chat/completions 透传 X-OpenAI-Key 200",
      async () => {
        const { status } = await fetchStatus(`${BASE}/openai/v1/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: getAuth(),
            "X-OpenAI-Key": process.env.OPENAI_API_KEY!,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 5,
          }),
        });
        expect(status).toBe(200);
      },
    );

    it("透传无效 key 应 401", async () => {
      const { status } = await fetchStatus(`${BASE}/openai/v1/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: getAuth(),
          "X-OpenAI-Key": "sk-invalid-passthrough-key",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 5,
        }),
      });
      expect(status).toBe(401);
    });
  });

  describe("API Key 指定", () => {
    it("GET /key/0/models 200", async () => {
      const { status } = await fetchStatus(`${BASE}/key/0/models`, {
        method: "GET",
        headers: { Authorization: getAuth() },
      });
      expect(status).toBe(200);
    });
  });

  describe("Grok 代理", () => {
    it.skipIf(!process.env.GROK_API_KEY)(
      "POST /chat/completions grok/grok-3-mini 200",
      async () => {
        const { status } = await fetchStatus(`${BASE}/chat/completions`, {
          method: "POST",
          headers: { Authorization: getAuth() },
          body: JSON.stringify({
            model: "grok/grok-3-mini",
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 5,
          }),
        });
        expect(status).toBe(200);
      },
    );

    it.skipIf(!process.env.GROK_API_KEY)(
      "POST /grok/v1/chat/completions 200",
      async () => {
        const { status } = await fetchStatus(`${BASE}/grok/v1/chat/completions`, {
          method: "POST",
          headers: { Authorization: getAuth() },
          body: JSON.stringify({
            model: "grok-3-mini",
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 5,
          }),
        });
        expect(status).toBe(200);
      },
    );
  });
});
