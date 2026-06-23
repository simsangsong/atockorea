import { allowRequest, __resetRequestRateLimit } from "@/lib/chatbot/requestRateLimit";

beforeEach(() => __resetRequestRateLimit());

describe("allowRequest", () => {
  it("allows up to perMinute then blocks", () => {
    const now = 1_000_000;
    const cfg = { perMinute: 3, perHour: 100 };
    for (let i = 0; i < 3; i++) expect(allowRequest("ns", "ip:1", cfg, now).allowed).toBe(true);
    const blocked = allowRequest("ns", "ip:1", cfg, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(60_000);
  });

  it("frees up after the minute window", () => {
    const now = 1_000_000;
    const cfg = { perMinute: 3, perHour: 100 };
    for (let i = 0; i < 3; i++) allowRequest("ns", "ip:1", cfg, now);
    expect(allowRequest("ns", "ip:1", cfg, now).allowed).toBe(false);
    expect(allowRequest("ns", "ip:1", cfg, now + 61_000).allowed).toBe(true);
  });

  it("enforces the hourly cap", () => {
    const now = 1_000_000;
    const cfg = { perMinute: 100, perHour: 5 };
    // spread across minutes so the per-minute cap never trips
    for (let i = 0; i < 5; i++) expect(allowRequest("ns", "ip:1", cfg, now + i * 61_000).allowed).toBe(true);
    expect(allowRequest("ns", "ip:1", cfg, now + 6 * 61_000).allowed).toBe(false);
  });

  it("isolates keys and namespaces", () => {
    const now = 1_000_000;
    const cfg = { perMinute: 1, perHour: 100 };
    expect(allowRequest("a", "ip:1", cfg, now).allowed).toBe(true);
    expect(allowRequest("a", "ip:1", cfg, now).allowed).toBe(false);
    expect(allowRequest("a", "ip:2", cfg, now).allowed).toBe(true); // different key
    expect(allowRequest("b", "ip:1", cfg, now).allowed).toBe(true); // different namespace
  });
});
