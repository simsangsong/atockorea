/**
 * T1.6/T1.7/T1.10 — ChatFeed 5-locale rendering (viewer-locale first +
 * original toggle + windowing), Composer preset chips with double-tap guard,
 * EmergencyCard tel links.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import ChatFeed from '@/components/tour-mode/ChatFeed';
import Composer from '@/components/tour-mode/Composer';
import EmergencyCard from '@/components/tour-mode/EmergencyCard';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';
import { QUICK_REPLY_PRESETS } from '@/lib/tour-room/quickReplies';
import { EMERGENCY_TITLE } from '@/lib/tour-room/emergency';

const GUIDE_MESSAGE: RoomMessage = {
  id: 'm1',
  sender_role: 'guide',
  source_text: 'We meet at 3pm at the parking lot.',
  translations: {
    en: 'We meet at 3pm at the parking lot.',
    ko: '오후 3시에 주차장에서 모입니다.',
    ja: '午後3時に駐車場に集合します。',
    es: 'Nos reunimos a las 3pm en el estacionamiento.',
    zh: '下午3点在停车场集合。',
  },
  created_at: '2026-07-14T05:00:00Z',
};

describe('ChatFeed', () => {
  it.each(ROOM_LOCALES)('renders the %s translation first', (locale) => {
    render(<ChatFeed messages={[GUIDE_MESSAGE]} viewerLocale={locale} />);
    expect(screen.getByText(GUIDE_MESSAGE.translations![locale])).toBeInTheDocument();
  });

  it('toggles to the original text on tap and back', () => {
    render(<ChatFeed messages={[GUIDE_MESSAGE]} viewerLocale="ko" />);
    fireEvent.click(screen.getByText('오후 3시에 주차장에서 모입니다.'));
    expect(screen.getByText('We meet at 3pm at the parking lot.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('We meet at 3pm at the parking lot.'));
    expect(screen.getByText('오후 3시에 주차장에서 모입니다.')).toBeInTheDocument();
  });

  it('renders system messages as centered cards without a role label', () => {
    const system: RoomMessage = {
      id: 's1',
      sender_role: 'system',
      source_text: 'You have arrived near Haedong Yonggungsa.',
      created_at: '2026-07-14T05:01:00Z',
    };
    render(<ChatFeed messages={[system]} viewerLocale="en" />);
    expect(screen.getByText(/arrived near/)).toBeInTheDocument();
    expect(screen.queryByText('Guide')).not.toBeInTheDocument();
  });

  it('windows long feeds: only the latest 60 mount, "earlier" reveals more (200+ AC)', () => {
    const many: RoomMessage[] = Array.from({ length: 230 }, (_, i) => ({
      id: `m${i}`,
      sender_role: 'guide',
      source_text: `msg-${i}`,
      created_at: `2026-07-14T05:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}Z`,
    }));
    render(<ChatFeed messages={many} viewerLocale="en" />);
    expect(screen.queryByText('msg-0')).not.toBeInTheDocument();
    expect(screen.getByText('msg-229')).toBeInTheDocument();
    expect(screen.getByText(/\+170/)).toBeInTheDocument(); // 230 - 60 hidden
    fireEvent.click(screen.getByText(/Show earlier messages/));
    expect(screen.getByText('msg-129')).toBeInTheDocument(); // window now 120
  });
});

describe('Composer', () => {
  it('renders all 8 preset chips in the viewer locale and guards double taps', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-14T05:00:00Z'));
    const onSendPreset = jest.fn();
    render(<Composer locale="ko" onSendText={jest.fn()} onSendPreset={onSendPreset} />);

    for (const preset of QUICK_REPLY_PRESETS) {
      expect(screen.getByText(new RegExp(preset.text.ko.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
    }

    const chip = screen.getByText(/버스가 어디에 있나요\?/);
    fireEvent.click(chip);
    fireEvent.click(chip); // within cooldown — ignored
    expect(onSendPreset).toHaveBeenCalledTimes(1);

    jest.setSystemTime(new Date('2026-07-14T05:00:02Z'));
    fireEvent.click(chip);
    expect(onSendPreset).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('clears the draft on submit and never submits blank text', () => {
    const onSendText = jest.fn();
    render(<Composer locale="en" onSendText={onSendText} onSendPreset={jest.fn()} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '  hello  ' } });
    fireEvent.submit(input.closest('form')!);
    expect(onSendText).toHaveBeenCalledWith('hello');
    expect((input as HTMLInputElement).value).toBe('');
    fireEvent.submit(input.closest('form')!);
    expect(onSendText).toHaveBeenCalledTimes(1);
  });
});

describe('EmergencyCard', () => {
  it.each(ROOM_LOCALES)('expands with tel: links (%s)', (locale) => {
    render(<EmergencyCard locale={locale} />);
    fireEvent.click(screen.getByText(new RegExp(EMERGENCY_TITLE[locale])));
    const helpline = screen.getByText(/1330/).closest('a');
    expect(helpline).toHaveAttribute('href', 'tel:1330');
  });
});

describe('ChatFeed ops highlight (W4.3)', () => {
  const adminReply: RoomMessage = {
    id: 'a1',
    sender_role: 'admin',
    source_text: 'We are on our way to you.',
    created_at: '2026-07-14T06:00:00Z',
  };

  it('highlights admin replies newer than the SOS timestamp', () => {
    render(
      <ChatFeed
        messages={[GUIDE_MESSAGE, adminReply]}
        viewerLocale="en"
        opsHighlightAfter="2026-07-14T05:30:00Z"
      />,
    );
    expect(screen.getByTestId('ops-reply-dot')).toBeInTheDocument();
    expect(screen.getByText('We are on our way to you.').closest('button')!.className).toContain('ring-emerald-300');
    // Guide message (older, non-admin) stays unhighlighted.
    expect(screen.getByText(GUIDE_MESSAGE.translations!.en).closest('button')!.className).not.toContain(
      'ring-emerald-300',
    );
  });

  it('does not highlight without an SOS or for pre-SOS admin messages', () => {
    const { rerender } = render(<ChatFeed messages={[adminReply]} viewerLocale="en" />);
    expect(screen.queryByTestId('ops-reply-dot')).toBeNull();
    rerender(<ChatFeed messages={[adminReply]} viewerLocale="en" opsHighlightAfter="2026-07-14T07:00:00Z" />);
    expect(screen.queryByTestId('ops-reply-dot')).toBeNull();
  });
});
