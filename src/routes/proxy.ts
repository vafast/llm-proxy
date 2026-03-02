/**
 * Provider Proxy 路由
 *
 * 为每个已注册的 provider 动态生成 proxy 路由
 * 例如: /openai/v1/chat/completions -> 代理到 OpenAI
 * 注：代理需返回 Response（流式/SSE），不得已直接返回
 */
import { defineRoute, Type } from "vafast";
import { getAllProviders } from "../providers";
import { proxy } from "../requests/proxy";
import { Environments } from "../utils/environments";

const PROXY_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;

export function createProxyRoutes() {
  const allProviders = getAllProviders(Environments.all());

  return Object.keys(allProviders).flatMap((providerName) =>
    PROXY_METHODS.map((method) =>
      defineRoute({
        method,
        path: `/${providerName}/*proxyPath`,
        schema: {
          params: Type.Object({ proxyPath: Type.String() }),
        },
        handler: async ({ req, body, params }) => {
          const targetPathname = "/" + params.proxyPath;
          return proxy(req, providerName, targetPathname, body);
        },
      }),
    ),
  );
}
