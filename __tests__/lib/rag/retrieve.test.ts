import { buildRagContextText, retrieveKnowledge, type RetrievedChunk } from "@/lib/rag/retrieve";
import { toVectorLiteral } from "@/lib/rag/embed";

// embedQuery hits OpenAI — stub it so the test is hermetic.
jest.mock("@/lib/rag/embed", () => ({
  embedQuery: jest.fn(async () => [0.1, 0.2, 0.3]),
  toVectorLiteral: (v: number[]) => `[${v.join(",")}]`,
}));

type Row = Record<string, unknown>;

function fakeSb(vectorRows: Row[], keywordRows: Row[]) {
  return {
    rpc: jest.fn(async (fn: string) => {
      if (fn === "match_knowledge_chunks") return { data: vectorRows, error: null };
      if (fn === "keyword_knowledge_chunks") return { data: keywordRows, error: null };
      return { data: [], error: null };
    }),
  } as never;
}

function row(id: number, extra: Partial<Row> = {}): Row {
  return {
    id,
    source_type: "policy",
    source_id: `s${id}`,
    locale: "en",
    title: `T${id}`,
    content: `content ${id}`,
    url: `/p/${id}`,
    tags: [],
    metadata: {},
    similarity: 0.5,
    ...extra,
  };
}

describe("toVectorLiteral", () => {
  it("renders a pgvector text literal", () => {
    expect(toVectorLiteral([1, 2, 3])).toBe("[1,2,3]");
  });
});

describe("retrieveKnowledge", () => {
  it("fuses vector + keyword results and dedupes by id (RRF)", async () => {
    // id 2 appears top of both lists -> should rank first after fusion.
    const vector = [row(1), row(2), row(3)];
    const keyword = [row(2), row(4)];
    const sb = fakeSb(vector, keyword);
    const hits = await retrieveKnowledge(sb, { query: "refund", locale: "en", limit: 10 });
    const ids = hits.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length); // no duplicates
    expect(ids[0]).toBe(2); // present in both -> highest fused score
    expect(ids).toEqual(expect.arrayContaining([1, 2, 3, 4]));
  });

  it("returns [] for an empty query without calling the db", async () => {
    const sb = fakeSb([], []);
    const hits = await retrieveKnowledge(sb, { query: "   " });
    expect(hits).toEqual([]);
  });

  it("survives keyword RPC failure (vector-only)", async () => {
    const sb = {
      rpc: jest.fn(async (fn: string) => {
        if (fn === "match_knowledge_chunks") return { data: [row(7)], error: null };
        return { data: null, error: { message: "boom" } };
      }),
    } as never;
    const hits = await retrieveKnowledge(sb, { query: "x", limit: 5 });
    expect(hits.map((h) => h.id)).toEqual([7]);
  });
});

describe("buildRagContextText", () => {
  const chunk = (over: Partial<RetrievedChunk>): RetrievedChunk => ({
    id: 1,
    source_type: "policy",
    source_id: "s1",
    locale: "en",
    title: "Refunds",
    content: "Refunds are available within 24h.",
    url: "/refund-policy",
    tags: [],
    metadata: {},
    similarity: 0.5,
    score: 0.1,
    ...over,
  });

  it("includes a source citation and the title", () => {
    const text = buildRagContextText([chunk({})]);
    expect(text).toContain("### Refunds");
    expect(text).toContain("Source: /refund-policy");
    expect(text).toContain("Refunds are available");
  });

  it("respects the maxChars budget", () => {
    const big = chunk({ content: "x".repeat(5000) });
    const text = buildRagContextText([big, chunk({ id: 2, title: "Second" })], { maxChars: 200 });
    expect(text).not.toContain("Second");
  });
});
