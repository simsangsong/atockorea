/**
 * 노쇼 증거팩 도메인 — AtoC 통합 플랜 §5.4b / D12.
 *
 * "증거 없는 노쇼 처리 불가 — 비가역 액션의 유일한 마찰 지점(체크인은 무마찰,
 * 노쇼만 증거 요구: 비대칭 마찰 원칙)."
 *
 * 이 파일은 두 층으로 명확히 갈린다:
 *   · 순수(pure) — validateEvidenceInput / buildWatermarkLines / evidencePaths /
 *     formatKstStamp. 네트워크·sharp·Supabase 없이 단위 테스트 가능.
 *   · IO — ensureEvidenceBucket / uploadEvidenceObject / composeWatermark /
 *     evidenceSignedUrl / hasEvidenceFor. 전부 주입된 클라이언트로만 동작한다.
 *
 * 저장 정책 (코디네이터 확정): 증거 사진은 PUBLIC 버킷 금지. 분쟁 증거에는
 * 사람과 현장이 찍히므로 전용 private 버킷에 올리고 조회는 단기 서명 URL로만
 * 한다. 그래서 DB에는 URL이 아니라 storage path가 저장된다
 * (lib/tour-room/attachments.ts의 public 버킷 정책과 의도적으로 다르다 —
 * 검증 헬퍼 classifyAttachment만 재사용한다).
 */

import { randomUUID } from 'node:crypto';
import { classifyAttachment } from '@/lib/tour-room/attachments';

/** private 버킷. 없으면 ensureEvidenceBucket이 public:false로 만든다. */
export const EVIDENCE_BUCKET = process.env.SUPABASE_OPS_EVIDENCE_BUCKET || 'ops-evidence';

/** 서명 URL 기본 만료 — 10분. 증거 시트는 열어놓고 오래 보는 화면이 아니고,
 *  유출되어도 창이 짧아야 한다(길게 필요하면 새로고침 = 재발급). */
export const DEFAULT_SIGNED_URL_TTL_SEC = 600;

/** 촬영시각 허용 오차 — 서버시각 대비 ±24h. 기기 시계가 틀어져도 현장 촬영은
 *  이 범위 안에 들고, 몇 달 전 사진 재활용은 걸러진다. */
export const CAPTURED_AT_SKEW_MS = 24 * 60 * 60 * 1000;

/** 워터마크 합성 장변 상한 (원본은 그대로 보관, 제출용만 축소). */
export const WATERMARK_MAX_EDGE = 1600;

// ─── 순수 계층 ──────────────────────────────────────────────────────────────

export interface EvidenceFileLike {
  type: string;
  size: number;
  name: string;
}

export interface EvidenceInput {
  file: EvidenceFileLike;
  capturedAt: unknown;
  latitude?: unknown;
  longitude?: unknown;
  accuracyM?: unknown;
  gpsUnavailableReason?: unknown;
  /** 서버 기준 시각 주입 (테스트 결정론). */
  nowMs?: number;
}

export interface EvidenceValue {
  ext: string;
  capturedAt: string;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  gpsUnavailableReason: string | null;
}

export type EvidenceValidation =
  | { ok: true; value: EvidenceValue }
  | { ok: false; code: EvidenceErrorCode; message: string };

export type EvidenceErrorCode =
  | 'photo_required'
  | 'photo_not_image'
  | 'photo_invalid'
  | 'captured_at_invalid'
  | 'captured_at_out_of_range'
  | 'coordinates_invalid'
  | 'gps_reason_required';

/** 사람이 읽는 한국어 문구 — 스태프 전용 화면이라 단일 로케일. */
const MESSAGES: Record<EvidenceErrorCode, string> = {
  photo_required: '현장 사진이 필요해요.',
  photo_not_image: '사진 파일만 첨부할 수 있어요.',
  photo_invalid: '사진을 확인할 수 없어요. 다시 촬영해 주세요.',
  captured_at_invalid: '촬영 시각을 읽을 수 없어요.',
  captured_at_out_of_range: '촬영 시각이 현재와 24시간 넘게 차이나요. 현장에서 바로 촬영해 주세요.',
  coordinates_invalid: '위치 좌표 값이 올바르지 않아요.',
  gps_reason_required: '위치를 받지 못했다면 그 이유를 적어주세요.',
};

function fail(code: EvidenceErrorCode): EvidenceValidation {
  return { ok: false, code, message: MESSAGES[code] };
}

/** null = 미제공, NaN = 형식 오류(호출부가 Number.isNaN으로 구분). */
function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value));
  return Number.isFinite(n) ? n : NaN;
}

/**
 * 증거 입력 검증 — 순수. 사진(이미지 MIME·8MB, classifyAttachment 재사용),
 * 촬영시각(유효 + 서버시각 ±24h), 좌표(유한·범위), 좌표 없으면 사유 필수.
 */
export function validateEvidenceInput(input: EvidenceInput): EvidenceValidation {
  const { file } = input;
  if (!file || !file.size) return fail('photo_required');

  const classified = classifyAttachment({ type: file.type, size: file.size, name: file.name });
  if ('error' in classified) {
    // classifyAttachment는 "이미지가 아님"과 "너무 큼"을 같은 채널로 돌려준다.
    return (file.type || '').toLowerCase().startsWith('image/')
      ? { ok: false, code: 'photo_invalid', message: classified.error }
      : fail('photo_not_image');
  }
  if (classified.kind !== 'image') return fail('photo_not_image');

  const rawCaptured = typeof input.capturedAt === 'string' ? input.capturedAt.trim() : '';
  if (!rawCaptured) return fail('captured_at_invalid');
  const capturedMs = Date.parse(rawCaptured);
  if (!Number.isFinite(capturedMs)) return fail('captured_at_invalid');
  const nowMs = typeof input.nowMs === 'number' ? input.nowMs : Date.now();
  if (Math.abs(nowMs - capturedMs) > CAPTURED_AT_SKEW_MS) return fail('captured_at_out_of_range');

  const lat = finiteNumber(input.latitude);
  const lng = finiteNumber(input.longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return fail('coordinates_invalid');
  const hasLat = lat !== null;
  const hasLng = lng !== null;
  if (hasLat !== hasLng) return fail('coordinates_invalid');
  if (hasLat && (lat! < -90 || lat! > 90)) return fail('coordinates_invalid');
  if (hasLng && (lng! < -180 || lng! > 180)) return fail('coordinates_invalid');

  const reasonRaw = typeof input.gpsUnavailableReason === 'string' ? input.gpsUnavailableReason.trim() : '';
  // 설계 결정 5: "GPS 없음"도 기록된 사실이지 우회로가 아니다.
  if (!hasLat && !reasonRaw) return fail('gps_reason_required');

  const accuracy = finiteNumber(input.accuracyM);
  if (Number.isNaN(accuracy)) return fail('coordinates_invalid');

  return {
    ok: true,
    value: {
      ext: classified.ext,
      capturedAt: new Date(capturedMs).toISOString(),
      latitude: hasLat ? lat : null,
      longitude: hasLng ? lng : null,
      accuracyM: accuracy === null ? null : Math.max(0, Math.round(accuracy)),
      gpsUnavailableReason: hasLat ? (reasonRaw || null) : reasonRaw.slice(0, 500),
    },
  };
}

/** private 버킷 내부 경로 한 쌍 (원본 + 워터마크본). */
export function evidencePaths(roomId: string, ext: string, id: string = randomUUID()): {
  id: string;
  originalPath: string;
  watermarkedPath: string;
} {
  const safeExt = /^[a-z0-9]{1,5}$/i.test(ext) ? ext.toLowerCase() : 'jpg';
  return {
    id,
    originalPath: `no-show/${roomId}/${id}/original.${safeExt}`,
    watermarkedPath: `no-show/${roomId}/${id}/watermarked.jpg`,
  };
}

/** "2026-07-24 14:03:22 KST" — 증거는 항상 현지(KST) 시각으로 읽힌다. */
export function formatKstStamp(iso: string | number | Date): string {
  const ms = iso instanceof Date ? iso.getTime() : typeof iso === 'number' ? iso : Date.parse(String(iso));
  if (!Number.isFinite(ms)) return '-';
  const kst = new Date(ms + 9 * 60 * 60 * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${kst.getUTCFullYear()}-${p(kst.getUTCMonth() + 1)}-${p(kst.getUTCDate())} ` +
    `${p(kst.getUTCHours())}:${p(kst.getUTCMinutes())}:${p(kst.getUTCSeconds())} KST`
  );
}

export interface WatermarkContext {
  capturedAt: string;
  recordedAt: string;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  gpsUnavailableReason: string | null;
  seatNumber: number;
  guestLabel: string | null;
  tourDate: string | null;
  roomId: string;
  actorRole: string;
}

/** 사진에 구울 텍스트 줄 — 순수(테스트 가능). */
export function buildWatermarkLines(ctx: WatermarkContext): string[] {
  const gps =
    ctx.latitude !== null && ctx.longitude !== null
      ? `GPS ${ctx.latitude.toFixed(6)}, ${ctx.longitude.toFixed(6)}` +
        (ctx.accuracyM !== null ? ` (±${ctx.accuracyM}m)` : '')
      : `GPS 없음 — ${ctx.gpsUnavailableReason || '사유 미기재'}`;
  return [
    `노쇼 증거 · ${ctx.seatNumber}번 좌석 · ${ctx.guestLabel || 'Guest'}`,
    `촬영 ${formatKstStamp(ctx.capturedAt)} / 서버 수신 ${formatKstStamp(ctx.recordedAt)}`,
    gps,
    `${ctx.tourDate ?? '-'} · room ${ctx.roomId.slice(0, 8)} · ${ctx.actorRole}`,
  ];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** 하단 반투명 바 + 텍스트 SVG — 순수(문자열 조립만). */
export function watermarkSvg(width: number, barHeight: number, lines: string[], fontSize: number): string {
  const pad = Math.round(fontSize * 0.8);
  const lineHeight = Math.round(fontSize * 1.45);
  const texts = lines
    .map((line, i) => {
      const y = pad + Math.round(fontSize * 0.95) + i * lineHeight;
      return `<text x="${pad}" y="${y}" font-family="sans-serif" font-size="${fontSize}" fill="#ffffff" font-weight="600">${escapeXml(line)}</text>`;
    })
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${barHeight}">` +
    `<rect x="0" y="0" width="${width}" height="${barHeight}" fill="#000000" fill-opacity="0.62"/>` +
    texts +
    '</svg>'
  );
}

// ─── IO 계층 ────────────────────────────────────────────────────────────────

export interface EvidenceStorageClient {
  storage: {
    listBuckets(): Promise<{ data: Array<{ name: string }> | null }>;
    createBucket(name: string, options: Record<string, unknown>): Promise<{ error: unknown }>;
    from(bucket: string): {
      upload(path: string, body: Buffer, options: Record<string, unknown>): Promise<{ error: unknown }>;
      createSignedUrl(path: string, expiresIn: number): Promise<{ data: { signedUrl: string } | null; error: unknown }>;
    };
  };
}

/** private 버킷 보장 — public:false가 이 슬라이스의 핵심 불변식이다. */
export async function ensureEvidenceBucket(supabase: EvidenceStorageClient): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((bucket) => bucket.name === EVIDENCE_BUCKET)) {
    await supabase.storage.createBucket(EVIDENCE_BUCKET, {
      public: false,
      fileSizeLimit: 8 * 1024 * 1024,
    });
  }
}

export async function uploadEvidenceObject(
  supabase: EvidenceStorageClient,
  path: string,
  bytes: Buffer,
  contentType: string,
): Promise<void> {
  const { error } = await supabase.storage.from(EVIDENCE_BUCKET).upload(path, bytes, {
    contentType: contentType || 'application/octet-stream',
    upsert: false,
  });
  if (error) throw error instanceof Error ? error : new Error('evidence upload failed');
}

/** 단기 서명 URL. 실패는 조회를 막지 않는다(사진 칸만 비고 나머지 사실은 남는다). */
export async function evidenceSignedUrl(
  supabase: EvidenceStorageClient,
  path: string | null | undefined,
  expiresInSec = DEFAULT_SIGNED_URL_TTL_SEC,
): Promise<string | null> {
  if (!path) return null;
  try {
    const { data, error } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .createSignedUrl(path, expiresInSec);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

/**
 * 워터마크 합성 — 장변 1600px 리사이즈(+EXIF 회전 반영) 후 하단 바에 텍스트.
 *
 * sharp 실패는 치명적이지 않다: null을 돌려주면 호출부가 원본만 저장하고
 * watermarked_path를 null로 남긴다 (원본만으로도 증거는 성립한다).
 */
export async function composeWatermark(bytes: Buffer, lines: string[]): Promise<Buffer | null> {
  try {
    const sharpMod = await import('sharp');
    const sharp = (sharpMod as unknown as { default?: typeof import('sharp') }).default ?? (sharpMod as unknown as typeof import('sharp'));
    const resized = await sharp(bytes)
      .rotate()
      .resize({ width: WATERMARK_MAX_EDGE, height: WATERMARK_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer({ resolveWithObject: true });
    const width = resized.info.width;
    const height = resized.info.height;
    if (!width || !height) return null;

    const fontSize = Math.max(13, Math.round(width * 0.026));
    const pad = Math.round(fontSize * 0.8);
    const barHeight = Math.min(
      Math.round(height * 0.6),
      pad * 2 + lines.length * Math.round(fontSize * 1.45),
    );
    const svg = watermarkSvg(width, barHeight, lines, fontSize);

    return await sharp(resized.data)
      .composite([{ input: Buffer.from(svg), top: Math.max(0, height - barHeight), left: 0 }])
      .jpeg({ quality: 88 })
      .toBuffer();
  } catch (error) {
    console.warn('[ops-evidence] watermark compose failed; keeping original only:', error);
    return null;
  }
}

export interface EvidenceLookupClient {
  from(table: string): {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    select(columns: string): any;
  };
}

export interface EvidenceLookupResult {
  found: boolean;
  evidenceId: string | null;
}

/**
 * 노쇼 강제 검사 — 이 (차량, 좌석)에 유효한 증거 행이 있는가?
 *
 * evidenceId가 주어지면 그 행이 정말 이 좌석의 것인지까지 확인한다(위조 방지:
 * 다른 좌석 증거 id를 붙여 통과시키는 경로를 막는다). 테이블 부재/조회 실패는
 * "증거 없음"으로 처리한다 — 게이트는 fail-closed다.
 */
export async function hasEvidenceFor(
  supabase: EvidenceLookupClient,
  opts: { roomVehicleId: string; seatNumber: number; evidenceId?: string | null },
): Promise<EvidenceLookupResult> {
  try {
    let query = supabase
      .from('ops_no_show_evidence')
      .select('id')
      .eq('room_vehicle_id', opts.roomVehicleId)
      .eq('seat_number', opts.seatNumber);
    if (opts.evidenceId) query = query.eq('id', opts.evidenceId);
    const { data, error } = await query.order('recorded_at', { ascending: false }).limit(1);
    if (error) {
      console.warn('[ops-evidence] evidence lookup failed (treated as missing):', error);
      return { found: false, evidenceId: null };
    }
    const row = Array.isArray(data) ? (data[0] as { id?: string } | undefined) : null;
    if (!row?.id) return { found: false, evidenceId: null };
    return { found: true, evidenceId: row.id };
  } catch (error) {
    console.warn('[ops-evidence] evidence lookup threw (treated as missing):', error);
    return { found: false, evidenceId: null };
  }
}
