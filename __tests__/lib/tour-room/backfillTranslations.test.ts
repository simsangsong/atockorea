/**
 * V0.5 — 늦은 합류자 백필. 스태프 팬아웃이 CORE 5종 바닥을 버린 대가로 생기는
 * 구멍(과거 메시지에 그 언어 번역이 없음)을 명시적으로 닫는 장치.
 *
 * @jest-environment node
 */
import {
  backfillRoomLocale,
  messagesMissingLocale,
  BACKFILL_MESSAGE_LIMIT,
} from '@/lib/tour-room/backfillTranslations.server';
import { translateTextForLocales } from '@/lib/openai-server';
import { broadcastToRoom } from '@/lib/tour-room/realtime';

jest.mock('@/lib/openai-server', () => ({ translateTextForLocales: jest.fn() }));
jest.mock('@/lib/tour-room/realtime', () => ({ broadcastToRoom: jest.fn(async () => undefined) }));
const translateMock = translateTextForLocales as jest.Mock;
const broadcastMock = broadcastToRoom as jest.Mock;

const ROOM = { id: 'r1' } as never;

interface Row {
  id: string;
  source_text: string | null;
  translations: Record<string, string> | null;
  target_locales: string[] | null;
}

function fakeDb(rows: Row[]) {
  const updates: Array<{ id: string; values: Record<string, unknown> }> = [];
  const client = {
    updates,
    from() {
      const chain: Record<string, unknown> = {};
      let pendingUpdate: Record<string, unknown> | null = null;
      let pendingId = '';
      chain.select = jest.fn(() => chain);
      chain.eq = jest.fn((col: string, value: string) => {
        if (col === 'id') pendingId = value;
        return chain;
      });
      chain.order = jest.fn(() => chain);
      chain.limit = jest.fn(async () => ({ data: rows, error: null }));
      chain.update = jest.fn((values: Record<string, unknown>) => {
        pendingUpdate = values;
        return chain;
      });
      chain.single = jest.fn(async () => {
        if (pendingUpdate) updates.push({ id: pendingId, values: pendingUpdate });
        return { data: { id: pendingId, ...pendingUpdate }, error: null };
      });
      return chain;
    },
  };
  return client as never as Parameters<typeof backfillRoomLocale>[0] & { updates: typeof updates };
}

beforeEach(() => {
  jest.clearAllMocks();
  translateMock.mockImplementation(async (text: string, locales: string[]) => ({
    source_locale: 'ko',
    translations: Object.fromEntries(locales.map((l) => [l, `${l}:${text}`])),
  }));
});

describe('messagesMissingLocale', () => {
  const rows: Row[] = [
    { id: 'a', source_text: '안녕', translations: { en: 'hi' }, target_locales: ['en'] },
    { id: 'b', source_text: '반가워', translations: { en: 'nice', ja: 'よろしく' }, target_locales: ['en', 'ja'] },
    { id: 'c', source_text: '   ', translations: {}, target_locales: [] },
    { id: 'd', source_text: null, translations: null, target_locales: null },
    { id: 'e', source_text: '또 봐', translations: null, target_locales: null },
  ];

  it('그 언어가 없는, 말할 내용이 있는 메시지만 고른다', () => {
    expect(messagesMissingLocale(rows, 'ja').map((m) => m.id)).toEqual(['a', 'e']);
  });

  it('이미 번역된 것은 건드리지 않는다 (재입장해도 콜이 늘지 않는다)', () => {
    expect(messagesMissingLocale(rows, 'en').map((m) => m.id)).toEqual(['e']);
  });

  it('상한을 지킨다 — 긴 방에 늦게 온 한 명이 수십 콜을 유발하면 안 된다', () => {
    const many: Row[] = Array.from({ length: 100 }, (_, i) => ({
      id: `m${i}`,
      source_text: `말 ${i}`,
      translations: null,
      target_locales: null,
    }));
    expect(messagesMissingLocale(many, 'fr')).toHaveLength(BACKFILL_MESSAGE_LIMIT);
    expect(messagesMissingLocale(many, 'fr', 3)).toHaveLength(3);
  });
});

describe('backfillRoomLocale', () => {
  it('빠진 언어를 메우고 기존 번역은 보존한다', async () => {
    const db = fakeDb([
      { id: 'a', source_text: '안녕', translations: { en: 'hi' }, target_locales: ['en'] },
    ]);
    const result = await backfillRoomLocale(db, ROOM, 'fr');

    expect(result).toMatchObject({ locale: 'fr', repaired: 1 });
    expect(db.updates[0].values.translations).toEqual({ en: 'hi', fr: 'fr:안녕' });
    expect(db.updates[0].values.target_locales).toEqual(['en', 'fr']);
  });

  it('복구한 메시지를 브로드캐스트한다 — 합류자에게 닿는 실제 경로다', async () => {
    const db = fakeDb([{ id: 'a', source_text: '안녕', translations: null, target_locales: null }]);
    await backfillRoomLocale(db, ROOM, 'fr');
    expect(broadcastMock).toHaveBeenCalledTimes(1);
    expect(broadcastMock.mock.calls[0][1]).toBe('message');
  });

  it('메울 것이 없으면 번역 호출이 0이다', async () => {
    const db = fakeDb([{ id: 'a', source_text: '안녕', translations: { fr: 'salut' }, target_locales: ['fr'] }]);
    const result = await backfillRoomLocale(db, ROOM, 'fr');
    expect(result.repaired).toBe(0);
    expect(translateMock).not.toHaveBeenCalled();
  });

  it('한 건이 실패해도 나머지를 계속한다', async () => {
    translateMock
      .mockRejectedValueOnce(new Error('provider down'))
      .mockResolvedValueOnce({ source_locale: 'ko', translations: { fr: 'salut' } });
    const db = fakeDb([
      { id: 'a', source_text: '하나', translations: null, target_locales: null },
      { id: 'b', source_text: '둘', translations: null, target_locales: null },
    ]);
    const result = await backfillRoomLocale(db, ROOM, 'fr');
    expect(result.repaired).toBe(1);
  });

  it('조회 자체가 깨져도 던지지 않는다 — 입장을 막으면 안 된다', async () => {
    const broken = {
      from() {
        throw new Error('db down');
      },
    } as never as Parameters<typeof backfillRoomLocale>[0];
    await expect(backfillRoomLocale(broken, ROOM, 'fr')).resolves.toMatchObject({ repaired: 0 });
  });

  it('빈 로케일은 아무것도 하지 않는다', async () => {
    const db = fakeDb([{ id: 'a', source_text: '안녕', translations: null, target_locales: null }]);
    const result = await backfillRoomLocale(db, ROOM, '');
    expect(result.repaired).toBe(0);
    expect(translateMock).not.toHaveBeenCalled();
  });
});
