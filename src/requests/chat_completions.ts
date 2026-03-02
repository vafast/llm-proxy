import { err } from "vafast";
import { getProvider } from "../providers";
import { Config } from "../utils/config";
import { Environments } from "../utils/environments";
import { Secrets } from "../utils/secrets";

/**
 * @param request - 原始请求（用于读取 headers 和扩展属性）
 * @param body - Vafast 预解析的 body（已通过 schema 校验）
 */
export async function chatCompletions(request: Request, body: unknown) {
  const contextApiKeyIndex = request.apiKeyIndex;

  const headers = new Headers(request.headers);
  headers.delete("Authorization");

  if (!body || typeof body !== "object") {
    throw err.badRequest("Invalid request.");
  }

  const data = body as Record<string, unknown>;

  const modelStr =
    data["model"] === "default"
      ? Config.defaultModel() || ""
      : String(data["model"] || "");
  const [providerName, ...modelParts] = modelStr.split("/") as [
    string,
    string,
  ];
  const model = modelParts.join("/");

  const provider = getProvider(providerName, Environments.all());
  if (!provider) {
    throw err.badRequest("Invalid provider.");
  }

  const apiKeyIndex =
    contextApiKeyIndex !== undefined
      ? Secrets.resolveApiKeyIndex(
          contextApiKeyIndex,
          provider.getApiKeys().length,
        )
      : await provider.getNextApiKeyIndex();

  const [requestInfo, requestInit] =
    await provider.buildChatCompletionsRequest({
      body: JSON.stringify({
        ...data,
        model,
      }),
      headers,
      apiKeyIndex,
    });

  return provider.fetch(requestInfo, requestInit);
}
