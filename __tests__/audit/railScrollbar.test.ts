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
 * 범위 주석: 어드민(`components/admin/*`, `app/(marketing)/admin/*`)의 칩 레일은
 * `.scrollbar-hide` 가 아니라 인라인 arbitrary variant
 * (`[&::-webkit-scrollbar]:hidden`)를 쓰므로 이 게이트에 안 걸린다. **의도적이다** —
 * 이 트랙은 손님 표면만 손댔다. 어드민도 같은 결함을 갖고 있으니 별도 티켓감.
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

const HAS_X_SCROLL = /\boverflow-x-(auto|scroll)\b/;
const HIDES_BAR = /\bscrollbar-hide\b/;

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
    expect(block).toMatch(/scrollbar-width:\s*thin/);
    // 다시 숨기면 실패.
    expect(block).not.toMatch(/\.rail-scrollbar\s*\{[^}]*scrollbar-width:\s*none/);
    expect(block).not.toMatch(/\.rail-scrollbar::-webkit-scrollbar\s*\{[^}]*display:\s*none/);
    // 두께 0 도 "숨김" 이다.
    expect(block).not.toMatch(/\.rail-scrollbar::-webkit-scrollbar\s*\{[^}]*height:\s*0/);
  });
});
