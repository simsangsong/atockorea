/**
 * 🔴 지역 해설 번역에 **다른 언어의 문자**가 섞이지 않았는지.
 *
 * 이 게이트가 생긴 이유: 2026-08-02, 중국어 본문 32곳에 한글이 그대로 박힌
 * 채로 열 개 로케일이 전부 초록이었다. `verifyUnit` G1~G11 어느 것도 이걸
 * 묻지 않는다 — 숫자도 태그도 URL도 아니고, 길이비는 정상이며, 미번역 검사는
 * 원문과 **같은** 문자열을 찾지 원문에 없던 제3의 문자를 찾지 않는다.
 * 사장님이 화면을 보고 「올레길은 偶来路로 번역해야지」라고 해서 드러났다.
 *
 * 왜 DB가 아니라 JSON 파일을 보는가: `i18n-work/region-scripts/*.json` 이
 * 번역의 원본이고 커밋되어 있다. DB를 읽으면 테스트가 네트워크와 자격증명에
 * 매이고, 라이브가 파일보다 앞서면 무엇이 옳은지 알 수 없게 된다. 쓰기 시점의
 * 방어는 `scripts/apply-region-script-locale.ts` 가 같은 함수로 한다.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ALLOWED_SCRIPTS, findScriptMix, SCRIPT_MIX_EXEMPT_TOPICS } from '@/lib/i18n/scriptMix';

const DIR = path.join(process.cwd(), 'i18n-work', 'region-scripts');

type Unit = { title: string; teaser: string; body: string; fun_fact?: string | null };

const files = existsSync(DIR)
  ? readdirSync(DIR).filter((f) => f.endsWith('.json'))
  : [];

describe('지역 해설 번역 — 로케일에 없는 문자 체계', () => {
  it('실제로 파일을 읽었다', () => {
    // 🔴 0개를 재면서 초록이 되는 것을 막는 백스톱. 이 저장소가 같은 방식으로
    // 두 번 속은 적이 있다(FA-002, 그리고 오늘 jest 스코프).
    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  it.each(files)('%s 에 다른 언어의 문자가 없다', (file) => {
    const locale = file.replace(/\.json$/, '');
    const data = JSON.parse(readFileSync(path.join(DIR, file), 'utf8')) as Record<string, Unit>;
    const violations: string[] = [];
    for (const [topicKey, unit] of Object.entries(data)) {
      for (const f of findScriptMix(locale, topicKey, {
        title: unit.title,
        teaser: unit.teaser,
        body: unit.body,
        fun_fact: unit.fun_fact ?? null,
      })) {
        violations.push(`${topicKey}/${f.field} [${f.script}] ${f.samples.join(' ')}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('검사 대상 로케일이 표에 다 있다 — 모르는 로케일은 조용히 통과한다', () => {
    const missing = files
      .map((f) => f.replace(/\.json$/, ''))
      .filter((l) => !ALLOWED_SCRIPTS[l]);
    expect(missing).toEqual([]);
  });

  it('예외는 「제주어」편 하나뿐이다', () => {
    // 예외가 늘어나면 게이트는 있으나 마나가 된다. 늘리려면 이 줄을 고쳐야 하고,
    // 고치는 순간 리뷰어 눈에 띈다.
    expect([...SCRIPT_MIX_EXEMPT_TOPICS]).toEqual(['jeju-language']);
  });

  it('🔴 규칙이 실제로 무언가를 잡는다 — 뮤테이션', () => {
    // 판정기가 늘 빈 배열을 돌려주는 상태로 망가지면 위 케이스는 전부 초록이다.
    const hangulInChinese = findScriptMix('zh', 'olle', { body: '올레是回家的路' });
    expect(hangulInChinese).toHaveLength(1);
    expect(hangulInChinese[0].script).toBe('hangul');

    const cjkInGerman = findScriptMix('de', 'jeju43', { body: 'Die Antwort war 長 und lang' });
    expect(cjkInGerman).toHaveLength(1);

    // 예외 주제는 통과해야 한다.
    expect(findScriptMix('zh', 'jeju-language', { body: '혼저옵서예' })).toEqual([]);
    // 허용된 조합은 통과해야 한다.
    expect(findScriptMix('ja', 'olle', { body: 'オルレは家へ帰る道です' })).toEqual([]);
  });
});
