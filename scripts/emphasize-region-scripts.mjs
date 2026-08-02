/**
 * 지역 해설 본문에 `**강조**`를 넣는다.
 *
 *   node scripts/emphasize-region-scripts.mjs           # 미리보기
 *   node scripts/emphasize-region-scripts.mjs --apply   # DB 반영
 *
 * 🔴 **원고를 다시 쓰지 않는다.** 사장님이 합격시킨 문장을 손으로 옮겨 적으면
 * 그 과정에서 반드시 한두 글자가 바뀌고, 그건 diff 로도 안 보인다. 그래서 이
 * 스크립트는 **지정한 구절을 찾아 감싸기만** 한다. 구절이 본문에 없거나 두 번
 * 이상 나오면 **아무것도 쓰지 않고 죽는다** — 애매한 자리를 추측으로 고르면
 * 엉뚱한 곳이 굵어지고, 그건 아무도 다시 안 본다.
 *
 * 강조 원칙(문단당 1~2곳):
 *   - 그 문단이 존재하는 이유가 되는 **숫자나 사실** 하나.
 *   - 감정을 얹는 문장은 굵히지 않는다. 특히 해녀·4·3 은 숫자만 굵힌다 —
 *     숫자 앞에 강조를 깔면 손님이 스스로 느낄 자리가 없어진다(사장님 지시,
 *     2026-08-02: "담백하게").
 *   - 다 굵으면 아무것도 안 굵다.
 *
 * 강조는 `body` 에만 넣는다. `title`·`teaser`·`fun_fact` 는 평문이다 —
 * 리스트 카드가 teaser 를 그대로 그리므로 거기 별표가 들어가면 화면에 보인다.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import path from 'path';

const apply = process.argv.includes('--apply');

/** topic_key → locale → 감쌀 구절(본문에 정확히 한 번 나와야 한다). */
const MANIFEST = {
  overview: {
    en: ['1,846 km²', 'a single shield volcano', 'every drop of drinking water on Jeju is rain'],
    ko: ['1,846km²', '섬 전체가 한라산입니다', '제주에서 마시는 물은 전부 빗물'],
  },
  'samda-sammu': {
    en: ['wind, rocks, women', 'thieves, gates, beggars', 'three wooden poles called jeongnang'],
    ko: ['바람과 돌과 여자', '도둑과 대문과 거지', '정낭이라는 나무막대 셋'],
  },
  'hallasan-unesco': {
    en: ['the only place in the world holding all three', '1,947.06 m', 'about 360 oreum'],
    ko: ['전 세계에서 제주가 유일합니다', '1,947.06m', '오름이 약 360개'],
  },
  dolhareubang: {
    en: ['Forty-eight were carved and 47 survive', 'genuinely unresolved'],
    ko: ['48기가 만들어져서 47기가 남았고', '정말로 미결입니다'],
  },
  haenyeo: {
    // 숫자만. 서사에 강조를 얹지 않는다.
    en: ['without air tanks', '4,377', '2,371', 'One hundred and five are under fifty'],
    ko: ['공기통을 메지 않습니다', '4,377명', '2,371명', '105명입니다'],
  },
  seolmundae: {
    en: ['360 oreum', 'Five Hundred Generals', '18,000 gods'],
    ko: ['360개의 오름', '오백장군', '1만 8천 신'],
  },
  batdam: {
    en: ['22,108 km', "The clever part is what's missing", 'lets the wind through'],
    ko: ['약 22,108km', '영리한 부분은 없는 쪽에 있습니다', '바람을 통과시켜 압력을 흘려보내니까 버팁니다'],
  },
  tangerine: {
    en: [
      'Picking fruit from your own tree counted as theft',
      'pouring boiling water over the roots',
      'a million seedlings',
      'daehaknamu',
      'golbyeong-namu',
    ],
    ko: [
      '제 나무에서 제가 귤을 따도 절도였습니다',
      '뿌리에 끓는 물을 부어',
      '약 100만 그루의 묘목',
      '대학나무라고 불렀습니다',
      '골병나무',
    ],
  },
  'farm-produce': {
    en: ['45.9% of its carrots', 'Gujwa carrots', 'sold with the soil still clinging to them'],
    ko: ['약 45.9%', '구좌 당근이 이 섬의 자랑입니다', '흙을 털지 않고 그대로 파는 게 특징'],
  },
  food: {
    en: [
      'Jeju cooking came out of scarcity',
      'seven dishes',
      'Black pork — heukdwaeji',
      'Gogi-guksu came out of village feasts',
    ],
    ko: [
      '제주 음식은 결핍에서 나왔습니다',
      '제주 7대 향토음식',
      '대표는 역시 흑돼지죠',
      '고기국수는 마을 잔치에서 나왔습니다',
    ],
  },
  'jeju-language': {
    en: ['critically endangered', "It isn't Korean with an accent", 'viewers on the mainland get subtitles'],
    ko: ['아주 심각하게 위기에 처한 언어', '억양만 다른 한국어가 아닙니다', '육지 시청자에게는 자막이 붙습니다'],
  },
  ponies: {
    en: ['In 1276', 'Natural Monument No. 347', '1.2 m at the shoulder'],
    ko: ['1276년', '천연기념물 제347호', '1.2m 남짓'],
  },
  olle: {
    en: ['27 courses covering about 437 km', 'at conversation pace'],
    ko: ['27개 코스 약 437km', '대화하는 속도로 걷는 길'],
  },
  dolphins: {
    en: [
      'About 120 Indo-Pacific bottlenose dolphins',
      'the only such population in Korean waters',
      'Sixteen deaths were recorded in 2024',
      "the country's first ever created for dolphins",
    ],
    ko: [
      '약 120마리',
      '한국 바다에서 이런 무리는 여기밖에 없습니다',
      '2024년 한 해에만 16마리',
      '국내 첫 보호구역',
    ],
  },
  'weather-wind': {
    en: ['a 1,947 m mountain', 'the windward side gets rain while the leeward side stays dry', 'The wind is the constant'],
    ko: ['1,947m짜리 산', '바람 맞는 쪽에는 비가 오고 반대쪽은 마릅니다', '변하지 않는 건 바람입니다'],
  },
  jeju43: {
    // 숫자와 백비만. 참혹함을 굵기로 연출하지 않는다.
    en: ['14,442 civilian victims', 'a blank headstone, lying on its side'],
    ko: ['14,442명', '아무것도 새겨지지 않은 채 옆으로 누워 있는 비석'],
  },
};

function env(key) {
  const raw = readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
  const line = raw.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  if (!line) throw new Error(`.env.local 에 ${key} 가 없다`);
  return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '');
}

const supabase = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
});

const { data: rows, error } = await supabase
  .from('region_scripts')
  .select('id, topic_key, sort_order, region_script_locales ( locale, body )')
  .eq('region_key', 'jeju')
  .order('sort_order');
if (error) throw new Error(error.message);

const problems = [];
const writes = [];

for (const row of rows ?? []) {
  const spec = MANIFEST[row.topic_key];
  if (!spec) {
    problems.push(`${row.topic_key}: 매니페스트에 없다 — 주제가 늘었으면 강조도 정해야 한다`);
    continue;
  }
  for (const [locale, phrases] of Object.entries(spec)) {
    const loc = (row.region_script_locales ?? []).find((l) => l.locale === locale);
    if (!loc) {
      problems.push(`${row.topic_key}/${locale}: 본문 행이 없다`);
      continue;
    }
    let body = loc.body;
    let applied = 0;
    for (const phrase of phrases) {
      if (body.includes(`**${phrase}**`)) continue; // 이미 감싸져 있다 — 재실행 안전
      const count = body.split(phrase).length - 1;
      if (count !== 1) {
        problems.push(
          `${row.topic_key}/${locale}: "${phrase}" 가 ${count}번 나온다(1이어야 함)`,
        );
        continue;
      }
      body = body.replace(phrase, `**${phrase}**`);
      applied += 1;
    }
    if (body !== loc.body) writes.push({ scriptId: row.id, topic: row.topic_key, locale, body, applied });
  }
}

if (problems.length > 0) {
  console.error('\n🔴 구절을 확정할 수 없습니다 — 아무것도 쓰지 않았습니다:\n');
  for (const p of problems) console.error('   - ' + p);
  process.exit(2);
}

for (const w of writes) {
  console.log(`${apply ? '→' : '·'} ${w.topic.padEnd(18)} ${w.locale}  +${w.applied}`);
  if (!apply) continue;
  const { error: upErr } = await supabase
    .from('region_script_locales')
    .update({ body: w.body, updated_at: new Date().toISOString() })
    .eq('script_id', w.scriptId)
    .eq('locale', w.locale);
  if (upErr) {
    console.error(`✗ ${w.topic}/${w.locale}: ${upErr.message}`);
    process.exit(1);
  }
}

console.log(`\n${writes.length}개 본문 ${apply ? '반영' : '반영 예정'} (변경 없음 ${(rows ?? []).length * 2 - writes.length})`);
