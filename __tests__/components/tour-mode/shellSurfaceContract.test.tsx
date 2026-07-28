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
import RoomShell from '@/components/tour-mode/RoomShell';
import StaffShell from '@/components/tour-mode/staff/StaffShell';
import { Screen } from '@/components/tour-mode/cockpit/Cockpit';
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
