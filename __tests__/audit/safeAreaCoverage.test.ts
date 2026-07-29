/**
 * @jest-environment node
 *
 * R9 — PWA 스코프 안의 모든 표면은 세이프에어리어를 스스로 처리한다.
 *
 * `app/tour-mode/layout.tsx`와 `app/admin/tour-ops/layout.tsx`는
 * `statusBarStyle: 'black-translucent'`을 쓴다. 설치된 PWA에서 이 설정의 의미는
 * **웹뷰가 상태바 아래에서 시작하고 홈 인디케이터 아래에서 끝난다**는 것이다.
 * 즉 `env(safe-area-inset-*)`을 반영하지 않은 루트는 첫 줄과 마지막 줄을
 * OS 크롬에 먹힌다.
 *
 * 이게 왜 테스트인가: 같은 증상이 2026-07-27 하루에 **세 번** 보고됐다
 * (itinerary 페이지 → 서랍 → "앱 전반"). 브라우저에서는 `env()`가 0이라
 * Playwright walk도, 육안 QA도 이 결함을 재현하지 못한다. 잡을 수 있는 곳은
 * 소스뿐이다.
 *
 * 계약: `/tour-mode` 아래 각 page.tsx가 렌더하는 컴포넌트는
 *   (a) 인셋을 처리하는 셸(RoomShell/StaffShell/Screen)을 렌더하거나
 *   (b) 자기 루트에서 tr-safe-* 또는 env(safe-area-inset-*)을 쓰거나
 * 둘 중 하나여야 한다.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

// X13: the tour app lives in its own route group with its own root layout.
const PAGES_DIR = existsSync('app/(app)/tour-mode') ? 'app/(app)/tour-mode' : 'app/tour-mode';

/** 인셋을 이미 처리하는 셸. 이걸 렌더하면 페이지는 물려받는다. */
const INSET_AWARE_SHELLS = ['RoomShell', 'StaffShell', 'Screen'];

const HANDLES_INSETS = /tr-safe-top|tr-safe-bottom|safe-area-inset/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return entry === 'page.tsx' ? [full.replace(/\\/g, '/')] : [];
  });
}

/** page.tsx가 import 하는 로컬 컴포넌트 파일 경로들. */
function importedComponents(pageSrc: string): string[] {
  return [...pageSrc.matchAll(/from '(@\/components\/[^']+)'/g)]
    .map((m) => m[1].replace('@/', ''))
    .flatMap((base) => [`${base}.tsx`, `${base}.ts`])
    .filter((p) => {
      try {
        return statSync(p).isFile();
      } catch {
        return false;
      }
    });
}

describe('🔴 R9 — /tour-mode PWA 표면은 세이프에어리어를 처리한다', () => {
  const pages = walk(PAGES_DIR);

  it('스캔 대상이 실제로 존재한다 — 0건이면 이 테스트는 장식이다', () => {
    expect(pages.length).toBeGreaterThanOrEqual(6);
  });

  it('모든 페이지가 인셋을 처리하거나, 처리하는 셸을 렌더한다', () => {
    const offenders: string[] = [];

    for (const page of pages) {
      const components = importedComponents(readFileSync(page, 'utf8'));
      if (!components.length) continue;

      const ok = components.some((file) => {
        const src = readFileSync(file, 'utf8');
        if (HANDLES_INSETS.test(src)) return true;
        return INSET_AWARE_SHELLS.some((shell) =>
          new RegExp(`<${shell}[\\s>]|\\b${shell}\\b\\s*,?\\s*$`, 'm').test(src),
        );
      });

      if (!ok) offenders.push(`${page} → ${components.map((c) => path.basename(c)).join(', ')}`);
    }

    expect(
      offenders.length === 0
        ? ''
        : `\nblack-translucent 스코프인데 인셋을 아무도 처리하지 않는 표면:\n  ${offenders.join('\n  ')}\n`,
    ).toBe('');
  });

  it('셸 두 개는 여전히 인셋을 처리한다 — 여기서 빠지면 전부가 무너진다', () => {
    for (const shell of ['components/tour-mode/RoomShell.tsx', 'components/tour-mode/staff/StaffShell.tsx']) {
      const src = readFileSync(shell, 'utf8');
      expect(src).toMatch(/tr-safe-top/);
      expect(src).toMatch(/tr-safe-bottom/);
    }
  });

  it('레이아웃이 여전히 black-translucent다 — 아니면 이 게이트의 전제가 바뀐 것', () => {
    // 누군가 'default'로 바꾸면 웹뷰가 상태바 아래에서 시작하지 않으므로
    // 위 요구사항의 근거가 사라진다. 전제가 바뀌면 여기서 알려준다.
    const layout = readFileSync(`${PAGES_DIR}/layout.tsx`, 'utf8');
    expect(layout).toContain('black-translucent');
  });
});
