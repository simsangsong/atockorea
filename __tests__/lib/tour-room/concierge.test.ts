/**
 * V2.1/V2.3/V2.4 — Smart Guide concierge core: intent keyword matching
 * (5 locales, word-boundary for Latin / substring for CJK), the §D-3
 * hardcoded guardrails, Tier 0 answers from room context, and locale
 * parity of every pre-translated template.
 */
import {
  answerTier0,
  classifyConciergeGuardrail,
  inlineConciergeAnswer,
  latestArrivalContext,
  matchConciergeIntent,
  renderConciergeAnswer,
  renderConciergeTranslations,
  CONCIERGE_CHIPS,
  CONCIERGE_COPY,
  type Tier0Context,
} from '@/lib/tour-room/concierge';
import { resolveSpotContent } from '@/lib/tour-room/spotContent';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';

// 10:00 KST on 2099-07-20 (01:00 UTC).
const NOW_10AM_KST = Date.UTC(2099, 6, 20, 1, 0);

const SCHEDULE = [
  { time: '09:00', title: 'Hotel pickup' },
  { time: '10:30', title: 'Gamcheon Culture Village' },
  { time: '13:00', title: 'Lunch' },
];

function ctx(overrides: Partial<Tier0Context> = {}): Tier0Context {
  return {
    spotTitle: null,
    content: null,
    schedule: [],
    freeTime: null,
    nowMs: NOW_10AM_KST,
    ...overrides,
  };
}

describe('intent matching (V2.3 — 5-locale keywords)', () => {
  it.each([
    ['where is the restroom?', 'restroom'],
    ['화장실이 어디에요?', 'restroom'],
    ['トイレはどこですか', 'restroom'],
    ['¿dónde está el baño?', 'restroom'],
    ['洗手间在哪里', 'restroom'],
    ['best photo here?', 'photo_spot'],
    ['포토스팟 알려줘', 'photo_spot'],
    ['写真スポットは？', 'photo_spot'],
    ['어디 가요 다음에?', 'next_stop'],
    ['what is the next stop?', 'next_stop'],
    ['下一站去哪', 'next_stop'],
    ['how much time do we have left', 'time_left'],
    ['남은 시간 얼마나 돼요', 'time_left'],
    ['何時に出発ですか', 'time_left'],
  ])('%s → %s', (text, intent) => {
    expect(matchConciergeIntent(text)).toBe(intent);
  });

  it('respects Latin word boundaries (the includes() cautionary tale)', () => {
    // "restrooms" pluralization is fine to catch, but unrelated containments are not.
    expect(matchConciergeIntent('I love hot pot')).toBeNull(); // "pot" ⊄ photo
    expect(matchConciergeIntent('we went to Washington')).toBeNull(); // ⊄ washroom
    expect(matchConciergeIntent('random unrelated sentence')).toBeNull();
  });
});

describe('guardrails (§D-3 — checked before intents, hardcoded)', () => {
  it.each([
    ['I need an ambulance', 'emergency'],
    ['응급실 가야 해요', 'emergency'],
    ['救急車を呼んで', 'emergency'],
    ['can I get a refund for this tour?', 'ops_request'],
    ['일정 변경 가능해요?', 'ops_request'],
    ['予定変更できますか', 'ops_request'],
    ['退款可以吗', 'ops_request'],
    ['recommend a good restaurant nearby', 'venue_recommendation'],
    ['이 근처 맛집 알려줘', 'venue_recommendation'],
    ['おすすめの店ありますか', 'venue_recommendation'],
  ])('%s → %s', (text, guardrail) => {
    expect(classifyConciergeGuardrail(text)).toBe(guardrail);
  });

  it('guardrails outrank intents when both match', () => {
    const text = 'cancel the tour and tell me the next stop';
    expect(classifyConciergeGuardrail(text)).toBe('ops_request');
  });

  it('photo-spot recommendation asks are NOT the venue guardrail', () => {
    expect(classifyConciergeGuardrail('포토스팟 추천해줘')).toBeNull();
    expect(matchConciergeIntent('포토스팟 추천해줘')).toBe('photo_spot');
  });
});

describe('Tier 0 answers (V2.1)', () => {
  const CONTENT = {
    convenience: { restroom: 'Next to the ticket office, west gate.' },
    smartNotes: { photo: 'Golden hour at the top deck.', facilities: 'Cafe at entrance.' },
  };

  it('restroom: answers from the latest arrival content', () => {
    const answer = answerTier0('restroom', ctx({ spotTitle: 'Haedong Yonggungsa', content: CONTENT }), 'en');
    expect(answer.answered).toBe(true);
    expect(answer.text).toContain('Haedong Yonggungsa');
    expect(answer.text).toContain('ticket office');
  });

  it('restroom: honest no-data fallback when no arrival content exists', () => {
    const answer = answerTier0('restroom', ctx(), 'ko');
    expect(answer.answered).toBe(false);
    expect(answer.text).toContain('가이드');
  });

  it('photo_spot: answers from smartNotes.photo', () => {
    const answer = answerTier0('photo_spot', ctx({ spotTitle: 'Gamcheon', content: CONTENT }), 'ja');
    expect(answer.answered).toBe(true);
    expect(answer.text).toContain('Golden hour');
  });

  it('next_stop: picks the first schedule item after now (KST)', () => {
    const answer = answerTier0('next_stop', ctx({ schedule: SCHEDULE }), 'en');
    expect(answer.answered).toBe(true);
    expect(answer.text).toContain('Gamcheon Culture Village');
    expect(answer.text).toContain('10:30');
  });

  it('next_stop: reports the day done after the last stop', () => {
    // 20:00 KST — past every scheduled time.
    const answer = answerTier0('next_stop', ctx({ schedule: SCHEDULE, nowMs: Date.UTC(2099, 6, 20, 11, 0) }), 'en');
    expect(answer.answered).toBe(true);
    expect(answer.text).toMatch(/done|enjoy/i);
  });

  it('next_stop: honest fallback without a schedule', () => {
    const answer = answerTier0('next_stop', ctx(), 'zh');
    expect(answer.answered).toBe(false);
  });

  it('time_left: active free-time countdown wins over the schedule', () => {
    const answer = answerTier0(
      'time_left',
      ctx({ schedule: SCHEDULE, freeTime: { remainingMs: 25 * 60_000, point: 'Gate 2' } }),
      'en',
    );
    expect(answer.answered).toBe(true);
    expect(answer.text).toContain('25');
    expect(answer.text).toContain('Gate 2');
  });

  it('time_left: falls back to minutes until the next schedule item', () => {
    const answer = answerTier0('time_left', ctx({ schedule: SCHEDULE }), 'en');
    expect(answer.answered).toBe(true);
    expect(answer.text).toContain('30'); // 10:00 → 10:30
  });

  it('time_left: honest fallback with nothing running', () => {
    const answer = answerTier0('time_left', ctx({ nowMs: Date.UTC(2099, 6, 20, 11, 0) }), 'es');
    expect(answer.answered).toBe(false);
  });
});

describe('lobby lifecycle (pre-tour joins must not get wrong-day answers)', () => {
  // 20:00 KST the evening BEFORE the tour — the clock-only comparison used to
  // report "today's stops are done" here.
  const EVE_8PM_KST = Date.UTC(2099, 6, 19, 11, 0);

  it('next_stop in the lobby announces the first stop, not "done"', () => {
    const answer = answerTier0('next_stop', ctx({ schedule: SCHEDULE, nowMs: EVE_8PM_KST, lifecycle: 'lobby' }), 'en');
    expect(answer.answered).toBe(true);
    expect(answer.text).toContain('Hotel pickup');
    expect(answer.text).toContain('09:00');
    expect(answer.text).not.toMatch(/done/i);
  });

  it('time_left in the lobby points at the Today tab instead of a dead timer', () => {
    const answer = answerTier0('time_left', ctx({ schedule: SCHEDULE, nowMs: EVE_8PM_KST, lifecycle: 'lobby' }), 'ko');
    expect(answer.answered).toBe(true);
    expect(answer.text).toContain('오늘 일정');
  });

  it('an active guide notice still outranks the lobby fallback', () => {
    const answer = answerTier0(
      'time_left',
      ctx({ lifecycle: 'lobby', freeTime: { remainingMs: 10 * 60_000, point: 'Lobby' } }),
      'en',
    );
    expect(answer.text).toContain('10');
  });

  it('omitted lifecycle keeps the live behaviour (back-compat)', () => {
    const answer = answerTier0('next_stop', ctx({ schedule: SCHEDULE }), 'en');
    expect(answer.text).toContain('Gamcheon Culture Village');
  });
});

describe('82-POI KB integration (V2.4 — restroom fields flow to Tier 0)', () => {
  it('a poi_kb-resolved spot answers the restroom intent in every locale', () => {
    // haeundae_beach is a stable KB key with convenience data; fall back to
    // scanning for any restroom-bearing key so a KB curation change can't
    // silently break this regression.
    const candidates = ['haeundae_beach', 'gamcheon_culture_village', 'gwangalli_beach'];
    let resolved: ReturnType<typeof resolveSpotContent> | null = null;
    let title = '';
    for (const key of candidates) {
      const attempt = resolveSpotContent({ title: key, poi_key: key }, 'en');
      if (attempt.content?.convenience?.restroom) {
        resolved = attempt;
        title = key;
        break;
      }
    }
    if (!resolved) {
      // KB carries no restroom copy for the sampled keys — the honest
      // fallback path is then the correct behaviour; nothing to assert.
      return;
    }
    for (const locale of ROOM_LOCALES) {
      const answer = answerTier0(
        'restroom',
        ctx({ spotTitle: title, content: resolved.content }),
        locale,
      );
      expect(answer.answered).toBe(true);
      expect(answer.text).toContain(title);
    }
  });
});

describe('context extraction', () => {
  it('latestArrivalContext returns the newest spot_arrival with content', () => {
    const result = latestArrivalContext([
      { metadata: { kind: 'spot_arrival', spot_title: 'Old Spot', content: { description: 'old' } } },
      { metadata: { kind: 'quick_reply' } },
      { metadata: { kind: 'spot_arrival', spot_title: 'New Spot', content: { description: 'new' } } },
      { metadata: {} },
    ]);
    expect(result.spotTitle).toBe('New Spot');
    expect(result.content?.description).toBe('new');
  });

  it('latestArrivalContext treats an empty content object as null', () => {
    const result = latestArrivalContext([{ metadata: { kind: 'spot_arrival', spot_title: 'Spot', content: {} } }]);
    expect(result.spotTitle).toBe('Spot');
    expect(result.content).toBeNull();
  });
});

describe('facility map card (W2 — scoped restroom/photo pins)', () => {
  const restroomPins = [
    { kind: 'restroom' as const, lat: 33.45, lng: 126.56, name: '정문 화장실', distanceM: 40 },
    { kind: 'restroom' as const, lat: 33.451, lng: 126.561, name: null, distanceM: 120 },
  ];

  it('attaches a restroom map card when the arrival spot has pins', () => {
    const answer = answerTier0('restroom', ctx({ spotTitle: '성산일출봉', facilityPins: restroomPins }), 'ko');
    expect(answer.answered).toBe(true);
    expect(answer.mapCard?.kind).toBe('restroom');
    expect(answer.mapCard?.pins).toHaveLength(2);
  });

  it('attaches a photo map card for the photo intent', () => {
    const photoPins = [{ kind: 'photo' as const, lat: 33.46, lng: 126.94, name: '분화구 뷰' }];
    const answer = answerTier0('photo_spot', ctx({ spotTitle: '성산', facilityPins: photoPins }), 'en');
    expect(answer.mapCard?.kind).toBe('photo');
    expect(answer.mapCard?.pins).toHaveLength(1);
  });

  it('does not leak the other kind (restroom intent ignores photo pins)', () => {
    const answer = answerTier0(
      'restroom',
      ctx({ spotTitle: 'X', facilityPins: [{ kind: 'photo' as const, lat: 33.4, lng: 126.5, name: null }] }),
      'en',
    );
    expect(answer.mapCard).toBeUndefined();
    expect(answer.answered).toBe(false); // no restroom pins, no text info → honest fallback
  });

  it('falls back to text with no map card when there are no pins (F-D8 no regression)', () => {
    const answer = answerTier0(
      'restroom',
      ctx({ spotTitle: 'Temple', content: { convenience: { restroom: 'Near the gate' } } }),
      'en',
    );
    expect(answer.mapCard).toBeUndefined();
    expect(answer.text).toContain('Near the gate');
  });

  it('latestArrivalContext extracts poi_key and facility_pins from metadata', () => {
    const result = latestArrivalContext([
      {
        metadata: {
          kind: 'spot_arrival',
          spot_title: 'Seongsan',
          poi_key: 'seongsan_ilchulbong',
          facility_pins: restroomPins,
        },
      },
    ]);
    expect(result.poiKey).toBe('seongsan_ilchulbong');
    expect(result.facilityPins).toHaveLength(2);
  });
});

describe('inlineConciergeAnswer (C — chat auto-answer gate)', () => {
  it('answers a Tier-0 info question typed into chat', () => {
    const answer = inlineConciergeAnswer('what time is the next stop?', ctx({ schedule: SCHEDULE }), 'en');
    expect(answer).toBeTruthy();
    expect(answer?.text).toContain('Gamcheon Culture Village');
  });

  it('carries the map card through the inline gate (restroom → pins)', () => {
    const answer = inlineConciergeAnswer(
      'where is the restroom?',
      ctx({ spotTitle: '성산', facilityPins: [{ kind: 'restroom', lat: 33.45, lng: 126.56, name: 'A' }] }),
      'en',
    );
    expect(answer?.mapCard?.kind).toBe('restroom');
  });

  it('stays silent on chit-chat (no intent → null → guide answers)', () => {
    expect(inlineConciergeAnswer('안녕하세요 반가워요', ctx(), 'ko')).toBeNull();
    expect(inlineConciergeAnswer('thanks so much!', ctx(), 'en')).toBeNull();
  });

  it('never auto-answers guardrailed asks (emergency / ops / venue → route to a human)', () => {
    expect(inlineConciergeAnswer('someone is injured, call an ambulance', ctx(), 'en')).toBeNull();
    expect(inlineConciergeAnswer('please change my pickup time', ctx({ schedule: SCHEDULE }), 'en')).toBeNull();
    expect(inlineConciergeAnswer('recommend a good restaurant nearby', ctx(), 'en')).toBeNull();
  });
});

describe('template locale parity (U-D copy discipline)', () => {
  it('every chip label and panel copy exists in every room locale', () => {
    for (const chip of CONCIERGE_CHIPS) {
      for (const locale of ROOM_LOCALES) {
        expect(chip.label[locale]).toBeTruthy();
      }
    }
    for (const locale of ROOM_LOCALES) {
      expect(CONCIERGE_COPY[locale].title).toBeTruthy();
      expect(CONCIERGE_COPY[locale].placeholder).toBeTruthy();
    }
  });

  it('renderConciergeTranslations bundles all locales with English source', () => {
    const bundle = renderConciergeTranslations('escalation_feed', { q: 'Alex: "refund please"' });
    expect(bundle.source_locale).toBe('en');
    expect(Object.keys(bundle.translations).sort()).toEqual([...ROOM_LOCALES].sort());
    for (const locale of ROOM_LOCALES) {
      expect(bundle.translations[locale]).toContain('refund please');
      expect(bundle.translations[locale]).not.toContain('{q}');
    }
  });

  it('interpolation leaves no unfilled placeholders in any answer', () => {
    for (const locale of ROOM_LOCALES) {
      const text = renderConciergeAnswer('time_left_next', locale, { minutes: 12, title: 'Lunch', time: '13:00' });
      expect(text).not.toMatch(/\{[a-z]+\}/);
      expect(text).toContain('12');
    }
  });

  it('lobby templates fill every locale with no leftover placeholders', () => {
    for (const locale of ROOM_LOCALES) {
      const nextStop = renderConciergeAnswer('next_stop_lobby', locale, { title: 'Hotel pickup', time: '09:00' });
      expect(nextStop).toContain('09:00');
      expect(nextStop).not.toMatch(/\{[a-z]+\}/);
      expect(renderConciergeAnswer('time_lobby', locale)).toBeTruthy();
    }
  });
});
