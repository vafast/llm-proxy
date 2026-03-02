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
import { Config } from "./utils/config";

/** 启动时检测鉴权配置，无配置时打印 warning */
function warnIfNoAuthConfig(): void {
  if (env.nodeEnv === "test") return;

  const hasDb = !!(
    process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL
  );
  const apiKeys = Config.apiKeys();
  const hasEnvKeys =
    apiKeys && apiKeys.length > 0 && apiKeys.some((k) => k?.trim?.());

  if (!hasDb && !hasEnvKeys) {
    console.warn(
      "⚠️ 未配置鉴权：未设置 PROXY_API_KEY 且无数据库。所有请求将被拒绝。请在 .env 中配置 PROXY_API_KEY 或 DATABASE_URL。",
    );
  } else if (hasDb && !hasEnvKeys) {
    console.warn(
      "⚠️ 仅配置了数据库：请通过 Admin API 创建 key 后使用，或配置 PROXY_API_KEY。",
    );
  }
}

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
    warnIfNoAuthConfig();
    console.log(`LLM Proxy 已启动: http://localhost:${env.port}`);
  },
);
