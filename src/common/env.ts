/**
 * 环境变量配置
 *
 * 使用 envalid 进行类型安全校验，启动时立即验证
 */
import { cleanEnv, str, port, bool } from "envalid";

const parsed = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ["development", "production", "staging", "test"],
    default: "development",
  }),
  PORT: port({ default: 8787 }),

  // 代理鉴权
  PROXY_API_KEY: str({ default: "" }),

  // Redis（Key 轮询，可选。支持 redis:// URL，优先 REDIS_PUBLIC_URL 用于公网）
  REDIS_URL: str({ default: "" }),
  REDIS_PUBLIC_URL: str({ default: "" }),

  // Provider API Keys
  OPENAI_API_KEY: str({ default: "" }),
  GEMINI_API_KEY: str({ default: "" }),
  ANTHROPIC_API_KEY: str({ default: "" }),
  CEREBRAS_API_KEY: str({ default: "" }),
  COHERE_API_KEY: str({ default: "" }),
  DEEPSEEK_API_KEY: str({ default: "" }),
  GROK_API_KEY: str({ default: "" }),
  GROQ_API_KEY: str({ default: "" }),
  MISTRAL_API_KEY: str({ default: "" }),
  OPENROUTER_API_KEY: str({ default: "" }),
  HUGGINGFACE_API_KEY: str({ default: "" }),
  PERPLEXITYAI_API_KEY: str({ default: "" }),
  REPLICATE_API_KEY: str({ default: "" }),
  CLOUDFLARE_API_KEY: str({ default: "" }),
  OLLAMA_API_KEY: str({ default: "" }),

  // 自定义 OpenAI 兼容端点（JSON 字符串）
  CUSTOM_OPENAI_ENDPOINTS: str({ default: "" }),

  // 配置
  DEV: bool({ default: false }),
  DEFAULT_MODEL: str({ default: "" }),
  ENABLE_GLOBAL_ROUND_ROBIN: bool({ default: false }),
});

export const env = {
  nodeEnv: parsed.NODE_ENV,
  port: parsed.PORT,
  isDev: parsed.isDev,
  isProd: parsed.isProd,
} as const;

export const proxyConfig = {
  apiKey: parsed.PROXY_API_KEY,
  dev: parsed.DEV,
  defaultModel: parsed.DEFAULT_MODEL || undefined,
  enableGlobalRoundRobin: parsed.ENABLE_GLOBAL_ROUND_ROBIN,
} as const;

export const redisConfig = {
  /** 优先公网 URL（本地测试 Railway 等），否则用 REDIS_URL */
  url:
    parsed.REDIS_PUBLIC_URL || parsed.REDIS_URL || undefined,
} as const;

export const providerKeys = {
  OPENAI_API_KEY: parsed.OPENAI_API_KEY,
  GEMINI_API_KEY: parsed.GEMINI_API_KEY,
  ANTHROPIC_API_KEY: parsed.ANTHROPIC_API_KEY,
  CEREBRAS_API_KEY: parsed.CEREBRAS_API_KEY,
  COHERE_API_KEY: parsed.COHERE_API_KEY,
  DEEPSEEK_API_KEY: parsed.DEEPSEEK_API_KEY,
  GROK_API_KEY: parsed.GROK_API_KEY,
  GROQ_API_KEY: parsed.GROQ_API_KEY,
  MISTRAL_API_KEY: parsed.MISTRAL_API_KEY,
  OPENROUTER_API_KEY: parsed.OPENROUTER_API_KEY,
  HUGGINGFACE_API_KEY: parsed.HUGGINGFACE_API_KEY,
  PERPLEXITYAI_API_KEY: parsed.PERPLEXITYAI_API_KEY,
  REPLICATE_API_KEY: parsed.REPLICATE_API_KEY,
  CLOUDFLARE_API_KEY: parsed.CLOUDFLARE_API_KEY,
  OLLAMA_API_KEY: parsed.OLLAMA_API_KEY,
  CUSTOM_OPENAI_ENDPOINTS: parsed.CUSTOM_OPENAI_ENDPOINTS,
} as const;
