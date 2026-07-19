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
  it('defaults voiceConfirm ON, system theme, normal text', () => {
    expect(DEFAULT_TOUR_ROOM_SETTINGS).toEqual({
      theme: 'system',
      voiceConfirm: true,
      autoRead: false,
      textScale: 'normal',
    });
    expect(readTourRoomSettings()).toEqual(DEFAULT_TOUR_ROOM_SETTINGS);
  });

  it('persists patches to localStorage and sanitizes garbage', () => {
    writeTourRoomSettings({ theme: 'dark', voiceConfirm: false });
    __resetTourRoomSettingsForTests();
    expect(readTourRoomSettings()).toMatchObject({ theme: 'dark', voiceConfirm: false });

    window.localStorage.setItem('tour_mode_settings', '{"theme":"neon","textScale":9}');
    expect(readTourRoomSettings()).toMatchObject({ theme: 'system', textScale: 'normal' });
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

  it('bumps bubble text when textScale=large', () => {
    render(<ChatFeed messages={[message]} viewerLocale="en" textScale="large" />);
    expect(screen.getByText('hello there').closest('button')).toHaveClass('tr-body-lg');
  });
});
