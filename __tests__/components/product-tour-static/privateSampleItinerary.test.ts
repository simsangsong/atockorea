/**
 * T1-4 — the Jeju private charter detail page must surface the out-of-Jeju-City
 * pickup surcharge (₩60,000, cash-or-booking), matching how the Busan/Seoul
 * private tours already show their region surcharges.
 */
import { getPrivateSampleItineraryConfig } from '@/components/product-tour-static/_shared/privateSampleItinerary';

describe('private-tour region surcharge rules', () => {
  it('the Jeju charter exposes an emphasised ₩60,000 pickup surcharge rule', () => {
    const config = getPrivateSampleItineraryConfig('jeju-island-private-car-charter-tour');
    expect(config).not.toBeNull();
    const surcharge = config!.rules.find((r) => r.text.ko.includes('60,000') || r.text.en.includes('60,000'));
    expect(surcharge).toBeDefined();
    expect(surcharge!.emphasis).toBe(true);
    expect(surcharge!.text.ko).toContain('제주시 외');
    expect(surcharge!.text.en.toLowerCase()).toContain('jeju city');
  });

  it('the Busan and Seoul charters still carry their own surcharge rules', () => {
    const busan = getPrivateSampleItineraryConfig('busan-private-car-charter-cruise-shore');
    expect(busan!.rules.some((r) => r.emphasis && r.text.en.includes('70,000'))).toBe(true);
    const seoul = getPrivateSampleItineraryConfig('seoul-suburbs-private-chartered-car-10hr');
    expect(seoul!.rules.some((r) => r.emphasis && r.text.en.includes('50,000'))).toBe(true);
  });

  it('non-private slugs return null (section hidden)', () => {
    expect(getPrivateSampleItineraryConfig('some-group-bus-tour')).toBeNull();
  });
});

describe('private-tour inclusions', () => {
  /**
   * The operator's own listing puts the driver-guide, vehicle, fuel, tolls,
   * parking and tax inside the fee; admissions, meals and tips outside it. The
   * rules block used to list parking as a guest expense — wrong, and wrong in
   * the guest's disfavour.
   */
  it.each([
    'jeju-island-private-car-charter-tour',
    'busan-private-car-charter-cruise-shore',
    'seoul-suburbs-private-chartered-car-10hr',
    'incheon-seoul-private-car-shore-excursion-cruise',
  ])('%s states parking/tolls included and admissions/meals excluded', (slug) => {
    const rules = getPrivateSampleItineraryConfig(slug)!.rules;
    const included = rules.find((r) => r.text.en.startsWith('Included in the price:'));
    expect(included).toBeDefined();
    expect(included!.text.en).toMatch(/parking/i);
    expect(included!.text.en).toMatch(/tolls/i);
    expect(included!.text.ko).toContain('주차료');

    const excluded = rules.find((r) => r.text.en.startsWith('Not included:'));
    expect(excluded).toBeDefined();
    expect(excluded!.text.en).toMatch(/admission/i);
    expect(excluded!.text.en).toMatch(/meals/i);

    // No rule may claim parking is a personal expense.
    expect(rules.some((r) => /parking (fees )?are personal/i.test(r.text.en))).toBe(false);
  });
});

describe('Jeju sample itineraries', () => {
  const jeju = () => getPrivateSampleItineraryConfig('jeju-island-private-car-charter-tour')!;

  it('offers the east / southwest / south courses', () => {
    expect(jeju().samples.map((s) => s.id)).toEqual([
      'jeju-east',
      'jeju-southwest',
      'jeju-south',
    ]);
  });

  it('names real places instead of numbered placeholders', () => {
    for (const sample of jeju().samples) {
      const stops = sample.slots.filter((s) => s.kind === 'stop');
      expect(stops.length).toBeGreaterThanOrEqual(5);
      for (const stop of stops) {
        expect(stop.title.en).not.toMatch(/itinerary slot/i);
        expect(stop.note?.en ?? '').not.toMatch(/to be added/i);
      }
    }
  });

  /**
   * The section is the one place a charter buyer can picture the day. Oedolgae
   * is the single stop with no photograph on the site — it renders a numbered
   * tile rather than borrowing another spot's picture, so the guard allows
   * exactly one photo-less stop per course.
   */
  it('carries a photo on all but at most one stop per course', () => {
    for (const sample of jeju().samples) {
      const stops = sample.slots.filter((s) => s.kind === 'stop');
      const missing = stops.filter((s) => !s.image);
      expect(missing.length).toBeLessThanOrEqual(1);
      for (const stop of stops) {
        if (stop.image) expect(stop.image).toMatch(/^\/images\/tours\//);
      }
    }
  });
});

describe('locale coverage', () => {
  /**
   * `pickLocalized` falls back to English for any missing locale, so a gap here
   * renders an English block inside an otherwise translated Chinese/Japanese
   * page — exactly what shipped before.
   */
  const LOCALES = ['ja', 'zh', 'zh-TW', 'es'] as const;

  function texts(slug: string) {
    const c = getPrivateSampleItineraryConfig(slug)!;
    const out = [c.title, c.subtitle, c.rulesTitle, ...c.rules.map((r) => r.text)];
    for (const s of c.samples) {
      out.push(s.label);
      if (s.blurb) out.push(s.blurb);
      for (const slot of s.slots) {
        out.push(slot.title);
        if (slot.note) out.push(slot.note);
        if (slot.stay) out.push(slot.stay);
      }
    }
    return out;
  }

  it.each([
    'jeju-island-private-car-charter-tour',
    'busan-private-car-charter-cruise-shore',
    'seoul-suburbs-private-chartered-car-10hr',
    'incheon-seoul-private-car-shore-excursion-cruise',
  ])('%s has every string in all six locales', (slug) => {
    const missing: string[] = [];
    for (const t of texts(slug)) {
      if (!t.ko) missing.push(`ko :: ${t.en}`);
      if (!t.en) missing.push(`en :: ${t.ko}`);
      for (const loc of LOCALES) {
        if (!t[loc]) missing.push(`${loc} :: ${t.en}`);
      }
    }
    expect(missing).toEqual([]);
  });

  /** A Korean place name left inside a Chinese label reads as a half-done translation. */
  it.each([
    'jeju-island-private-car-charter-tour',
    'busan-private-car-charter-cruise-shore',
    'seoul-suburbs-private-chartered-car-10hr',
    'incheon-seoul-private-car-shore-excursion-cruise',
  ])('%s leaves no Hangul in the non-Korean strings', (slug) => {
    const HANGUL = /[가-힣]/;
    const leaks: string[] = [];
    for (const t of texts(slug)) {
      for (const loc of ['en', ...LOCALES] as const) {
        const v = t[loc];
        if (v && HANGUL.test(v)) leaks.push(`${loc} :: ${v}`);
      }
    }
    expect(leaks).toEqual([]);
  });
});
