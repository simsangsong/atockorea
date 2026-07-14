/**
 * Wave T2 UI — T2.1/T2.2 Composer voice flow (confirm-before-send contract),
 * T2.8 CaptionBanner, T2.6 GuideCaptionBar posting contract.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Composer from '@/components/tour-mode/Composer';
import CaptionBanner from '@/components/tour-mode/CaptionBanner';
import GuideCaptionBar from '@/components/tour-mode/GuideCaptionBar';
import { writeTourRoomSettings, __resetTourRoomSettingsForTests } from '@/hooks/useTourRoomSettings';
import type { RoomCaption } from '@/hooks/useTourRoomChannel';

jest.mock('@/lib/tour-room/recorder', () => ({
  isVoiceRecordingSupported: jest.fn(() => true),
  startVoiceRecording: jest.fn(),
  extensionForMime: jest.fn(() => 'webm'),
  MAX_RECORDING_MS: 60_000,
}));
jest.mock('@/lib/tour-room/tts', () => ({
  primeAudio: jest.fn(),
  speakWithDevice: jest.fn(async () => true),
  TTS_LANG: { en: 'en-US', ko: 'ko-KR', ja: 'ja-JP', es: 'es-ES', zh: 'zh-CN' },
}));
jest.mock('@/lib/tour-room/captionCapture', () => ({
  detectCaptionTier: jest.fn(() => 'web-speech'),
  startCaptionCapture: jest.fn(),
}));

const recorderMock = jest.requireMock('@/lib/tour-room/recorder');
const captureMock = jest.requireMock('@/lib/tour-room/captionCapture');
const ttsMock = jest.requireMock('@/lib/tour-room/tts');

/** Drive one full record→transcribe cycle through the mocked recorder. */
async function recordOnce(clipBlob: Blob | null = new Blob(['x'], { type: 'audio/webm' })) {
  let finish: ((clip: { blob: Blob; mimeType: string; durationMs: number } | null) => void) | null = null;
  (recorderMock.startVoiceRecording as jest.Mock).mockImplementation(async (opts) => {
    finish = opts.onFinish;
    return { stop: jest.fn(), cancel: jest.fn() };
  });
  fireEvent.click(screen.getByTestId('mic-button'));
  await waitFor(() => expect(screen.getByTestId('recording-bar')).toBeInTheDocument());
  await act(async () => {
    finish!(clipBlob ? { blob: clipBlob, mimeType: 'audio/webm', durationMs: 1500 } : null);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  __resetTourRoomSettingsForTests();
});

describe('Composer voice flow (T2.2 confirm-before-send)', () => {
  const setup = (transcribe: jest.Mock) => {
    const onSendText = jest.fn();
    render(
      <Composer
        locale="en"
        onSendText={onSendText}
        onSendPreset={jest.fn()}
        transcribeVoice={transcribe}
      />,
    );
    return onSendText;
  };

  it('hides the mic entirely without a transcriber (O-9 gate also mocks in)', () => {
    render(<Composer locale="en" onSendText={jest.fn()} onSendPreset={jest.fn()} />);
    expect(screen.queryByTestId('mic-button')).not.toBeInTheDocument();
  });

  it('default (voiceConfirm ON): transcript fills the input for review, nothing auto-sends', async () => {
    const transcribe = jest.fn(async () => ({ text: 'We are at the gate', needsConfirmation: false }));
    const onSendText = setup(transcribe);
    await recordOnce();
    await waitFor(() => expect(screen.getByDisplayValue('We are at the gate')).toBeInTheDocument());
    expect(screen.getByTestId('voice-confirm-hint')).toBeInTheDocument();
    expect(onSendText).not.toHaveBeenCalled();
    // The user confirms by pressing send.
    fireEvent.click(screen.getByRole('button', { name: 'send' }));
    expect(onSendText).toHaveBeenCalledWith('We are at the gate');
  });

  it('voiceConfirm OFF + clean transcript → auto-send through the text path', async () => {
    writeTourRoomSettings({ voiceConfirm: false });
    const transcribe = jest.fn(async () => ({ text: 'On my way', needsConfirmation: false }));
    const onSendText = setup(transcribe);
    await recordOnce();
    await waitFor(() => expect(onSendText).toHaveBeenCalledWith('On my way'));
    expect(screen.queryByTestId('voice-confirm-hint')).not.toBeInTheDocument();
  });

  it('voiceConfirm OFF but server flags quality → confirm step is forced (T2.2)', async () => {
    writeTourRoomSettings({ voiceConfirm: false });
    const transcribe = jest.fn(async () => ({ text: 'garbled maybe', needsConfirmation: true }));
    const onSendText = setup(transcribe);
    await recordOnce();
    await waitFor(() => expect(screen.getByDisplayValue('garbled maybe')).toBeInTheDocument());
    expect(onSendText).not.toHaveBeenCalled();
    expect(screen.getByTestId('voice-confirm-hint')).toBeInTheDocument();
  });

  it('transcription failure shows the retry note, never sends', async () => {
    const transcribe = jest.fn(async () => null);
    const onSendText = setup(transcribe);
    await recordOnce();
    await waitFor(() => expect(screen.getByTestId('voice-note')).toBeInTheDocument());
    expect(onSendText).not.toHaveBeenCalled();
  });
});

describe('CaptionBanner (T2.8)', () => {
  const caption: RoomCaption = {
    id: 'c1',
    seq: 3,
    sender_role: 'guide',
    source_text: '여기서 20분 자유시간입니다',
    translations: { en: '20 minutes of free time here' },
    created_at: '2026-07-14T10:00:00Z',
  };

  it('renders the viewer-locale caption and toggles to the original on tap', () => {
    render(<CaptionBanner caption={caption} locale="en" />);
    const banner = screen.getByTestId('caption-banner');
    expect(banner).toHaveTextContent('20 minutes of free time here');
    fireEvent.click(banner);
    expect(banner).toHaveTextContent('여기서 20분 자유시간입니다');
  });

  it('renders nothing without a caption', () => {
    render(<CaptionBanner caption={null} locale="en" />);
    expect(screen.queryByTestId('caption-banner')).not.toBeInTheDocument();
  });

  it('auto-reads each caption once via device TTS when autoRead is on', () => {
    writeTourRoomSettings({ autoRead: true });
    const { rerender } = render(<CaptionBanner caption={caption} locale="en" />);
    expect(ttsMock.speakWithDevice).toHaveBeenCalledWith('20 minutes of free time here', 'en');
    rerender(<CaptionBanner caption={caption} locale="en" />);
    expect(ttsMock.speakWithDevice).toHaveBeenCalledTimes(1); // same seq — spoken once
  });
});

describe('GuideCaptionBar (T2.6)', () => {
  it('starts capture and posts Tier A sentences with an increasing seq', async () => {
    let handlers: { onText?: (text: string) => void } = {};
    (captureMock.startCaptionCapture as jest.Mock).mockImplementation(async (h: typeof handlers) => {
      handlers = h;
      return { tier: 'web-speech', stop: jest.fn() };
    });
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({}) })) as never;

    render(<GuideCaptionBar bookingId="b1" roomSession="rs" locale="ko" />);
    fireEvent.click(screen.getByTestId('caption-start'));
    await waitFor(() => expect(screen.getByTestId('caption-stop')).toBeInTheDocument());

    act(() => handlers.onText?.('첫 문장입니다'));
    act(() => handlers.onText?.('두 번째 문장'));

    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toContain('/api/tour-rooms/b1/captions');
    expect(JSON.parse(calls[0][1].body)).toMatchObject({ text: '첫 문장입니다', seq: 1, record: false });
    expect(JSON.parse(calls[1][1].body)).toMatchObject({ seq: 2 });
    expect(calls[0][1].headers['x-tour-room-auth']).toBe('rs');
  });

  it('renders nothing on devices that cannot capture (O-9 spirit)', () => {
    (captureMock.detectCaptionTier as jest.Mock).mockReturnValue('unsupported');
    render(<GuideCaptionBar bookingId="b1" roomSession="rs" locale="ko" />);
    expect(screen.queryByTestId('guide-caption-bar')).not.toBeInTheDocument();
  });
});
