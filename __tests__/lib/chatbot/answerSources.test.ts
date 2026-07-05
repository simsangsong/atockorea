import { buildAnswerSources } from "@/lib/chatbot/answerSources";
import type { RetrievedChunk } from "@/lib/rag/retrieve";

function chunk(over: Partial<RetrievedChunk>): RetrievedChunk {
  return {
    id: 1,
    source_type: "policy" as RetrievedChunk["source_type"],
    source_id: "refund",
    locale: "all",
    title: null,
    content: "…",
    url: null,
    tags: [],
    metadata: {},
    similarity: 0.5,
    score: 1,
    ...over,
  };
}

describe("buildAnswerSources (W4.6)", () => {
  it("localizes type labels and keeps internal hrefs as relative paths", () => {
    const out = buildAnswerSources(
      [
        chunk({ id: 1, source_type: "policy" as never, url: "https://www.atockorea.com/refund" }),
        chunk({ id: 2, source_type: "tour_product" as never, title: "Jeju Private Car Charter", url: "/tour-product/jeju-island-private-car-charter-tour" }),
      ],
      "ko",
    );
    expect(out).toEqual([
      { type: "policy", label: "사이트 정책", href: "/refund" },
      { type: "tour_product", label: "Jeju Private Car Charter", href: "/tour-product/jeju-island-private-car-charter-tour" },
    ]);
  });

  it("dedupes by (type,label), caps at 3, and drops external hrefs", () => {
    const out = buildAnswerSources(
      [
        chunk({ id: 1, source_type: "policy" as never }),
        chunk({ id: 2, source_type: "policy" as never, source_id: "cancel" }),
        chunk({ id: 3, source_type: "site" as never, url: "https://evil.example.com/x" }),
        chunk({ id: 4, source_type: "qa" as never }),
        chunk({ id: 5, source_type: "poi" as never }),
      ],
      "en",
    );
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ type: "policy", label: "Site policy", href: null });
    expect(out[1]).toEqual({ type: "site", label: "Site guide", href: null });
    expect(out[2].type).toBe("qa");
  });
});
