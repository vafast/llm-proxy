import { OpenAICompatibleProvider } from "../provider";

/**
 * MiniMax OpenAI 兼容代理
 *
 * MiniMax 同时提供 OpenAI 兼容接口和 Anthropic 兼容接口：
 * - OpenAI 兼容：https://api.minimaxi.com/v1/chat/completions
 * - Anthropic 兼容：https://api.minimaxi.com/anthropic/v1/messages
 * 代理统一使用 /v1 前缀，用户按需选择子路径。
 */
export class MiniMax extends OpenAICompatibleProvider {
  readonly apiKeyName: keyof Env = "MINIMAX_API_KEY";
  readonly baseUrlProp: string = "https://api.minimaxi.com";

  get chatCompletionPath(): string {
    return "/v1/chat/completions";
  }
}
