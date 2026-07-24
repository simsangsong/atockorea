/**
 * @jest-environment node
 *
 * §5.4b D12 노쇼 증거팩 — 순수 검증 계층. 네트워크·sharp·Supabase 0.
 *
 * "증거 없는 노쇼 처리 불가"의 앞단: 무엇이 유효한 증거인가를 여기서 정한다.
 */
import {
  validateEvidenceInput,
  buildWatermarkLines,
  watermarkSvg,
  evidencePaths,
  formatKstStamp,
  hasEvidenceFor,
  CAPTURED_AT_SKEW_MS,
} from '@/lib/ops/seating/evidence';

const NOW = Date.parse('2026-07-24T05:00:00.000Z'); // 14:00 KST
const PHOTO = { type: 'image/jpeg', size: 400_000, name: 'IMG_0001.jpg' };

function input(over: Record<string, unknown> = {}) {
  return {
    file: PHOTO,
    capturedAt: new Date(NOW - 30_000).toISOString(),
    latitude: 33.4996,
    longitude: 126.5312,
    accuracyM: 12,
    nowMs: NOW,
    ...over,
  };
}

describe('validateEvidenceInput (D12)', () => {
  it('accepts a fresh geotagged photo', () => {
    const result = validateEvidenceInput(input());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({ ext: 'jpg', latitude: 33.4996, longitude: 126.5312, accuracyM: 12 });
    expect(result.value.gpsUnavailableReason).toBeNull();
  });

  it('rejects a missing or empty photo', () => {
    const empty = validateEvidenceInput(input({ file: { ...PHOTO, size: 0 } }));
    expect(empty).toMatchObject({ ok: false, code: 'photo_required' });
  });

  it('rejects a non-image attachment', () => {
    const pdf = validateEvidenceInput(input({ file: { type: 'application/pdf', size: 1000, name: 'x.pdf' } }));
    expect(pdf).toMatchObject({ ok: false, code: 'photo_not_image' });
  });

  it('rejects an image over the 8MB attachment ceiling', () => {
    const big = validateEvidenceInput(input({ file: { ...PHOTO, size: 9 * 1024 * 1024 } }));
    expect(big).toMatchObject({ ok: false, code: 'photo_invalid' });
  });

  it('rejects an unparseable captured_at', () => {
    expect(validateEvidenceInput(input({ capturedAt: 'yesterday' }))).toMatchObject({
      ok: false,
      code: 'captured_at_invalid',
    });
    expect(validateEvidenceInput(input({ capturedAt: '' }))).toMatchObject({
      ok: false,
      code: 'captured_at_invalid',
    });
  });

  it('rejects captured_at beyond ±24h of server time (both directions)', () => {
    const stale = validateEvidenceInput(
      input({ capturedAt: new Date(NOW - CAPTURED_AT_SKEW_MS - 60_000).toISOString() }),
    );
    expect(stale).toMatchObject({ ok: false, code: 'captured_at_out_of_range' });
    const future = validateEvidenceInput(
      input({ capturedAt: new Date(NOW + CAPTURED_AT_SKEW_MS + 60_000).toISOString() }),
    );
    expect(future).toMatchObject({ ok: false, code: 'captured_at_out_of_range' });
  });

  it('rejects out-of-range or half-supplied coordinates', () => {
    expect(validateEvidenceInput(input({ latitude: 133 }))).toMatchObject({ ok: false, code: 'coordinates_invalid' });
    expect(validateEvidenceInput(input({ longitude: -900 }))).toMatchObject({ ok: false, code: 'coordinates_invalid' });
    expect(validateEvidenceInput(input({ latitude: 'abc' }))).toMatchObject({ ok: false, code: 'coordinates_invalid' });
    // 위도만 오고 경도가 없으면 좌표가 아니다.
    expect(validateEvidenceInput(input({ longitude: null }))).toMatchObject({
      ok: false,
      code: 'coordinates_invalid',
    });
  });

  it('requires a written reason when coordinates are absent (GPS 없음도 기록된 사실)', () => {
    const noReason = validateEvidenceInput(input({ latitude: null, longitude: null, accuracyM: null }));
    expect(noReason).toMatchObject({ ok: false, code: 'gps_reason_required' });

    const blank = validateEvidenceInput(
      input({ latitude: null, longitude: null, accuracyM: null, gpsUnavailableReason: '   ' }),
    );
    expect(blank).toMatchObject({ ok: false, code: 'gps_reason_required' });

    const ok = validateEvidenceInput(
      input({ latitude: null, longitude: null, accuracyM: null, gpsUnavailableReason: ' 실내 주차장 ' }),
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.gpsUnavailableReason).toBe('실내 주차장');
  });
});

describe('watermark composition helpers', () => {
  const ctx = {
    capturedAt: '2026-07-24T05:00:00.000Z',
    recordedAt: '2026-07-24T05:00:05.000Z',
    latitude: 33.4996,
    longitude: 126.5312,
    accuracyM: 12,
    gpsUnavailableReason: null,
    seatNumber: 7,
    guestLabel: 'Massimo C.',
    tourDate: '2026-07-24',
    roomId: 'abcdef12-3456-7890-abcd-ef1234567890',
    actorRole: 'guide',
  };

  it('bakes seat, masked guest, both timestamps and GPS into the lines', () => {
    const lines = buildWatermarkLines(ctx);
    expect(lines[0]).toContain('7번 좌석');
    expect(lines[0]).toContain('Massimo C.');
    expect(lines[1]).toContain('2026-07-24 14:00:00 KST');
    expect(lines[2]).toContain('33.499600');
    expect(lines[3]).toContain('2026-07-24');
  });

  it('states the reason on the photo when GPS is missing', () => {
    const lines = buildWatermarkLines({ ...ctx, latitude: null, longitude: null, gpsUnavailableReason: '실내 주차장' });
    expect(lines[2]).toBe('GPS 없음 — 실내 주차장');
  });

  it('escapes XML in the SVG overlay', () => {
    const svg = watermarkSvg(800, 100, ['a & b <script>'], 20);
    expect(svg).toContain('a &amp; b &lt;script&gt;');
    expect(svg).not.toContain('<script>');
  });

  it('formats KST stamps and builds private-bucket paths', () => {
    expect(formatKstStamp('2026-07-24T15:30:00.000Z')).toBe('2026-07-25 00:30:00 KST');
    expect(formatKstStamp('nope')).toBe('-');
    const paths = evidencePaths('room-1', 'png', 'ev-1');
    expect(paths.originalPath).toBe('no-show/room-1/ev-1/original.png');
    expect(paths.watermarkedPath).toBe('no-show/room-1/ev-1/watermarked.jpg');
    // 확장자 인젝션 방지 (경로 조작).
    expect(evidencePaths('room-1', '../../x', 'ev-1').originalPath).toBe('no-show/room-1/ev-1/original.jpg');
  });
});

describe('hasEvidenceFor (노쇼 강제 게이트)', () => {
  function lookupDb(rows: unknown[], error?: unknown) {
    const filters: Array<[string, unknown]> = [];
    const chain = {
      eq(col: string, val: unknown) {
        filters.push([col, val]);
        return chain;
      },
      order() {
        return chain;
      },
      limit() {
        return Promise.resolve({ data: rows, error: error ?? null });
      },
    };
    return {
      filters,
      client: { from: () => ({ select: () => chain }) },
    };
  }

  it('finds the evidence row for a seat', async () => {
    const { client, filters } = lookupDb([{ id: 'ev-9' }]);
    const result = await hasEvidenceFor(client, { roomVehicleId: 'v1', seatNumber: 3 });
    expect(result).toEqual({ found: true, evidenceId: 'ev-9' });
    expect(filters).toEqual([
      ['room_vehicle_id', 'v1'],
      ['seat_number', 3],
    ]);
  });

  it('scopes an explicit evidenceId to the same seat (anti-forgery)', async () => {
    const { client, filters } = lookupDb([{ id: 'ev-9' }]);
    await hasEvidenceFor(client, { roomVehicleId: 'v1', seatNumber: 3, evidenceId: 'ev-9' });
    expect(filters).toContainEqual(['id', 'ev-9']);
  });

  it('fails closed on an empty result or a query error', async () => {
    expect(await hasEvidenceFor(lookupDb([]).client, { roomVehicleId: 'v1', seatNumber: 3 })).toEqual({
      found: false,
      evidenceId: null,
    });
    // 테이블 부재(42P01) 등 — 게이트는 열리지 않는다.
    expect(
      await hasEvidenceFor(lookupDb([], { code: '42P01' }).client, { roomVehicleId: 'v1', seatNumber: 3 }),
    ).toEqual({ found: false, evidenceId: null });
  });
});
