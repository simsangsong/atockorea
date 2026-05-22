import { rankApprovedQaPairs, type ApprovedQaPair } from "@/lib/chatbot/qaKnowledge";

const pairs: ApprovedQaPair[] = [
  {
    id: 1,
    question: "Can I bring a pet on this tour?",
    answer: "Pets are not listed as allowed for this tour. Please contact support for confirmation.",
    question_locale: "en",
    answer_locale: "en",
    category: "pet",
    tour_slug: "east-signature-nature-core",
    tags: ["support_ticket", "auto_draft", "pet"],
  },
  {
    id: 2,
    question: "Where is hotel pickup?",
    answer: "Pickup is normally from the hotel lobby.",
    question_locale: "en",
    answer_locale: "en",
    category: "pickup",
    tour_slug: null,
    tags: ["pickup"],
  },
];

describe("approved QA retrieval", () => {
  it("ranks matching approved QA above unrelated entries", () => {
    const ranked = rankApprovedQaPairs(pairs, "Are dogs or pets allowed?", "en", {
      tourSlug: "east-signature-nature-core",
    });

    expect(ranked[0]?.id).toBe(1);
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
  });
});
