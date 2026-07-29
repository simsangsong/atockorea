import {
  buildQaTags,
  inferQaCategory,
  inferQaLocale,
  sanitizeQaText,
} from "@/lib/support/qa-learning";

describe("support QA learning helpers", () => {
  it("redacts obvious contact and booking identifiers", () => {
    expect(
      sanitizeQaText("Email me at guest@example.com or +82 10-1234-5678 about booking ABCD-1234"),
    ).toContain("[email]");
    expect(
      sanitizeQaText("Email me at guest@example.com or +82 10-1234-5678 about booking ABCD-1234"),
    ).toContain("[phone]");
  });

  it("infers structured categories and locales", () => {
    expect(inferQaCategory("반려동물 동반 가능한가요?", "전용 좌석은 없습니다.")).toBe("pet");
    expect(inferQaCategory("픽업은 호텔 로비인가요?", "네, 호텔 로비입니다.")).toBe("pickup");
    expect(inferQaLocale("픽업은 어디인가요?")).toBe("ko");
  });

  it("builds stable dashboard tags", () => {
    expect(buildQaTags({ category: "pickup", tourSlug: "east-signature-nature-core" })).toEqual([
      "support_ticket",
      "auto_draft",
      "pickup",
      "tour:east-signature-nature-core",
    ]);
  });
});

/**
 * Over-redaction is a real failure too — it is just quieter.
 *
 * `BOOKING_RE` matched "ticket office", because `office` is four-plus
 * characters of `[A-Z0-9-]` under the `i` flag. Surfaced by X20: a guide's
 * answer "Behind the ticket office, on the left" was stored as "Behind the
 * [booking], on the left", losing the only useful word in it. Nothing failed;
 * the corpus just quietly filled with sentences that no longer say anything.
 */
describe('sanitizeQaText does not eat ordinary nouns', () => {
  const KEPT = [
    'Behind the ticket office, on the left',
    'Fill in the booking form at the desk',
    'Ask at the reservation desk downstairs',
    'Your order details are in the email',
  ];
  it.each(KEPT)('keeps %s', (text) => {
    expect(sanitizeQaText(text)).toBe(text);
  });

  const REDACTED: Array<[string, string]> = [
    ['about booking ABCD-1234', 'about [booking]'],
    ['ticket A1B2C3 please', '[booking] please'],
    ['order 998877 was refunded', '[booking] was refunded'],
    ['reservation #GYG-55210', '[booking]'],
  ];
  it.each(REDACTED)('still redacts %s', (input, expected) => {
    expect(sanitizeQaText(input)).toBe(expected);
  });
});
