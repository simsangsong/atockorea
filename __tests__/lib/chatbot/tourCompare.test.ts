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

describe("W6.2 ambiguous-tie fall-through (deep-audit 2026-07-05)", () => {
  it("does not compare an arbitrary pair when 3+ tours tie the score", () => {
    // Several "cruise shore" tours all score 2 on {cruise, shore}; region
    // words are STOP_TOKENS so they don't break the tie → must fall through.
    const msg = "What's the difference between the Jeju cruise shore tour and the Busan cruise shore tour?";
    const matched = matchToursInText(msg, "en");
    expect(matched.length).toBeLessThan(2);
    expect(buildComparisonAnswer(msg, "en")).toBeNull();
  });

  it("still compares two clearly-distinct tours", () => {
    const distinct = products.filter(
      (p) => !/cruise|shore/i.test(p.title) && p.title.split(/\s+/).length >= 3,
    );
    if (distinct.length >= 2) {
      const msg = `difference between ${distinct[0].title} and ${distinct[1].title}?`;
      const matched = matchToursInText(msg, "en");
      expect(matched.map((m) => m.slug).sort()).toEqual([distinct[0].slug, distinct[1].slug].sort());
    }
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
