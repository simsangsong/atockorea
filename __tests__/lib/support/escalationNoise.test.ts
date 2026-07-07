import type { SupabaseClient } from "@supabase/supabase-js";
import { detectEscalation, looksLikeComplaint } from "@/lib/support/escalation";

// No escalation keywords configured → isolates the rage-punctuation (esc-01)
// and sensitive-topic (esc-03) branches from the keyword-DB branch.
const emptySb = {
  from: () => ({ select: () => ({ eq: async () => ({ data: [] }) }) }),
} as unknown as SupabaseClient;

describe("pressure-test esc-01: rage punctuation no longer false-escalates", () => {
  it("enthusiastic messages ending in !!! are NOT complaints", () => {
    expect(looksLikeComplaint("This tour looks amazing!!!")).toBe(false);
    expect(looksLikeComplaint("정말 기대돼요!!!")).toBe(false);
    expect(looksLikeComplaint("Can't wait!!!!")).toBe(false);
  });

  it("genuine anger is still detected", () => {
    expect(looksLikeComplaint("서비스 정말 최악이었어요")).toBe(true);
    expect(looksLikeComplaint("terrible experience, worst tour ever")).toBe(true);
    expect(looksLikeComplaint("no one has replied to my email")).toBe(true);
  });

  it("an enthusiastic tour question does not create a ticket", async () => {
    const d = await detectEscalation(emptySb, "This Jeju tour looks amazing!!!", "…", "en", {
      intent: "tour_recommendation",
    });
    expect(d.escalate).toBe(false);
  });
});

describe("pressure-test esc-03: sensitive-topic needs a real threat", () => {
  it("informational legal questions do NOT escalate to a high-priority ticket", async () => {
    const a = await detectEscalation(emptySb, "법적 고지사항 어디서 봐요?", "…", "ko", { intent: "legal" });
    expect(a.escalate).toBe(false);
    const b = await detectEscalation(emptySb, "법적으로 문제 없나요?", "…", "ko", { intent: "legal" });
    expect(b.escalate).toBe(false);
  });

  it("actual legal threats still escalate as sensitive_topic", async () => {
    const a = await detectEscalation(emptySb, "소송하겠습니다", "…", "ko", { intent: "legal" });
    expect(a.reason).toBe("sensitive_topic");
    const b = await detectEscalation(emptySb, "I will sue you and contact my attorney", "…", "en", {
      intent: "legal",
    });
    expect(b.reason).toBe("sensitive_topic");
  });
});
