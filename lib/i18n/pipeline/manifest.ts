/**
 * i18n 파이프라인 — 매니페스트.
 *
 * **야간 무인작업의 생명줄.** 세션이 중간에 끊겨도 이 파일만 보면 다음 세션이
 * 그대로 이어받는다(플랜 v2.2 §4 세션 절차 6단).
 *
 * 상태 전이:
 *   pending ──▶ running ──▶ auto_pass ──▶ human_pass
 *                  │
 *                  └──▶ verify_fail ──(attempts<3)──▶ pending
 *                              └──(attempts>=3)──▶ blocked   ← 미발행·영어 폴백
 */

export type UnitStatus =
  | 'pending'
  | 'running'
  | 'verify_fail'
  | 'flagged'
  | 'auto_pass'
  | 'human_pass'
  | 'blocked';

export const MAX_ATTEMPTS = 3;

export interface Unit {
  /** `<surface>:<slug>:<locale>:<chunk>` — 전역 유일. */
  id: string;
  surface: string;
  /** POI 명칭처럼 슬러그가 없는 표면은 빈 문자열. */
  slug: string;
  locale: string;
  /** 청크 라벨 — 보통 top-level 키 이름. */
  chunk: string;
  tier: string;
  status: UnitStatus;
  attempts: number;
  /** 세그먼트 수 · 원문 문자수 — 진척 추정용. */
  segments: number;
  sourceChars: number;
  /** 마지막 검증 요약. */
  lastError?: string;
  fails?: number;
  flags?: number;
}

export interface Manifest {
  /** 매니페스트 스키마 버전. */
  version: 1;
  /** 프롬프트·용어집 버전 — 캐시 오염 방지 솔트(H6). */
  pipelineVersion: string;
  /** ISO 8601. 스크립트가 주입한다(스크립트 밖에서는 시각을 만들지 않는다). */
  createdAt: string;
  updatedAt: string;
  units: Unit[];
}

export function emptyManifest(pipelineVersion: string, now: string): Manifest {
  return { version: 1, pipelineVersion, createdAt: now, updatedAt: now, units: [] };
}

export function unitId(surface: string, slug: string, locale: string, chunk: string): string {
  return `${surface}:${slug}:${locale}:${chunk}`;
}

/** 다음 세션이 집어야 할 unit — pending + 재시도 여력이 남은 verify_fail. */
export function claimableUnits(manifest: Manifest, limit: number, locale?: string): Unit[] {
  return manifest.units
    .filter((u) => {
      if (locale && u.locale !== locale) return false;
      if (u.status === 'pending') return true;
      if (u.status === 'verify_fail') return u.attempts < MAX_ATTEMPTS;
      return false;
    })
    .slice(0, limit);
}

/** 검증 결과를 상태로 환원. 3회 실패는 blocked(미발행). */
export function applyVerifyOutcome(
  unit: Unit,
  outcome: { failed: boolean; flagged: boolean; fails: number; flags: number; error?: string },
): Unit {
  const attempts = unit.attempts + 1;
  if (outcome.failed) {
    return {
      ...unit,
      attempts,
      status: attempts >= MAX_ATTEMPTS ? 'blocked' : 'verify_fail',
      lastError: outcome.error,
      fails: outcome.fails,
      flags: outcome.flags,
    };
  }
  return {
    ...unit,
    attempts,
    status: outcome.flagged ? 'flagged' : 'auto_pass',
    lastError: undefined,
    fails: 0,
    flags: outcome.flags,
  };
}

export interface ProgressSummary {
  total: number;
  byStatus: Record<UnitStatus, number>;
  byLocale: Record<string, Record<string, number>>;
  /** 발행 가능(auto_pass + flagged + human_pass) 비율. */
  publishableRatio: number;
}

export function summarize(manifest: Manifest): ProgressSummary {
  const byStatus = {
    pending: 0, running: 0, verify_fail: 0, flagged: 0, auto_pass: 0, human_pass: 0, blocked: 0,
  } as Record<UnitStatus, number>;
  const byLocale: Record<string, Record<string, number>> = {};

  for (const u of manifest.units) {
    byStatus[u.status] += 1;
    const bucket = byLocale[u.locale] ?? (byLocale[u.locale] = {});
    bucket[u.status] = (bucket[u.status] ?? 0) + 1;
  }

  const publishable = byStatus.auto_pass + byStatus.flagged + byStatus.human_pass;
  return {
    total: manifest.units.length,
    byStatus,
    byLocale,
    publishableRatio: manifest.units.length === 0 ? 0 : publishable / manifest.units.length,
  };
}
