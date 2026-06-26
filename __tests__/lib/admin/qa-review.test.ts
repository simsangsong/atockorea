import {
  MAX_BULK_REVIEW_IDS,
  QA_REVIEW_ACTIONS,
  parseBulkIds,
  resolveReviewStatus,
} from "@/lib/admin/qa-review";

describe("qa-review", () => {
  describe("resolveReviewStatus", () => {
    it("maps approve/true -> approved+active", () => {
      expect(resolveReviewStatus("approve")).toEqual({ review_status: "approved", is_active: true });
      expect(resolveReviewStatus("true")).toEqual({ review_status: "approved", is_active: true });
    });
    it("maps reject/false -> rejected+inactive", () => {
      expect(resolveReviewStatus("reject")).toEqual({ review_status: "rejected", is_active: false });
      expect(resolveReviewStatus("false")).toEqual({ review_status: "rejected", is_active: false });
    });
    it("maps reset -> draft+inactive and needs_edit -> needs_edit+inactive", () => {
      expect(resolveReviewStatus("reset")).toEqual({ review_status: "draft", is_active: false });
      expect(resolveReviewStatus("needs_edit")).toEqual({
        review_status: "needs_edit",
        is_active: false,
      });
    });
    it("covers every declared action", () => {
      for (const action of QA_REVIEW_ACTIONS) {
        expect(resolveReviewStatus(action)).toBeDefined();
      }
    });
  });

  describe("parseBulkIds", () => {
    it("keeps finite positive ints, order preserved", () => {
      expect(parseBulkIds([3, 1, 2])).toEqual({ ids: [3, 1, 2] });
    });
    it("coerces numeric strings", () => {
      expect(parseBulkIds(["5", 6])).toEqual({ ids: [5, 6] });
    });
    it("dedupes", () => {
      expect(parseBulkIds([1, 1, 2, 2, 1])).toEqual({ ids: [1, 2] });
    });
    it("drops non-positive, non-integer, and garbage values", () => {
      expect(parseBulkIds([0, -1, 1.5, "x", null, 4])).toEqual({ ids: [4] });
    });
    it("errors on non-array", () => {
      expect(parseBulkIds("nope").error).toBe("ids_must_be_array");
    });
    it("errors when nothing valid remains", () => {
      expect(parseBulkIds([0, -2, "x"]).error).toBe("no_valid_ids");
    });
    it("errors (no truncation) when over the cap", () => {
      const many = Array.from({ length: MAX_BULK_REVIEW_IDS + 1 }, (_, i) => i + 1);
      const out = parseBulkIds(many);
      expect(out.error).toBe("too_many_ids");
      expect(out.ids).toEqual([]);
    });
    it("accepts exactly the cap", () => {
      const many = Array.from({ length: MAX_BULK_REVIEW_IDS }, (_, i) => i + 1);
      expect(parseBulkIds(many).ids).toHaveLength(MAX_BULK_REVIEW_IDS);
    });
  });
});
