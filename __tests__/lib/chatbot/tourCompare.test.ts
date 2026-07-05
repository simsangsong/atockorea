import { buildComparisonAnswer, looksLikeComparisonQuestion, matchToursInText } from "@/lib/chatbot/tourCompare";
import { listStaticTourProducts } from "@/components/product-tour-static/catalog/staticTourCatalogCards";
import { computeResolutionRate } from "@/lib/admin/chatbot-resolution";

const products = listStaticTourProducts("en");
const [p1, p2] = products;

describe("W6.2 tour comparison", () => {
  it("detects comparison phrasing in several languages", () => {
    for (const q of [
      "What's the difference between them?",
      "A vs B which is better",
      "두 투어 차이가 뭐예요?",
      "どう違うの？",
      "有什么区别？",
      "¿Cuál es mejor?",
    ]) {
      expect(looksLikeComparisonQuestion(q)).toBe(true);
    }
    expect(looksLikeComparisonQuestion("recommend a tour please")).toBe(false);
  });

  it("matches two catalogue tours named in free text and builds the answer", () => {
    const msg = `What's the difference between the ${p1.title} and the ${p2.title}?`;
    const matched = matchToursInText(msg, "en");
    expect(matched.map((m) => m.slug).sort()).toEqual([p1.slug, p2.slug].sort());

    const answer = buildComparisonAnswer(msg, "en");
    expect(answer).not.toBeNull();
    expect(answer!.cards).toHaveLength(2);
    expect(answer!.reply).toContain(p1.title);
    expect(answer!.reply).toContain(p2.title);
    expect(answer!.reply).toContain(p1.duration);
    expect(answer!.chips.length).toBeGreaterThan(0);
  });

  it("falls through (null) when fewer than two tours are named", () => {
    expect(buildComparisonAnswer(`How is the ${p1.title} different from other options?`, "en"))
      .toBeNull();
    expect(buildComparisonAnswer("what's the difference between morning and afternoon pickup?", "en"))
      .toBeNull();
  });
});

describe("W6.5 computeResolutionRate", () => {
  it("computes the conservative proxy and clamps at zero", () => {
    expect(computeResolutionRate({ userMessages: 100, escalatedMessages: 6, negativeFeedback: 4 })).toBe(0.9);
    expect(computeResolutionRate({ userMessages: 5, escalatedMessages: 4, negativeFeedback: 4 })).toBe(0);
  });
  it("is null with no traffic", () => {
    expect(computeResolutionRate({ userMessages: 0, escalatedMessages: 0, negativeFeedback: 0 })).toBeNull();
  });
});
