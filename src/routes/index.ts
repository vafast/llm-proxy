/**
 * 路由聚合
 *
 * 所有业务路由在此组装，auth 作为路由组中间件（非全局）
 * /ping 作为公开根路由不在此处，定义在 src/index.ts
 */
import { defineRoute, defineRoutes } from "vafast";
import { healthRoutes } from "./health";
import { chatRoutes } from "./chat";
import { modelsRoutes } from "./models";
import { createProxyRoutes } from "./proxy";
import { adminRouteConfig } from "./admin";
import { authMiddleware } from "../middleware/auth";
import { extractApiKeyIndex } from "../middleware/extractApiKeyIndex";

export function createAllRoutes() {
  const proxyRoutes = createProxyRoutes();

  // 核心业务路由（在多个前缀下复用）
  const coreRoutes = [...chatRoutes, ...modelsRoutes, ...proxyRoutes];

  // 所有业务路由统一挂载 auth 中间件
  return defineRoutes([
    ...adminRouteConfig,
    defineRoute({
      path: "",
      middleware: [authMiddleware],
      children: [
        // 健康检查（/status）
        ...healthRoutes,

        // 直连
        ...coreRoutes,

        // /key/:keySpec 前缀
        defineRoute({
          path: "/key/:keySpec",
          middleware: [extractApiKeyIndex],
          children: [...coreRoutes],
        }),
      ],
    }),
  ]);
}
