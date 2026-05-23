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
