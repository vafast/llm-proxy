/**
 * Provider Proxy 路由
 *
 * 为每个已注册的 provider 动态生成 proxy 路由
 * 例如: /openai/v1/chat/completions -> 代理到 OpenAI
 * 注：代理需返回 Response（流式/SSE），不得已直接返回
 */
import { defineRoute, Type } from "vafast";
import { getProvider, getAllProviders } from "../providers";
import { Environments } from "../utils/environments";
import { NotFoundError } from "../utils/error";
import { Secrets } from "../utils/secrets";
import { buildForwardHeaders } from "../utils/passthrough";

const PROXY_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;

/** 供单元测试使用 */
export async function proxy(
  request: Request,
  providerName: string,
  pathname: string,
  body?: unknown,
  search?: string,
) {
  const contextApiKeyIndex = request.apiKeyIndex;

  const env = Environments.all();
  const providerInstance = getProvider(providerName, env);

  if (!providerInstance) {
    throw new NotFoundError();
  }

  // 部分 provider 的 baseUrl 已包含 /v1，若 pathname 以 /v1 开头则去除以避免重复
  let normalizedPathname = pathname;
  if (pathname.startsWith("/v1/") || pathname === "/v1") {
    const base = providerInstance.baseUrl();
    if (base.endsWith("/v1") || base.endsWith("/v1/")) {
      normalizedPathname = pathname.replace(/^\/v1/, "") || "/";
    }
  }

  const apiKeyIndex =
    contextApiKeyIndex !== undefined
      ? Secrets.resolveApiKeyIndex(
          contextApiKeyIndex,
          providerInstance.getApiKeys().length,
        )
      : await providerInstance.getNextApiKeyIndex();

  const rawBody: string | null =
    body != null
      ? typeof body === "string"
        ? body
        : JSON.stringify(body)
      : null;

  const forwardHeaders = buildForwardHeaders(request, providerName);

  const pathnameWithSearch = search ? normalizedPathname + search : normalizedPathname;

  return providerInstance.fetch(
    pathnameWithSearch,
    {
      method: request.method,
      body: rawBody,
      headers: forwardHeaders,
    },
    apiKeyIndex,
  );
}

export function createProxyRoutes() {
  const allProviders = getAllProviders(Environments.all());

  return Object.keys(allProviders).flatMap((providerName) =>
    PROXY_METHODS.map((method) =>
      defineRoute({
        method,
        path: `/${providerName}/*proxyPath`,
        schema: {
          params: Type.Object({ proxyPath: Type.String() }),
          body: Type.Optional(Type.Any()),
        },
        handler: async ({ req, body, params }) => {
          const targetPathname = "/" + params.proxyPath;
          const search = new URL(req.url).search;
          return proxy(req, providerName, targetPathname, body, search);
        },
      }),
    ),
  );
}
