import {
  createBuilderBooking,
  type BuilderBookingInput,
} from "@/lib/booking/createBuilderBooking";
import { quote } from "@/lib/quote-engine/pricing-policy";

/** Build a baseline input + price-result pair for an English 8h / 2 pax /
 *  Busan-city private tour — the canonical Phase 9 acceptance example. */
function makeBaselineInput(overrides: Partial<BuilderBookingInput> = {}): BuilderBookingInput {
  const price = quote({
    track: "private",
    region: "busan",
    guideLanguageTier: "english",
    durationHours: 8,
    pax: 2,
    poiRegions: ["busan", "busan"],
  });
  return {
    poiKeys: ["haedong_yonggungsa", "gamcheon_culture_village"],
    region: "busan",
    track: "private",
    durationHours: 8,
    guideLanguage: "en",
    guideLanguageTier: "english",
    tourDate: "2026-08-20",
    pax: 2,
    contact: {
      name: "Sam Traveler",
      email: "sam@example.com",
      phone: "+1-555-1111",
    },
    notes: null,
    locale: "en",
    sourceUrl: "https://atockorea.com/itinerary-builder?region=busan",
    price,
    bookingReferenceOverride: "A2C-TEST0001",
    ...overrides,
  };
}

describe("createBuilderBooking — Phase 10 D11/D12/D17/D25", () => {
  it("English 8h / 2pax / Busan-city → ₩340,000 row", () => {
    const row = createBuilderBooking(makeBaselineInput());
    expect(row.final_price).toBe(340000);
    expect(row.unit_price).toBe(340000);
    expect(row.total_price).toBe(340000);
    expect(row.currency).toBe("krw");
    expect(row.source).toBe("itinerary_builder");
    expect(row.tour_id).toBeNull();
    expect(row.merchant_id).toBeNull();
    expect(row.payment_status).toBe("pending");
    expect(row.status).toBe("pending");
  });

  it("D11 — unit_price = total_price = final_price (no per-person fiction)", () => {
    // A 13-pax Solati booking — exactly the case where per-person fiction
    // would lie ("₩640k ÷ 13 = ₩49k/person" is meaningless because Solati
    // is a flat per-vehicle price). All three columns must agree.
    const price = quote({
      track: "private",
      region: "busan",
      guideLanguageTier: "english",
      durationHours: 8,
      pax: 13,
      poiRegions: ["busan"],
    });
    const row = createBuilderBooking(
      makeBaselineInput({
        pax: 13,
        price,
      }),
    );
    expect(row.unit_price).toBe(row.final_price);
    expect(row.total_price).toBe(row.final_price);
    // Sanity — Solati 13 pax / 8h English: base 340k + Solati 150k = ₩490k.
    expect(row.final_price).toBe(490000);
  });

  it("D17 — itinerary jsonb carries the full pricing breakdown", () => {
    const row = createBuilderBooking(makeBaselineInput());
    expect(row.itinerary.region).toBe("busan");
    expect(row.itinerary.track).toBe("private");
    expect(row.itinerary.duration_hours).toBe(8);
    expect(row.itinerary.guide_language).toBe("en");
    expect(row.itinerary.guide_language_tier).toBe("english");
    expect(row.itinerary.pax).toBe(2);
    expect(row.itinerary.vehicle).toBe("sedan");
    expect(row.itinerary.tier).toBe("english");
    expect(row.itinerary.poi_keys).toEqual([
      "haedong_yonggungsa",
      "gamcheon_culture_village",
    ]);
    expect(row.itinerary.breakdown.length).toBeGreaterThanOrEqual(1);
    expect(row.itinerary.breakdown[0]?.code).toBe("base");
    expect(row.itinerary.breakdown[0]?.amount).toBe(340000);
  });

  it("Cruise track preserves cruise_port + breakdown lines", () => {
    const price = quote({
      track: "cruise",
      region: "jeju",
      guideLanguageTier: "english",
      durationHours: 6,
      pax: 2,
      cruisePort: "gangjeong",
      poiRegions: ["jeju"],
      jejuPoiZones: ["south"],
    });
    const row = createBuilderBooking(
      makeBaselineInput({
        region: "jeju",
        track: "cruise",
        durationHours: 6,
        cruisePort: "gangjeong",
        price,
      }),
    );
    expect(row.itinerary.cruise_port).toBe("gangjeong");
    expect(row.itinerary.track).toBe("cruise");
    // Cruise +₩40k + Gangjeong +₩70k must show up as separate breakdown lines.
    const codes = row.itinerary.breakdown.map((l) => l.code);
    expect(codes).toContain("cruise_excursion");
    expect(codes).toContain("gangjeong_port");
  });

  it("DMZ track — fixed-price row stores nothing surprising", () => {
    const price = quote({
      track: "dmz",
      region: "seoul",
      guideLanguageTier: "english",
      durationHours: 0,
      pax: 7,
    });
    const row = createBuilderBooking(
      makeBaselineInput({
        region: "seoul",
        track: "dmz",
        durationHours: 0,
        poiKeys: [],
        pax: 7,
        price,
      }),
    );
    expect(row.final_price).toBe(830000);
    expect(row.itinerary.track).toBe("dmz");
    expect(row.itinerary.poi_keys).toEqual([]);
  });

  it("Trims contact fields and falls null when empty", () => {
    const row = createBuilderBooking(
      makeBaselineInput({
        contact: { name: "  ", email: "sam@example.com", phone: "" },
        notes: "   ",
      }),
    );
    expect(row.contact_name).toBeNull();
    expect(row.contact_email).toBe("sam@example.com");
    expect(row.contact_phone).toBeNull();
    expect(row.special_requests).toBeNull();
  });

  it("Booking reference defaults to A2C-XXXXXXXX shape", () => {
    const row = createBuilderBooking(
      makeBaselineInput({ bookingReferenceOverride: undefined }),
    );
    expect(row.booking_reference).toMatch(/^A2C-[A-F0-9]{8}$/);
  });

  it("number_of_guests is at least 1", () => {
    const row = createBuilderBooking(makeBaselineInput({ pax: 0 }));
    expect(row.number_of_guests).toBe(1);
  });
});
