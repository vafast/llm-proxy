import { Config } from "./config";
import { validateKey } from "../db/keys";

export const AUTHORIZATION_KEYS = [
  "Authorization",
  "x-api-key",
  "x-goog-api-key",
];

export const AUTHORIZATION_QUERY_PARAMETERS = ["key"];

function extractApiKey(request: Request): string | null {
  const authorizationKey = AUTHORIZATION_KEYS.find((key) =>
    Boolean(request.headers.get(key)),
  );
  const authorizationValue = authorizationKey
    ? request.headers.get(authorizationKey)
    : null;

  if (authorizationKey && authorizationValue) {
    return authorizationValue.split(/\s/)[1] || authorizationValue;
  }
  const url = new URL(request.url);
  const queryKey = AUTHORIZATION_QUERY_PARAMETERS.find((param) =>
    Boolean(url.searchParams.get(param)),
  );
  return queryKey ? url.searchParams.get(queryKey) : null;
}

/**
 * 异步鉴权：优先校验 keys 表，无 DB 或 keys 表无匹配时回退到 PROXY_API_KEY
 * 未配置 PROXY_API_KEY 且无 DB 时等同于鉴权关闭（接受所有请求）
 */
export async function authenticate(request: Request): Promise<boolean> {
  const envKeys = Config.apiKeys();
  if (!envKeys) return true;

  const apiKey = extractApiKey(request);
  if (!apiKey) return false;

  try {
    const dbValid = await validateKey(apiKey);
    if (dbValid) return true;
  } catch {
    // DB 不可用或 keys 表未初始化时回退到 env
  }

  return envKeys.includes(apiKey);
}
