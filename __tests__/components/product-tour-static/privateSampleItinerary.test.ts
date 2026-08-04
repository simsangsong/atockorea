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
    // 2026-08-05: was ₩70,000 "including Gyeongju". The policy accordion on the
    // same page states the listing's ₩130,000 out-of-Busan surcharge, and both
    // rendered together. The listing figure wins.
    expect(busan!.rules.some((r) => r.emphasis && r.text.en.includes('130,000'))).toBe(true);
    const seoul = getPrivateSampleItineraryConfig('seoul-suburbs-private-chartered-car-10hr');
    expect(seoul!.rules.some((r) => r.emphasis && r.text.en.includes('50,000'))).toBe(true);
  });

  it('the Busan cruise charter never offers hotel pickup or ships placeholder slots', () => {
    // It is a cruise shore excursion: its own pickup_dropoff.notes say hotel
    // pickup is not offered, yet the sample section rendered "호텔 픽업 (기본)"
    // and five "방문지 추후 추가 예정" slots. Only opening the page showed it.
    const busan = getPrivateSampleItineraryConfig('busan-private-car-charter-cruise-shore');
    const slots = busan!.samples.flatMap((s) => s.slots);
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      const blob = `${slot.title.ko} ${slot.title.en} ${slot.note?.ko ?? ''} ${slot.note?.en ?? ''}`;
      expect(blob).not.toMatch(/호텔|hotel/i);
      expect(blob).not.toMatch(/추후 추가 예정|to be added|일정 슬롯|Itinerary slot/i);
    }
    expect(busan!.rules.some((r) => r.text.ko.includes('투숙 호텔이 기본'))).toBe(false);
  });

  it('non-private slugs return null (section hidden)', () => {
    expect(getPrivateSampleItineraryConfig('some-group-bus-tour')).toBeNull();
  });
});
