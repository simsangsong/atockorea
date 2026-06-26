import {
  BULK_ORDER_STATUSES,
  MAX_BULK_ORDER_IDS,
  isBulkOrderStatus,
  parseBulkOrderIds,
  partitionBulkTransitions,
} from "@/lib/admin/orders-bulk";

describe("orders-bulk", () => {
  describe("isBulkOrderStatus", () => {
    it("allows only confirmed + completed", () => {
      expect(isBulkOrderStatus("confirmed")).toBe(true);
      expect(isBulkOrderStatus("completed")).toBe(true);
      expect(isBulkOrderStatus("cancelled")).toBe(false);
      expect(isBulkOrderStatus("no_show")).toBe(false);
      expect(isBulkOrderStatus("pending")).toBe(false);
    });
    it("BULK_ORDER_STATUSES is exactly those two", () => {
      expect([...BULK_ORDER_STATUSES]).toEqual(["confirmed", "completed"]);
    });
  });

  describe("parseBulkOrderIds", () => {
    it("keeps non-empty strings, trims, dedupes, preserves order", () => {
      expect(parseBulkOrderIds([" a ", "b", "a", "  "])).toEqual({ ids: ["a", "b"] });
    });
    it("drops non-strings", () => {
      expect(parseBulkOrderIds(["a", 1, null, {}])).toEqual({ ids: ["a"] });
    });
    it("errors on non-array / empty / oversize", () => {
      expect(parseBulkOrderIds("x").error).toBe("ids_must_be_array");
      expect(parseBulkOrderIds([" ", 3]).error).toBe("no_valid_ids");
      const many = Array.from({ length: MAX_BULK_ORDER_IDS + 1 }, (_, i) => `id-${i}`);
      expect(parseBulkOrderIds(many).error).toBe("too_many_ids");
    });
  });

  describe("partitionBulkTransitions", () => {
    it("allows pending/confirmed/same -> completed, skips cancelled", () => {
      const rows = [
        { id: "a", status: "pending" },
        { id: "b", status: "confirmed" },
        { id: "c", status: "completed" }, // same-status = idempotent allow
        { id: "d", status: "cancelled" }, // terminal -> skipped
      ];
      const { valid, skipped } = partitionBulkTransitions(rows, "completed");
      expect(valid).toEqual(["a", "b", "c"]);
      expect(skipped.map((s) => s.id)).toEqual(["d"]);
    });
    it("treats same-status as an allowed idempotent move", () => {
      const { valid } = partitionBulkTransitions([{ id: "a", status: "confirmed" }], "confirmed");
      expect(valid).toEqual(["a"]);
    });
    it("skips everything for an invalid target", () => {
      const { valid, skipped } = partitionBulkTransitions(
        [{ id: "a", status: "pending" }],
        "no_show",
      );
      expect(valid).toEqual([]);
      expect(skipped).toHaveLength(1);
    });
  });
});
