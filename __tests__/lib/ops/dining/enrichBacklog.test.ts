/**
 * 손님이 안 내기로 한 번역 비용을, 누군가는 낸다.
 *
 * `collectCell` 은 보여줄 만큼만 즉시 번역하고 나머지는 미번역으로 저장한다.
 * 그 거래의 나머지 절반이 `enrichPendingPlaces`(주간 flywheel)다. 절반만 남으면
 * 조용한 품질 저하가 된다 — 카드는 계속 뜨는데 이름이 영영 한국어로 남는다.
 * 그래서 "미룬다"와 "갚는다"를 한 파일에서 같이 못박는다.
 */
import { enrichPendingPlaces, SYNC_ENRICH_LIMIT } from '@/lib/ops/dining/cache.server';
import { translateAndEnrichPlaces } from '@/lib/ops/dining/translate.server';
import type { RoomDbClient } from '@/lib/tour-room/access';

jest.mock('@/lib/ops/dining/translate.server', () => ({
  translateAndEnrichPlaces: jest.fn(),
}));
const translateMock = translateAndEnrichPlaces as jest.Mock;

type Row = { place_key: string; name: string };

/** 미번역 행을 돌려주고, 어떤 update 가 나갔는지 기록한다. */
function backlogDb(pending: Row[]) {
  const updates: Array<{ key: string; values: Record<string, unknown> }> = [];
  let readFilters: Record<string, unknown> = {};
  const db = {
    updates,
    readFilters,
    from() {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.is = (col: string, val: unknown) => {
        readFilters[`is:${col}`] = val;
        return chain;
      };
      chain.gt = (col: string) => {
        readFilters[`gt:${col}`] = true;
        return chain;
      };
      chain.limit = (n: number) => {
        readFilters.limit = n;
        return Promise.resolve({ data: pending, error: null });
      };
      chain.update = (values: Record<string, unknown>) => ({
        eq: (_col: string, key: string) => {
          updates.push({ key, values });
          return Promise.resolve({ error: null });
        },
      });
      return chain;
    },
  };
  return db;
}

beforeEach(() => {
  jest.clearAllMocks();
  translateMock.mockImplementation(async (rows: Array<{ place_key: string }>) =>
    rows.map((r) => ({ ...r, name_i18n: { en: `Shop ${r.place_key}` }, signature_menus: [] })),
  );
});

describe('enrichPendingPlaces — 미룬 번역 갚기', () => {
  it('미번역 행만 골라 이름을 채운다', async () => {
    const db = backlogDb([
      { place_key: 'kakao:1', name: '가게1' },
      { place_key: 'kakao:2', name: '가게2' },
    ]);
    const result = await enrichPendingPlaces(db as unknown as RoomDbClient);

    expect(result).toEqual({ found: 2, enriched: 2 });
    // 대상 선정: enriched_at 이 NULL 이고 아직 만료되지 않은 행.
    expect(db.readFilters['is:enriched_at']).toBeNull();
    expect(db.readFilters['gt:expires_at']).toBe(true);
    expect(db.updates.map((u) => u.key)).toEqual(['kakao:1', 'kakao:2']);
    expect(db.updates[0].values).toMatchObject({ name_i18n: { en: 'Shop kakao:1' } });
  });

  it('모델이 아무것도 못 내도 도장은 찍는다 — 매주 다시 시도하지 않도록', async () => {
    translateMock.mockImplementation(async (rows: Array<{ place_key: string }>) =>
      rows.map((r) => ({ ...r, name_i18n: null, signature_menus: [] })),
    );
    const db = backlogDb([{ place_key: 'kakao:9', name: '가게9' }]);
    await enrichPendingPlaces(db as unknown as RoomDbClient);

    expect(db.updates).toHaveLength(1);
    expect(db.updates[0].values.enriched_at).toEqual(expect.any(String));
    // 빈 결과를 name_i18n 에 덮어써서 기존 값을 지우지는 않는다.
    expect(db.updates[0].values.name_i18n).toBeUndefined();
  });

  it('한 번에 처리할 양을 묶는다 — 크론 한 틱이 하루치 예산을 삼키면 안 된다', async () => {
    const db = backlogDb([]);
    await enrichPendingPlaces(db as unknown as RoomDbClient, { limit: 5_000 });
    expect(Number(db.readFilters.limit)).toBeLessThanOrEqual(120);
  });

  it('갚을 것이 없으면 모델을 부르지 않는다', async () => {
    const db = backlogDb([]);
    const result = await enrichPendingPlaces(db as unknown as RoomDbClient);
    expect(result).toEqual({ found: 0, enriched: 0 });
    expect(translateMock).not.toHaveBeenCalled();
  });

  it('조회가 실패해도 크론을 죽이지 않는다', async () => {
    const db = {
      from: () => ({
        select: () => ({
          is: () => ({ gt: () => ({ limit: async () => ({ data: null, error: { message: 'boom' } }) }) }),
        }),
      }),
    };
    await expect(enrichPendingPlaces(db as unknown as RoomDbClient)).resolves.toEqual({ found: 0, enriched: 0 });
  });

  it('동기 번역 상한이 카드가 보여주는 개수보다 넉넉하다', () => {
    // 카드는 5곳을 보여준다(places.MAX_RESULTS). 상한이 그보다 작으면 손님이
    // 기다린 뒤에도 한국어 이름만 보게 된다 — 미루기의 의미가 없어진다.
    expect(SYNC_ENRICH_LIMIT).toBeGreaterThanOrEqual(12);
  });
});
