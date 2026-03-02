#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface CliArgs {
  env?: string;
  help?: boolean;
}

export interface FileSystemOperations {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string, encoding: BufferEncoding) => string;
  writeFileSync: (path: string, data: string) => void;
}

export interface GenerationResult {
  success: boolean;
  messages: string[];
}

export interface GenerationOptions {
  rootDir: string;
  env?: string;
  fsOps?: FileSystemOperations;
}

/**
 * 校验环境名
 */
export function validateEnvironmentName(env: string): boolean {
  // 允许字母、数字、连字符、下划线
  return /^[a-zA-Z0-9_-]+$/.test(env);
}

/**
 * 获取指定环境的文件路径
 */
export function getFilePaths(
  rootDir: string,
  env?: string,
): { configPath: string; devVarsPath: string } {
  if (env) {
    return {
      configPath: path.join(rootDir, `config.${env}.jsonc`),
      devVarsPath: path.join(rootDir, `.dev.vars.${env}`),
    };
  } else {
    return {
      configPath: path.join(rootDir, "config.jsonc"),
      devVarsPath: path.join(rootDir, ".dev.vars"),
    };
  }
}

/**
 * 解析命令行参数
 */
export function parseArgs(argv: string[] = process.argv.slice(2)): CliArgs {
  const args: CliArgs = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--env") {
      if (i + 1 >= argv.length || argv[i + 1].startsWith("-")) {
        throw new Error("--env option requires a value");
      }
      args.env = argv[i + 1];
      i++; // 跳过下一参数（为值）
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return args;
}

/**
 * 显示帮助信息
 */
export function showHelp(): string {
  return `
Usage: generate-dev-vars [options]

Options:
  --env <name>    Specify environment name
                  - No env: Generate .dev.vars from config.jsonc
                  - With env: Generate .dev.vars.<env> from config.<env>.jsonc
  --help, -h      Show this help message

Examples:
  npm run generate-dev-vars                    # Generate .dev.vars from config.jsonc
  npm run generate-dev-vars -- --env example   # Generate .dev.vars.example from config.example.jsonc
  npm run generate-dev-vars -- --env staging   # Generate .dev.vars.staging from config.staging.jsonc
  npm run generate-dev-vars -- --env prod      # Generate .dev.vars.prod from config.prod.jsonc

说明：.dev.vars 文件包含开发环境的敏感认证信息。
`;
}

/**
 * 移除 JSON 注释并解析 JSONC
 */
export function parseJsonc(content: string): Record<string, any> {
  // 正则匹配字符串与注释；匹配到字符串保留，匹配到注释移除
  const regex = /"(?:[^"\\]|\\.)*"|(\/\/.*$|\/\*[\s\S]*?\*\/)/gm;

  const withoutComments = content.replace(regex, (match, comment) => {
    // 匹配到注释（捕获组 1）返回空串，否则返回原字符串
    return comment ? "" : match;
  });

  // 移除尾逗号
  const withoutTrailingCommas = withoutComments.replace(/,(\s*[}\]])/g, "$1");

  return JSON.parse(withoutTrailingCommas);
}

/**
 * 将值转为环境变量格式
 */
export function valueToEnvVar(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (Array.isArray(value)) {
    // 数组整体序列化
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * 将 JSON 配置转为 .dev.vars 格式
 */
export function configToDevVars(
  config: Record<string, any>,
  env?: string,
): string {
  const lines: string[] = [];

  // 添加头部注释
  lines.push(`# Environment Variables${env ? ` (${env})` : ""}`);
  lines.push(`# Generated from config${env ? `.${env}` : ""}.jsonc`);
  lines.push("");

  // 跳过 $schema 字段
  for (const [key, value] of Object.entries(config)) {
    if (key === "$schema") continue;

    const envValue = valueToEnvVar(value);
    lines.push(`${key}=${envValue}`);
  }

  return lines.join("\n") + "\n";
}

/**
 * 生成单个 dev vars 文件
 */
export function generateSingleDevVarsFile(
  configPath: string,
  devVarsPath: string,
  env: string | undefined,
  fsOps: FileSystemOperations,
): { success: boolean; message: string } {
  const configFileName = path.basename(configPath);
  const devVarsFileName = path.basename(devVarsPath);

  if (!fsOps.existsSync(configPath)) {
    return {
      success: true,
      message: `⚠️  ${configFileName} not found, skipping ${devVarsFileName} generation`,
    };
  }

  try {
    const configContent = fsOps.readFileSync(configPath, "utf8");
    const config = parseJsonc(configContent);

    const devVarsContent = configToDevVars(config, env);

    fsOps.writeFileSync(devVarsPath, devVarsContent);

    return {
      success: true,
      message: `✅ Generated ${devVarsFileName} from ${configFileName}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `❌ Error generating ${devVarsFileName}: ${errorMessage}`,
    };
  }
}

/**
 * 根据配置生成 dev vars 文件
 */
export function generateDevVars(
  rootDir: string,
  env?: string,
  fsOps: FileSystemOperations = fs,
): GenerationResult {
  // 若提供则校验环境名
  if (env && !validateEnvironmentName(env)) {
    return {
      success: false,
      messages: [`❌ Invalid environment name: ${env}`],
    };
  }

  const { configPath, devVarsPath } = getFilePaths(rootDir, env);

  const result = generateSingleDevVarsFile(configPath, devVarsPath, env, fsOps);

  return {
    success: result.success,
    messages: [result.message],
  };
}

/**
 * 生成 .dev.vars 的主函数
 */
function main(): void {
  let args: CliArgs;

  try {
    args = parseArgs();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error: ${errorMessage}`);
    console.error("Use --help or -h for usage information.");
    process.exit(1);
  }

  if (args.help) {
    console.log(showHelp());
    return;
  }

  const rootDir = path.resolve(__dirname, "..");
  const env = args.env;

  console.log(
    `🔄 Generating .dev.vars files${env ? ` for environment: ${env}` : ""}...`,
  );

  const result = generateDevVars(rootDir, env);

  result.messages.forEach((message) => console.log(message));

  if (result.success) {
    console.log("🎉 Dev vars generation completed!");
  } else {
    process.exit(1);
  }
}

// 直接执行时运行脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
