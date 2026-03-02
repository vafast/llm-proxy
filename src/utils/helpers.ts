import { AUTHORIZATION_QUERY_PARAMETERS } from "./authorization";
import { randomInt } from "node:crypto";

export function maskUrl(url: string): string {
  // Constants for masking behavior
  const MASK_THRESHOLD = 10; // Minimum length to show prefix
  const MASK_PREFIX_LENGTH = 3; // Number of characters to show before masking
  const MASK_PLACEHOLDER = "***";

  // List of sensitive parameter names that should be masked
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

    // Mask only sensitive query parameters
    if (urlObj.search) {
      const params = new URLSearchParams(urlObj.search);
      const maskedParams = new URLSearchParams();

      for (const [key, value] of params.entries()) {
        const keyLower = key.toLowerCase();
        const isSensitive = sensitiveParams.some((param) => keyLower === param);

        if (isSensitive) {
          // Mask the value, keeping prefix for longer values
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
          // Keep non-sensitive parameters as-is
          maskedParams.set(key, value);
        }
      }

      urlObj.search = maskedParams.toString();
    }

    return urlObj.toString();
  } catch {
    // If URL parsing fails, return masked version
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

  // Remove authorization query parameters using regex
  AUTHORIZATION_QUERY_PARAMETERS.forEach((param) => {
    // Pattern to match: &key=value or ?key=value
    const paramPattern = new RegExp(`[?&]${param}=([^&]*)`, "g");
    cleanedPathname = cleanedPathname.replace(
      paramPattern,
      (match, value, offset, str) => {
        // If it's the first parameter (?key=value), replace with ? if there are other params
        if (match.startsWith("?")) {
          // Find the next parameter after this one
          const nextAmpersand = str.indexOf("&", offset + match.length);
          if (nextAmpersand !== -1) {
            return "?";
          } else {
            return "";
          }
        }
        // If it's not the first parameter (&key=value), just remove it
        return "";
      },
    );
  });

  // Clean up any invalid query string formats like ?&param=value
  return cleanedPathname.replace(/\?\&/, "?");
}

/**
 * Wraps a promise with a timeout using a single timer and AbortController.
 * Aborts the fetch request on timeout and rejects immediately with TimeoutError.
 * Ensures the timer is always cleared and the Promise settles within timeoutMs.
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
