/**
 * 번역 메모리 (TM) — 같은 원문은 한 번만 번역한다.
 *
 * 플랜: docs/i18n-expansion-plan-v2-2026-07-25.md §3-[0] / §10
 *
 * 실측(2026-07-26, 독일어 Tier1 10슬러그): 세그먼트 5,566개 중 고유 3,056개 —
 * **45.1%가 중복**이다. 슬러그마다 거의 같은 예약안내·신뢰항목·실용정보 문구가
 * 반복되기 때문이다.
 *
 * TM은 비용 절감 장치이기 이전에 **일관성 장치**다. 같은 원문이 슬러그마다 다르게
 * 번역되면 L3 도메인 용어(픽업·집합장소·노쇼·유예시간)가 문서 간에 갈린다.
 *
 * 캐시 오염 방지(H6): 키에 `pipelineVersion`을 솔트로 섞는다. RULES.md나 용어집이
 * 바뀌면 버전을 올려 이전 결과가 재사용되지 않게 한다.
 */
import { sourceHash } from './segments';

export interface TmEntry {
  /** 확정 번역. */
  target: string;
  /** 이 번역을 만든 unit — 추적용. */
  unitId: string;
}

export interface TranslationMemory {
  version: 1;
  locale: string;
  pipelineVersion: string;
  /** `<pipelineVersion>:<sourceHash>` → 엔트리. */
  entries: Record<string, TmEntry>;
}

export function emptyTm(locale: string, pipelineVersion: string): TranslationMemory {
  return { version: 1, locale, pipelineVersion, entries: {} };
}

export function tmKey(pipelineVersion: string, source: string): string {
  return `${pipelineVersion}:${sourceHash(source)}`;
}

/**
 * 조회. **마스킹된 원문**을 키로 쓴다 — 번역도 마스킹 상태에서 이뤄지므로
 * 고유명사가 TM을 오염시키지 않는다.
 */
export function tmLookup(
  tm: TranslationMemory,
  source: string,
  pipelineVersion: string,
): string | undefined {
  return tm.entries[tmKey(pipelineVersion, source)]?.target;
}

/** 검증을 통과한 세그먼트만 기록한다. 빈 번역은 넣지 않는다. */
export function tmRecord(
  tm: TranslationMemory,
  pipelineVersion: string,
  unitId: string,
  pairs: Array<{ source: string; target: string }>,
): number {
  let added = 0;
  for (const { source, target } of pairs) {
    if (!target || target.trim().length === 0) continue;
    const key = tmKey(pipelineVersion, source);
    if (tm.entries[key]) continue; // 먼저 확정된 번역을 이긴다 — 결과가 흔들리지 않게.
    tm.entries[key] = { target, unitId };
    added += 1;
  }
  return added;
}

export function tmSize(tm: TranslationMemory): number {
  return Object.keys(tm.entries).length;
}
