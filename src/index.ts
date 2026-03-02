/**
 * LLM Proxy 入口
 *
 * 架构与 ai-server 一致：
 * - 根路由（/ping）无鉴权，供负载均衡器 / Railway healthcheck 使用
 * - 业务路由通过路由组中间件挂载 auth
 * - server.use() 只注册真正全局的中间件（cors、requestId、error）
 */
import { Server, serve, defineRoute, defineRoutes } from "vafast";
import { cors } from "@vafast/cors";
import { requestId } from "@vafast/request-id";
import { errorMiddleware } from "./middleware/error";
import { createAllRoutes } from "./routes";
import { env } from "./common/env";
import { initDb } from "./db";

// 根路由（无鉴权）- 负载均衡器 / Railway healthcheck
const rootRoutes = defineRoutes([
  defineRoute({ method: "GET", path: "/ping", handler: () => "Pong" }),
  defineRoute({ method: "HEAD", path: "/ping", handler: () => null }),
]);

const businessRoutes = createAllRoutes();
const server = new Server([...rootRoutes, ...businessRoutes]);

server.use(cors({ origin: true }));
server.use(requestId());
server.use(errorMiddleware);

serve(
  {
    fetch: server.fetch,
    port: env.port,
    hostname: "0.0.0.0",
    gracefulShutdown: true,
    trustProxy: true,
  },
  async () => {
    await initDb();
    console.log(`LLM Proxy 已启动: http://localhost:${env.port}`);
  },
);
