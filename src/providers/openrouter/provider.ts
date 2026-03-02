import { OpenAIModelsListResponseBody } from "../openai/types";
import { OpenAICompatibleProvider } from "../provider";
import { OpenRouterModelsListResponseBody } from "./types";

export class OpenRouter extends OpenAICompatibleProvider {
  get chatCompletionPath(): string {
    return "/v1/chat/completions";
  }
  get modelsPath(): string {
    return "/v1/models";
  }

  readonly apiKeyName: keyof Env = "OPENROUTER_API_KEY";
  readonly baseUrlProp: string = "https://openrouter.ai/api";

  // 将模型列表转为 OpenAI 格式
  modelsToOpenAIFormat(
    data: OpenRouterModelsListResponseBody,
  ): OpenAIModelsListResponseBody {
    return {
      object: "list",
      data: data.data.map(({ id, created, ...model }) => ({
        id,
        object: "model",
        created,
        owned_by: "openrouter",
        _: model,
      })),
    };
  }
}
