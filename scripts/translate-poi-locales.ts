/**
 * A5 — fill `match_pois.content_locales` for fr / de / ru / it.
 *
 *   npx tsx scripts/translate-poi-locales.ts --locale=fr --limit=5 --dry
 *   npx tsx scripts/translate-poi-locales.ts --locale=all
 *
 * Why this exists: the arrival card now reads the POI master and SPEAKS it
 * (A2/A3), but fr/de/ru/it were written for 13 of 124 stops. Western guests
 * hear English. This translates the English master into those four.
 *
 * What it deliberately reuses instead of reinventing:
 *   - `i18n-work/RULES.md` + `styleguide/<locale>.md` — the same instruction
 *     set the tour-page track uses. Loaded in full, never summarised.
 *   - `i18n-work/glossary/<locale>.json` — L1 proper nouns. The POI's own name
 *     is taken from here VERBATIM rather than translated, because a place name
 *     invented per-call drifts between screens.
 *   - `lib/i18n/pipeline/gates.ts` `verifyUnit` — G1..G11 (structure, numbers,
 *     currency, placeholders, markup, verbatim, length ratio, untranslated,
 *     charset, banned terms). A unit that fails is retried once with the
 *     findings fed back, then skipped. Rule 6: no translation beats a wrong one.
 *
 * Safety:
 *   - writes `content_locale_status[locale] = 'pending'`, so nothing published
 *     here reaches a guest until a human approves it in
 *     /admin/poi-content-locales (the A4 gate is fail-closed);
 *   - additive only — an existing locale entry is never overwritten without
 *     --force, matching the i18n track's INSERT-only rule;
 *   - resumable: already-translated pairs are skipped, so a crashed run is
 *     restarted by re-running the same command.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { chatCompletion } from '../lib/ai/router';
import { verifyUnit, type TargetLocale, type UnitPayload, type Finding } from '../lib/i18n/pipeline/gates';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: join(ROOT, '.env.local') });
config({ path: join(ROOT, '..', '..', '..', '.env.local') });

const LOCALES: TargetLocale[] = ['fr', 'de', 'ru', 'it'];
const LANG_NAME: Record<TargetLocale, string> = {
  fr: 'French (français)',
  de: 'German (Deutsch)',
  ru: 'Russian (русский)',
  it: 'Italian (italiano)',
};

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const DRY = argv.includes('--dry');
const FORCE = argv.includes('--force');
const LIMIT = Number(flag('limit') ?? '0') || Infinity;
const ONLY_POI = flag('poi');
const localeArg = flag('locale') ?? 'all';
const targets: TargetLocale[] =
  localeArg === 'all' ? LOCALES : LOCALES.includes(localeArg as TargetLocale) ? [localeArg as TargetLocale] : [];

if (targets.length === 0) {
  console.error('--locale=fr|de|ru|it|all');
  process.exit(2);
}

// The router's default is 8 s, tuned for short interactive calls. A 2,000-char
// briefing translated into four fields does not come back in 8 s, and every
// timeout burns a paid call before failing. Offline batch work gets a real
// budget unless the environment already set one.
if (!process.env.TOUR_AI_BATCH_TIMEOUT_MS && !process.env.TOUR_AI_TIMEOUT_MS) {
  process.env.TOUR_AI_BATCH_TIMEOUT_MS = '90000';
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}

// ── fixed prompt parts ───────────────────────────────────────────────────────

const RULES = readFileSync(join(ROOT, 'i18n-work', 'RULES.md'), 'utf8');

function styleguide(locale: TargetLocale): string {
  const path = join(ROOT, 'i18n-work', 'styleguide', `${locale}.md`);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

interface Glossary {
  names: Record<string, string>;
  banned?: string[];
}

function glossary(locale: TargetLocale): Glossary {
  const path = join(ROOT, 'i18n-work', 'glossary', `${locale}.json`);
  if (!existsSync(path)) return { names: {} };
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Glossary;
  return { names: raw.names ?? {}, banned: raw.banned ?? [] };
}

// ── source extraction ────────────────────────────────────────────────────────

interface PoiRow {
  poi_key: string;
  name_en: string | null;
  description: string | null;
  highlights: unknown;
  content_locales: Record<string, Record<string, unknown>> | null;
  content_locale_status: Record<string, string> | null;
}

/** Fields worth speaking; `name` is glossary-supplied, never translated here. */
const FIELDS = ['description', 'insider_tip', 'best_time', 'why_on_route'] as const;

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** en content → { pointer: text }. Pointers double as the output contract. */
function sourceUnit(row: PoiRow): UnitPayload {
  const en = row.content_locales?.en ?? {};
  const segments: Record<string, string> = {};
  for (const field of FIELDS) {
    const text = str(en[field]) || (field === 'description' ? str(row.description) : '');
    if (text) segments[`/${field}`] = text;
  }
  const highlights = Array.isArray(en.highlights)
    ? en.highlights
    : Array.isArray(row.highlights)
      ? row.highlights
      : [];
  highlights.forEach((h, i) => {
    const text = str(h);
    if (text) segments[`/highlights/${i}`] = text;
  });
  return { segments };
}

/** Which glossary names actually occur in this unit — the prompt stays short. */
function relevantTerms(unit: UnitPayload, poiKey: string, names: Record<string, string>): Record<string, string> {
  const haystack = Object.values(unit.segments).join(' ').toLowerCase();
  const picked: Record<string, string> = {};
  for (const [key, value] of Object.entries(names)) {
    if (!value) continue;
    const english = key.replace(/_/g, ' ');
    if (key === poiKey || haystack.includes(english)) picked[english] = value;
  }
  return picked;
}

// ── translation ──────────────────────────────────────────────────────────────

function buildPrompt(
  locale: TargetLocale,
  unit: UnitPayload,
  terms: Record<string, string>,
  retryFindings: Finding[],
): string {
  const termLines = Object.entries(terms)
    .map(([en, tr]) => `  "${en}" → "${tr}"`)
    .join('\n');
  const retry =
    retryFindings.length > 0
      ? `\n## 이전 시도가 검증에서 탈락했다. 아래를 고쳐서 다시 내라.\n${retryFindings
          .map((f) => `  [${f.gate}] ${f.pointer}: ${f.message}`)
          .join('\n')}\n`
      : '';

  return `${RULES}

<TARGET_LANG> = ${LANG_NAME[locale]}

${styleguide(locale)}

## 고유명사 — 아래 표기를 그대로 쓴다 (규칙 2의 토큰 대신 확정 표기를 준다)
${termLines || '  (해당 없음)'}
${retry}
## 출력 형식
JSON 객체 하나만 출력한다. 키는 아래 원문의 키와 **정확히 동일**해야 한다 —
추가·누락·병합 금지(규칙 1). 값은 번역문 문자열이다.
확신이 없는 항목은 빈 문자열 ""로 둔다(규칙 6).

## 원문 (en)
${JSON.stringify(unit.segments, null, 2)}`;
}

function parseTarget(raw: string): UnitPayload | null {
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    // RULES.md documents a `{ unitId, locale, segments }` envelope, so the model
    // returns one whether or not this prompt asked for it. Unwrap it — reading
    // only the top level found zero pointers and reported every unit as an
    // abstention, which looked like a well-behaved run and was not.
    const body =
      parsed.segments && typeof parsed.segments === 'object' && !Array.isArray(parsed.segments)
        ? (parsed.segments as Record<string, unknown>)
        : parsed;
    const segments: Record<string, string> = {};
    for (const [k, v] of Object.entries(body)) {
      if (typeof v === 'string') segments[k] = v;
    }
    return { segments };
  } catch {
    return null;
  }
}

async function translateUnit(
  locale: TargetLocale,
  unit: UnitPayload,
  terms: Record<string, string>,
  banned: string[],
): Promise<{ target: UnitPayload; findings: Finding[] } | { target: null; findings: Finding[] }> {
  let findings: Finding[] = [];
  // Two attempts: the second gets the first's gate findings. Rule 6 says an
  // untranslated field is fine, so we never grind past this.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const res = await chatCompletion(
      'batch',
      [{ role: 'user', content: buildPrompt(locale, unit, terms, attempt === 0 ? [] : findings) }],
      { jsonResponse: true, temperature: 0.2, maxOutputTokens: 4000 },
    );
    if (process.env.DEBUG_TRANSLATE) {
      console.log(`\n--- raw (${res.provider}/${res.model}) ---\n${res.content.slice(0, 1200)}\n---`);
    }
    const target = parseTarget(res.content);
    if (!target) {
      findings = [{ gate: 'G1', severity: 'fail', pointer: '/', message: 'JSON 파싱 실패' }];
      continue;
    }
    // Two normalisations before verifying:
    //  - drop empties: rule 6 makes "" a legitimate abstention, and G1 would
    //    otherwise report it as a missing pointer;
    //  - drop keys the source never had. Models echo envelope fields from the
    //    rules file (`unitId`, `locale`) and G1 counts those as invented
    //    content, which failed every single unit on the first live run.
    const kept: Record<string, string> = {};
    for (const [k, v] of Object.entries(target.segments)) {
      if (v.trim() && k in unit.segments) kept[k] = v;
    }
    const abstained = Object.keys(unit.segments).filter((p) => !kept[p]);
    const scopedSource: UnitPayload = {
      segments: Object.fromEntries(Object.entries(unit.segments).filter(([p]) => kept[p])),
    };
    const result = verifyUnit(scopedSource, { segments: kept }, {
      locale,
      bannedTerms: banned,
      keepAsIs: Object.values(terms),
    });
    findings = result.findings;
    if (!result.failed) {
      if (abstained.length > 0) {
        console.log(`      (미번역 ${abstained.length}건: ${abstained.join(', ')} — 규칙 6)`);
      }
      return { target: { segments: kept }, findings };
    }
  }
  return { target: null, findings };
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const db = createClient(SUPABASE_URL!, SERVICE_KEY!);
  const { data, error } = await db
    .from('match_pois')
    .select('poi_key, name_en, description, highlights, content_locales, content_locale_status')
    .order('poi_key');
  if (error) throw error;

  const rows = ((data ?? []) as PoiRow[]).filter((r) => !r.poi_key.startsWith('_'));
  if (rows.length === 0) {
    console.error('match_pois 가 비어 있다 — 아무것도 검사하지 않았다.');
    process.exit(2);
  }

  let done = 0;
  let skipped = 0;
  let failed = 0;
  // Bounds ATTEMPTS, not successes. Counting only successes let the first live
  // run walk 40+ POIs after every one of them failed a gate.
  let attempted = 0;

  for (const locale of targets) {
    const gloss = glossary(locale);
    console.log(`\n=== ${locale} (글로서리 ${Object.keys(gloss.names).length}건) ===`);

    for (const row of rows) {
      if (attempted >= LIMIT) break;
      if (ONLY_POI && row.poi_key !== ONLY_POI) continue;

      // The English master must itself be approved — translating from content
      // nobody signed off on would launder it through a second language.
      if (row.content_locale_status?.en !== 'approved') {
        skipped += 1;
        continue;
      }
      const existing = row.content_locales?.[locale];
      if (existing && !FORCE) {
        skipped += 1;
        continue;
      }

      const unit = sourceUnit(row);
      if (Object.keys(unit.segments).length === 0) {
        skipped += 1;
        continue;
      }

      attempted += 1;
      const terms = relevantTerms(unit, row.poi_key, gloss.names);
      const name = gloss.names[row.poi_key] || row.name_en || row.poi_key;
      process.stdout.write(`  ${row.poi_key} … `);

      if (DRY) {
        console.log(`(dry) ${Object.keys(unit.segments).length} segments, 용어 ${Object.keys(terms).length}`);
        done += 1;
        continue;
      }

      let outcome: Awaited<ReturnType<typeof translateUnit>>;
      try {
        outcome = await translateUnit(locale, unit, terms, gloss.banned ?? []);
      } catch (e) {
        console.log(`실패 (${e instanceof Error ? e.message : String(e)})`);
        failed += 1;
        continue;
      }
      if (!outcome.target) {
        const fails = outcome.findings.filter((f) => f.severity === 'fail');
        console.log(`게이트 탈락 — ${fails.slice(0, 2).map((f) => `${f.gate} ${f.pointer}`).join(', ')}`);
        failed += 1;
        continue;
      }

      // Rebuild the locale entry from the pointers.
      const entry: Record<string, unknown> = { name };
      const highlights: string[] = [];
      for (const [pointer, text] of Object.entries(outcome.target.segments)) {
        const hit = /^\/highlights\/(\d+)$/.exec(pointer);
        if (hit) {
          highlights[Number(hit[1])] = text;
          continue;
        }
        entry[pointer.slice(1)] = text;
      }
      const compact = highlights.filter(Boolean);
      if (compact.length > 0) entry.highlights = compact;

      // A name with no prose is not a translation. Writing one anyway created
      // three empty fr rows on the first run and reported them as "ok".
      if (!entry.description && compact.length === 0) {
        console.log('내용 없음 — 쓰지 않음');
        failed += 1;
        continue;
      }

      const nextLocales = { ...(row.content_locales ?? {}), [locale]: entry };
      // A4 — pending, always. Nothing this script writes reaches a guest until
      // a human approves it.
      const nextStatus = { ...(row.content_locale_status ?? {}), [locale]: 'pending' };
      const { error: writeError } = await db
        .from('match_pois')
        .update({ content_locales: nextLocales, content_locale_status: nextStatus })
        .eq('poi_key', row.poi_key);
      if (writeError) {
        console.log(`쓰기 실패 (${writeError.message})`);
        failed += 1;
        continue;
      }
      const flags = outcome.findings.length;
      console.log(`ok${flags ? ` (flag ${flags})` : ''}`);
      done += 1;
    }
  }

  console.log(`\n번역 ${done} · 건너뜀 ${skipped} · 실패 ${failed}`);
  if (done === 0 && !DRY) {
    console.error('한 건도 번역하지 않았다 — 조건을 확인하라.');
    process.exit(2);
  }
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
