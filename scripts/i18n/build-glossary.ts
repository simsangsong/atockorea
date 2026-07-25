/**
 * 글로서리 L1 빌드 — 서브에이전트 산출물 검증 후 `i18n-work/glossary/<locale>.json` 확정.
 *
 * 플랜: docs/i18n-expansion-plan-v2-2026-07-25.md (v3.1) §3
 *
 *   npm run i18n:glossary -- --locale=de
 *   npm run i18n:glossary -- --all
 *
 * `out/poi-names/<locale>.json`(서브에이전트 출력) → 검사 → `glossary/<locale>.json`.
 * DB를 건드리지 않는다 — `match_pois` 쓰기는 별도 스크립트(사람 승인 후).
 *
 * 검사 항목:
 *   K1 키 집합이 source.json 과 정확히 일치 (누락·초과 금지)
 *   K2 로케일 문자셋 — ru는 키릴, de/fr/it은 키릴·CJK 금지
 *   K3 괄호 개수가 원문과 동일 — 원문에 없는 주석 추가(규칙 1 위반) 검출
 *   K4 숫자 값 동일 — `9.81 Park`·`1100`·`4·3` 같은 값이 변형되지 않았는지
 *   K5 활동 라벨 혼입 — "점심/Mittagessen/déjeuner/pranzo/обед" 류가 이름에 들어갔는지
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { numberMultiset } from '../../lib/i18n/pipeline/gates';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORK = join(ROOT, 'i18n-work');
const LOCALES = ['de', 'fr', 'it', 'ru'] as const;
type Loc = (typeof LOCALES)[number];

const argv = process.argv.slice(2);
function flag(name: string): string | undefined {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}
const ALL = argv.includes('--all');
const ONE = flag('locale') as Loc | undefined;
const targets: Loc[] = ALL ? [...LOCALES] : ONE ? [ONE] : [];
if (targets.length === 0) {
  console.error('--locale=de|fr|it|ru 또는 --all 을 지정하라.');
  process.exit(1);
}

const CYRILLIC = /\p{Script=Cyrillic}/u;
const CJK = /[　-〿぀-ヿ㐀-䶿一-鿿가-힯]/;

/** 활동·일정 라벨 — 장소 이름에 들어가면 안 된다(플랜 v3.1 §3 es 선례의 결함). */
const ACTIVITY_WORDS: Record<Loc, RegExp> = {
  de: /\b(Mittagessen|Frühstück|Abendessen|Besuch|Fotostopp|Pause)\b/i,
  fr: /\b(déjeuner|petit[- ]déjeuner|dîner|visite de|arrêt photo|pause)\b/i,
  it: /\b(pranzo|colazione|cena|visita a|sosta fotografica|pausa)\b/i,
  ru: /\b(обед|завтрак|ужин|посещение|фотостоп|остановка)\b/i,
};

interface Source {
  pois: Array<{ key: string; en: string | null; ko: string | null }>;
}
interface OutFile {
  locale: string;
  names: Record<string, string>;
  notes?: Record<string, string>;
}

interface Issue {
  check: string;
  key: string;
  message: string;
}

function countParens(s: string): number {
  return (s.match(/[()]/g) ?? []).length;
}

function verifyLocale(locale: Loc, source: Source): { out: OutFile; issues: Issue[] } | null {
  const outPath = join(WORK, 'out', 'poi-names', `${locale}.json`);
  if (!existsSync(outPath)) {
    console.log(`⚠ ${locale}: out/poi-names/${locale}.json 없음 — 건너뜀`);
    return null;
  }

  const out = JSON.parse(readFileSync(outPath, 'utf8')) as OutFile;
  const names = out.names ?? {};
  const issues: Issue[] = [];

  // K1 키 집합
  const expected = new Set(source.pois.map((p) => p.key));
  const actual = new Set(Object.keys(names));
  for (const k of expected) {
    if (!actual.has(k)) issues.push({ check: 'K1', key: k, message: '키 누락' });
  }
  for (const k of actual) {
    if (!expected.has(k)) issues.push({ check: 'K1', key: k, message: 'source에 없는 키' });
  }

  for (const poi of source.pois) {
    const value = names[poi.key];
    if (typeof value !== 'string' || value.trim().length === 0) continue; // 규칙 6 미번역은 정상
    const en = poi.en ?? '';

    // K2 문자셋
    if (locale === 'ru') {
      if (!CYRILLIC.test(value)) {
        issues.push({ check: 'K2', key: poi.key, message: `키릴 없음 — "${value}"` });
      }
    } else if (CYRILLIC.test(value)) {
      issues.push({ check: 'K2', key: poi.key, message: `키릴 혼입 — "${value}"` });
    }
    if (CJK.test(value)) {
      issues.push({ check: 'K2', key: poi.key, message: `CJK 혼입 — "${value}"` });
    }

    // K3 괄호 개수
    if (countParens(en) !== countParens(value)) {
      issues.push({
        check: 'K3',
        key: poi.key,
        message: `괄호 개수 ${countParens(en)}→${countParens(value)} — 원문에 없는 주석 추가 의심: "${value}"`,
      });
    }

    // K4 숫자 값
    const a = numberMultiset(en).join(' ');
    const b = numberMultiset(value).join(' ');
    if (a !== b) {
      issues.push({ check: 'K4', key: poi.key, message: `숫자 [${a}] → [${b}] — "${value}"` });
    }

    // K5 활동 라벨
    if (ACTIVITY_WORDS[locale].test(value)) {
      issues.push({ check: 'K5', key: poi.key, message: `활동 라벨 혼입 — "${value}"` });
    }
  }

  return { out, issues };
}

function main(): void {
  const source = JSON.parse(
    readFileSync(join(WORK, 'in', 'poi-names', 'source.json'), 'utf8'),
  ) as Source;

  console.log(`\n=== 글로서리 L1 빌드 · POI ${source.pois.length}건 ===\n`);
  let anyBlocking = false;

  for (const locale of targets) {
    const result = verifyLocale(locale, source);
    if (!result) continue;

    const { out, issues } = result;
    const filled = Object.values(out.names).filter((v) => v.trim().length > 0).length;
    const empty = source.pois.length - filled;

    const blocking = issues.filter((i) => i.check === 'K1');
    const warnings = issues.filter((i) => i.check !== 'K1');

    console.log(
      `${blocking.length === 0 ? '✓' : '✗'} ${locale} — 채움 ${filled} / 미번역 ${empty} · 차단 ${blocking.length} · 경고 ${warnings.length}`,
    );
    for (const i of issues.slice(0, 12)) {
      console.log(`    [${i.check}] ${i.key} — ${i.message}`);
    }
    if (issues.length > 12) console.log(`    … 그 외 ${issues.length - 12}건`);

    if (blocking.length > 0) {
      anyBlocking = true;
      console.log(`    → 키 집합 불일치로 ${locale} 글로서리를 쓰지 않았다. 재작업 필요.`);
      continue;
    }

    const glossaryDir = join(WORK, 'glossary');
    mkdirSync(glossaryDir, { recursive: true });
    const target = join(glossaryDir, `${locale}.json`);

    // 기존 파일의 `banned`(스타일가이드 금지어)는 보존한다 — L1만 갱신한다.
    const prev = existsSync(target)
      ? (JSON.parse(readFileSync(target, 'utf8')) as { banned?: string[] })
      : {};

    const payload = {
      locale,
      note: 'L1 고유명사. 플랜 v3.1 §3 — 피벗 en, 고유명사 로마자 유지(ru는 키릴 전사), 수식어만 번역, 괄호 주석 추가 금지.',
      banned: prev.banned ?? [],
      names: out.names,
      notes: out.notes ?? {},
      verification: {
        checkedAt: new Date().toISOString(),
        filled,
        empty,
        warnings: warnings.map((w) => `[${w.check}] ${w.key} — ${w.message}`),
      },
    };
    writeAtomic(target, JSON.stringify(payload, null, 2));
    console.log(`    → i18n-work/glossary/${locale}.json 기록`);
  }

  console.log('');
  process.exit(anyBlocking ? 1 : 0);
}

function writeAtomic(path: string, content: string): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content, 'utf8');
  renameSync(tmp, path);
}

main();
