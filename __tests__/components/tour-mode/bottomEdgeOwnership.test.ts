/**
 * 🔴 상설 가드 — 손님 방의 **아래쪽 가장자리는 입력창과 탭바의 것이다.**
 *
 * `InstallBanner`가 `fixed inset-x-3 z-40` + `bottom: calc(...)`로 뷰포트 바닥에
 * 붙어 있었다. 시드 룸에서 iPhone 13 크기로 `elementFromPoint` 히트 테스트한 결과:
 *
 *   입력창(textarea)  y 557-599   세 지점 전부 배너의 <p>가 잡힘
 *   탭바              y 607-664   가운데·오른쪽이 배너에 잡힘
 *
 * 즉 D-1 기간 동안 손님은 **메시지를 쓸 수도, 탭을 옮길 수도 없었다.** 빠져나가는
 * 길은 작은 회색 "Not now" 하나뿐인데, 그걸 크롬으로 읽은 손님은 영영 못 나온다.
 *
 * 스크린샷으로는 안 잡힌다 — 배너도 입력창도 **둘 다 화면에 있기 때문이다.**
 * 겹침은 z 순서에만 존재한다. 그래서 이 가드는 소스를 읽는다.
 *
 * 규칙: 바닥에 고정되는 레이어는 **전면(`inset-0`)이거나, 고정이 아니거나** 둘 중
 * 하나여야 한다. 그 사이(바닥에 붙은 부분 높이 레이어)가 정확히 사고 지점이다.
 * 전면 오버레이는 의도적으로 전부를 덮고, 자기 안에 닫기 수단을 갖는다.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'components/tour-mode');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return name.endsWith('.tsx') ? [full] : [];
  });
}

/** A tailwind class list containing `fixed`, captured with its whole string. */
const FIXED_CLASS = /className=(?:"([^"]*\bfixed\b[^"]*)"|\{`([^`]*\bfixed\b[^`]*)`\})/g;

/** Full-screen overlays own the whole viewport, including the dock. Allowed. */
const FULL_SCREEN = /\binset-0\b|\btop-0\b[\s\S]*\bbottom-0\b/;

/**
 * The deliberate exception. A surface with no composer and no tab bar — the
 * planner, say — may own its own bottom edge, because there is nothing beneath
 * to cover. What it must not do is take that silently: the scroll region above
 * it has to reserve matching clearance, or the last card is unreachable
 * instead of the composer. So the exception is claimed in a comment that says
 * where the clearance lives, and the next person to add a bottom bar has to
 * write that sentence before this gate lets them past.
 */
const DECLARED_DOCK = /bottom-dock:/;

/** Anchored to the bottom edge — `bottom-N`, `inset-y-`, or an inline bottom. */
const BOTTOM_ANCHORED = /\bbottom-(?:\[[^\]]*\]|\d|px|auto)/;

type Finding = { file: string; classes: string; why: string };

function scan(): Finding[] {
  const found: Finding[] = [];
  for (const file of walk(ROOT)) {
    const src = readFileSync(file, 'utf8');
    const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');

    for (const m of src.matchAll(FIXED_CLASS)) {
      const classes = (m[1] ?? m[2] ?? '').replace(/\s+/g, ' ').trim();
      if (FULL_SCREEN.test(classes)) continue;
      // A declared dock: the claim must sit right above the element.
      if (DECLARED_DOCK.test(src.slice(Math.max(0, m.index! - 700), m.index!))) continue;

      // Tailwind bottom anchor on the same element.
      if (BOTTOM_ANCHORED.test(classes)) {
        found.push({ file: rel, classes, why: 'fixed + bottom-* but not full screen' });
        continue;
      }

      // Inline `bottom:` in the style prop that follows this className. The
      // window is generous on purpose — the two are always written together,
      // and InstallBanner had exactly this shape.
      const after = src.slice(m.index! + m[0].length, m.index! + m[0].length + 400);
      if (/style=\{\{[^}]*\bbottom:/.test(after)) {
        found.push({ file: rel, classes, why: 'fixed + inline bottom: but not full screen' });
      }
    }
  }
  return found;
}

describe('the bottom edge of the guest room belongs to the composer and the tab bar', () => {
  it('has no partial-height layer pinned to the bottom of the viewport', () => {
    const findings = scan();
    // Printed as a list so a failure names the file and the exact class string,
    // rather than making the next reader re-derive the rule from this comment.
    expect(
      findings.map((f) => `${f.file}\n    ${f.why}\n    ${f.classes}`).join('\n\n'),
    ).toBe('');
  });

  it('still catches the shape that shipped', () => {
    // Guard on the guard: the matcher must recognise the real regression, not
    // just return an empty list because it stopped matching anything at all.
    const shipped = 'fixed inset-x-3 z-40 mx-auto max-w-2xl rounded-[var(--tr-radius-card)] p-4';
    expect(FULL_SCREEN.test(shipped)).toBe(false);
    expect(BOTTOM_ANCHORED.test('fixed bottom-2 inset-x-3')).toBe(true);

    const withInlineBottom = `className="${shipped}" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}`;
    const m = [...withInlineBottom.matchAll(FIXED_CLASS)][0];
    expect(m).toBeDefined();
    const after = withInlineBottom.slice(m.index! + m[0].length);
    expect(/style=\{\{[^}]*\bbottom:/.test(after)).toBe(true);
  });

  it('does not flag a full-screen overlay', () => {
    expect(FULL_SCREEN.test('fixed inset-0 z-50 bg-black/40')).toBe(true);
  });
});
