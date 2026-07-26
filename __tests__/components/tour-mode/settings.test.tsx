/**
 * T1.12 — room settings: defaults (voice confirm ON), persistence, theme
 * switching applied as a `.dark` ancestor on the shell, language change
 * callback, text-size effect on the chat feed.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import RoomShell from '@/components/tour-mode/RoomShell';
import SettingsTab from '@/components/tour-mode/SettingsTab';
import ChatFeed from '@/components/tour-mode/ChatFeed';
import {
  __resetTourRoomSettingsForTests,
  DEFAULT_TOUR_ROOM_SETTINGS,
  readTourRoomSettings,
  writeTourRoomSettings,
} from '@/hooks/useTourRoomSettings';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

beforeEach(() => {
  window.localStorage.clear();
  __resetTourRoomSettingsForTests();
});

describe('useTourRoomSettings store', () => {
  it('defaults voiceConfirm ON, system theme, classic skin, normal text', () => {
    expect(DEFAULT_TOUR_ROOM_SETTINGS).toEqual({
      theme: 'system',
      skin: 'classic',
      voiceConfirm: true,
      autoRead: false,
      textScale: 3,
    });
    expect(readTourRoomSettings()).toEqual(DEFAULT_TOUR_ROOM_SETTINGS);
  });

  it('persists patches to localStorage and sanitizes garbage', () => {
    writeTourRoomSettings({ theme: 'dark', voiceConfirm: false });
    __resetTourRoomSettingsForTests();
    expect(readTourRoomSettings()).toMatchObject({ theme: 'dark', voiceConfirm: false });

    window.localStorage.setItem('tour_mode_settings', '{"theme":"neon","textScale":9}');
    expect(readTourRoomSettings()).toMatchObject({ theme: 'system', textScale: 3 });
  });

  it('persists a picked skin and falls back to classic on unknown values (C-D5)', () => {
    writeTourRoomSettings({ skin: 'winter' });
    __resetTourRoomSettingsForTests();
    expect(readTourRoomSettings().skin).toBe('winter');

    // A stored value from a future/older build must never break the room.
    window.localStorage.setItem('tour_mode_settings', '{"skin":"lava"}');
    expect(readTourRoomSettings().skin).toBe('classic');
  });
});

describe('SettingsTab', () => {
  it('toggles voice confirm off/on and switches theme', () => {
    render(<SettingsTab locale="ko" onLocaleChange={jest.fn()} />);

    const voiceToggle = screen.getByRole('switch', { name: '보내기 전 음성 텍스트 확인' });
    expect(voiceToggle).toHaveAttribute('aria-checked', 'true'); // default ON
    fireEvent.click(voiceToggle);
    expect(readTourRoomSettings().voiceConfirm).toBe(false);
    fireEvent.click(voiceToggle);
    expect(readTourRoomSettings().voiceConfirm).toBe(true);

    fireEvent.click(screen.getByText(/다크/));
    expect(readTourRoomSettings().theme).toBe('dark');
    fireEvent.click(screen.getByText(/라이트/));
    expect(readTourRoomSettings().theme).toBe('light');
  });

  it('reports a language change through the callback (server re-join is the caller`s job)', () => {
    const onLocaleChange = jest.fn();
    render(<SettingsTab locale="en" onLocaleChange={onLocaleChange} />);
    fireEvent.click(screen.getByText('日本語'));
    expect(onLocaleChange).toHaveBeenCalledWith('ja');
  });

  it('hides the chat-language picker unless onChatLocaleChange is provided', () => {
    render(<SettingsTab locale="en" onLocaleChange={jest.fn()} />);
    expect(screen.queryByTestId('chat-language-select')).not.toBeInTheDocument();
  });

  it('reports a chat-language pick (any LLM language) through the callback', () => {
    const onChatLocaleChange = jest.fn();
    render(
      <SettingsTab
        locale="en"
        onLocaleChange={jest.fn()}
        chatLocale=""
        onChatLocaleChange={onChatLocaleChange}
      />,
    );
    const select = screen.getByTestId('chat-language-select');
    // French is outside the 5 room UI locales — proves the plane is unbounded.
    fireEvent.change(select, { target: { value: 'fr' } });
    expect(onChatLocaleChange).toHaveBeenCalledWith('fr');
  });
});

describe('RoomShell settings tab + theme', () => {
  const shellProps = {
    title: 'Busan Signature',
    lifecycle: 'live' as const,
    connection: 'realtime' as const,
    locale: 'ko' as const,
    schedule: [],
    chat: <div>chat-content</div>,
    settings: <div>settings-content</div>,
  };

  it('shows the settings tab and switches to it', () => {
    render(<RoomShell {...shellProps} />);
    expect(screen.getByRole('tab', { name: '설정' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '설정' }));
    expect(screen.getByText('settings-content')).toBeInTheDocument();
  });

  it('back steps through tab history instead of exiting (no backHref)', () => {
    render(<RoomShell {...shellProps} />); // lands on chat; no backHref
    // No back button at the root — it never dumps a customer to the entry gate.
    expect(screen.queryByTestId('room-back')).not.toBeInTheDocument();
    // chat → map → settings
    fireEvent.click(screen.getByRole('tab', { name: '지도' }));
    fireEvent.click(screen.getByRole('tab', { name: '설정' }));
    expect(screen.getByText('settings-content')).toBeInTheDocument();
    // back → map, back → chat (one step per click)
    fireEvent.click(screen.getByTestId('room-back'));
    expect(screen.getByRole('tab', { name: '지도', selected: true })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('room-back'));
    expect(screen.getByText('chat-content')).toBeInTheDocument();
    // back at root → button gone again
    expect(screen.queryByTestId('room-back')).not.toBeInTheDocument();
  });

  it('wraps the shell in a .dark ancestor only when theme=dark', () => {
    const { container, rerender } = render(<RoomShell {...shellProps} theme="dark" />);
    expect(container.firstChild).toHaveClass('dark');
    rerender(<RoomShell {...shellProps} theme="light" />);
    expect(container.firstChild).not.toHaveClass('dark');
  });
});

describe('ChatFeed text scale (T1.12)', () => {
  const message: RoomMessage = {
    id: 'm1',
    sender_role: 'guide',
    source_text: 'hello there',
    created_at: '2026-07-14T05:00:00Z',
  };

  it('bumps bubble text at the large steps (4-5)', () => {
    render(<ChatFeed messages={[message]} viewerLocale="en" textScale={4} />);
    expect(screen.getByText('hello there').closest('button')).toHaveClass('tr-body-lg');
  });

  // P1-6 — 5 steps replaced the 2-value setting; a guest who had already chosen
  // the legacy 'large' must stay large rather than being reset to the default.
  it('migrates the legacy normal/large values instead of discarding them', () => {
    window.localStorage.setItem('tour_mode_settings', '{"textScale":"large"}');
    expect(readTourRoomSettings().textScale).toBe(4);
    window.localStorage.setItem('tour_mode_settings', '{"textScale":"normal"}');
    expect(readTourRoomSettings().textScale).toBe(3);
  });

  it('keeps the default bubble class at the small/default steps', () => {
    render(<ChatFeed messages={[message]} viewerLocale="en" textScale={2} />);
    expect(screen.getByText('hello there').closest('button')).toHaveClass('tr-body');
  });
});
