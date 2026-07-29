/**
 * C1 (§D-5 U-D11) — 상설 셸 표면 계약 게이트.
 *
 * 모든 `.tr-root` 셸은 자기 서브트리에 두 가지를 심어야 한다:
 *   - `--tr-font-scale` — 모든 `tr-*` 크기가 `calc(… * var(…, 1))`이므로
 *   - `data-tr-skin`   — 스킨 토큰 블록이 이 속성을 키로 잡으므로
 *
 * 🔴 이게 왜 테스트가 되었나: RoomShell과 StaffShell은 손으로 심었고 콕핏은
 * **아예 빠져 있었다**(사용자 리포트 2026-07-28). 그리고 아무것도 실패하지
 * 않았다 — CSS 폴백이 `1`이고 속성이 없으면 어떤 스킨 블록에도 매치되지 않으니,
 * 설정 화면은 일어나지 않는 변화를 계속 약속했다. **조용히 죽는 계약은 반드시
 * 테스트로 잡아야 한다.**
 *
 * 손으로 베낀 계약은 현재 셸이 아니라 **다음 셸에서** 어긋난다 — 이번이 바로
 * 그 사례다. 그래서 실제로 렌더해서 DOM을 확인한다. import 문 grep은 훅을
 * 부르고 결과를 안 쓰는 셸을 통과시킨다.
 */
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import RoomShell from '@/components/tour-mode/RoomShell';
import StaffShell from '@/components/tour-mode/staff/StaffShell';
import { Screen } from '@/components/tour-mode/cockpit/Cockpit';
import PlanEditorClient from '@/components/tour-mode/plan/PlanEditorClient';
import { __resetTourRoomSettingsForTests, writeTourRoomSettings } from '@/hooks/useTourRoomSettings';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));

/** The element that actually carries `.tr-root` — the contract's subject. */
function trRoot(container: HTMLElement): HTMLElement {
  const el = container.querySelector('.tr-root');
  if (!el) throw new Error('shell rendered no .tr-root');
  return el as HTMLElement;
}

const SHELLS: Array<{ name: string; render: () => HTMLElement }> = [
  {
    name: 'RoomShell (guest)',
    render: () =>
      trRoot(
        render(
          <RoomShell
            locale="en"
            lifecycle="live"
            connection="realtime"
            title="Test tour"
            schedule={[]}
            chat={<div />}
            settings={<div />}
          />,
        ).container,
      ),
  },
  {
    name: 'StaffShell (guide console)',
    render: () =>
      trRoot(
        render(
          <StaffShell
            title="Test tour"
            lifecycle="lobby"
            chat={<div />}
            seats={<div />}
            ops={<div />}
            settings={<div />}
          />,
        ).container,
      ),
  },
  {
    name: 'Cockpit Screen (drive mode)',
    render: () => trRoot(render(<Screen>{null}</Screen>).container),
  },
];

/**
 * 🔴 P7.1b — the FOURTH shell, and the one this file predicted.
 *
 * The comment above says a hand-copied contract drifts on the NEXT shell, not
 * the current one. The planner was that next shell: it carries `.tr-root`, it
 * opens standalone from the invite email with nothing above it, and it planted
 * neither half of the contract. Measured with the same localStorage in both:
 * room `--tr-font-scale` 1.35, planner 1.
 *
 * It is listed separately from SHELLS because it is a PARTIAL signatory by
 * design — text scale yes, skin not until P7.8 (§N-9 option B). Folding it into
 * the array above would make the skin case fail and invite someone to "fix" it
 * by stamping an attribute whose palette consequences have not been designed.
 */
const PLANNER = () =>
  trRoot(render(<PlanEditorClient bookingId="00000000-0000-4000-8000-000000000000" />).container);

describe('shell surface contract (C1)', () => {
  beforeEach(() => {
    __resetTourRoomSettingsForTests();
    window.localStorage.clear();
  });

  it.each(SHELLS)('$name plants data-tr-skin on its .tr-root', ({ render: mount }) => {
    writeTourRoomSettings({ skin: 'jeju' });
    expect(mount().getAttribute('data-tr-skin')).toBe('jeju');
  });

  it.each(SHELLS)('$name plants --tr-font-scale on its .tr-root', ({ render: mount }) => {
    // Step 1 = 0.85. A shell that forgets the variable reads '' here, which is
    // exactly the cockpit's old behaviour — the CSS then falls back to 1 and
    // the setting silently does nothing.
    writeTourRoomSettings({ textScale: 1 });
    expect(mount().style.getPropertyValue('--tr-font-scale')).toBe('0.85');
  });

  it.each(SHELLS)('$name tracks a text-scale CHANGE, not just a default', ({ render: mount }) => {
    writeTourRoomSettings({ textScale: 5 });
    expect(mount().style.getPropertyValue('--tr-font-scale')).toBe('1.35');
  });

  describe('the planner (P7.1b — partial signatory by design)', () => {
    it('plants --tr-font-scale on its .tr-root', () => {
      writeTourRoomSettings({ textScale: 1 });
      expect(PLANNER().style.getPropertyValue('--tr-font-scale')).toBe('0.85');
    });

    it('tracks a text-scale CHANGE, not just a default', () => {
      writeTourRoomSettings({ textScale: 5 });
      expect(PLANNER().style.getPropertyValue('--tr-font-scale')).toBe('1.35');
    });

    /**
     * 🔴 The planner has FOUR `.tr-root` return paths, not one: loading, dead
     * link, the read-only fixed-itinerary view, and the editor. Wiring the two
     * obvious ones is the same bug at half the size — a guest who enlarged
     * their text still meets the loading and dead-link screens, and the
     * dead-link screen is exactly what an expired invite renders.
     *
     * This asserts on the SOURCE rather than by rendering each branch, because
     * three of the four need a live session to reach and a test that can only
     * reach one branch would go green while the other three drifted.
     */
    it('plants it on ALL four root return paths, not just the editor', () => {
      const source = readFileSync(
        path.join(process.cwd(), 'components', 'tour-mode', 'plan', 'PlanEditorClient.tsx'),
        'utf8',
      );
      const rootLines = source
        .split('\n')
        .map((line, i) => ({ line, no: i + 1 }))
        .filter(({ line }) => /className=\{`[^`]*\btr-root\b/.test(line));

      expect(rootLines.length).toBe(4);

      // Each root's element must carry the surface style within its own JSX tag.
      const unwired = rootLines.filter(({ no }) => {
        const tag = source.split('\n').slice(no - 1, no + 6).join('\n');
        return !tag.includes('surfaceStyle');
      });
      expect(unwired.map((r) => `${r.no}: ${r.line.trim().slice(0, 70)}`)).toEqual([]);
    });

    /**
     * Deliberate, not forgotten. P7.8 flips this when §N-9 option B has decided
     * which token families a skin may touch in this scope; until then stamping
     * the attribute ships a gradient whose two stops come from different
     * families (see PlanEditorClient's own note).
     */
    it('does NOT carry data-tr-skin yet — P7.8 owns that decision', () => {
      writeTourRoomSettings({ skin: 'jeju' });
      expect(PLANNER().getAttribute('data-tr-skin')).toBeNull();
    });
  });

  /**
   * The cockpit's theme rule is its own (A5): night driving means dark unless
   * the driver explicitly chose light. Pinned here because C1 routed it
   * through the shared contract, and a refactor that "unified" it into
   * follow-the-system would hand a driver a white screen at night.
   */
  it('the cockpit stays dark under system preference, and only explicit light lifts it', () => {
    writeTourRoomSettings({ theme: 'system' });
    expect(render(<Screen>{null}</Screen>).container.querySelector('.dark')).not.toBeNull();

    __resetTourRoomSettingsForTests();
    writeTourRoomSettings({ theme: 'light' });
    expect(render(<Screen>{null}</Screen>).container.querySelector('.dark')).toBeNull();
  });
});
