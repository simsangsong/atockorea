/**
 * 증거팩의 클라이언트 안전 표시 헬퍼 (§5.4b D12).
 *
 * evidence.ts는 `node:crypto`와 `sharp`를 쓰는 서버 모듈이다. admin 증거 시트는
 * `'use client'` 페이지라 거기서 evidence.ts를 import하면 webpack이 node 스킴을
 * 브라우저 번들로 끌고 들어가 **프로덕션 빌드가 통째로 실패한다**(tsc·jest는
 * 통과하므로 빌드까지 가야만 드러난다).
 *
 * 그래서 순수 표시 함수만 이 파일로 분리한다 — 저장소가 이미 쓰는 분리 패턴과
 * 동일하다: facilityPins / facilityPins.server, eta.ts / eta.server.ts.
 * 서버 쪽은 evidence.ts가 그대로 re-export하므로 기존 import는 바뀌지 않는다.
 */

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
