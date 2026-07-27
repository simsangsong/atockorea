/**
 * C-D4/C-D5/C-D6 — background skins: the picker writes the device store, the
 * shells stamp data-tr-skin so the CSS token blocks key off it, and unknown
 * stored values fall back to classic (covered in settings.test.tsx sanitize).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import RoomShell from '@/components/tour-mode/RoomShell';
import StaffShell from '@/components/tour-mode/staff/StaffShell';
import SkinPicker from '@/components/tour-mode/SkinPicker';
import {
  readTourRoomSettings,
  writeTourRoomSettings,
  __resetTourRoomSettingsForTests,
  TOUR_SKINS,
} from '@/hooks/useTourRoomSettings';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }),
  });
});

beforeEach(() => {
  window.localStorage.clear();
  __resetTourRoomSettingsForTests();
});

describe('SkinPicker (C-D6)', () => {
  it('renders every skin in TOUR_SKINS with classic checked by default', () => {
    render(<SkinPicker locale="ko" />);
    for (const skin of TOUR_SKINS) {
      expect(screen.getByTestId(`skin-${skin}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('skin-classic')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('skin-winter')).toHaveAttribute('aria-checked', 'false');
  });

  it('picking a skin persists to the device store and moves the check', () => {
    render(<SkinPicker locale="ko" />);
    fireEvent.click(screen.getByTestId('skin-forest'));
    expect(readTourRoomSettings().skin).toBe('forest');
    expect(screen.getByTestId('skin-forest')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('skin-classic')).toHaveAttribute('aria-checked', 'false');
  });

  it('labels are localized (en fallback for unknown locale set)', () => {
    render(<SkinPicker locale="en" />);
    expect(screen.getByTestId('skin-contrast')).toHaveAccessibleName('High contrast');
  });
});

describe('skin stamping on the shells (C-D5)', () => {
  const roomBase = {
    title: 'Busan Signature',
    lifecycle: 'live' as const,
    connection: 'realtime' as const,
    locale: 'ko' as const,
    schedule: [],
    settings: <div>settings</div>,
    chat: <div>chat</div>,
  };

  it('RoomShell stamps data-tr-skin from the store', () => {
    writeTourRoomSettings({ skin: 'winter' });
    const { container } = render(<RoomShell {...roomBase} />);
    expect(container.querySelector('.tr-root')).toHaveAttribute('data-tr-skin', 'winter');
  });

  it('StaffShell stamps data-tr-skin from the store', () => {
    writeTourRoomSettings({ skin: 'contrast' });
    render(
      <StaffShell
        title="제주 프라이빗"
        lifecycle="live"
        chat={<p>c</p>}
        seats={<p>s</p>}
        ops={<p>o</p>}
        settings={<p>t</p>}
      />,
    );
    expect(screen.getByTestId('staff-shell')).toHaveAttribute('data-tr-skin', 'contrast');
  });
});
