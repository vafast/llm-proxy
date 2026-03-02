import { readFileSync, writeFileSync, existsSync } from "fs";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  MockedFunction,
} from "vitest";

// Mock fs 模块
vi.mock("fs", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(),
  };
});

// Mock readline 模块（不在顶部 import createInterface，因 Workers 环境无 node:readline）
const mockQuestion = vi.fn();
const mockClose = vi.fn();
const mockCreateInterface = vi.fn(() => ({
  question: mockQuestion,
  close: mockClose,
}));
vi.mock("readline", () => ({
  createInterface: mockCreateInterface,
}));

// Mock process.exit
const mockExit = vi.fn();
const originalProcessExit = process.exit;

// Mock console.log 与 console.error
const mockConsoleLog = vi.fn();
const mockConsoleError = vi.fn();
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe("create-config.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exit = mockExit as never; // 类型断言以满足 TypeScript
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
  });

  afterEach(() => {
    process.exit = originalProcessExit;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  it("should create config.jsonc when it does not exist and user provides valid input", async () => {
    (existsSync as MockedFunction<typeof existsSync>).mockReturnValueOnce(
      false,
    ); // config.jsonc 不存在
    (existsSync as MockedFunction<typeof existsSync>).mockReturnValueOnce(true); // config.example.jsonc 存在

    (readFileSync as MockedFunction<typeof readFileSync>).mockReturnValueOnce(`{
      "$schema": "../schemas/config-schema.json",
      "PROXY_API_KEY": "your-proxy-api-key",
      "OPENAI_API_KEY": "",
      "GEMINI_API_KEY": ["YOUR_GEMINI_API_KEY_1", "YOUR_GEMINI_API_KEY_2"],
      // --- Other API Keys ---
      "ANTHROPIC_API_KEY": "",
      "CLOUDFLARE_ACCOUNT_ID": "",
      "DEV": false
    }`);

    // 设置 mockQuestion 以处理回调式接口
    const responses = ["mock-proxy-key", "mock-openai-key", "", ""];
    let responseIndex = 0;
    mockQuestion.mockImplementation(
      (prompt: string, callback: (answer: string) => void) => {
        const response = responses[responseIndex++] || "";
        callback(response);
      },
    );

    // Mock 就绪后动态导入脚本
    const { main } = await import("../../scripts/create-config");
    await main();

    expect(existsSync).toHaveBeenCalledWith("config.jsonc");
    expect(existsSync).toHaveBeenCalledWith("config.example.jsonc");
    expect(readFileSync).toHaveBeenCalledWith("config.example.jsonc", "utf8");
    expect(mockCreateInterface).toHaveBeenCalledTimes(1);
    expect(mockQuestion).toHaveBeenCalledTimes(4); // PROXY_API_KEY、OPENAI_API_KEY、GEMINI_API_KEY、ANTHROPIC_API_KEY
    expect(writeFileSync).toHaveBeenCalledTimes(1);
    expect(writeFileSync).toHaveBeenCalledWith(
      "config.jsonc",
      expect.stringContaining('"PROXY_API_KEY": "mock-proxy-key"'),
    );
    expect(writeFileSync).toHaveBeenCalledWith(
      "config.jsonc",
      expect.stringContaining('"OPENAI_API_KEY": "mock-openai-key"'),
    );
    expect(writeFileSync).toHaveBeenCalledWith(
      "config.jsonc",
      expect.not.stringContaining('"GEMINI_API_KEY":'),
    );
    expect(writeFileSync).toHaveBeenCalledWith(
      "config.jsonc",
      expect.not.stringContaining('"ANTHROPIC_API_KEY":'),
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining("✅ config.jsonc created successfully!"),
    );
    expect(mockExit).not.toHaveBeenCalled();
  });

  it("should exit if config.jsonc exists and user chooses not to overwrite", async () => {
    (existsSync as MockedFunction<typeof existsSync>).mockReturnValueOnce(true); // config.jsonc 已存在

    // 设置 mockQuestion 以处理回调式接口
    const responses = ["n"];
    let responseIndex = 0;
    mockQuestion.mockImplementation(
      (prompt: string, callback: (answer: string) => void) => {
        const response = responses[responseIndex++] || "";
        callback(response);
      },
    );

    const { main } = await import("../../scripts/create-config");
    await main();

    expect(mockQuestion).toHaveBeenCalledWith(
      "config.jsonc already exists. Overwrite? (y/N): ",
      expect.any(Function),
    );
    expect(mockConsoleLog).toHaveBeenCalledWith("Cancelled.");
    expect(mockExit).toHaveBeenCalledWith(0);
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it("should exit with error if config.example.jsonc is not found", async () => {
    (existsSync as MockedFunction<typeof existsSync>).mockReturnValueOnce(
      false,
    ); // config.jsonc 不存在
    (existsSync as MockedFunction<typeof existsSync>).mockReturnValueOnce(
      false,
    ); // config.example.jsonc 不存在

    const { main } = await import("../../scripts/create-config");
    await main();

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining("Error: config.example.jsonc not found."),
    );
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it("should prompt again for required fields if input is empty", async () => {
    (existsSync as MockedFunction<typeof existsSync>).mockReturnValueOnce(
      false,
    ); // config.jsonc 不存在
    (existsSync as MockedFunction<typeof existsSync>).mockReturnValueOnce(true); // config.example.jsonc 存在

    (readFileSync as MockedFunction<typeof readFileSync>).mockReturnValueOnce(`{
      "$schema": "../schemas/config-schema.json",
      "PROXY_API_KEY": "your-proxy-api-key"
    }`);

    // 设置 mockQuestion 以处理回调式接口
    const responses = ["", "valid-proxy-key"]; // 第一次空，第二次有效
    let responseIndex = 0;
    mockQuestion.mockImplementation(
      (prompt: string, callback: (answer: string) => void) => {
        const response = responses[responseIndex++] || "";
        callback(response);
      },
    );

    const { main } = await import("../../scripts/create-config");
    await main();

    expect(mockQuestion).toHaveBeenCalledTimes(2); // PROXY_API_KEY 提示两次
    expect(mockConsoleLog).toHaveBeenCalledWith(
      "This field is required. Please enter a value.",
    );
    expect(writeFileSync).toHaveBeenCalledWith(
      "config.jsonc",
      expect.stringContaining('"PROXY_API_KEY": "valid-proxy-key"'),
    );
    expect(mockExit).not.toHaveBeenCalled();
  });

  it("should handle JSON array input correctly", async () => {
    (existsSync as MockedFunction<typeof existsSync>).mockReturnValueOnce(
      false,
    ); // config.jsonc 不存在
    (existsSync as MockedFunction<typeof existsSync>).mockReturnValueOnce(true); // config.example.jsonc 存在

    (readFileSync as MockedFunction<typeof readFileSync>).mockReturnValueOnce(`{
      "$schema": "../schemas/config-schema.json",
      "PROXY_API_KEY": "your-proxy-api-key",
      "GEMINI_API_KEY": ["YOUR_GEMINI_API_KEY_1"]
    }`);

    // 设置 mockQuestion 以处理回调式接口
    const responses = ["mock-proxy-key", '["key1", "key2"]']; // 数组输入
    let responseIndex = 0;
    mockQuestion.mockImplementation(
      (prompt: string, callback: (answer: string) => void) => {
        const response = responses[responseIndex++] || "";
        callback(response);
      },
    );

    const { main } = await import("../../scripts/create-config");
    await main();

    expect(writeFileSync).toHaveBeenCalledWith(
      "config.jsonc",
      expect.stringContaining('"GEMINI_API_KEY": ["key1","key2"]'),
    );
    expect(mockExit).not.toHaveBeenCalled();
  });

  it("should warn if no API keys are configured", async () => {
    (existsSync as MockedFunction<typeof existsSync>).mockReturnValueOnce(
      false,
    ); // config.jsonc 不存在
    (existsSync as MockedFunction<typeof existsSync>).mockReturnValueOnce(true); // config.example.jsonc 存在

    (readFileSync as MockedFunction<typeof readFileSync>).mockReturnValueOnce(`{
      "$schema": "../schemas/config-schema.json",
      "PROXY_API_KEY": "your-proxy-api-key",
      "OPENAI_API_KEY": "",
      "GEMINI_API_KEY": ["YOUR_GEMINI_API_KEY_1"]
    }`);

    // 设置 mockQuestion 以处理回调式接口
    const responses = ["mock-proxy-key", "", ""]; // 仅设置 PROXY_API_KEY
    let responseIndex = 0;
    mockQuestion.mockImplementation(
      (prompt: string, callback: (answer: string) => void) => {
        const response = responses[responseIndex++] || "";
        callback(response);
      },
    );

    const { main } = await import("../../scripts/create-config");
    await main();

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining(
        "Warning: No API keys configured. At least one provider API key is recommended.",
      ),
    );
    expect(mockExit).not.toHaveBeenCalled();
  });
});
