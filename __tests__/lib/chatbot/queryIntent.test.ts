import {
  bookingSpecificReply,
  classifyChatbotQuery,
  expandQueryForTourCatalogue,
  policyFallbackReply,
  replyLooksMisrouted,
} from "@/lib/chatbot/queryIntent";

describe("chatbot query intent routing", () => {
  it("keeps cancellation and refund questions out of the tour catalogue", () => {
    const result = classifyChatbotQuery(
      "\uD658\uBD88 \uADDC\uC815 \uC54C\uB824\uC918. \uC804\uB0A0 \uCDE8\uC18C\uD558\uBA74 \uC5B4\uB5BB\uAC8C \uB3FC?",
    );

    expect(result.intent).toBe("policy");
    expect(result.useTourCatalog).toBe(false);
    expect(result.useSiteKnowledge).toBe(true);
  });

  it("routes exact personal booking details to support instead of catalogue answers", () => {
    const result = classifyChatbotQuery(
      "\uB0B4 \uD638\uD154 \uD53D\uC5C5 \uC2DC\uAC04\uC774 \uC815\uD655\uD788 \uBA87 \uC2DC\uC57C?",
    );

    expect(result.intent).toBe("booking_specific");
    expect(result.requiresHuman).toBe(true);
    expect(bookingSpecificReply("ko")).toContain("\uC608\uC57D \uAE30\uB85D");
  });

  it("expands Korean Jeju relaxed-travel questions into catalogue search terms", () => {
    const prompt =
      "\uC81C\uC8FC\uC5D0\uC11C \uBD80\uBAA8\uB2D8\uC774\uB791 \uAC08 \uB9CC\uD55C \uD22C\uC5B4 \uCD94\uCC9C\uD574\uC918. \uB108\uBB34 \uD798\uB4E0 \uAC74 \uC2EB\uC5B4";
    const result = classifyChatbotQuery(prompt);
    const expanded = expandQueryForTourCatalogue(prompt);

    expect(result.intent).toBe("tour_recommendation");
    expect(result.useTourCatalog).toBe(true);
    expect(expanded).toContain("jeju");
    expect(expanded).toContain("senior");
    expect(expanded).toContain("low mobility");
  });

  // W2.1 (C-3·C-12): listed-price questions get the catalogue (with numbers),
  // NOT the private-quote interrogation.
  it("routes catalog price questions to price_question, not quote_request", () => {
    const en = classifyChatbotQuery("How much is the Pocheon day tour per person?");
    expect(en.intent).toBe("price_question");
    expect(en.useTourCatalog).toBe(true);

    const ko = classifyChatbotQuery("제주 투어는 1인당 얼마인가요?");
    expect(ko.intent).toBe("price_question");

    const zh = classifyChatbotQuery("浦川一日游多少钱?");
    expect(zh.intent).toBe("price_question");
  });

  it("keeps explicit quote asks and private-price asks in the quote funnel", () => {
    expect(classifyChatbotQuery("Can I get a quote for a private tour in Busan?").intent).toBe("quote_request");
    expect(classifyChatbotQuery("부산 프라이빗 투어 4명이면 얼마예요?").intent).toBe("quote_request");
    expect(classifyChatbotQuery("제주 전세 투어 견적 부탁해요").intent).toBe("quote_request");
  });

  // Deep-audit 2026-07-05: a listed tour whose NAME contains "private/charter"
  // must still answer its list price, not be hijacked into the quote funnel.
  it("answers a listed private/charter tour's price question (not quote)", () => {
    const en = classifyChatbotQuery('How much is the "Jeju Island Private Car Charter Tour" tour?');
    expect(en.intent).toBe("price_question");
    expect(en.useTourCatalog).toBe(true);
    // but the same product WITH quote slots is a real custom quote
    expect(
      classifyChatbotQuery("Private Jeju charter for 4 people tomorrow, how much?").intent,
    ).toBe("quote_request");
  });

  // W1.5.3 (C-24): tourist FAQ that used to fall through to "unknown".
  it("classifies airport/luggage/child/guide-language/weather FAQ as policy", () => {
    expect(classifyChatbotQuery("Can you pick me up at the airport?").intent).toBe("policy");
    expect(classifyChatbotQuery("캐리어 2개 있는데 짐 보관 되나요?").intent).toBe("policy");
    expect(classifyChatbotQuery("Do you have an english speaking guide?").intent).toBe("policy");
    expect(classifyChatbotQuery("비가 오면 투어는 어떻게 되나요?").intent).toBe("policy");
  });

  // W1.5.4 (C-25): ja/zh/es policy keywords (was ko/en only).
  it("classifies ja/zh/es policy questions as policy", () => {
    expect(classifyChatbotQuery("退款政策是什么?").intent).toBe("policy");
    expect(classifyChatbotQuery("子供料金はありますか").intent).toBe("policy");
    expect(classifyChatbotQuery("¿Cuál es la política de cancelación?").intent).toBe("policy");
    expect(classifyChatbotQuery("キャンセル料はかかりますか").intent).toBe("policy");
  });

  it("detects company/contact and explicit support requests", () => {
    expect(classifyChatbotQuery("\uD68C\uC0AC \uC8FC\uC18C\uC640 \uC5F0\uB77D\uCC98 \uC54C\uB824\uC918").intent).toBe("company");
    expect(classifyChatbotQuery("\uC0C1\uB2F4\uC6D0 \uC5F0\uACB0\uD574\uC918").intent).toBe("support");
  });

  it("guards against policy answers drifting into unrelated tour lists", () => {
    expect(
      replyLooksMisrouted(
        "policy",
        "Here are recommended day tour products: Jeju tour, Busan tour, Gyeongju day tour.",
      ),
    ).toBe(true);
    expect(policyFallbackReply("en")).toContain("free cancellation");
  });
});
