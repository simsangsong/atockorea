/**
 * A5 (plan §11.A) — explicit light/dark controls on every surface:
 *   - RoomShell header (guest + guide): 3-state cycle light → dark → system,
 *     writing the shared device settings store.
 *   - Settings tab keeps the full segmented control (promoted above language —
 *     covered by settings.test.tsx rendering).
 * The cockpit chip is covered in cockpit.test.tsx (driver default dark).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import RoomShell from '@/components/tour-mode/RoomShell';
import {
  readTourRoomSettings,
  __resetTourRoomSettingsForTests,
} from '@/hooks/useTourRoomSettings';

const base = {
  title: 'Busan Signature',
  lifecycle: 'live' as const,
  connection: 'realtime' as const,
  locale: 'ko' as const,
  schedule: [],
  settings: <div>settings-content</div>,
  chat: <div>chat-content</div>,
};

beforeEach(() => {
  window.localStorage.clear();
  __resetTourRoomSettingsForTests();
});

describe('RoomShell header theme toggle (A5)', () => {
  it('renders in the header with the current-state aria-label (default: system/auto)', () => {
    render(<RoomShell {...base} />);
    const toggle = screen.getByTestId('theme-toggle');
    expect(toggle).toHaveAttribute('aria-label', '화면 모드: 자동');
  });

  it('cycles system → light → dark → system and persists to the device store', () => {
    render(<RoomShell {...base} />);
    const toggle = screen.getByTestId('theme-toggle');

    fireEvent.click(toggle); // system → light
    expect(readTourRoomSettings().theme).toBe('light');
    expect(toggle).toHaveAttribute('aria-label', '화면 모드: 라이트');

    fireEvent.click(toggle); // light → dark
    expect(readTourRoomSettings().theme).toBe('dark');
    expect(toggle).toHaveAttribute('aria-label', '화면 모드: 다크');

    fireEvent.click(toggle); // dark → system
    expect(readTourRoomSettings().theme).toBe('system');
    expect(toggle).toHaveAttribute('aria-label', '화면 모드: 자동');
  });
});
