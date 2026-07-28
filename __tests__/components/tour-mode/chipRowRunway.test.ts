/**
 * 🔴 상설 가드 — 칩 줄의 페이드는 **자기가 착지할 자리**를 갖고 있어야 한다.
 *
 * `.tr-chiprow`의 오른쪽 28px 페이드는 "더 있다"는 신호였다. 그런데 flex 줄은
 * 마지막 아이템 뒤에 아무것도 두지 않으므로, 페이드가 내려앉을 곳이 **마지막 칩
 * 자신**이었다. 시드 룸 390px에서 각 줄을 끝까지 스크롤한 뒤 실측:
 *
 *   quick-signal-bar  칩 6개   끝 여백 0px   → 마지막 칩의 28px가 먹힘
 *   quick-replies     칩 12개  끝 여백 12px  → 마지막 칩의 16px가 먹힘
 *
 * 손님이 무엇을 하든 **마지막 선택지는 영영 흐려진 채**였다. 시그널 줄에서 마지막
 * 선택지들은 길 잃은 손님이 찾는 것들이다.
 *
 * 고친 뒤 같은 측정: 여백 34px / 46px, 먹히는 양 0px / 0px.
 *
 * 이 가드가 지키는 불변식은 **활주로 ≥ 페이드**다. 둘 중 하나만 바꾸면 여기서
 * 실패한다 — 이 버그가 정확히 "둘이 따로 정해져 있었기" 때문에 생겼다.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const CSS = readFileSync(path.join(process.cwd(), 'app/tour-room-theme.css'), 'utf8');

/** The fade width, read from where it is actually declared. */
function fadeWidthPx(): number {
  const block = /@property --tr-chiprow-trail\s*\{([^}]*)\}/.exec(CSS);
  expect(block).not.toBeNull();
  const initial = /initial-value:\s*(\d+(?:\.\d+)?)px/.exec(block![1]);
  expect(initial).not.toBeNull();
  return Number(initial![1]);
}

/** The runway width, read from the ::after that provides it. */
function runwayPx(): number {
  const block = /\.tr-chiprow::after\s*\{([^}]*)\}/.exec(CSS);
  expect(block).not.toBeNull();
  const basis = /flex:\s*0\s+0\s+(\d+(?:\.\d+)?)px/.exec(block![1]);
  expect(basis).not.toBeNull();
  return Number(basis![1]);
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return name.endsWith('.tsx') ? [full] : [];
  });
}

describe('chip row fade has somewhere to land', () => {
  it('runway is at least as wide as the fade', () => {
    const fade = fadeWidthPx();
    const runway = runwayPx();
    expect({ fade, runway, ok: runway >= fade }).toEqual({ fade, runway, ok: true });
  });

  it('the mask is driven by the two properties, not by a hard-coded edge', () => {
    // A literal `calc(100% - 28px)` here is how the first version drifted out of
    // step with the runway: two numbers, one meaning.
    const rule = /\.tr-chiprow\s*\{([^}]*)\}/.exec(CSS);
    expect(rule).not.toBeNull();
    expect(rule![1]).toContain('var(--tr-chiprow-lead)');
    expect(rule![1]).toContain('var(--tr-chiprow-trail)');
  });

  it('every user of the class is a flex container', () => {
    // The runway is a flex item. On a non-flex `.tr-chiprow` it would become a
    // block and take a whole line instead of 28px of trailing space.
    const offenders: string[] = [];
    for (const file of [...walk(path.join(process.cwd(), 'components/tour-mode'))]) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/className=(?:"([^"]*\btr-chiprow\b[^"]*)"|\{`([^`]*\btr-chiprow\b[^`]*)`\})/g)) {
        const classes = (m[1] ?? m[2] ?? '').replace(/\s+/g, ' ').trim();
        if (!/\bflex\b/.test(classes)) {
          offenders.push(`${path.relative(process.cwd(), file).replace(/\\/g, '/')}\n    ${classes}`);
        }
      }
    }
    expect(offenders.join('\n\n')).toBe('');
  });

  it('the scroll-driven half stays optional', () => {
    // Without scroll-driven animation support the properties keep their initial
    // values, which reproduce the original right-only mask. That is the whole
    // reason the fallback is safe, so the @supports wrapper is part of the
    // contract rather than a stylistic choice.
    const at = CSS.indexOf('animation-timeline: scroll(self inline)');
    expect(at).toBeGreaterThan(-1);
    const before = CSS.slice(0, at);
    expect(before.lastIndexOf('@supports (animation-timeline: scroll())')).toBeGreaterThan(
      before.lastIndexOf('\n}\n@media'),
    );
    expect(/@property --tr-chiprow-lead[\s\S]*?initial-value:\s*0px/.test(CSS)).toBe(true);
  });
});
