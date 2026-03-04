/**
 * 模型调用集成测试
 *
 * 验证代理真实调用上游模型并返回有效内容。
 * 需加载 .env.development 的 key，运行：npm run test:integration:model
 *
 * 说明：测试请求发往 LLM_PROXY_BASE（默认 https://llm.huyooo.com），
 * 各 provider 的 API key 需在部署环境配置，本地 .env.development 仅用于 PROXY_API_KEY。
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

async function chat(
  providerModel: string,
  options: { stream?: boolean } = {},
): Promise<{ content?: string; usage?: { total_tokens?: number }; error?: string }> {
  const url = `${BASE}/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: getAuth(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: providerModel,
      messages: [{ role: "user", content: "回复一个字：好" }],
      max_tokens: 10,
      stream: options.stream ?? false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
  }

  if (options.stream) {
    const text = await res.text();
    const lines = text.split("\n").filter((l) => l.startsWith("data:") && l !== "data: [DONE]");
    let content = "";
    for (const line of lines) {
      const data = line.slice(5).trim();
      if (!data) continue;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.delta?.reasoning_content;
        if (delta) content += delta;
      } catch {
        // ignore parse errors
      }
    }
    return { content: content || undefined };
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
    error?: { message?: string };
  };

  if (json.error) {
    return { error: json.error.message };
  }

  const content = json.choices?.[0]?.message?.content;
  return {
    content,
    usage: json.usage,
  };
}

/** 各 provider 的 model 及对应 env key（用于 skipIf） */
const MODEL_CASES: Array<{ provider: string; model: string; envKey: string }> = [
  { provider: "openai", model: "gpt-4o-mini", envKey: "OPENAI_API_KEY" },
  { provider: "anthropic", model: "claude-sonnet-4-20250514", envKey: "ANTHROPIC_API_KEY" },
  { provider: "google-ai-studio", model: "gemini-2.0-flash", envKey: "GEMINI_API_KEY" },
  { provider: "grok", model: "grok-3-mini", envKey: "GROK_API_KEY" },
  { provider: "deepseek", model: "deepseek-chat", envKey: "DEEPSEEK_API_KEY" },
  { provider: "ark", model: "doubao-seed-1-6-250615", envKey: "ARK_API_KEY" },
  { provider: "qwen", model: "qwen3.5-flash", envKey: "QWEN_API_KEY" },
  { provider: "glm", model: "glm-5", envKey: "GLM_API_KEY" },
  { provider: "moonshot", model: "kimi-k2.5", envKey: "MOONSHOT_API_KEY" },
  { provider: "minimax", model: "MiniMax-M2.5", envKey: "MINIMAX_API_KEY" },
];

function hasKey(envKey: string): boolean {
  const val = process.env[envKey];
  return !!val && val.trim().length > 0;
}

describe("模型调用集成测试", () => {
  beforeAll(() => {
    if (!process.env.PROXY_API_KEY) {
      throw new Error(
        "PROXY_API_KEY 未配置。请运行: npm run test:integration:model",
      );
    }
  });

  for (const { provider, model, envKey } of MODEL_CASES) {
    const fullModel = `${provider}/${model}`;

    it.skipIf(!hasKey(envKey))(
      `${provider} ${model} 非流式返回有效内容`,
      async () => {
        const result = await chat(fullModel, { stream: false });
        expect(result.error).toBeUndefined();
        expect(result.content).toBeDefined();
        expect(typeof result.content).toBe("string");
        expect(result.content!.length).toBeGreaterThan(0);
      },
      30_000,
    );

    it.skipIf(!hasKey(envKey))(
      `${provider} ${model} 流式返回有效内容`,
      async () => {
        const result = await chat(fullModel, { stream: true });
        expect(result.error).toBeUndefined();
        expect(result.content).toBeDefined();
        expect(typeof result.content).toBe("string");
        expect(result.content!.length).toBeGreaterThan(0);
      },
      30_000,
    );
  }
});
