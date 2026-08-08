// 문자 체계 혼입 스캔 — `i18n:verify`(G1~G11)가 못 잡는 결함을 따로 훑는다.
//
// 왜 필요한가: 2026-08-07 ru 작업에서 키릴 낱말 **안에** 한자·타밀·말라얄람 글자가
// 하나씩 박혀 있었다(`Чеджу形` · `Кваகчи`). G1~G11 어디에도 「문자 체계 혼입」 검사가
// 없고, 눈으로는 글자가 비슷해 그냥 읽힌다. 플랜 §7 의 슬러그 처리 레시피 5단계.
//
// 사용:
//   node scripts/i18n/charset-scan.mjs <locale> [slugFilter]
//   node scripts/i18n/charset-scan.mjs --selftest
//
// 🔴 범위는 반드시 \u 이스케이프로 적는다. 리터럴 범위(`[ -ɏ]` 꼴)로 적으면 보이지 않는
//    문자가 섞여 범위가 통째로 넓어진다 — 2026-08-08 에 실제로 NUL 이 들어가 키릴을
//    통과시키면서 초록을 냈다. **게이트를 죽이는 건 코드가 아니라 그 옆의 것이다.**
import fs from 'node:fs';

// 모든 로케일에 공통으로 정상인 것.
const COMMON =
  '\\u0020-\\u024F' + // ASCII + Latin-1 + Latin Ext-A/B
  '\\u1E00-\\u1EFF' + // Latin Extended Additional
  '\\u2000-\\u206F' + // General Punctuation (— ’ « » …)
  '\\u20A0-\\u20CF' + // Currency (₩ €)
  '\\u2100-\\u214F' + // Letterlike (№)
  '\\u2190-\\u21FF' + // Arrows (→)
  '\\u2200-\\u22FF' + // Math operators (≈)
  '\\u2460-\\u24FF' + // Enclosed alphanumerics (① ② — 영어 원문에 이미 있다)
  '\\u25A0-\\u25FF' + // Geometric shapes
  '\\u27E6-\\u27FF' + // ⟦ ⟧ 글로서리 토큰
  // 🔴 한글·한자는 허용한다 — 이 레포의 관례가 고유명사 뒤에 괄호 원어를 다는 것이고
  //    (`Hwaseong Haenggung (화성행궁)`), 발행된 행 전체가 그 형태다.
  '\\u3000-\\u303F' + // CJK 구두점
  '\\u3130-\\u318F' + // 한글 호환 자모
  '\\uAC00-\\uD7A3' + // 한글 음절
  '\\u4E00-\\u9FFF' + // 한자
  '\\u33A1' + // ㎡
  '\\s';

// 🔴 로케일별로 갈린다. 키릴은 ru 에서 본문이고, fr·de·it 에서는 사고다.
const CYRILLIC = '\\u0400-\\u04FF';
const EXTRA = { ru: CYRILLIC };

function allowedFor(locale) {
  return new RegExp('[' + COMMON + (EXTRA[locale] ?? '') + ']');
}

function offenders(s, allowed) {
  return [...new Set([...s].filter((ch) => !allowed.test(ch)))];
}

if (process.argv.includes('--selftest')) {
  const cases = [
    // [문자열, 로케일, 깨끗해야 하는가]
    ['Кваchi', 'fr', false], // 키릴 혼입 — 이 트랙의 진짜 사고 모양
    ['Кваchi', 'ru', true], // 같은 문자열이 ru 에선 정상
    ['Кваகчи', 'ru', false], // 타밀 혼입은 ru 에서도 사고
    ['Чеджу形', 'ru', true], // ⚠ 한자는 병기 관례라 허용 — 낱말 안 혼입은 눈으로
    ['Hwaseong Haenggung (화성행궁)', 'fr', true], // 관례: 괄호 원어
    ['Bulguksa (불국사) 藥泉寺', 'it', true], // 관례: 한자 병기
    ['naïve — élève ⟦G0⟧ ≈ 25 °C ₩8 000 № 1 → «test» … 09h00', 'fr', true],
    ['Itinéraire 3 : la côte et le vieux centre-ville', 'fr', true],
  ];
  let ok = true;
  for (const [s, loc, expectClean] of cases) {
    const o = offenders(s, allowedFor(loc));
    const clean = o.length === 0;
    if (clean !== expectClean) {
      ok = false;
      console.log(`🔴 SELFTEST [${loc}] ${JSON.stringify(s)} → ${clean ? 'clean' : o.join(' ')}`);
    }
  }
  console.log(ok ? '✅ selftest 통과' : '🔴 selftest 실패');
  process.exit(ok ? 0 : 1);
}

const loc = process.argv[2] ?? 'fr';
const filter = process.argv[3] ?? '';
const dir = `i18n-work/out/tour_product_pages/${loc}`;
const allowed = allowedFor(loc);

let bad = 0;
for (const f of fs.readdirSync(dir)) {
  if (filter && !f.includes(filter)) continue;
  const j = JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8'));
  for (const [k, v] of Object.entries(j.segments)) {
    const o = offenders(v, allowed);
    if (o.length) {
      bad++;
      console.log(f.replace(/^tour_product_pages_/, ''), k, o.join(' '));
    }
  }
}
console.log(bad === 0 ? `✅ 문자 혼입 0 (${loc}${filter ? ' · ' + filter : ''})` : `🔴 ${bad}건`);
process.exit(bad === 0 ? 0 : 1);
