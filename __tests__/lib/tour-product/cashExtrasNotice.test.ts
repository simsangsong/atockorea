/**
 * L1 — the disclosure that was missing from every listing.
 *
 * `/extend` (hourly time extension, cash to the guide) is gated on
 * `tours.price_type === 'vehicle'`. Live bookings on vehicle-charter products,
 * queried 2026-07-28: GetYourGuide 3, Klook 2, Viator 1, one test row, direct
 * sales ZERO. So this was never a precaution — the entire population that could
 * be asked for cash during a tour had been told nothing.
 *
 * These tests hold two things: that the sentence exists in every locale a
 * product page can render, and that the condition for showing it is the same
 * condition the billing route uses. The second is the one that rots: if extras
 * ever open up to per-person tours, a listing promise that says otherwise is
 * worse than no listing promise.
 */
import { CASH_EXTRAS_NOTICE, cashExtrasNoticeFor } from '@/lib/tour-product/cashExtrasNotice';
import { TOUR_PRODUCT_PAGE_LOCALES } from '@/lib/tour-product/tourProductPageLocale';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';

describe('cash extras notice — locale coverage', () => {
  it('exists for every locale a product page can render', () => {
    for (const locale of TOUR_PRODUCT_PAGE_LOCALES) {
      expect(typeof CASH_EXTRAS_NOTICE[locale]).toBe('string');
      expect(CASH_EXTRAS_NOTICE[locale].length).toBeGreaterThan(20);
    }
  });

  it('covers every listing locale, and nothing here is unreachable', () => {
    // L2 widened this constant from the six listing locales to all ten room
    // locales, because the confirmation email and the voucher speak the guest's
    // room language. So an exact set equality against the listing locales is no
    // longer the right claim — that would now fail for a correct constant.
    //
    // The two claims that still hold, and that catch the failures that matter:
    const keys = new Set(Object.keys(CASH_EXTRAS_NOTICE));
    for (const locale of TOUR_PRODUCT_PAGE_LOCALES) {
      // 1. Nothing a listing can render is missing.
      expect({ locale, present: keys.has(locale) }).toEqual({ locale, present: true });
    }
    // 2. Nothing here is a language no surface can reach. `ROOM_LOCALES` is the
    //    widest audience the sentence has, so anything outside it is dead copy —
    //    and dead copy is what stops being maintained.
    for (const key of keys) {
      expect({ key, reachable: (ROOM_LOCALES as readonly string[]).includes(key) }).toEqual({
        key,
        reachable: true,
      });
    }
    expect(keys.size).toBe(ROOM_LOCALES.length);
  });

  it('says all three things in every language: optional, cash, on the day', () => {
    // Checked per language rather than by keyword-matching English, because a
    // translation that quietly drops "optional" turns a courtesy into a fee.
    const required: Record<string, RegExp[]> = {
      en: [/optional/i, /cash/i, /guide/i],
      ko: [/선택/, /현금/, /가이드/],
      ja: [/オプション/, /現金/, /ガイド/],
      zh: [/另行选择|可选/, /现金/, /导游/],
      'zh-TW': [/另行選擇|可選/, /現金/, /導遊/],
      es: [/opcional/i, /efectivo/i, /guía/i],
      // L2 added these four for the confirmation email and the voucher. They
      // are held to the same three words, not merely to "differs from English".
      fr: [/facultati/i, /espèces/i, /guide/i],
      de: [/optional/i, /\bbar\b/i, /Reiseleitung|Guide/],
      ru: [/дополнительн/i, /наличными/i, /гиду|гид/i],
      it: [/facoltativ/i, /contanti/i, /guida/i],
    };
    // Every locale in the constant has to appear above — otherwise a new one
    // slips in checked by nothing.
    expect(Object.keys(required).sort()).toEqual(Object.keys(CASH_EXTRAS_NOTICE).sort());
    for (const [locale, patterns] of Object.entries(required)) {
      const text = CASH_EXTRAS_NOTICE[locale as keyof typeof CASH_EXTRAS_NOTICE];
      for (const pattern of patterns) {
        expect(`${locale}: ${text}`).toMatch(pattern);
      }
    }
  });
});

describe('cash extras notice — when it applies', () => {
  it('🔴 shows only for vehicle-charter products, mirroring /extend', () => {
    expect(cashExtrasNoticeFor('vehicle', 'en')).toBe(CASH_EXTRAS_NOTICE.en);
    // A per-person tour cannot produce one of these charges, so claiming it can
    // would be its own kind of wrong.
    expect(cashExtrasNoticeFor('person', 'en')).toBeNull();
    expect(cashExtrasNoticeFor('group', 'en')).toBeNull();
    expect(cashExtrasNoticeFor(null, 'en')).toBeNull();
    expect(cashExtrasNoticeFor(undefined, 'en')).toBeNull();
  });

  it('returns the requested language', () => {
    expect(cashExtrasNoticeFor('vehicle', 'ko')).toBe(CASH_EXTRAS_NOTICE.ko);
    expect(cashExtrasNoticeFor('vehicle', 'zh-TW')).toBe(CASH_EXTRAS_NOTICE['zh-TW']);
  });
});
