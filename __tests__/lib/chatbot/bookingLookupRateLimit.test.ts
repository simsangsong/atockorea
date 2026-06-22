import {
  BOOKING_LOOKUP_LIMITS,
  checkBookingLookupAllowed,
  recordBookingLookupAttempt,
  recordBookingLookupFailure,
  recordBookingLookupSuccess,
  __resetBookingLookupRateLimit,
} from "@/lib/chatbot/bookingLookupRateLimit";

beforeEach(() => __resetBookingLookupRateLimit());

const KEY = "session-1|1.2.3.4";

describe("booking lookup rate limit", () => {
  it("allows up to perMinute attempts then rate-limits", () => {
    const now = 1_000_000;
    for (let i = 0; i < BOOKING_LOOKUP_LIMITS.perMinute; i++) {
      expect(checkBookingLookupAllowed(KEY, now).allowed).toBe(true);
      recordBookingLookupAttempt(KEY, now);
    }
    const gate = checkBookingLookupAllowed(KEY, now);
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.reason).toBe("rate_limited");
  });

  it("frees up after the minute window passes", () => {
    const now = 1_000_000;
    for (let i = 0; i < BOOKING_LOOKUP_LIMITS.perMinute; i++) recordBookingLookupAttempt(KEY, now);
    expect(checkBookingLookupAllowed(KEY, now).allowed).toBe(false);
    // 61 seconds later the per-minute window has rolled over.
    expect(checkBookingLookupAllowed(KEY, now + 61_000).allowed).toBe(true);
  });

  it("locks after maxFailures failed verifications", () => {
    const now = 2_000_000;
    let locked = false;
    for (let i = 0; i < BOOKING_LOOKUP_LIMITS.maxFailures; i++) {
      locked = recordBookingLookupFailure(KEY, now);
    }
    expect(locked).toBe(true);
    const gate = checkBookingLookupAllowed(KEY, now);
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.reason).toBe("locked");
  });

  it("stays locked until the lock window expires", () => {
    const now = 2_000_000;
    for (let i = 0; i < BOOKING_LOOKUP_LIMITS.maxFailures; i++) recordBookingLookupFailure(KEY, now);
    expect(checkBookingLookupAllowed(KEY, now + BOOKING_LOOKUP_LIMITS.lockMs - 1).allowed).toBe(false);
    expect(checkBookingLookupAllowed(KEY, now + BOOKING_LOOKUP_LIMITS.lockMs + 1).allowed).toBe(true);
  });

  it("a success clears the failure counter so it won't lock", () => {
    const now = 3_000_000;
    for (let i = 0; i < BOOKING_LOOKUP_LIMITS.maxFailures - 1; i++) recordBookingLookupFailure(KEY, now);
    recordBookingLookupSuccess(KEY);
    // One more failure after the reset should not trip the lock.
    expect(recordBookingLookupFailure(KEY, now)).toBe(false);
    expect(checkBookingLookupAllowed(KEY, now).allowed).toBe(true);
  });

  it("isolates keys from one another", () => {
    const now = 4_000_000;
    for (let i = 0; i < BOOKING_LOOKUP_LIMITS.maxFailures; i++) recordBookingLookupFailure("a|ip", now);
    expect(checkBookingLookupAllowed("a|ip", now).allowed).toBe(false);
    expect(checkBookingLookupAllowed("b|ip", now).allowed).toBe(true);
  });
});
