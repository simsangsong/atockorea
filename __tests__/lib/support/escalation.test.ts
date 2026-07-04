import type { SupabaseClient } from "@supabase/supabase-js";
import { detectEscalation, isActionRequest } from "@/lib/support/escalation";

function mockSb(keywords: Array<{ keyword: string; category?: string; locale?: string }>): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: async () => ({ data: keywords.map((k) => ({ locale: "any", category: null, ...k })) }),
      }),
    }),
  } as unknown as SupabaseClient;
}

const KEYWORDS = [{ keyword: "환불" }, { keyword: "refund" }];

describe("W1.5.1 (C-20) — informational questions do not create keyword tickets", () => {
  it("policy QUESTION with a refund keyword does not escalate", async () => {
    const d = await detectEscalation(mockSb(KEYWORDS), "환불 정책이 뭐예요?", "환불 정책은 24시간 전 100%입니다.", "ko", {
      intent: "policy",
    });
    expect(d.escalate).toBe(false);
  });

  it("refund ACTION request escalates even on policy intent", async () => {
    const d = await detectEscalation(mockSb(KEYWORDS), "환불해주세요. 투어가 취소됐어요", "…", "ko", {
      intent: "policy",
    });
    expect(d.escalate).toBe(true);
    expect(d.reason).toBe("keyword_match");
  });

  it("booking_specific keeps keyword escalation live", async () => {
    const d = await detectEscalation(mockSb(KEYWORDS), "내 예약 환불 처리 됐나요?", "…", "ko", {
      intent: "booking_specific",
    });
    expect(d.escalate).toBe(true);
  });

  it("without intent info the legacy keyword behavior is preserved", async () => {
    const d = await detectEscalation(mockSb(KEYWORDS), "refund question", "…", "en");
    expect(d.escalate).toBe(true);
    expect(d.reason).toBe("keyword_match");
  });

  it("explicit human handoff still wins regardless of intent", async () => {
    const d = await detectEscalation(mockSb(KEYWORDS), "상담원 연결해줘", "…", "ko", { intent: "policy" });
    expect(d.escalate).toBe(true);
    expect(d.reason).toBe("user_requested_human");
  });
});

// W1.5.2 (C-21): complaint tone escalates even without trigger keywords.
describe("complaint tone detection", () => {
  it("escalates keyword-free complaints as reason=complaint", async () => {
    const cases = [
      "서비스 정말 별로였어요",
      "The tour was terrible, never again",
      "답장이 없어요. 어떻게 된 거예요",
      "太失望了",
      "el servicio fue pésimo",
    ];
    for (const msg of cases) {
      const d = await detectEscalation(mockSb([]), msg, "…", "ko", { intent: "unknown" });
      expect(d.escalate).toBe(true);
      expect(d.reason).toBe("complaint");
    }
  });

  it("does not flag calm informational questions", async () => {
    const d = await detectEscalation(mockSb([]), "픽업 시간대는 보통 어떻게 되나요?", "…", "ko", {
      intent: "policy",
    });
    expect(d.escalate).toBe(false);
  });

  it("complaint beats the informational-intent gate", async () => {
    const d = await detectEscalation(mockSb(KEYWORDS), "환불 정책도 최악이네요 정말 실망입니다", "…", "ko", {
      intent: "policy",
    });
    expect(d.escalate).toBe(true);
    expect(d.reason).toBe("complaint");
  });
});

describe("isActionRequest", () => {
  it("matches real requests in ko/en/ja/zh/es", () => {
    expect(isActionRequest("환불해주세요")).toBe(true);
    expect(isActionRequest("please cancel my booking")).toBe(true);
    expect(isActionRequest("I want a refund")).toBe(true);
    expect(isActionRequest("返金してください")).toBe(true);
    expect(isActionRequest("我要退款")).toBe(true);
    expect(isActionRequest("quiero un reembolso")).toBe(true);
  });

  it("does not match informational phrasings", () => {
    expect(isActionRequest("환불 정책이 뭐예요?")).toBe(false);
    expect(isActionRequest("what is the refund policy?")).toBe(false);
    expect(isActionRequest("is it refundable?")).toBe(false);
  });
});
