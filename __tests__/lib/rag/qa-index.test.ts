import { syncQaPairToIndex, removeQaFromIndex } from "@/lib/rag/qa-index";

jest.mock("@/lib/rag/embed", () => ({
  embedTexts: jest.fn(async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3])),
  toVectorLiteral: (v: number[]) => `[${v.join(",")}]`,
}));

type QaRow = Record<string, unknown> | null;

/** Minimal supabase stub capturing upsert/delete calls. */
function makeSb(qaRow: QaRow) {
  const calls = { upsert: [] as unknown[], deleted: [] as Array<Record<string, string>> };
  const sb = {
    from(table: string) {
      if (table === "qa_pairs") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: qaRow, error: null }) }),
          }),
        };
      }
      // knowledge_chunks
      return {
        upsert: async (row: unknown, opts: unknown) => {
          calls.upsert.push({ row, opts });
          return { error: null };
        },
        delete: () => {
          const filter: Record<string, string> = {};
          const chain = {
            eq: (col: string, val: string) => {
              filter[col] = val;
              calls.deleted.push({ [col]: val });
              return chain;
            },
            then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
          };
          return chain;
        },
      };
    },
  } as never;
  return { sb, calls };
}

describe("syncQaPairToIndex", () => {
  it("indexes an approved + active pair", async () => {
    const { sb, calls } = makeSb({
      id: 5,
      question: "Refund if it rains?",
      answer: "Yes, weather refunds apply.",
      question_locale: "en",
      answer_locale: "en",
      category: "refund",
      tour_slug: null,
      tags: ["x"],
      review_status: "approved",
      is_active: true,
    });
    const result = await syncQaPairToIndex(sb, 5);
    expect(result).toBe("indexed");
    expect(calls.upsert).toHaveLength(1);
    const row = (calls.upsert[0] as { row: Record<string, unknown> }).row;
    expect(row.source_type).toBe("qa");
    expect(row.source_id).toBe("5");
    expect(String(row.content)).toContain("Refund if it rains?");
  });

  it("removes a pair that is no longer approved/active", async () => {
    const { sb, calls } = makeSb({
      id: 9,
      question: "q",
      answer: "a",
      review_status: "rejected",
      is_active: false,
      question_locale: "ko",
      answer_locale: "ko",
      category: null,
      tour_slug: null,
      tags: null,
    });
    const result = await syncQaPairToIndex(sb, 9);
    expect(result).toBe("removed");
    expect(calls.upsert).toHaveLength(0);
    expect(calls.deleted).toEqual(expect.arrayContaining([{ source_type: "qa" }, { source_id: "9" }]));
  });

  it("removes a missing pair", async () => {
    const { sb } = makeSb(null);
    expect(await syncQaPairToIndex(sb, 1)).toBe("removed");
  });
});

describe("removeQaFromIndex", () => {
  it("deletes by source_type + source_id", async () => {
    const { sb, calls } = makeSb(null);
    await removeQaFromIndex(sb, 42);
    expect(calls.deleted).toEqual(expect.arrayContaining([{ source_type: "qa" }, { source_id: "42" }]));
  });
});
