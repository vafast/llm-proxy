import type { Middleware } from "vafast";
import { err } from "vafast";

function getAdminKey(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7).trim() || null;
  }
  return req.headers.get("x-admin-key")?.trim() || null;
}

/**
 * 管理员鉴权：校验 ADMIN_KEY
 * 未配置 ADMIN_KEY 时拒绝所有 admin 请求
 */
export const adminAuthMiddleware: Middleware = async (req, next) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    throw err.unauthorized("ADMIN_KEY 未配置");
  }
  const key = getAdminKey(req);
  if (!key || key !== adminKey) {
    throw err.unauthorized("管理员鉴权失败");
  }
  return next();
};
