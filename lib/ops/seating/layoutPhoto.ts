/**
 * 실차 사진 IO — AtoC 통합 플랜 §5.3b (배치도 확정 게이트의 증거물).
 *
 * ⚠ 서버 전용. node:crypto를 쓰므로 `'use client'` 파일에서 import 금지
 * (tsc·jest는 통과하고 webpack 프로덕션 빌드만 깨진다). 편집기 페이지는
 * layoutEditor.ts(순수)만 가져간다 — evidence.ts ↔ evidenceFormat.ts 와
 * 같은 분리 규약.
 *
 * 저장 정책은 ops_no_show_evidence와 동일하다: PUBLIC 버킷 금지. 차량 내부
 * 사진에는 기사·손님이 찍힐 수 있고, 배치도 확정 근거는 분쟁 시 꺼내 보는
 * 기록물이다. 그래서 DB에는 URL이 아니라 storage path만 저장하고 조회는
 * 단기 서명 URL로만 한다.
 */

import { randomUUID } from 'node:crypto';
import { classifyAttachment } from '@/lib/tour-room/attachments';

/** private 버킷. 없으면 ensureLayoutPhotoBucket이 public:false로 만든다. */
export const LAYOUT_PHOTO_BUCKET =
  process.env.SUPABASE_OPS_VEHICLE_REF_BUCKET || 'ops-vehicle-refs';

/** 서명 URL 기본 만료 — 15분 (편집기를 열어두고 대조하는 시간). */
export const LAYOUT_PHOTO_SIGNED_TTL_SEC = 900;

export interface LayoutPhotoFileLike {
  type: string;
  size: number;
  name: string;
}

export type LayoutPhotoValidation =
  | { ok: true; ext: string }
  | { ok: false; code: 'photo_required' | 'photo_not_image' | 'photo_invalid'; message: string };

/** 사진 검증 — 순수. 이미지 MIME + 크기 상한은 classifyAttachment 재사용. */
export function validateLayoutPhoto(file: LayoutPhotoFileLike | null): LayoutPhotoValidation {
  if (!file || !file.size) {
    return { ok: false, code: 'photo_required', message: '실차 내부 사진이 필요해요.' };
  }
  const classified = classifyAttachment({ type: file.type, size: file.size, name: file.name });
  if ('error' in classified) {
    return (file.type || '').toLowerCase().startsWith('image/')
      ? { ok: false, code: 'photo_invalid', message: classified.error }
      : { ok: false, code: 'photo_not_image', message: '사진 파일만 첨부할 수 있어요.' };
  }
  if (classified.kind !== 'image') {
    return { ok: false, code: 'photo_not_image', message: '사진 파일만 첨부할 수 있어요.' };
  }
  return { ok: true, ext: classified.ext };
}

/** private 버킷 내부 경로 — 배치도 1행당 최신 1장이지만 경로는 매번 새로 만든다
 *  (덮어쓰기 대신 새 경로 → 캐시·서명 URL 혼선 없음). */
export function layoutPhotoPath(layoutId: string, ext: string, id: string = randomUUID()): string {
  const safeExt = /^[a-z0-9]{1,5}$/i.test(ext) ? ext.toLowerCase() : 'jpg';
  return `vehicle-layout/${layoutId}/${id}.${safeExt}`;
}

export interface LayoutPhotoStorageClient {
  storage: {
    listBuckets(): Promise<{ data: Array<{ name: string }> | null }>;
    createBucket(name: string, options: Record<string, unknown>): Promise<{ error: unknown }>;
    from(bucket: string): {
      upload(path: string, body: Buffer, options: Record<string, unknown>): Promise<{ error: unknown }>;
      createSignedUrl(
        path: string,
        expiresIn: number,
      ): Promise<{ data: { signedUrl: string } | null; error: unknown }>;
    };
  };
}

/** private 버킷 보장 — public:false가 이 슬라이스의 불변식이다. */
export async function ensureLayoutPhotoBucket(supabase: LayoutPhotoStorageClient): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((bucket) => bucket.name === LAYOUT_PHOTO_BUCKET)) {
    await supabase.storage.createBucket(LAYOUT_PHOTO_BUCKET, {
      public: false,
      fileSizeLimit: 8 * 1024 * 1024,
    });
  }
}

export async function uploadLayoutPhoto(
  supabase: LayoutPhotoStorageClient,
  path: string,
  bytes: Buffer,
  contentType: string,
): Promise<void> {
  const { error } = await supabase.storage.from(LAYOUT_PHOTO_BUCKET).upload(path, bytes, {
    contentType: contentType || 'application/octet-stream',
    upsert: false,
  });
  if (error) throw error instanceof Error ? error : new Error('layout photo upload failed');
}

/** 단기 서명 URL. 실패해도 편집은 막지 않는다(사진 칸만 빈다). */
export async function layoutPhotoSignedUrl(
  supabase: LayoutPhotoStorageClient,
  path: string | null | undefined,
  expiresInSec = LAYOUT_PHOTO_SIGNED_TTL_SEC,
): Promise<string | null> {
  if (!path) return null;
  try {
    const { data, error } = await supabase.storage
      .from(LAYOUT_PHOTO_BUCKET)
      .createSignedUrl(path, expiresInSec);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}
