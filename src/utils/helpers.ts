import { AUTHORIZATION_QUERY_PARAMETERS } from "./authorization";
import { randomInt } from "node:crypto";

export function maskUrl(url: string): string {
  // 脱敏相关常量
  const MASK_THRESHOLD = 10; // 显示前缀的最小长度
  const MASK_PREFIX_LENGTH = 3; // 脱敏前保留的字符数
  const MASK_PLACEHOLDER = "***";

  // 需脱敏的敏感参数名
  const sensitiveParams = [
    "apikey",
    "api_key",
    "token",
    "access_token",
    "accesstoken",
    "auth",
    "authorization",
    "password",
    "secret",
    "key",
    "api-key",
  ];

  try {
    const urlObj = new URL(url);

    // 仅脱敏敏感查询参数
    if (urlObj.search) {
      const params = new URLSearchParams(urlObj.search);
      const maskedParams = new URLSearchParams();

      for (const [key, value] of params.entries()) {
        const keyLower = key.toLowerCase();
        const isSensitive = sensitiveParams.some((param) => keyLower === param);

        if (isSensitive) {
          // 脱敏值，较长时保留前缀
          if (value.length > MASK_THRESHOLD) {
            maskedParams.set(
              key,
              `${value.slice(0, MASK_PREFIX_LENGTH)}${MASK_PLACEHOLDER}`,
            );
          } else if (value.length > 0) {
            maskedParams.set(key, MASK_PLACEHOLDER);
          } else {
            maskedParams.set(key, value);
          }
        } else {
          // 非敏感参数保持原样
          maskedParams.set(key, value);
        }
      }

      urlObj.search = maskedParams.toString();
    }

    return urlObj.toString();
  } catch {
    // URL 解析失败时返回脱敏版本
    const MASK_PLACEHOLDER = "***";
    return (
      url.split("?")[0] + (url.includes("?") ? `?${MASK_PLACEHOLDER}` : "")
    );
  }
}

/**
 * Node.js fetch() 会自动解压 gzip/br 响应，但不会修改 Response.headers，
 * 导致 content-encoding/content-length 与实际 body 不匹配。
 * 作为代理透传时需要剥掉这些 hop-by-hop 头。
 */
const HOP_BY_HOP_HEADERS = ["content-encoding", "content-length", "transfer-encoding"];

function stripHopHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const h of HOP_BY_HOP_HEADERS) headers.delete(h);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const fetch2: typeof fetch = async (input, init) => {
  const url = input.toString();
  const maskedUrl = maskUrl(url);
  console.info(`Sub-Request: ${init?.method} ${maskedUrl}`);

  const response = await fetch(input, init);
  return stripHopHeaders(response);
};

export function safeJsonParse(text: string): string | { [key: string]: any } {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function getPathname(request: Request): string {
  return request.url.replace(new URL(request.url).origin, "");
}

export function shuffleArray<T>(array: T[]): T[] {
  const cloneArray = [...array];

  for (let i = cloneArray.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [cloneArray[i], cloneArray[j]] = [cloneArray[j], cloneArray[i]];
  }

  return cloneArray;
}

export function formatString(
  template: string,
  args: { [key: string]: string },
): string {
  return Object.keys(args).reduce((formattedString: string, key) => {
    const regExp = new RegExp(`\\{${key}\\}`, "g");
    return formattedString.replace(regExp, args[key]);
  }, template);
}

export function cleanPathname(pathname: string): string {
  let cleanedPathname = pathname;

  // 用正则移除鉴权相关查询参数
  AUTHORIZATION_QUERY_PARAMETERS.forEach((param) => {
    // 匹配 &key=value 或 ?key=value
    const paramPattern = new RegExp(`[?&]${param}=([^&]*)`, "g");
    cleanedPathname =     cleanedPathname.replace(
      paramPattern,
      (match, value, offset, str) => {
        // 首个参数 (?key=value)：若有其他参数则保留 ?
        if (match.startsWith("?") && typeof str === "string") {
          const nextAmpersand = str.indexOf("&", offset + match.length);
          if (nextAmpersand !== -1) {
            return "?";
          }
          return "";
        }
        return "";
      },
    );
  });

  // 清理无效查询格式如 ?&param=value
  return cleanedPathname.replace(/\?\&/, "?");
}

/**
 * 使用单定时器和 AbortController 包装 Promise 超时。
 * 超时时中止 fetch 并立即 reject TimeoutError。
 * 确保定时器被清理且 Promise 在 timeoutMs 内完成。
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  abortController: AbortController,
  timeoutMs: number,
  providerName: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      abortController.abort();
      const timeoutError = new Error(
        `Provider ${providerName} request timed out`,
      );
      timeoutError.name = "TimeoutError";
      reject(timeoutError);
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}
