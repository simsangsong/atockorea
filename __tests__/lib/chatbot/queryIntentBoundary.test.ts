import { classifyChatbotQuery } from "@/lib/chatbot/queryIntent";

// Regression battery for the pressure-test T1 fix (2026-07-07): the classifier
// used plain `q.includes(term)` with no word boundaries, so keyword substrings
// false-matched inside larger words. These lock the boundary-aware matcher +
// term curation so the fixes cannot silently regress.

const intentOf = (q: string) => classifyChatbotQuery(q).intent;

describe("queryIntent boundary matching (pressure-test T1)", () => {
  it("Korean 시내 (downtown) no longer misroutes to booking_specific", () => {
    // "내 투어"/"내 " used to substring-match inside "시내 투어".
    expect(intentOf("부산 시내 투어 요금이 얼마인가요")).toBe("price_question");
    expect(intentOf("서울 시내 투어 추천해줘")).not.toBe("booking_specific");
    expect(intentOf("제주 시내 관광지 알려줘")).not.toBe("booking_specific");
  });

  it("genuine 1st-person booking questions still classify as booking_specific", () => {
    expect(intentOf("내 예약 픽업 시간 알려줘")).toBe("booking_specific");
    expect(intentOf("제 결제가 정상적으로 됐는지 확인해줘")).toBe("booking_specific");
  });

  it("Korean compounds without spaces still match their keyword", () => {
    // Boundary logic must NOT break space-less CJK compounds.
    expect(intentOf("전액환불 되나요?")).toBe("policy"); // 전액환불 → 환불
    expect(intentOf("제주도 투어 추천")).not.toBe("unknown"); // 제주도 → 제주
  });

  it("ASCII substrings no longer force the wrong intent", () => {
    expect(intentOf("Is there a coffee shop at the rest stop?")).not.toBe("policy"); // coffee→fee
    expect(intentOf("Can I take a detour to a viewpoint?")).not.toBe("tour_recommendation"); // detour→tour (bare)
    expect(intentOf("I lost my headphones, who do I call?")).not.toBe("company"); // headphones→phone
    expect(intentOf("Do you have vegan cookies on the tour?")).not.toBe("legal"); // cookies→cookie
    expect(intentOf("In terms of pace, which tour is easiest?")).not.toBe("legal"); // in terms of→terms
    expect(intentOf("I booked through a travel agent, can you help?")).not.toBe("support"); // travel agent→agent
  });

  it("still detects the real keyword when it is a standalone word", () => {
    expect(intentOf("What is your cancellation and refund policy?")).toBe("policy");
    expect(intentOf("Can you connect me to a live agent?")).toBe("support");
    expect(intentOf("What is your cookie policy?")).toBe("legal");
  });

  it("newly-covered gaps route correctly", () => {
    expect(intentOf("¿Puedo llevar sillita de bebé?")).toBe("policy"); // es child seat
    expect(intentOf("silla de bebé disponible?")).toBe("policy");
    expect(intentOf("Who operates these tours?")).toBe("company"); // operator
    expect(intentOf("who runs your tours?")).toBe("company");
  });

  it("explicit negation of one's own booking does not gate on identity", () => {
    expect(intentOf("내 예약 말고 그냥 부산 투어 추천해줘")).not.toBe("booking_specific");
    expect(intentOf("not my booking, just recommend a Jeju tour")).not.toBe("booking_specific");
  });
});
