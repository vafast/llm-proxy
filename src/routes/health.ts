/**
 * 健康检查路由（需鉴权）
 *
 * /ping 作为公开根路由定义在 src/index.ts，供 Railway healthcheck 使用
 */
import { defineRoute } from "vafast";
import { status } from "../requests/status";

export const healthRoutes = [
  defineRoute({
    method: "GET",
    path: "/status",
    handler: async () => status(),
  }),
];
