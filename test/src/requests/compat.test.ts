import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CloudflareAIGateway } from "~/src/ai_gateway";
import { compat } from "~/src/requests/compat";
import { fetch2 } from "~/src/utils/helpers";

vi.mock("~/src/utils/helpers", () => ({
  fetch2: vi.fn(),
}));

describe("compat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetch2).mockResolvedValue(new Response(null, { status: 200 }));
  });

  it("forwards chat completions requests without leaking proxy authorization", async () => {
    const bodyStr = JSON.stringify({ model: "gpt-4o", messages: [] });
    const request = new Request(
      "https://example.com/g/test-gateway/compat/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer proxy-api-key",
        },
      },
    );

    const aiGateway = {
      buildCompatRequest: vi.fn().mockReturnValue([
        "https://gateway.ai.cloudflare.com/v1/account/gateway/compat/chat/completions",
        {
          method: "POST",
          headers: { "cf-aig-authorization": "Bearer test" },
          body: bodyStr,
        },
      ]),
    } as unknown as CloudflareAIGateway;

    // 新签名：compat(request, pathname, aiGateway, body?)
    // body 作为第 4 个参数传入（Vafast 预解析后的 body）
    await compat(request, "/compat/chat/completions", aiGateway, bodyStr);

    const callArgs = vi.mocked(aiGateway.buildCompatRequest).mock.calls[0][0];
    expect(callArgs.method).toBe("POST");
    expect(callArgs.path).toBe("/compat/chat/completions");
    // forwardBody 使用传入的 body 字符串，而非 request.body stream
    expect(callArgs.body).toBe(bodyStr);
    expect(
      (callArgs.headers as Record<string, string>)["authorization"],
    ).toBeUndefined();

    expect(fetch2).toHaveBeenCalledWith(
      "https://gateway.ai.cloudflare.com/v1/account/gateway/compat/chat/completions",
      expect.objectContaining({
        method: "POST",
        body: bodyStr,
        headers: { "cf-aig-authorization": "Bearer test" },
      }),
    );
  });

  it("preserves nested paths and query strings when forwarding", async () => {
    const request = new Request(
      "https://example.com/compat/chat/completions?foo=bar",
      {
        method: "GET",
      },
    );

    const aiGateway = {
      buildCompatRequest: vi
        .fn()
        .mockReturnValue([
          "https://gateway.ai.cloudflare.com/v1/account/gateway/compat/chat/completions?foo=bar",
          {},
        ]),
    } as unknown as CloudflareAIGateway;

    await compat(request, "/compat/chat/completions?foo=bar", aiGateway);

    expect(aiGateway.buildCompatRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/compat/chat/completions?foo=bar",
        method: "GET",
      }),
    );
  });
});
