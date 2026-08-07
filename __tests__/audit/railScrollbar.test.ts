/**
 * @jest-environment node
 *
 * 🔴 손님이 보는 가로 레일에서 스크롤바를 끄지 마라 — 데스크톱에서 **도달 불가**가 된다.
 *
 * 왜 테스트인가 (2026-08-07, 사장님 스크린샷):
 * 라이브 `www.atockorea.com` 을 1440px 로 실측하니 `/tours/list` 의
 * "Classic Bus Tour" 선반이 **1748px** 을, 상품 페이지 추천 레일이 **588px** 을
 * 화면 밖에 숨기고 있었다. 그 레일들은 전부 `.scrollbar-hide`
 * (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`) 를 달고 있었고,
 * 화살표 버튼도 없고 `tabIndex` 는 -1 이었다.
 *
 * 그리고 랩 실험(Chromium headless·headed 양쪽)에서 확인한 것:
 * **가로로만 스크롤되는 컨테이너 위에서 마우스 휠을 세로로 굴리면 페이지가 스크롤된다.
 * 레일은 안 움직인다.** 즉 스크롤바가 유일한 마우스 어포던스였고, 그걸 꺼 뒀다.
 * 트랙패드(가로 제스처)와 터치만 도달할 수 있었다 — 데스크톱 손님은 못 봤다.
 *
 * 계약 3가지:
 *  ① `overflow-x-auto|scroll` 과 `scrollbar-hide` 를 같은 요소에 같이 쓰지 않는다.
 *     대신 `.rail-scrollbar`(app/globals.css) — 터치에선 숨고, 마우스에선 얇게 보인다.
 *  ② 죽은 클래스명 금지. 이 레포엔 스크롤바 Tailwind 플러그인이 없다
 *     (`tailwind.config.js` → `plugins: []`). 그래서 `scrollbar-none`·`scrollbar-thin`
 *     은 **아무 일도 안 한다** — 붙여 놓고 "숨겼다"고 믿게 만드는 게 더 나쁘다.
 *     실제로 5곳이 그 상태였고 OS 기본 스크롤바가 그대로 나오고 있었다.
 *  ③ 뮤테이션 가드: `.rail-scrollbar` 의 fine-pointer 블록 안에서 다시 숨기면 실패한다.
 *
 * 계약 ④ (2026-08-07 확장, 사장님 지시 "관리자화면도 다 문제 있으면 수정하고"):
 * 인라인 변형(`[scrollbar-width:none]` · `[&::-webkit-scrollbar]:hidden` ·
 * `style={{ scrollbarWidth: 'none' }}`)으로 숨기는 것도 금지다. 어드민·관제 칩 레일
 * **6곳**이 정확히 그 형태로 게이트 밖에 숨어 있었다 — 클래스 이름만 보는 게이트는
 * 자기 어휘 밖의 같은 결함을 못 본다(PR #768 과 같은 함정).
 *
 * 계약 ⑤: `.rail-arrow` 의 기본 `display:none` 은 fine-pointer 미디어 블록 **위**에
 * 있어야 한다. 같은 특정도라 아래에 두면 나중 규칙이 이겨 화살표가 영영 안 나온다.
 * 이 실수를 실제로 한 번 저질렀다.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['components', 'app'];

/** 규칙을 설명하는 주석에는 반례가 그대로 적혀 있다 — 먼저 지운다. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(full);
  }
  return out;
}

const FILES = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d))).filter(
  (f) => !f.includes('__tests__'),
);

/**
 * className 하나를 통째로 본다. `cn(...)` 로 여러 줄에 나뉘어도 잡히도록
 * 문자열 리터럴 단위가 아니라 **JSX 속성 블록 단위**로 읽는다.
 */
const CLASS_BLOCK = /class(?:Name)?\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([\s\S]{0,900}?)\}\s*(?=\/?>|\n\s*[a-zA-Z-]+=))/g;

function classBlocks(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(CLASS_BLOCK)) out.push(m[1] ?? m[2] ?? m[3] ?? '');
  return out;
}

/** `@media`/`@supports` 한 덩어리를 중괄호로 세어 떼어낸다. 고정 길이 slice 금지. */
function braceBlock(css: string, from: number): string {
  let depth = 0;
  for (let i = css.indexOf('{', from); i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(from, i);
    }
  }
  throw new Error(`unbalanced CSS block at ${from}`);
}

const HAS_X_SCROLL = /\boverflow-x-(auto|scroll)\b/;
const HIDES_BAR = /\bscrollbar-hide\b/;
/** Tailwind arbitrary variants that switch the bar off without naming it. */
const HIDES_BAR_INLINE =
  /\[scrollbar-width:\s*none\]|\[&::-webkit-scrollbar\]:hidden|\[-ms-overflow-style:\s*none\]/;

/**
 * `SortSegmented` 는 레일이 아니라 **높이 고정(h-11) 세그먼트 컨트롤**이다. 10px 바가
 * 생기면 44px 탭 타깃이 34px 로 줄어든다. 데스크톱 실측 가로 넘침 0px.
 *
 * 스마트앱은 2026-08-07 에 편입됐다(사장님 지시 "손님 폰 앱 칩 줄도"). `.tr-chiprow` 가
 * fine pointer 에서 같은 얇은 바를 그린다 — 규칙 ⑦ 참고. `TimeWheel` 은 세로 휠 피커라
 * `overflow-y-scroll` 이고, 이 규칙은 가로축만 본다.
 */
const INLINE_HIDE_ALLOWED = ['components/tours-list/SortSegmented.tsx'];
const allowedInlineHide = (rel: string) =>
  INLINE_HIDE_ALLOWED.some((p) => rel.replace(/\\/g, '/').includes(p));

describe('audit: 손님 가로 레일 스크롤바', () => {
  it('① `overflow-x-auto` 요소가 `scrollbar-hide` 를 달고 있지 않다', () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const src = stripComments(readFileSync(file, 'utf8'));
      for (const block of classBlocks(src)) {
        if (HAS_X_SCROLL.test(block) && HIDES_BAR.test(block)) {
          offenders.push(`${path.relative(ROOT, file)} :: ${block.replace(/\s+/g, ' ').trim().slice(0, 120)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('② 죽은 스크롤바 클래스명(`scrollbar-none`/`scrollbar-thin`)이 없다', () => {
    // 근거: 플러그인이 없으므로 이 이름들은 CSS 로 존재하지 않는다.
    const tw = readFileSync(path.join(ROOT, 'tailwind.config.js'), 'utf8');
    expect(tw).toMatch(/plugins:\s*\[\s*\]/);
    const css = readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');
    expect(css).not.toMatch(/\.scrollbar-(none|thin)\b/);

    const offenders: string[] = [];
    for (const file of FILES) {
      const src = stripComments(readFileSync(file, 'utf8'));
      if (/\bscrollbar-(none|thin)\b/.test(src)) offenders.push(path.relative(ROOT, file));
    }
    expect(offenders).toEqual([]);
  });

  it('③ `.rail-scrollbar` 는 마우스 기기에서 실제로 보인다 (뮤테이션 가드)', () => {
    const css = readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');
    expect(css).toMatch(/\.rail-scrollbar\b/);

    // fine-pointer 블록을 통째로 떼어 본다.
    const start = css.indexOf('@media (hover: hover) and (pointer: fine)');
    expect(start).toBeGreaterThan(-1);
    let depth = 0;
    let end = -1;
    for (let i = css.indexOf('{', start); i < css.length; i += 1) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    expect(end).toBeGreaterThan(start);
    const block = css.slice(start, end);

    // 보여야 한다.
    expect(block).toMatch(/\.rail-scrollbar::-webkit-scrollbar\s*\{[^}]*display:\s*block/);
    // 다시 숨기면 실패.
    expect(block).not.toMatch(/\.rail-scrollbar\s*\{[^}]*scrollbar-width:\s*none/);
    expect(block).not.toMatch(/\.rail-scrollbar::-webkit-scrollbar\s*\{[^}]*display:\s*none/);
    // 두께 0 도 "숨김" 이다.
    expect(block).not.toMatch(/\.rail-scrollbar::-webkit-scrollbar\s*\{[^}]*height:\s*0/);

    /*
     * 🔴 그리고 이 한 줄이 진짜 함정이다.
     *
     * Chromium 실측(headed, 2026-08-08):
     *   scrollbar-width: thin + ::-webkit-scrollbar{height:5px} → gutter 10px
     *   scrollbar-width: auto + ::-webkit-scrollbar{height:5px} → gutter  5px
     *
     * **non-initial `scrollbar-width` 는 그 요소의 `::-webkit-scrollbar` 규칙을
     * 통째로 무시하게 만든다.** 그래서 첫 버전은 아무도 디자인하지 않은 바를
     * 내보냈다 — 크로미움 기본 "thin" 크롬 10px. 게다가 pseudo-element 의
     * `getComputedStyle` 은 **지정값** 5px 을 그대로 돌려줘서 측정도 속였다.
     * 판정은 `offsetHeight - clientHeight`(gutter) 로 한다.
     */
    expect(block).not.toMatch(/\.rail-scrollbar\s*\{[^}]*scrollbar-width:\s*thin/);

    // 파이어폭스는 `::-webkit-scrollbar` 가 없다 — 표준 속성 분기가 있어야 한다.
    expect(css).toMatch(/@supports not selector\(::-webkit-scrollbar\)/);
    const ffAt = css.indexOf('@supports not selector(::-webkit-scrollbar)');
    expect(css.slice(ffAt)).toMatch(/\.rail-scrollbar\s*\{[^}]*scrollbar-width:\s*thin/);
    // 순서: 파이어폭스 분기가 뒤에 와야 `auto` 를 덮는다.
    expect(ffAt).toBeGreaterThan(start);
  });

  it('④ 인라인 변형으로 가로 레일의 스크롤바를 끄지 않는다', () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const rel = path.relative(ROOT, file);
      if (allowedInlineHide(rel)) continue;
      const src = stripComments(readFileSync(file, 'utf8'));

      for (const block of classBlocks(src)) {
        if (HAS_X_SCROLL.test(block) && HIDES_BAR_INLINE.test(block)) {
          offenders.push(`${rel} :: ${block.replace(/\s+/g, ' ').trim().slice(0, 110)}`);
        }
      }
      // `style={{ scrollbarWidth: 'none' }}` — 인라인 스타일은 클래스를 이긴다.
      if (/scrollbarWidth\s*:\s*['"]none['"]/.test(src)) {
        offenders.push(`${rel} :: style={{ scrollbarWidth: 'none' }}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('⑥ `components/` 하위 폴더가 전부 Tailwind 스캔 대상이다', () => {
    /*
     * 🔴 `tailwind.config.js` 의 `content` 는 폴더 **화이트리스트**다. 목록에 없는
     * 폴더의 클래스는 조용히 생성되지 않는다 — DOM 엔 클래스가 있는데 규칙이 없다.
     * `tour-ops` 가 그렇게 스타일시트를 통째로 잃었고(설정 파일 주석), 2026-08-07 에
     * `tours-list` 가 같은 걸 했다: 선반 화살표의 `top-[38%]` 이 생성 안 돼 `top:auto`
     * 로 떨어지면서 버튼이 레일 **바닥**에 붙었다. 실렌더에서 `top` 을 재서야 잡혔다.
     */
    const cfg = readFileSync(path.join(ROOT, 'tailwind.config.js'), 'utf8');
    const listed = [...cfg.matchAll(/^\s*'([^']+)',/gm)].map((m) => m[1]);
    const dirs = readdirSync(path.join(ROOT, 'components'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      // v0 export folders carry their own node_modules — deliberately unscanned.
      .filter((d) => !/^b_/.test(d.name))
      .map((d) => d.name);
    const missing = dirs.filter((d) => !listed.includes(d));
    expect(missing).toEqual([]);
  });

  it('⑦ 스마트앱 `.tr-chiprow` 도 마우스에서 바를 그린다', () => {
    /*
     * 손님·기사 폰 앱의 칩 줄. 오래 "모바일 칩 줄에 바가 보이는 건 더 나쁘다" 는
     * 이유로 꺼 뒀는데, 그 판단은 **손가락 기준**이었다. 스태프는 이 앱을 데스크톱에서
     * 연다(가이드 좌석 스트립·공지 패널·기사 콕핏이 전부 `.tr-chiprow`).
     * 마스크 페이드는 "더 있다" 고 말할 뿐 갈 방법을 주지 않는다.
     */
    const css = readFileSync(path.join(ROOT, 'app/tour-room-theme.css'), 'utf8');
    const start = css.indexOf('@media (hover: hover) and (pointer: fine)');
    expect(start).toBeGreaterThan(-1);
    /*
     * 🔴 고정 길이로 잘라내면 안 된다. 처음엔 `slice(start, start + 1400)` 로 떴는데
     * 그게 **바로 뒤의 파이어폭스 `@supports` 블록까지 삼켜서** 거기 있는
     * `scrollbar-width: thin` 을 webkit 블록의 위반으로 신고했다. 중괄호로 센다.
     */
    const block = braceBlock(css, start);
    expect(block).toMatch(/\.tr-chiprow::-webkit-scrollbar\s*\{[^}]*display:\s*block/);
    expect(block).not.toMatch(/\.tr-chiprow::-webkit-scrollbar\s*\{[^}]*height:\s*0/);
    // `.rail-scrollbar` 와 같은 함정 — `thin` 을 쓰면 webkit 규칙이 통째로 무시된다.
    expect(block).not.toMatch(/\.tr-chiprow\s*\{[^}]*scrollbar-width:\s*thin/);
    const ffAt = css.indexOf('@supports not selector(::-webkit-scrollbar)');
    expect(ffAt).toBeGreaterThan(start);
    expect(css.slice(ffAt)).toMatch(/\.tr-chiprow\s*\{[^}]*scrollbar-width:\s*thin/);
  });

  it('⑤ `.rail-arrow` 기본 숨김이 미디어 블록보다 위에 있다 (순서 뮤테이션 가드)', () => {
    const css = readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');
    const base = css.search(/\.rail-arrow\s*\{\s*display:\s*none/);
    const media = css.indexOf('@media (hover: hover) and (pointer: fine)');
    expect(base).toBeGreaterThan(-1);
    expect(media).toBeGreaterThan(-1);
    // 같은 특정도 — 아래에 두면 화살표가 영영 안 나온다.
    expect(base).toBeLessThan(media);
    const shown = css.slice(media);
    expect(shown).toMatch(/\.rail-arrow\s*\{\s*display:\s*(inline-)?flex/);
  });
});
