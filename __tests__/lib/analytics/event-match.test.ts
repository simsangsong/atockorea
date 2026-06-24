import { eventMatchesFilter, eventMatchesStep } from '@/lib/analytics/event-match';

const ev = {
  event_name: 'purchase',
  payload: { tour_id: 'jeju-1', amount: 100 },
  page_path: '/tour-product/jeju-1',
  locale: 'en',
  device_class: 'mobile',
};

describe('eventMatchesFilter', () => {
  it('matches when filter is empty/absent', () => {
    expect(eventMatchesFilter(ev, null)).toBe(true);
    expect(eventMatchesFilter(ev, undefined)).toBe(true);
    expect(eventMatchesFilter(ev, {})).toBe(true);
  });

  it('matches a payload key/value', () => {
    expect(eventMatchesFilter(ev, { tour_id: 'jeju-1' })).toBe(true);
    expect(eventMatchesFilter(ev, { tour_id: 'busan-2' })).toBe(false);
  });

  it('matches context columns (locale, device_class, page_path)', () => {
    expect(eventMatchesFilter(ev, { locale: 'en' })).toBe(true);
    expect(eventMatchesFilter(ev, { locale: 'ko' })).toBe(false);
    expect(eventMatchesFilter(ev, { device_class: 'mobile' })).toBe(true);
    expect(eventMatchesFilter(ev, { device_class: 'desktop' })).toBe(false);
    expect(eventMatchesFilter(ev, { page_path: '/tour-product/jeju-1' })).toBe(true);
    expect(eventMatchesFilter(ev, { page_path: '/other' })).toBe(false);
  });

  it('supports page_path_like SQL wildcards', () => {
    expect(eventMatchesFilter(ev, { page_path_like: '/tour-product/%' })).toBe(true);
    expect(eventMatchesFilter(ev, { page_path_like: '/tour-product/jeju-_' })).toBe(true);
    expect(eventMatchesFilter(ev, { page_path_like: '/tours/%' })).toBe(false);
    expect(eventMatchesFilter({ ...ev, page_path: null }, { page_path_like: '/x/%' })).toBe(false);
  });

  it('requires ALL filter keys to match (AND semantics)', () => {
    expect(eventMatchesFilter(ev, { tour_id: 'jeju-1', locale: 'en' })).toBe(true);
    expect(eventMatchesFilter(ev, { tour_id: 'jeju-1', locale: 'ko' })).toBe(false);
  });

  it('skips filter entries whose expected value is null/undefined', () => {
    expect(eventMatchesFilter(ev, { tour_id: null, locale: 'en' })).toBe(true);
  });

  it('treats a missing payload as no match for payload keys', () => {
    expect(eventMatchesFilter({ event_name: 'x' }, { tour_id: 'jeju-1' })).toBe(false);
  });
});

describe('eventMatchesStep', () => {
  it('requires the event name to match first', () => {
    expect(eventMatchesStep(ev, { event_name: 'purchase' })).toBe(true);
    expect(eventMatchesStep(ev, { event_name: 'view' })).toBe(false);
  });

  it('combines event name + filter', () => {
    expect(eventMatchesStep(ev, { event_name: 'purchase', filter: { tour_id: 'jeju-1' } })).toBe(true);
    expect(eventMatchesStep(ev, { event_name: 'purchase', filter: { tour_id: 'busan-2' } })).toBe(false);
    expect(eventMatchesStep(ev, { event_name: 'view', filter: { tour_id: 'jeju-1' } })).toBe(false);
  });
});
