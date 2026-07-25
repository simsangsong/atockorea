/**
 * 손님 안내 메시지 조립 — M1~M3.
 *
 * 이 스위트가 막는 사고는 두 가지다:
 *   1. **링크 자리가 빈 채로 나가는 메시지.** 이 체인에서 가장 흔하고, 조용히
 *      보내면 손님이 "링크가 없어요"라고 연락해 올 때까지 아무도 모른다.
 *   2. **없는 날씨를 있는 척하는 문구.** 예보가 없으면 그 줄은 사라져야 한다 —
 *      "오늘 날씨: " 로 끝나는 문장이 나가면 손님은 우리가 빠뜨렸다고 읽는다.
 */

import {
  canEmail,
  composeForRecipient,
  planBulkEmail,
  resolveTemplate,
  weatherVars,
  type RecipientInput,
} from '../guestMessage';
import type { DailyForecast } from '@/lib/ops/weather/forecast';

const FORECAST: DailyForecast = {
  city: 'Seoul',
  date: '2026-08-03',
  tempMinC: 22,
  tempMaxC: 29,
  precipProbability: 60,
  precipMm: 4,
  weatherCode: 61,
  windMaxKph: 10,
};

function recipient(over: Partial<RecipientInput> = {}): RecipientInput {
  return {
    bookingId: 'bk-1',
    guestName: '김손님',
    email: 'guest@example.com',
    locale: 'ko',
    pickupPoint: '명동역 2번 출구',
    pickupTime: '08:30',
    roomLink: 'https://atockorea.com/tour-mode/room/bk-1?rt=tok',
    ...over,
  };
}

const CTX = { tourName: '제주 동부 일일투어', tourDate: '2026-08-03', operatorName: 'AtoC Korea' };

describe('resolveTemplate', () => {
  it('prefers the per-tour override', () => {
    const r = resolveTemplate({ tour: { body: 'tour body', subject: 'tour subject' }, tenant: { body: 'tenant' }, code: 'code' });
    expect(r).toMatchObject({ body: 'tour body', subject: 'tour subject', source: 'tour' });
  });

  it('falls back to the tenant template, then the code preset', () => {
    expect(resolveTemplate({ tenant: { body: 'tenant' }, code: 'code' }).source).toBe('tenant');
    expect(resolveTemplate({ code: 'code' }).source).toBe('code');
  });

  it('treats a blank override as "not configured" rather than an empty message', () => {
    // 실수로 비워 둔 행이 코드 프리셋을 가려 손님에게 빈 메시지가 나가면 안 된다.
    const r = resolveTemplate({ tour: { body: '   ' }, tenant: { body: '' }, code: 'code' });
    expect(r).toMatchObject({ body: 'code', source: 'code' });
  });
});

describe('weatherVars', () => {
  it('is null on both fields when there is no forecast', () => {
    expect(weatherVars(null, 'ko')).toEqual({ weather: null, clothing: null });
    expect(weatherVars(undefined, 'ko')).toEqual({ weather: null, clothing: null });
  });

  it('renders in the guest locale, not ours', () => {
    expect(weatherVars(FORECAST, 'ja').weather).toContain('雨');
    expect(weatherVars(FORECAST, 'ko').weather).toContain('비');
  });
});

describe('composeForRecipient — the weather line', () => {
  const template = {
    body: ['안녕하세요 {guest_name}님', '집합 {pickup_time} · {pickup_point}', '날씨 {weather}', '{clothing}', '링크 {room_link}'].join('\n'),
  };

  it('fills the weather and clothing lines when a forecast exists', () => {
    const out = composeForRecipient(template, recipient(), { ...CTX, forecast: FORECAST });
    expect(out.body).toContain('22–29°C');
    expect(out.body).toContain('우산');
  });

  it('removes the weather lines entirely when there is no forecast', () => {
    // '날씨 ' 로 끝나는 줄이 남으면 손님은 우리가 빠뜨렸다고 읽는다.
    const out = composeForRecipient(template, recipient(), { ...CTX, forecast: null });
    expect(out.body).not.toContain('날씨');
    expect(out.body).toContain('집합 08:30');
    expect(out.body).toContain('링크 https://');
  });

  it('keeps the lines whose tokens do have values', () => {
    const out = composeForRecipient(template, recipient(), { ...CTX, forecast: null });
    expect(out.body.split('\n').filter(Boolean)).toHaveLength(3);
  });
});

describe('composeForRecipient — missing variables', () => {
  const template = { body: '{guest_name}님, 링크: {room_link}' };

  it('reports an empty room link instead of sending a broken message', () => {
    const out = composeForRecipient(template, recipient({ roomLink: null }), CTX);
    expect(out.missing).toContain('{room_link}');
  });

  it('does not count an absent weather as a missing variable', () => {
    // 날씨는 없을 수 있는 정보다 — 이걸 필수로 세면 예보 실패가 발송 전체를 막는다.
    const out = composeForRecipient({ body: '{guest_name} {weather}' }, recipient(), { ...CTX, forecast: null });
    expect(out.missing).toEqual([]);
  });

  it('renders the subject with the same variables as the body', () => {
    const out = composeForRecipient(
      { body: 'hi', subject: '{tour_date} {tour_name} 안내' },
      recipient(),
      CTX,
    );
    expect(out.subject).toBe('2026-08-03 제주 동부 일일투어 안내');
  });
});

describe('canEmail', () => {
  it('accepts a plausible address and rejects the rest', () => {
    expect(canEmail(recipient())).toBe(true);
    expect(canEmail(recipient({ email: null }))).toBe(false);
    expect(canEmail(recipient({ email: '  ' }))).toBe(false);
    expect(canEmail(recipient({ email: 'not-an-email' }))).toBe(false);
  });
});

describe('planBulkEmail', () => {
  const template = { body: '{guest_name}님 링크: {room_link}', subject: '안내' };

  it('separates the sendable from the skipped instead of quietly shrinking the list', () => {
    // 20명 중 17명에게 갔다는 사실을 화면이 말해야 나머지 3명을 사람이 처리한다.
    const plan = planBulkEmail(
      template,
      [
        recipient(),
        recipient({ bookingId: 'bk-2', guestName: '이손님', email: null }),
        recipient({ bookingId: 'bk-3', guestName: '박손님', roomLink: null }),
      ],
      CTX,
    );
    expect(plan.sendable.map((s) => s.bookingId)).toEqual(['bk-1']);
    expect(plan.skipped).toEqual([
      { bookingId: 'bk-2', guestName: '이손님', reason: 'no_email' },
      { bookingId: 'bk-3', guestName: '박손님', reason: 'missing_vars' },
    ]);
  });

  it('refuses to send a message whose link never resolved', () => {
    // 링크 없는 안내 메일은 안 보낸 것보다 나쁘다 — 손님은 받았다고 생각하고 기다린다.
    const plan = planBulkEmail(template, [recipient({ roomLink: null })], CTX);
    expect(plan.sendable).toHaveLength(0);
    expect(plan.skipped[0].reason).toBe('missing_vars');
  });

  it('handles an empty roster without throwing', () => {
    expect(planBulkEmail(template, [], CTX)).toEqual({ sendable: [], skipped: [] });
  });
});
