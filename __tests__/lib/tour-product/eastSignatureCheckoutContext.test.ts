import { buildBookingPayload } from "@/components/product-tour-static/_shared/bookingShared";
import type { TourProductCheckoutContext } from "@/lib/tour-product/eastSignatureCheckoutContext";

/**
 * Regression coverage for the vehicle-priced private charter checkout flow.
 *
 * Before this fix, `loadCheckoutContextFromToursTable` silently coerced any
 * `price_type !== 'group'` to `'person'`, so a vehicle-priced tour (e.g.
 * `jeju-island-private-car-charter-tour` @ $249/vehicle) ended up reporting
 * `priceType: 'person'` to `buildBookingPayload`, which then multiplied by
 * the guest count. The server-side `/api/bookings` correctly kept the fixed
 * price, but the resulting client/server mismatch tripped the PRICE_MISMATCH
 * guard and blocked the booking entirely.
 *
 * The behavioural contract these tests pin down:
 *   - `person`  → unit × guests
 *   - `group`   → unit (fixed)
 *   - `vehicle` → unit (fixed, same shape as group)
 */
describe("buildBookingPayload across all price types", () => {
  const baseCtx = (priceType: TourProductCheckoutContext["priceType"]): TourProductCheckoutContext => ({
    tourId: "tour-1",
    unitPriceUsd: 249,
    priceType,
  });

  it("multiplies for person price type", () => {
    const payload = buildBookingPayload(baseCtx("person"), "2026-06-01", 3, "en");
    expect(payload.totalPrice).toBe(747);
    expect(payload.guests).toBe(3);
  });

  it("keeps fixed total for group price type", () => {
    const payload = buildBookingPayload(baseCtx("group"), "2026-06-01", 3, "en");
    expect(payload.totalPrice).toBe(249);
    expect(payload.guests).toBe(3);
  });

  it("keeps fixed total for vehicle price type — the regression scenario", () => {
    // Without the fix, a 3-guest vehicle booking would compute 249 * 3 = 747,
    // the server would expect 249, and the booking would be rejected.
    const payload = buildBookingPayload(baseCtx("vehicle"), "2026-06-01", 3, "en");
    expect(payload.totalPrice).toBe(249);
    expect(payload.guests).toBe(3);
  });

  it("vehicle total stays fixed even with the max guest count", () => {
    const payload = buildBookingPayload(baseCtx("vehicle"), "2026-06-01", 12, "en");
    expect(payload.totalPrice).toBe(249);
    expect(payload.guests).toBe(12);
  });

  it("rounds person totals to two decimals", () => {
    const ctx: TourProductCheckoutContext = {
      tourId: "tour-1",
      unitPriceUsd: 59.33,
      priceType: "person",
    };
    const payload = buildBookingPayload(ctx, "2026-06-01", 2, "en");
    expect(payload.totalPrice).toBe(118.66);
  });

  it("emits a noon ISO timestamp for the booking date", () => {
    const payload = buildBookingPayload(baseCtx("vehicle"), "2026-06-01", 2, "en");
    expect(payload.date).toMatch(/^2026-06-01T(03|12)/); // "T12" local-noon → "T03" UTC for KST
    expect(payload.date.endsWith("Z")).toBe(true);
  });
});
