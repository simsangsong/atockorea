/**
 * T6.3/T6.4/T6.5 — activeNotice countdown logic, NoticeBanner rendering,
 * onboard ack button on the pickup board.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import NoticeBanner from '@/components/tour-mode/NoticeBanner';
import PickupBoard from '@/components/tour-mode/PickupBoard';
import { activeNotice, formatRemaining, formatTargetTime } from '@/lib/tour-room/notices';
import { kstToday, kstStartOfDayMs } from '@/lib/tour-room/time';
import { __resetTourRoomSettingsForTests } from '@/hooks/useTourRoomSettings';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';
import type { PickupBoardState } from '@/lib/tour-room/pickup';

jest.mock('@/lib/tour-room/tts', () => ({
  primeAudio: jest.fn(),
  speakWithDevice: jest.fn(async () => true),
  TTS_LANG: { en: 'en-US', ko: 'ko-KR', ja: 'ja-JP', es: 'es-ES', zh: 'zh-CN' },
}));

const today = kstToday();
const dayStart = kstStartOfDayMs(today);

const message = (metadata: Record<string, unknown>, createdMs: number, id = `n-${createdMs}`): RoomMessage => ({
  id,
  sender_role: 'guide',
  source_text: 'notice',
  created_at: new Date(createdMs).toISOString(),
  metadata,
});

beforeEach(() => {
  window.localStorage.clear();
  __resetTourRoomSettingsForTests();
});

describe('activeNotice (T6.3/T6.5)', () => {
  const now = dayStart + 15 * 60 * 60 * 1000; // 15:00 KST

  it('counts down to the KST wall-clock target and flags 10/5-minute warnings', () => {
    const messages = [message({ kind: 'free_time_timer', until_time: '16:00', meeting_point: 'Gate 2' }, now)];
    const state = activeNotice(messages, today, now)!;
    expect(state.remainingMs).toBe(60 * 60 * 1000);
    expect(state.warn10).toBe(false);

    const at1551 = activeNotice(messages, today, dayStart + (15 * 60 + 51) * 60 * 1000)!;
    expect(at1551.warn10).toBe(true);
    expect(at1551.warn5).toBe(false);

    const at1556 = activeNotice(messages, today, dayStart + (15 * 60 + 56) * 60 * 1000)!;
    expect(at1556.warn5).toBe(true);
  });

  it('the newest notice supersedes (extension), cancel clears after its grace', () => {
    const timer = message({ kind: 'free_time_timer', until_time: '16:00' }, now, 'a');
    const extended = message({ kind: 'free_time_timer', until_time: '16:30' }, now + 60_000, 'b');
    expect(activeNotice([timer, extended], today, now + 120_000)!.targetMs).toBe(dayStart + 16.5 * 60 * 60 * 1000);

    const cancel = message({ kind: 'free_time_timer', cancelled: true }, now + 120_000, 'c');
    expect(activeNotice([timer, extended, cancel], today, now + 180_000)!.cancelled).toBe(true);
    expect(activeNotice([timer, extended, cancel], today, now + 20 * 60 * 1000)).toBeNull();
  });

  it('expires long-past notices and ignores rooms without one', () => {
    const messages = [message({ kind: 'meeting_notice', meeting_time: '10:00', meeting_point: 'Lobby' }, dayStart + 9 * 3600_000)];
    expect(activeNotice(messages, today, dayStart + 11 * 3600_000)).toBeNull();
    expect(activeNotice([], today, now)).toBeNull();
  });

  it('formats remaining time and locale target times', () => {
    expect(formatRemaining(83_000)).toBe('1:23');
    expect(formatRemaining(0)).toBe('0:00');
    const fourPm = dayStart + 16 * 3600_000;
    expect(formatTargetTime(fourPm, 'ko')).toContain('4');
    expect(formatTargetTime(fourPm, 'en')).toMatch(/4:00/);
  });
});

describe('NoticeBanner (T6.3/T6.5)', () => {
  it('renders the countdown for an active free-time timer', () => {
    jest.useFakeTimers().setSystemTime(dayStart + 15 * 3600_000);
    const messages = [message({ kind: 'free_time_timer', until_time: '15:30', meeting_point: 'Gate 2' }, dayStart + 14.9 * 3600_000)];
    render(<NoticeBanner messages={messages} tourDate={today} locale="en" />);
    expect(screen.getByTestId('notice-banner')).toHaveTextContent('Free time');
    expect(screen.getByTestId('notice-countdown')).toHaveTextContent('30:00');
    act(() => {
      jest.advanceTimersByTime(2_000);
    });
    expect(screen.getByTestId('notice-countdown')).toHaveTextContent('29:58');
    jest.useRealTimers();
  });

  it('renders nothing without an active notice', () => {
    render(<NoticeBanner messages={[]} tourDate={today} locale="en" />);
    expect(screen.queryByTestId('notice-banner')).not.toBeInTheDocument();
  });
});

describe('PickupBoard onboard ack (T6.4)', () => {
  const LIVE: PickupBoardState = {
    visible: true,
    mode: 'static',
    rank: 1,
    totalStops: 3,
    myStop: { booking_id: 'mine', pickup_point_id: 'pp', name: 'Stop', lat: 1, lng: 2, pickup_time: '08:50:00' },
    etaMinutes: null,
    distanceM: null,
  };

  it('fires the ack and flips to the done chip', () => {
    const onOnboardAck = jest.fn();
    const { rerender } = render(
      <PickupBoard state={LIVE} locale="ko" onSendPreset={jest.fn()} onboardAcked={false} onOnboardAck={onOnboardAck} />,
    );
    fireEvent.click(screen.getByTestId('onboard-ack'));
    expect(onOnboardAck).toHaveBeenCalled();
    rerender(
      <PickupBoard state={LIVE} locale="ko" onSendPreset={jest.fn()} onboardAcked onOnboardAck={onOnboardAck} />,
    );
    expect(screen.getByTestId('onboard-done')).toHaveTextContent('탑승 완료');
    expect(screen.queryByTestId('onboard-ack')).not.toBeInTheDocument();
  });
});
