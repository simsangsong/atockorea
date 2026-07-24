/**
 * @jest-environment node
 *
 * 셀프 스케줄 토큰 — 바인딩 결정 5의 "룸 토큰과 분리" 불변식이 핵심 검사다.
 * 두 체계가 서로의 토큰을 받아주면 scope 혼선이 실제 권한 상승이 된다.
 */

import {
  DEFAULT_TTL_SECONDS,
  hashGuideScheduleToken,
  signGuideScheduleToken,
  verifyGuideScheduleToken,
} from '@/lib/ops/guides/selfToken';
import { signGuideRoomToken, verifyRoomToken } from '@/lib/tour-room/token';

const SECRET_ENV = 'OPS_GUIDE_SCHEDULE_TOKEN_SECRET';
const PREV_ENV = 'OPS_GUIDE_SCHEDULE_TOKEN_SECRET_PREV';

describe('guide schedule token', () => {
  const before = { secret: process.env[SECRET_ENV], prev: process.env[PREV_ENV] };

  beforeEach(() => {
    process.env[SECRET_ENV] = 'schedule-secret-1';
    delete process.env[PREV_ENV];
  });

  afterAll(() => {
    if (before.secret === undefined) delete process.env[SECRET_ENV];
    else process.env[SECRET_ENV] = before.secret;
    if (before.prev === undefined) delete process.env[PREV_ENV];
    else process.env[PREV_ENV] = before.prev;
  });

  it('round-trips guideId and name', () => {
    const { token, payload } = signGuideScheduleToken({ guideId: 'g-1', name: '김가이드' });
    expect(payload.scope).toBe('guide-schedule');
    const verified = verifyGuideScheduleToken(token)!;
    expect(verified.guideId).toBe('g-1');
    expect(verified.name).toBe('김가이드');
  });

  it('defaults to a season-long TTL and honours an explicit one', () => {
    const { payload } = signGuideScheduleToken({ guideId: 'g-1' });
    expect(payload.exp - payload.iat).toBe(DEFAULT_TTL_SECONDS);
    expect(payload.name).toBe('가이드');
    const short = signGuideScheduleToken({ guideId: 'g-1', ttlSeconds: 60 });
    expect(short.payload.exp - short.payload.iat).toBe(60);
  });

  it('rejects a tampered payload', () => {
    const { token } = signGuideScheduleToken({ guideId: 'g-1' });
    const [body, sig] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ scope: 'guide-schedule', guideId: 'someone-else', name: 'x', iat: 0, exp: 9_999_999_999 }),
    ).toString('base64url');
    expect(verifyGuideScheduleToken(`${forged}.${sig}`)).toBeNull();
    expect(verifyGuideScheduleToken(`${body}.deadbeef`)).toBeNull();
    expect(verifyGuideScheduleToken('garbage')).toBeNull();
    expect(verifyGuideScheduleToken(null)).toBeNull();
  });

  it('rejects an expired token', () => {
    const { token } = signGuideScheduleToken({ guideId: 'g-1', ttlSeconds: 1 });
    jest.useFakeTimers().setSystemTime(new Date(Date.now() + 5000));
    try {
      expect(verifyGuideScheduleToken(token)).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects a token signed with another secret, and accepts the previous one during rotation', () => {
    const { token } = signGuideScheduleToken({ guideId: 'g-1' });
    process.env[SECRET_ENV] = 'schedule-secret-2';
    expect(verifyGuideScheduleToken(token)).toBeNull();
    process.env[PREV_ENV] = 'schedule-secret-1';
    expect(verifyGuideScheduleToken(token)?.guideId).toBe('g-1');
  });

  // 바인딩 결정 5 — 두 토큰 체계는 서로를 통과시키지 않는다.
  describe('room-token separation', () => {
    const roomSecretBefore = process.env.TOUR_ROOM_TOKEN_SECRET;
    beforeEach(() => {
      process.env.TOUR_ROOM_TOKEN_SECRET = 'room-secret';
    });
    afterAll(() => {
      if (roomSecretBefore === undefined) delete process.env.TOUR_ROOM_TOKEN_SECRET;
      else process.env.TOUR_ROOM_TOKEN_SECRET = roomSecretBefore;
    });

    it('does not accept a tour-room guide token', () => {
      const future = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
      const { token } = signGuideRoomToken({ tourId: 't-1', tourDate: future, displayName: '가이드' });
      expect(verifyGuideScheduleToken(token)).toBeNull();
    });

    it('is not accepted by the tour-room verifier', () => {
      const { token } = signGuideScheduleToken({ guideId: 'g-1' });
      expect(verifyRoomToken(token)).toBeNull();
    });

    // 시크릿을 실수로 같게 설정해도 scope에서 한 번 더 걸린다 (이중 방어).
    it('still rejects a room token when both secrets are misconfigured to match', () => {
      process.env.TOUR_ROOM_TOKEN_SECRET = 'shared-by-mistake';
      process.env[SECRET_ENV] = 'shared-by-mistake';
      const future = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
      const { token } = signGuideRoomToken({ tourId: 't-1', tourDate: future, displayName: '가이드' });
      expect(verifyGuideScheduleToken(token)).toBeNull();
    });
  });

  it('hashes a token for logging instead of printing it', () => {
    const { token } = signGuideScheduleToken({ guideId: 'g-1' });
    const hash = hashGuideScheduleToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token.slice(0, 12));
  });
});
