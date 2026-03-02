/**
 * 管理员 Key 管理路由
 *
 * 需 ADMIN_KEY 鉴权
 */
import { defineRoute, defineRoutes, err, Type } from "vafast";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import * as keysDb from "../db/keys";
import { getNextIndex } from "../utils/key_rotation";
import { redisConfig } from "../common/env";

function handleDbError(e: unknown): never {
  if (e instanceof Error && e.message.includes("未配置")) {
    throw err.badRequest("数据库未配置，请设置 DATABASE_URL 或 DATABASE_PUBLIC_URL");
  }
  throw e;
}

const adminRouteConfig = [
  defineRoute({
    path: "/admin",
    middleware: [adminAuthMiddleware],
    children: [
      defineRoute({
        method: "POST",
        path: "/keys",
        schema: {
          body: Type.Object({
            name: Type.Optional(Type.String()),
          }),
        },
        handler: async ({ body }) => {
          const result = await keysDb.createKey(body.name).catch(handleDbError);
          return {
            id: result.id,
            key: result.key,
            name: result.name,
            created_at: result.created_at,
          };
        },
      }),
      defineRoute({
        method: "GET",
        path: "/keys",
        handler: async () => {
          const list = await keysDb.listKeys().catch(handleDbError);
          return { keys: list };
        },
      }),
      defineRoute({
        method: "PATCH",
        path: "/keys/:id",
        schema: {
          params: Type.Object({ id: Type.String() }),
          body: Type.Object({
            enabled: Type.Optional(Type.Boolean()),
            name: Type.Optional(Type.String()),
          }),
        },
        handler: async ({ params, body }) => {
          const updates: { enabled?: boolean; name?: string } = {};
          if (body.enabled !== undefined) updates.enabled = body.enabled;
          if (body.name !== undefined) updates.name = body.name;
          const ok = await keysDb.updateKey(params.id, updates).catch(handleDbError);
          if (!ok) throw err.notFound("Key 不存在");
          return { ok: true };
        },
      }),
      defineRoute({
        method: "DELETE",
        path: "/keys/:id",
        schema: {
          params: Type.Object({ id: Type.String() }),
        },
        handler: async ({ params }) => {
          const ok = await keysDb.deleteKey(params.id).catch(handleDbError);
          if (!ok) throw err.notFound("Key 不存在");
          return { ok: true };
        },
      }),
      defineRoute({
        method: "GET",
        path: "/redis-ping",
        handler: async () => {
          if (!redisConfig.url) {
            throw err("Redis 未配置（REDIS_URL 或 REDIS_PUBLIC_URL）", 503);
          }
          const i0 = await getNextIndex("redis-ping-test", 2);
          const i1 = await getNextIndex("redis-ping-test", 2);
          return { ok: true, indices: [i0, i1], message: "两个相同 key 轮询应返回 [0, 1]" };
        },
      }),
    ],
  }),
];

export const adminRoutes = defineRoutes(adminRouteConfig);
export { adminRouteConfig };
