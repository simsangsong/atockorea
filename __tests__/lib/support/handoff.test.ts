import {
  assistantReplyShouldOfferHandoff,
  ensureHandoffPrompt,
  humanHandoffAcknowledgement,
  userMessageRequestsHumanHandoff,
} from "@/lib/support/handoff";

describe("human handoff helpers", () => {
  it("detects assistant replies that should offer human support", () => {
    expect(
      assistantReplyShouldOfferHandoff("I do not have that information in the verified site context."),
    ).toBe(true);
    expect(
      assistantReplyShouldOfferHandoff("확인된 정보만으로는 답을 찾을 수 없습니다. 고객센터에 문의하시겠어요?"),
    ).toBe(true);
    expect(assistantReplyShouldOfferHandoff("Pickup is listed as 08:30 at the hotel lobby.")).toBe(false);
  });

  it("detects explicit user requests for a human", () => {
    expect(userMessageRequestsHumanHandoff("상담원 연결해줘")).toBe(true);
    expect(userMessageRequestsHumanHandoff("Please connect me with customer support")).toBe(true);
    expect(userMessageRequestsHumanHandoff("What tours do you offer in Jeju?")).toBe(false);
  });

  it("adds a Korean handoff prompt when the answer is uncertain", () => {
    const reply = ensureHandoffPrompt("정확한 답변을 위해 확인이 필요합니다.", "ko");

    expect(reply).toContain("담당자에게 바로 연결해 드릴까요?");
  });

  it("builds acknowledgement text with the created ticket id", () => {
    expect(humanHandoffAcknowledgement("ko", 42)).toContain("#42");
  });
});
