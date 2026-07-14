/**
 * T4.5 SpotArrivalCard (rich briefing + expand + audio) and the T4.7
 * Composer photo-question panel (private answer inline / shared closes).
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Composer from '@/components/tour-mode/Composer';
import ChatFeed from '@/components/tour-mode/ChatFeed';
import SpotArrivalCard from '@/components/tour-mode/SpotArrivalCard';
import { __resetTourRoomSettingsForTests } from '@/hooks/useTourRoomSettings';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';

jest.mock('@/lib/tour-room/recorder', () => ({
  isVoiceRecordingSupported: jest.fn(() => false),
  startVoiceRecording: jest.fn(),
  extensionForMime: jest.fn(() => 'webm'),
  MAX_RECORDING_MS: 60_000,
}));
jest.mock('@/lib/tour-room/tts', () => ({
  primeAudio: jest.fn(),
  speakWithDevice: jest.fn(async () => true),
  speakMessage: jest.fn(async () => 'device'),
  TTS_LANG: { en: 'en-US', ko: 'ko-KR', ja: 'ja-JP', es: 'es-ES', zh: 'zh-CN' },
}));

const CONTENT = {
  name: 'Haedong Yonggungsa',
  description: 'A seaside temple founded in 1376.',
  highlights: ['Sunrise view', 'Ocean cliffs', 'Stone lanterns'],
  visitBasics: { hours: '04:30–19:00', admission: 'Free' },
  convenience: { restroom: 'At the entrance' },
  smartNotes: { tip: 'Go early to beat the crowds.' },
};

beforeEach(() => {
  window.localStorage.clear();
  __resetTourRoomSettingsForTests();
});

describe('SpotArrivalCard (T4.5)', () => {
  it.each(ROOM_LOCALES)('renders name, basics and expands in %s', (locale) => {
    render(<SpotArrivalCard content={CONTENT} messageText="arrived line" locale={locale} />);
    const card = screen.getByTestId('spot-arrival-card');
    expect(card).toHaveTextContent('Haedong Yonggungsa');
    expect(card).toHaveTextContent('04:30–19:00');
    expect(card).not.toHaveTextContent('Go early'); // collapsed: first 3 rows only
    fireEvent.click(screen.getByTestId('spot-expand-toggle'));
    expect(card).toHaveTextContent('Go early to beat the crowds.');
    expect(card).toHaveTextContent('A seaside temple founded in 1376.');
  });

  it('shows the audio button only with a pre-recorded guide', () => {
    const { rerender } = render(<SpotArrivalCard content={CONTENT} messageText="x" locale="en" />);
    expect(screen.queryByTestId('spot-audio-button')).not.toBeInTheDocument();
    rerender(<SpotArrivalCard content={CONTENT} messageText="x" audioUrl="https://cdn.test/a.mp3" locale="en" />);
    expect(screen.getByTestId('spot-audio-button')).toBeInTheDocument();
  });
});

describe('ChatFeed arrival routing (T4.3 degradation)', () => {
  const arrivalMessage = (metadata: Record<string, unknown>): RoomMessage => ({
    id: 'm1',
    sender_role: 'system',
    source_text: 'You have arrived near Haedong Yonggungsa.',
    created_at: '2026-07-14T10:00:00Z',
    metadata,
  });

  it('renders the rich card when content rides the metadata', () => {
    render(
      <ChatFeed messages={[arrivalMessage({ kind: 'spot_arrival', content: CONTENT })]} viewerLocale="en" />,
    );
    expect(screen.getByTestId('spot-arrival-card')).toBeInTheDocument();
  });

  it('falls back to the plain system bubble without content (tier 3)', () => {
    render(<ChatFeed messages={[arrivalMessage({ kind: 'spot_arrival' })]} viewerLocale="en" />);
    expect(screen.queryByTestId('spot-arrival-card')).not.toBeInTheDocument();
    expect(screen.getByText(/You have arrived near/)).toBeInTheDocument();
  });
});

describe('Composer photo questions (T4.7)', () => {
  function pickPhoto() {
    const input = screen.getByTestId('vision-file-input') as HTMLInputElement;
    const file = new File([new Uint8Array(128)], 'food.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });
  }

  beforeAll(() => {
    global.URL.createObjectURL = jest.fn(() => 'blob:preview');
    global.URL.revokeObjectURL = jest.fn();
  });

  it('private ask shows the answer inline in the panel', async () => {
    const ask = jest.fn(async () => ({ answer: 'That is hotteok — a sweet pancake.', shared: false }));
    render(<Composer locale="en" onSendText={jest.fn()} onSendPreset={jest.fn()} vision={{ ask }} />);
    fireEvent.click(screen.getByTestId('camera-button'));
    pickPhoto();
    await act(async () => {
      fireEvent.click(screen.getByTestId('vision-ask-button'));
    });
    await waitFor(() => expect(screen.getByTestId('vision-answer')).toHaveTextContent('hotteok'));
    expect(ask).toHaveBeenCalledWith(expect.any(File), { question: '', share: false });
  });

  it('shared ask closes the panel (the room broadcast carries the answer)', async () => {
    const ask = jest.fn(async () => ({ answer: 'answer', shared: true }));
    render(<Composer locale="en" onSendText={jest.fn()} onSendPreset={jest.fn()} vision={{ ask }} />);
    fireEvent.click(screen.getByTestId('camera-button'));
    pickPhoto();
    fireEvent.click(screen.getByRole('checkbox'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('vision-ask-button'));
    });
    await waitFor(() => expect(screen.queryByTestId('vision-panel')).not.toBeInTheDocument());
    expect(ask).toHaveBeenCalledWith(expect.any(File), { question: '', share: true });
  });

  it('failure keeps the panel with a retry note', async () => {
    const ask = jest.fn(async () => null);
    render(<Composer locale="ko" onSendText={jest.fn()} onSendPreset={jest.fn()} vision={{ ask }} />);
    fireEvent.click(screen.getByTestId('camera-button'));
    pickPhoto();
    await act(async () => {
      fireEvent.click(screen.getByTestId('vision-ask-button'));
    });
    await waitFor(() => expect(screen.getByTestId('vision-panel')).toHaveTextContent('다시 시도'));
  });
});
