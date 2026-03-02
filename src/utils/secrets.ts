import { Config } from "./config";
import { Environments } from "./environments";
import { shuffleArray } from "./helpers";
import { randomInt } from "node:crypto";

// 返回 [0, max-1] 范围内的密码学安全随机整数。
export function getSecureRandomIndex(max: number): number {
  if (max <= 0) {
    throw new Error("max must be greater than 0");
  }

  // 浏览器 / Cloudflare Workers / 支持 Web Crypto 的环境
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const array = new Uint32Array(1);
    const maxUint32 = 0xffffffff;
    const limit = Math.floor((maxUint32 + 1) / max) * max;

    let value: number;
    do {
      (crypto as Crypto).getRandomValues(array);
      value = array[0];
    } while (value >= limit);

    return value % max;
  }

  // Node.js 回退，使用内置 crypto.randomInt
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require("crypto") as typeof import("crypto");
  return nodeCrypto.randomInt(0, max);
}

/**
 * 环境变量密钥管理工具类。
 * 支持获取某 key 的全部值或按索引获取单个值，可选轮询。
 */
export class Secrets {
  /**
   * 获取指定环境变量的全部值。
   *
   * @param keyName - 环境变量名
   * @param shuffle - 是否打乱顺序（默认 false）
   * @returns 字符串数组，不存在则返回空数组
   */
  static getAll(keyName: keyof Env, shuffle: boolean = false): string[] {
    const value = Environments.get(keyName);

    if (value === undefined) {
      return [];
    }

    let result: string[] = [];
    if (Array.isArray(value)) {
      result = [...value];
    } else if (typeof value === "string") {
      result = [value];
    }

    if (shuffle && result.length > 1) {
      return shuffleArray(result);
    }

    return result;
  }

  /**
   * 按 apiKeyIndex 获取指定环境变量的单个值。
   *
   * @param keyName - 环境变量名
   * @param apiKeyIndex - 取值索引（默认 0）
   * @returns 对应索引的字符串值
   */
  static get(keyName: keyof Env, apiKeyIndex: number = 0): string {
    const allKeys = this.getAll(keyName);
    if (allKeys.length === 0) {
      return "";
    }
    return allKeys[apiKeyIndex % allKeys.length];
  }

  /**
   * 根据全局轮询配置，确定下次使用的索引。
   *
   * @param identifier - 轮询标识（如 "GEMINI_API_KEY" 或自定义端点名）
   * @param length - 可用 key 数量
   * @returns 下次使用的索引 (0 到 length-1)
   */
  static async getNextIndex(
    identifier: string,
    length: number,
  ): Promise<number> {
    if (length <= 1) {
      return 0;
    }

    if (Config.isGlobalRoundRobinEnabled()) {
      const { getNextIndex } = await import("./key_rotation");
      return getNextIndex(identifier, length);
    }

    return randomInt(length);
  }

  /**
   * 根据 key 名和全局轮询配置，确定下次使用的索引。
   *
   * @param keyName - 环境变量名
   * @returns 下次使用的索引 (0 到 length-1)
   */
  static async getNext(keyName: keyof Env): Promise<number> {
    const length = this.getAll(keyName).length;
    return this.getNextIndex(keyName, length);
  }

  /**
   * 将选择（数字或范围）解析为单个 apiKeyIndex。
   *
   * @param selection - 来自 MiddlewareContext 的选择
   * @param length - 可用 API Key 总数
   * @returns [0, length-1] 范围内的索引
   */
  static resolveApiKeyIndex(
    selection: number | { start?: number; end?: number },
    length: number,
  ): number {
    if (typeof selection === "number") {
      return selection % length;
    }

    const start = (selection.start ?? 0) % length;
    const end =
      selection.end === undefined
        ? length - 1
        : Math.min(selection.end, length - 1);

    if (start >= end) {
      return start;
    }

    // 在 [start, end] 范围内随机选择
    return randomInt(start, end + 1);
  }
}
