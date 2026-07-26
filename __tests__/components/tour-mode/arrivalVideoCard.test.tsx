/**
 * Arrival video card — subtitle-overlay behavior. Overlay metas attach the
 * viewer-locale VTT as a <track>; legacy burned-in metas render exactly as
 * before (no track, no crossOrigin).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import ArrivalVideoCard from '@/components/tour-mode/ArrivalVideoCard';
import type { ArrivalVideoCardMeta } from '@/lib/tour-room/poiVideos';

const LEGACY: ArrivalVideoCardMeta = {
  poster_url: 'https://cdn/poster.png',
  duration_seconds: 64,
  urls: { en: 'https://cdn/en.mp4', ja: 'https://cdn/ja.mp4' },
};

const OVERLAY: ArrivalVideoCardMeta = {
  poster_url: 'https://cdn/poster.png',
  duration_seconds: 42,
  urls: { en: 'https://cdn/neutral.mp4', ja: 'https://cdn/neutral.mp4' },
  subtitles: { en: 'https://cdn/en.vtt', ja: 'https://cdn/ja.vtt' },
};

function play() {
  fireEvent.click(screen.getByTestId('arrival-video-poster'));
}

describe('ArrivalVideoCard — subtitle overlay', () => {
  it('attaches the viewer-locale VTT as a default subtitles track', () => {
    render(<ArrivalVideoCard meta={OVERLAY} locale="ja" />);
    play();
    const video = screen.getByTestId('arrival-video-player');
    expect(video).toHaveAttribute('crossorigin', 'anonymous');
    const track = screen.getByTestId('arrival-video-subtitles');
    expect(track).toHaveAttribute('src', 'https://cdn/ja.vtt');
    expect(track).toHaveAttribute('kind', 'subtitles');
    expect(track).toHaveAttribute('default');
  });

  it('Korean viewers get the English VTT fallback', () => {
    render(<ArrivalVideoCard meta={OVERLAY} locale="ko" />);
    play();
    expect(screen.getByTestId('arrival-video-subtitles')).toHaveAttribute('src', 'https://cdn/en.vtt');
  });

  it('legacy burned-in renders get no track and no crossOrigin', () => {
    render(<ArrivalVideoCard meta={LEGACY} locale="en" />);
    play();
    const video = screen.getByTestId('arrival-video-player');
    expect(video).not.toHaveAttribute('crossorigin');
    expect(screen.queryByTestId('arrival-video-subtitles')).toBeNull();
  });
});
