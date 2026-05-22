import {
  assistantReplyShouldOfferHandoff,
  ensureHandoffPrompt,
  humanHandoffAcknowledgement,
} from "@/lib/support/handoff";

describe("human handoff helpers", () => {
  it("detects assistant replies that should offer human support", () => {
    expect(
      assistantReplyShouldOfferHandoff("I do not have that information in the verified site context."),
    ).toBe(true);
    expect(
      assistantReplyShouldOfferHandoff("제공된 정보에 없습니다. 고객 지원팀에 문의하시겠습니까?"),
    ).toBe(true);
    expect(assistantReplyShouldOfferHandoff("Pickup is listed as 08:30 at the hotel lobby.")).toBe(false);
  });

  it("adds a Korean handoff prompt when the answer is uncertain", () => {
    const reply = ensureHandoffPrompt("정확한 답변은 확인이 필요합니다.", "ko");

    expect(reply).toContain("담당자 고객센터로 연결해 드릴까요?");
  });

  it("builds acknowledgement text with the created ticket id", () => {
    expect(humanHandoffAcknowledgement("ko", 42)).toContain("#42");
  });
});
