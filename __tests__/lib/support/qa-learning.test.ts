import {
  buildQaTags,
  inferQaCategory,
  inferQaLocale,
  sanitizeQaText,
} from "@/lib/support/qa-learning";

describe("support QA learning helpers", () => {
  it("redacts obvious contact and booking identifiers", () => {
    expect(
      sanitizeQaText("Email me at guest@example.com or +82 10-1234-5678 about booking ABCD-1234"),
    ).toContain("[email]");
    expect(
      sanitizeQaText("Email me at guest@example.com or +82 10-1234-5678 about booking ABCD-1234"),
    ).toContain("[phone]");
  });

  it("infers structured categories and locales", () => {
    expect(inferQaCategory("반려동물 동반 가능한가요?", "전용 좌석은 없습니다.")).toBe("pet");
    expect(inferQaCategory("픽업은 호텔 로비인가요?", "네, 호텔 로비입니다.")).toBe("pickup");
    expect(inferQaLocale("픽업은 어디인가요?")).toBe("ko");
  });

  it("builds stable dashboard tags", () => {
    expect(buildQaTags({ category: "pickup", tourSlug: "east-signature-nature-core" })).toEqual([
      "support_ticket",
      "auto_draft",
      "pickup",
      "tour:east-signature-nature-core",
    ]);
  });
});
