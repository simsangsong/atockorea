/**
 * §D A0.3 — 성능 베이스라인.
 *
 *   npx tsx scripts/perf-baseline.ts
 *
 * §F 예산 중 **서버·브라우저 없이 정직하게 잴 수 있는 것**만 잰다. 나머지는
 * "미측정"으로 남기고 무엇이 필요한지 적는다.
 *
 * 🔴 추정치를 쓰지 않는 이유는 플랜 자신이 겪은 일이다: §F의 다이닝 MISS 예산
 * 8초는 **근거 없는 추정**이었고, 실측하니 틀렸다("예산은 측정 후에 쓴다").
 * 베이스라인에 추정이 섞이면 다음 세션이 그 숫자를 기준으로 회귀를 판정한다.
 *
 * 이 스크립트는 **재실행 가능**해야 의미가 있다 — 베이스라인은 한 번 적고 마는
 * 숫자가 아니라 비교 대상이다.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { performance } from 'node:perf_hooks';

import { matchConciergeIntent, classifyConciergeGuardrail } from '../lib/tour-room/concierge';
import { conciergeCacheKey, contextVersion } from '../lib/tour-room/conciergeCache';
import { capacityVerdict } from '../lib/ops/seating/capacity';
import { buildUnifiedRecords, summarize } from '../lib/ops/bookings/unified';

interface Stat {
  label: string;
  p50: number;
  p95: number;
  budget?: string;
}

/** N회 반복 후 p50/p95(ms). 워밍업을 버려 JIT 편차를 줄인다. */
function bench(label: string, fn: () => void, iterations = 20_000, budget?: string): Stat {
  for (let i = 0; i < Math.min(2000, iterations); i++) fn(); // warmup
  const samples: number[] = [];
  const batch = 100;
  for (let i = 0; i < iterations / batch; i++) {
    const t0 = performance.now();
    for (let j = 0; j < batch; j++) fn();
    samples.push((performance.now() - t0) / batch);
  }
  samples.sort((a, b) => a - b);
  return {
    label,
    p50: samples[Math.floor(samples.length * 0.5)],
    p95: samples[Math.floor(samples.length * 0.95)],
    budget,
  };
}

function ms(n: number): string {
  return n < 0.01 ? `${(n * 1000).toFixed(1)}µs` : `${n.toFixed(3)}ms`;
}

// ── 번들 무게 (실측) ─────────────────────────────────────────────────────────
function bundleReport(): { firstLoadKb: number | null; totalGzipMb: number | null } {
  const next = path.join(process.cwd(), '.next');
  if (!fs.existsSync(next)) return { firstLoadKb: null, totalGzipMb: null };
  const gz = (p: string) => {
    try {
      return zlib.gzipSync(fs.readFileSync(path.join(next, p))).length;
    } catch {
      return 0;
    }
  };
  let firstLoad = 0;
  try {
    const bm = JSON.parse(fs.readFileSync(path.join(next, 'build-manifest.json'), 'utf8')) as {
      rootMainFiles?: string[];
    };
    for (const f of bm.rootMainFiles ?? []) firstLoad += gz(f);
    const routeDir = path.join(next, 'static/chunks/app/tour-mode/room/[bookingId]');
    if (fs.existsSync(routeDir)) {
      for (const f of fs.readdirSync(routeDir).filter((x) => x.endsWith('.js'))) {
        firstLoad += gz(`static/chunks/app/tour-mode/room/[bookingId]/${f}`);
      }
    }
  } catch {
    return { firstLoadKb: null, totalGzipMb: null };
  }

  let total = 0;
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir)) {
      const p = path.join(dir, e);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (e.endsWith('.js')) total += zlib.gzipSync(fs.readFileSync(p)).length;
    }
  };
  try {
    walk(path.join(next, 'static/chunks'));
  } catch {
    /* partial */
  }
  return { firstLoadKb: Math.round(firstLoad / 1024), totalGzipMb: Number((total / 1024 / 1024).toFixed(2)) };
}

function main() {
  const stats: Stat[] = [];

  // Tier 0 — §F 예산 < 100ms (네트워크 0). 순수 함수라 정확히 잴 수 있다.
  const questions = ['화장실 어디예요?', 'where is the toilet', '몇 시에 출발해요', 'what is for lunch'];
  let qi = 0;
  stats.push(
    bench(
      'Tier0 의도 매칭 + 가드레일 판정',
      () => {
        const q = questions[qi++ % questions.length];
        classifyConciergeGuardrail(q);
        matchConciergeIntent(q);
      },
      20_000,
      '< 100ms (§F)',
    ),
  );

  // §L L2 캐시 키 — Tier1 히트 경로의 계산 비용.
  const ctx = {
    tourId: 'T1',
    tourDate: '2026-08-17',
    poiKey: 'seongsan',
    lifecycle: 'live',
    freeTimeActive: false,
    nowMs: 1_800_000_000_000,
  };
  stats.push(
    bench('§L L2 캐시 키 계산 (sha256)', () => conciergeCacheKey('화장실 어디예요', 'ko', contextVersion(ctx)), 20_000),
  );

  // 정원 판정 — 12팀 그룹.
  const party = Array.from({ length: 12 }, () => ({ number_of_guests: 2, status: 'confirmed' }));
  stats.push(
    bench(
      '정원 판정 (12팀)',
      () => capacityVerdict(party, { max_room_guests: 12, price_type: 'person' }, [{ total_seats: 20 }]),
      20_000,
    ),
  );

  // B1 통합 리졸버 — 한 주(60건) 규모.
  const bookings = Array.from({ length: 60 }, (_, i) => ({
    id: `b${i}`,
    tour_id: 't1',
    tour_date: '2026-08-17',
    created_at: '2026-08-01T02:00:00Z',
    contact_name: `Guest ${i}`,
    number_of_guests: 2,
    status: 'confirmed',
    source: 'gyg',
  }));
  stats.push(bench('B1 통합 리졸버 (60건)', () => summarize(buildUnifiedRecords({ bookings })), 2_000));

  console.log('\n=== A0.3 성능 베이스라인 (in-process) ===');
  console.log(`측정 시각: ${new Date().toISOString()}  ·  node ${process.version}\n`);
  for (const s of stats) {
    console.log(
      `${s.label.padEnd(34)} p50 ${ms(s.p50).padStart(9)}  p95 ${ms(s.p95).padStart(9)}` +
        (s.budget ? `   예산 ${s.budget}` : ''),
    );
  }

  const b = bundleReport();
  console.log('\n=== 번들 (gzip, `next build` 산출물 실측) ===');
  if (b.firstLoadKb === null) {
    console.log('.next 없음 — `npx next build --webpack` 먼저 실행하세요.');
  } else {
    console.log(`손님 룸 first-load JS : ${b.firstLoadKb} KB   예산 350 KB (§F)`);
    console.log(`전체 client chunk 합계: ${b.totalGzipMb} MB   (참고용 — 예산 아님)`);
  }

  console.log('\n=== 미측정 (서버·실기기 필요) ===');
  console.log('룸 진입 첫 유의미 렌더 · 메시지 전송→표시 · 카드 탭→시트 · Tier1 응답 ·');
  console.log('다이닝 HIT/MISS · 라우트 p50/p95');
  console.log('→ dev 서버 + A0.1 시뮬 데이터(ALLOW_SIM_SEED=1)가 있어야 정직하게 잴 수 있다.');
  console.log('🔴 추정치를 적지 않는다 — §F의 다이닝 MISS 8초가 근거 없는 추정이었고 실측에서 틀렸다.');
}

main();
