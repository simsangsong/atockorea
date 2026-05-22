import {
  buildSiteKnowledgeContextText,
  rankSiteKnowledgeChunks,
} from "@/lib/chatbot/siteKnowledge";

describe("site chatbot knowledge retrieval", () => {
  it("finds Korean refund policy content for refund questions", () => {
    const ranked = rankSiteKnowledgeChunks("환불은 언제까지 가능한가요?", "ko", { limit: 5 });

    expect(ranked.some((chunk) => chunk.category === "policy" && chunk.source === "/refund-policy")).toBe(true);
  });

  it("matches POIs by compact Korean name aliases", () => {
    const ranked = rankSiteKnowledgeChunks("해동용궁사 입장료와 주차 알려줘", "ko", { limit: 5 });

    expect(ranked[0]?.id).toBe("poi:haedong_yonggungsa");
  });

  it("builds compact context blocks for the assistant prompt", () => {
    const context = buildSiteKnowledgeContextText({
      locale: "en",
      query: "What is ATOC Korea's role and contact email?",
      maxChunks: 3,
      maxChars: 2400,
    });

    expect(context).toContain("Footer company");
    expect(context).toContain("support@atockorea.com");
  });
});
