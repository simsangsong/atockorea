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
