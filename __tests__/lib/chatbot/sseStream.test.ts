/**
 * @jest-environment node
 */
import { sseEvent, sseComment, SSE_HEADERS } from "@/lib/chatbot/sseStream";

const decoder = new TextDecoder();

describe("sseStream", () => {
  describe("sseEvent", () => {
    it("encodes name + JSON data with the trailing blank-line delimiter", () => {
      const out = decoder.decode(sseEvent("delta", { text: "hi" }));
      expect(out).toBe('event: delta\ndata: {"text":"hi"}\n\n');
    });

    it("serializes a done payload with all protocol fields", () => {
      const out = decoder.decode(
        sseEvent("done", {
          reply: "안녕하세요",
          ticket_id: null,
          escalated: false,
          escalation_reason: null,
          handoff_offered: false,
          checkout_url: null,
        }),
      );
      expect(out.startsWith("event: done\ndata: ")).toBe(true);
      expect(out.endsWith("\n\n")).toBe(true);
      const json = out.slice("event: done\ndata: ".length, -2);
      expect(JSON.parse(json)).toEqual({
        reply: "안녕하세요",
        ticket_id: null,
        escalated: false,
        escalation_reason: null,
        handoff_offered: false,
        checkout_url: null,
      });
    });

    it("emits exactly one event terminator (no accidental double newline mid-payload)", () => {
      const out = decoder.decode(sseEvent("error", { error: "assistant_failed" }));
      expect(out.match(/\n\n/g)).toHaveLength(1);
    });
  });

  describe("sseComment", () => {
    it("encodes a colon-prefixed comment line", () => {
      expect(decoder.decode(sseComment("heartbeat"))).toBe(": heartbeat\n\n");
    });
  });

  describe("SSE_HEADERS", () => {
    it("disables proxy buffering and transforms (D-T2-6)", () => {
      expect(SSE_HEADERS["Content-Type"]).toBe("text/event-stream; charset=utf-8");
      expect(SSE_HEADERS["Cache-Control"]).toBe("no-cache, no-transform");
      expect(SSE_HEADERS["X-Accel-Buffering"]).toBe("no");
    });
  });
});
