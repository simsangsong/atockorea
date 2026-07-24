/**
 * §D A0.4 — 로케일 레이아웃 하니스.
 *
 *   npm run locale:fit            전체 리포트
 *   npm run locale:fit -- --top=40
 *
 * A1.7의 표적("독일어·러시아어 긴 단어 붕괴")을 문자열 수준에서 좁힌다.
 * 3,000개를 눈으로 보는 대신 상위 N개만 실기기에서 확인하게 만드는 것이 목적이다.
 *
 * 🔴 이건 스크린샷을 대신하지 않는다. 픽셀 검증은 A1.7이 한다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { locales } from '../lib/locale';
import {
  DEFAULT_THRESHOLDS,
  findFitRisks,
  findMissingKeys,
  flattenMessages,
} from '../lib/audit/localeFit';

function arg(name: string, fallback: number): number {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  const n = hit ? Number(hit.split('=')[1]) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function main() {
  const top = arg('top', 25);
  const dir = path.join(process.cwd(), 'messages');

  const bundles: Record<string, Record<string, string>> = {};
  for (const locale of locales) {
    const file = path.join(dir, `${locale}.json`);
    if (!fs.existsSync(file)) {
      console.warn(`⚠ ${locale}.json 없음 — 건너뜀`);
      continue;
    }
    bundles[locale] = flattenMessages(JSON.parse(fs.readFileSync(file, 'utf8')));
  }

  const counts = Object.entries(bundles).map(([l, m]) => `${l}:${Object.keys(m).length}`);
  console.log(`\n=== A0.4 로케일 적합성 (messages/) ===`);
  console.log(`로케일 ${Object.keys(bundles).length}개 · 문자열 ${counts.join(' ')}\n`);

  // ── 누락 키 ────────────────────────────────────────────────────────────────
  const missing = findMissingKeys(bundles);
  if (missing.length === 0) {
    console.log('✅ 누락 키 없음 — 모든 로케일이 en의 키를 전부 갖고 있다.');
  } else {
    console.log('🔴 누락 키 (그 자리에는 영어가 그대로 노출된다):');
    for (const m of missing) {
      console.log(`   ${m.locale.padEnd(6)} ${m.missing.length}개  예: ${m.missing.slice(0, 3).join(', ')}`);
    }
  }

  // ── 레이아웃 위험 ──────────────────────────────────────────────────────────
  const risks = findFitRisks(bundles);
  const chrome = risks.filter((r) => r.surface === 'chrome');
  const prose = risks.filter((r) => r.surface === 'prose');

  const byLocale = new Map<string, number>();
  for (const r of chrome) byLocale.set(r.locale, (byLocale.get(r.locale) ?? 0) + 1);

  console.log(
    `\n레이아웃 위험 후보 ${risks.length}건 ` +
      `(무공백 토큰 > ${DEFAULT_THRESHOLDS.maxRun}자 또는 en 대비 > ${DEFAULT_THRESHOLDS.maxLengthRatio}배)`,
  );
  console.log(`  · 🔴 좁은 컨테이너(버튼·라벨·칩) ${chrome.length}건  ← 실제로 볼 것`);
  console.log(`  ·    넓은 산문(약관·정책 본문)  ${prose.length}건  ← 같은 토큰이어도 안 터진다`);
  const ranked = [...byLocale.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`좁은 컨테이너 로케일별: ${ranked.map(([l, n]) => `${l} ${n}`).join(' · ') || '없음'}\n`);

  for (const r of chrome.slice(0, top)) {
    const ratio = r.lengthRatio !== null ? `${r.lengthRatio}x` : '—';
    console.log(`[${r.locale}] run=${String(r.longestRun).padStart(3)} ratio=${ratio.padStart(6)}  ${r.key}`);
    console.log(`   ${r.text.length > 110 ? `${r.text.slice(0, 110)}…` : r.text}`);
  }
  if (chrome.length > top) console.log(`\n… 좁은 컨테이너 외 ${chrome.length - top}건 (--top=N으로 더 보기)`);

  console.log('\n🔴 이 목록은 "터진다"가 아니라 "눈으로 볼 것"이다. 픽셀 검증은 A1.7이 실기기에서 한다.');
}

main();
