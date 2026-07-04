import {
  classifyGenError,
  estimateCostUsd,
  isRetryableGenError,
  usageFromGeminiResponse,
  assistantOutageReply,
} from "@/lib/chatbot/chatTelemetry";

describe("classifyGenError (W0.2)", () => {
  it("classifies the July-4 spending-cap failure as quota", () => {
    expect(classifyGenError(new Error("[429 Too Many Requests] RESOURCE_EXHAUSTED: monthly spending cap exceeded"))).toBe("quota");
  });

  it("classifies auth failures as key (non-retryable)", () => {
    expect(classifyGenError(new Error("[403 Forbidden] API key not valid"))).toBe("key");
    expect(isRetryableGenError("key")).toBe(false);
  });

  it("classifies timeouts and network drops", () => {
    expect(classifyGenError(new Error("The operation was aborted due to timeout"))).toBe("timeout");
    expect(classifyGenError(new Error("fetch failed"))).toBe("network");
  });

  it("falls back to unknown (retryable)", () => {
    expect(classifyGenError(new Error("something odd"))).toBe("unknown");
    expect(isRetryableGenError("unknown")).toBe(true);
  });
});

describe("estimateCostUsd (W0.5)", () => {
  it("prices gemini-2.5-flash at $0.30/$2.50 per MTok", () => {
    expect(estimateCostUsd("gemini-2.5-flash", 1_000_000, 1_000_000)).toBeCloseTo(2.8);
  });

  it("prices flash-lite cheaper than flash", () => {
    expect(estimateCostUsd("gemini-2.5-flash-lite", 1_000_000, 0)).toBeLessThan(
      estimateCostUsd("gemini-2.5-flash", 1_000_000, 0),
    );
  });
});

describe("usageFromGeminiResponse", () => {
  it("counts thinking tokens as output (they are billed)", () => {
    const u = usageFromGeminiResponse(
      { usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, thoughtsTokenCount: 30 } },
      "gemini-2.5-flash",
    );
    expect(u).toMatchObject({ inputTokens: 100, outputTokens: 80 });
    expect(u!.costUsd).toBeGreaterThan(0);
  });

  it("returns null without usage metadata", () => {
    expect(usageFromGeminiResponse({}, "gemini-2.5-flash")).toBeNull();
    expect(usageFromGeminiResponse(null, "gemini-2.5-flash")).toBeNull();
  });
});

describe("assistantOutageReply (W0.4)", () => {
  it("is localized and never empty", () => {
    for (const loc of ["en", "ko", "ja", "zh", "zh-TW", "es"] as const) {
      expect(assistantOutageReply(loc).length).toBeGreaterThan(20);
    }
    expect(assistantOutageReply("ko")).toContain("일시적인 문제");
  });
});
