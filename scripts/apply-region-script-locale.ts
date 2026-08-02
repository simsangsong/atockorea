/**
 * 지역 해설 번역을 한 언어씩 반영한다.
 *
 *   npx tsx scripts/apply-region-script-locale.ts --locale=zh          # 검증만
 *   npx tsx scripts/apply-region-script-locale.ts --locale=zh --apply  # 반영
 *
 * 입력: `i18n-work/region-scripts/<locale>.json`
 *       { "<topic_key>": { title, teaser, body, fun_fact }, ... }  × 16
 *
 * 🔴 **한 언어 = 한 트랜잭션이다.** 사장님 결정(D7)으로 승인 큐가 없어서 쓰는
 * 즉시 손님 화면에 뜬다. 16편 중 5편만 들어가면 독일어 5장 + 영어 11장이 섞인
 * 화면이 되는데(라우트가 주제별로 en 폴백), 그 상태를 손님이 보는 시간이 있으면
 * 안 된다. PostgREST 의 배열 upsert 는 단일 INSERT ... ON CONFLICT 로 나가므로
 * 전부 들어가거나 하나도 안 들어간다.
 *
 * 🔴 **게이트가 유일한 방어선이다.** 같은 D7 때문에 사람이 보는 단계가 없고,
 * 사장님이 읽을 수 있는 언어는 중·영·한뿐이다. 나머지 여섯 언어는 여기서
 * 걸러지지 않으면 아무도 못 잡는다. 그래서 `fail` 이 하나라도 있으면 **쓰지
 * 않는다** — 파이프라인의 규칙 6 그대로: 틀린 번역보다 번역 없음이 낫다.
 *
 * 재사용하는 것(= `scripts/translate-poi-locales.ts` 와 같은 계보):
 *   - `lib/i18n/pipeline/gates.ts` `verifyUnit` — G1~G11
 *   - `i18n-work/styleguide/<locale>.md`, `i18n-work/glossary/<locale>.json`
 * 다른 것: LLM 을 호출하지 않는다. 번역은 사람이 써서 위 JSON 에 넣는다.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { verifyUnit, LENGTH_RATIO_BOUNDS, type TargetLocale, type UnitPayload } from '../lib/i18n/pipeline/gates';
import { countEmphasis } from '../lib/text/emphasis';
import { findScriptMix } from '../lib/i18n/scriptMix';

const ROOT = process.cwd();
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const locale = arg('locale');
const apply = process.argv.includes('--apply');

if (!locale) {
  console.error('사용법: --locale=zh [--apply]');
  process.exit(2);
}

function env(key: string): string {
  const raw = readFileSync(path.join(ROOT, '.env.local'), 'utf8');
  const line = raw.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  if (!line) throw new Error(`.env.local 에 ${key} 가 없다`);
  return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '');
}

const supabase = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
});

const SRC = path.join(ROOT, 'i18n-work', 'region-scripts', `${locale}.json`);
if (!existsSync(SRC)) {
  console.error(`입력 파일이 없다: ${SRC}`);
  process.exit(2);
}
type Unit = { title: string; teaser: string; body: string; fun_fact?: string | null };
const incoming = JSON.parse(readFileSync(SRC, 'utf8')) as Record<string, Unit>;

async function main() {
  const { data: rows, error } = await supabase
    .from('region_scripts')
    .select('id, topic_key, sort_order, region_script_locales ( locale, title, teaser, body, fun_fact )')
    .eq('region_key', 'jeju')
    .order('sort_order');
  if (error) throw new Error(error.message);

  const fails: string[] = [];
  const flags: string[] = [];
  const payload: Array<Record<string, unknown>> = [];

  /**
   * 🔴 CJK 대상 언어는 **한국어를 원문으로 검증한다.**
   *
   * G3(숫자)는 원문의 숫자가 번역에서 사라지면 실패로 잡는다. 그런데 영어는
   * `700,000` · `1.8 million` 로 쓰고 중국어·일본어는 `70万` · `180万` 으로 쓴다.
   * 자릿수 체계가 아예 달라서 문자로는 대응이 없다 — 영어를 원문으로 두면
   * **올바른 번역이 전부 숫자 소실로 탈락한다.**
   *
   * 한국어는 같은 만 단위 체계를 쓰고(70만·180만), 내용은 영어와 같은 한 쌍이다.
   * G3 가 물으려는 것은 "번역이 숫자를 잃었는가"이지 "영어와 같은 표기인가"가
   * 아니므로, 물음이 성립하는 쪽을 원문으로 삼는다.
   *
   * 이건 이 게이트가 이미 하고 있는 판단과 같은 층위다 — 로마숫자(XV=15)와
   * 연대 축약(1970s→'70)을 서식으로 인정하는 것과 똑같은 이유다.
   * 유럽어는 영어 그대로 검증한다(같은 아라비아 체계).
   */
  const CJK_TARGETS = new Set(['ja', 'zh', 'zh-TW']);
  const SOURCE_LOCALE = arg('source') ?? (CJK_TARGETS.has(locale) ? 'ko' : 'en');

  for (const row of (rows ?? []) as Array<{
    id: string;
    topic_key: string;
    region_script_locales: Array<Unit & { locale: string }>;
  }>) {
    const en = row.region_script_locales.find((l) => l.locale === SOURCE_LOCALE);
    if (!en) {
      fails.push(`${row.topic_key}: ${SOURCE_LOCALE} 원문이 없다 — 번역 소스가 성립하지 않는다`);
      continue;
    }
    const tgt = incoming[row.topic_key];
    if (!tgt) {
      fails.push(`${row.topic_key}: 번역이 없다 (16편 전부 있어야 한 언어가 완성된다)`);
      continue;
    }

    const seg = (u: Unit): UnitPayload['segments'] => ({
      '/title': u.title,
      '/teaser': u.teaser,
      '/body': u.body,
      ...(u.fun_fact ? { '/fun_fact': u.fun_fact } : {}),
    });

    // fun_fact 는 원문에 있으면 번역에도 있어야 한다. G1 이 잡지만 메시지를 여기서
    // 더 분명히 낸다 — "구조 불일치"보다 "fun_fact 가 빠졌다"가 고치기 쉽다.
    if (Boolean(en.fun_fact) !== Boolean(tgt.fun_fact)) {
      fails.push(`${row.topic_key}: fun_fact 유무가 원문과 다르다`);
    }

    const result = verifyUnit({ segments: seg(en) }, { segments: seg(tgt) }, {
      locale: locale as TargetLocale,
      // 상호는 고유명사다. 번역하지 않고 원문 그대로 두는 것이 정상이므로 G9 예외.
      keepAsIs: ['Jeju', 'Hallasan', 'UNESCO', 'FAO', 'Seogwipo', 'Udo', 'Gapado'],
    });
    for (const f of result.findings) {
      const line = `${row.topic_key}${f.pointer} [${f.gate}] ${f.message}`;
      (f.severity === 'fail' ? fails : flags).push(line);
    }

    // 🔴 로케일에 속하지 않는 문자 체계. G1~G11 어느 것도 묻지 않는 질문이라
    // 중국어 본문의 한글 32곳이 열 로케일 전부 초록인 채로 통과했다(2026-08-02).
    for (const f of findScriptMix(locale, row.topic_key, {
      title: tgt.title, teaser: tgt.teaser, body: tgt.body, fun_fact: tgt.fun_fact ?? null,
    })) {
      fails.push(
        `${row.topic_key}/${f.field}: ${locale} 에 ${f.script} 문자가 섞였다 — ${f.samples.join(' ')}`,
      );
    }

    // 🔴 강조는 게이트에서 flag 다. 승인 큐가 없는 이 트랙에서 flag 는 침묵과
    // 같으므로 여기서 fail 로 올린다. 강조가 빠진 본문은 위계 없이 평평해진다.
    if (countEmphasis(en.body) !== countEmphasis(tgt.body)) {
      fails.push(
        `${row.topic_key}/body: 강조 개수 ${countEmphasis(tgt.body)} ≠ 원문 ${countEmphasis(en.body)}`,
      );
    }

    payload.push({
      script_id: row.id,
      locale,
      title: tgt.title,
      teaser: tgt.teaser,
      body: tgt.body,
      fun_fact: tgt.fun_fact ?? null,
      updated_at: new Date().toISOString(),
    });
  }

  const extra = Object.keys(incoming).filter((k) => !(rows ?? []).some((r: { topic_key: string }) => r.topic_key === k));
  if (extra.length) fails.push(`주제에 없는 키: ${extra.join(', ')}`);

  console.log(`\n${locale} — 주제 ${payload.length}/16 · 길이비 허용 ${JSON.stringify(LENGTH_RATIO_BOUNDS[locale as TargetLocale] ?? '(미정의)')}`);
  if (flags.length) {
    console.log(`\n감수 권고 ${flags.length}건:`);
    for (const f of flags) console.log('   ~ ' + f);
  }
  if (fails.length) {
    console.error(`\n🔴 실패 ${fails.length}건 — 아무것도 쓰지 않았습니다:\n`);
    for (const f of fails) console.error('   - ' + f);
    process.exit(1);
  }
  if (payload.length !== 16) {
    console.error(`\n🔴 16편이 아니라 ${payload.length}편입니다 — 부분 반영은 하지 않습니다.`);
    process.exit(1);
  }

  console.log('\n✅ 게이트 통과');
  if (!apply) {
    console.log('(--apply 를 주면 반영합니다)');
    process.exit(0);
  }

  // 배열 upsert = 단일 INSERT ... ON CONFLICT. 부분 성공이 없다.
  const { error: upErr } = await supabase
    .from('region_script_locales')
    .upsert(payload, { onConflict: 'script_id,locale' });
  if (upErr) {
    console.error(`🔴 반영 실패(전부 롤백): ${upErr.message}`);
    process.exit(1);
  }
  console.log(`✅ ${locale} 16편 반영 완료`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
