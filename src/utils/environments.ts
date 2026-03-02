import * as process from "node:process";

/**
 * 环境变量访问工具
 * Node.js 下使用 process.env
 */
export class Environments {
  /**
   * 返回所有环境变量（兼容 Env 类型）
   */
  static all(): Env {
    return process.env as unknown as Env;
  }

  /**
   * 检查环境变量是否存在。
   *
   * @param {keyof Env} key - 环境变量名
   * @returns {boolean} 存在返回 true，否则 false
   */
  static has(key: keyof Env): key is keyof Env {
    const env = this.all();
    return env[key] !== undefined;
  }

  /**
   * 按 key 获取环境变量，返回字符串。
   *
   * @param {keyof Env} key - 环境变量名
   * @param {false} parse - 设为 false 时不解析，返回原始字符串
   * @returns {string | undefined} 环境变量值，未找到返回 undefined
   */
  static get(key: keyof Env, parse: false): string | undefined;

  /**
   * 按 key 获取环境变量并解析。
   * 解析时优先尝试 JSON，失败则尝试逗号分隔。
   *
   * @param {keyof Env} key - 环境变量名
   * @param {boolean} [parse=true] - 是否解析
   * @returns {string | Array<any> | Object | number | undefined} 解析后的值
   */
  static get(
    key: keyof Env,
    parse?: boolean,
  ): string | Array<any> | object | number | undefined;

  static get(
    key: keyof Env,
    parse: boolean = true,
  ): string | Array<any> | object | number | undefined {
    const env = this.all();
    const value = env[key] as string | undefined;

    if (value === undefined) {
      return undefined;
    }

    if (!parse) {
      return value;
    }

    // 优先尝试 JSON 解析
    const jsonValue = this.parseJson(value);
    if (jsonValue !== undefined) {
      return jsonValue;
    }

    // JSON 解析失败则尝试逗号分隔
    const separatedTexts = this.parseCommaSeparatedText(value);

    // 解析失败则返回原值
    return separatedTexts ?? value;
  }

  /**
   * 尝试将字符串解析为 JSON。
   *
   * @private
   * @param {string} value - 待解析字符串
   * @returns {Array<any> | Object | number | undefined} 解析结果，失败返回 undefined
   */
  private static parseJson(
    value: string,
  ): Array<any> | object | number | undefined {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }

  /**
   * 将逗号分隔字符串解析为去空格后的数组。
   *
   * @private
   * @param {string} value - 逗号分隔字符串
   * @returns {Array<string> | undefined} 字符串数组
   */
  private static parseCommaSeparatedText(
    value: string,
  ): Array<string> | undefined {
    if (value.includes(",")) {
      return value.split(",").map((item) => item.trim());
    }
    return undefined;
  }
}
