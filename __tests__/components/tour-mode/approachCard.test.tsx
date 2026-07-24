/**
 * §11.C C2 — ApproachCard render (5 locales, distance, hero, map link, video
 * slot) and the ChatFeed approach_card branch, including the guarantee that a
 * preview never renders the heavier arrival cards.
 */
import { render, screen } from '@testing-library/react';
import ApproachCard from '@/components/tour-mode/ApproachCard';
import ChatFeed from '@/components/tour-mode/ChatFeed';
import { __resetTourRoomSettingsForTests } from '@/hooks/useTourRoomSettings';
import { APPROACH_COPY, type ApproachCardMeta } from '@/lib/tour-room/approach';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

jest.mock('@/lib/tour-room/tts', () => ({
  primeAudio: jest.fn(),
  speakWithDevice: jest.fn(async () => true),
  speakMessage: jest.fn(async () => 'device'),
  TTS_LANG: { en: 'en-US', ko: 'ko-KR', ja: 'ja-JP', es: 'es-ES', zh: 'zh-CN' },
}));

const META: ApproachCardMeta = {
  kind: 'approach_card',
  spot_title: 'Seongsan Ilchulbong',
  poi_key: 'seongsan',
  distance_m: 900,
  poi_lat: 33.458,
  poi_lng: 126.9425,
  content: { name: 'Seongsan Ilchulbong', description: 'A tuff cone that rises straight out of the sea.' },
};

beforeEach(() => {
  window.localStorage.clear();
  __resetTourRoomSettingsForTests();
});

describe('ApproachCard', () => {
  it.each(ROOM_LOCALES)('renders the badge, distance and title in %s', (locale) => {
    render(<ApproachCard meta={META} locale={locale} />);
    const card = screen.getByTestId('approach-card');
    expect(card).toHaveTextContent(APPROACH_COPY[locale].badge);
    expect(screen.getByTestId('approach-distance')).toHaveTextContent('900 m');
    expect(card).toHaveTextContent('Seongsan Ilchulbong');
    expect(card).toHaveTextContent('A tuff cone that rises straight out of the sea.');
  });

  it('links the POI coordinates out to a map', () => {
    render(<ApproachCard meta={META} locale="en" />);
    const link = screen.getByRole('link', { name: APPROACH_COPY.en.map });
    expect(link).toHaveAttribute('href', 'https://maps.google.com/?q=33.458000,126.942500');
  });

  it('omits the map link when the POI has no coordinates', () => {
    render(<ApproachCard meta={{ ...META, poi_lat: null, poi_lng: null }} locale="en" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows the generic preview line when no content resolved', () => {
    render(<ApproachCard meta={{ ...META, content: undefined }} locale="ko" />);
    expect(screen.getByTestId('approach-card')).toHaveTextContent(APPROACH_COPY.ko.preview);
  });

  it('renders the approved POI short when one rides the metadata', () => {
    render(
      <ApproachCard
        meta={{ ...META, video_card: { poster_url: null, duration_seconds: 64, urls: { en: 'https://cdn/en.mp4' } } }}
        locale="en"
      />,
    );
    expect(screen.getByTestId('arrival-video-card')).toBeInTheDocument();
  });

  it('has no video slot at all without an approved render', () => {
    render(<ApproachCard meta={META} locale="en" />);
    expect(screen.queryByTestId('arrival-video-card')).not.toBeInTheDocument();
  });
});

describe('ChatFeed approach_card routing', () => {
  const message = (metadata: Record<string, unknown>): RoomMessage => ({
    id: 'm1',
    sender_role: 'system',
    source_text: 'Coming up: Seongsan Ilchulbong — about 900 m ahead.',
    created_at: '2026-07-24T02:00:00Z',
    metadata,
  });

  it('renders the preview card, not an arrival card', () => {
    render(<ChatFeed messages={[message({ ...META })]} viewerLocale="en" />);
    expect(screen.getByTestId('approach-card')).toBeInTheDocument();
    expect(screen.queryByTestId('arrival-bundle-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('spot-arrival-card')).not.toBeInTheDocument();
  });

  it('leaves the existing arrival branches untouched', () => {
    render(
      <ChatFeed
        messages={[
          message({ kind: 'arrival_bundle', spot_title: 'S', follow_mode: 'free', ticket_required: false, meeting_time: null }),
        ]}
        viewerLocale="en"
      />,
    );
    expect(screen.getByTestId('arrival-bundle-card')).toBeInTheDocument();
    expect(screen.queryByTestId('approach-card')).not.toBeInTheDocument();
  });
});
