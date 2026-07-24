/**
 * §5.7 R-5 — DiningCard render + the ChatFeed `dining_card` branch.
 *
 * The three contracts worth locking down:
 *   ① NO map tile ever (K7 — Kakao POI data on a non-Kakao map is a ToS risk);
 *   ② the DIETARY_CAUTION line renders whenever ANY filter is applied — it is
 *      the honest half of "we exclude, we never assert compliance";
 *   ③ the filter chips re-filter the loaded payload with ZERO network.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import DiningCard from '@/components/tour-mode/DiningCard';
import ChatFeed from '@/components/tour-mode/ChatFeed';
import { __resetTourRoomSettingsForTests } from '@/hooks/useTourRoomSettings';
import { DINING_COPY, type DiningCardMeta, type DiningPlace } from '@/lib/ops/dining/card';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

jest.mock('@/lib/tour-room/tts', () => ({
  primeAudio: jest.fn(),
  speakWithDevice: jest.fn(async () => true),
  speakMessage: jest.fn(async () => 'device'),
  TTS_LANG: { en: 'en-US', ko: 'ko-KR', ja: 'ja-JP', es: 'es-ES', zh: 'zh-CN' },
}));

const place = (over: Partial<DiningPlace> = {}): DiningPlace => ({
  place_key: 'kakao:1',
  name: '올래국수',
  name_i18n: { en: 'Olrae Noodles' },
  cuisine: '국수',
  category_name: '음식점 > 한식 > 국수',
  lat: 33.51,
  lng: 126.53,
  distance_m: 180,
  walk_min: 2,
  price_band: 1,
  rating: 4.5,
  review_count: 3200,
  tags: ['kids_ok'],
  signature_menus: [{ name: '고기국수' }, { name: '멸치국수' }, { name: '비빔국수' }, { name: '수육' }],
  place_url: 'http://place.map.kakao.com/1',
  open_today: true,
  closes_at: '20:00',
  ...over,
});

const meta = (over: Partial<DiningCardMeta> = {}): DiningCardMeta => ({
  kind: 'dining_card',
  poi_key: 'dongmun_market',
  spot_title: 'Dongmun Market',
  cell: 'wydm9q1',
  meal: 'lunch',
  dietary: [],
  source: 'cache',
  places: [place()],
  ...over,
});

beforeEach(() => {
  window.localStorage.clear();
  __resetTourRoomSettingsForTests();
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })) as unknown as typeof fetch;
});

describe('DiningCard — content', () => {
  it.each(ROOM_LOCALES)('renders the title and the picks in %s', (locale) => {
    render(<DiningCard meta={meta()} locale={locale} />);
    const card = screen.getByTestId('dining-card');
    expect(screen.getByTestId('dining-title')).toHaveTextContent('Dongmun Market');
    expect(card).toHaveTextContent(DINING_COPY[locale].mapLink);
    expect(card).toHaveTextContent(DINING_COPY[locale].goHere);
  });

  it('keeps the Korean original next to the localized name (a taxi driver needs it)', () => {
    render(<DiningCard meta={meta()} locale="en" />);
    expect(screen.getByTestId('dining-place')).toHaveTextContent('Olrae Noodles (올래국수)');
  });

  it('shows walk time, price band, rating, reviews and hours', () => {
    render(<DiningCard meta={meta()} locale="en" />);
    const row = screen.getByTestId('dining-place');
    expect(screen.getByTestId('dining-walk')).toHaveTextContent('2 min walk');
    expect(row).toHaveTextContent('₩');
    expect(row).toHaveTextContent('4.5');
    expect(row).toHaveTextContent('3.2k');
    expect(row).toHaveTextContent('Open until 20:00');
  });

  it('caps the signature menus at three', () => {
    render(<DiningCard meta={meta()} locale="ko" />);
    const menus = screen.getByTestId('dining-menus');
    expect(menus).toHaveTextContent('고기국수 · 멸치국수 · 비빔국수');
    expect(menus).not.toHaveTextContent('수육');
  });

  it('badges an unrated place instead of inventing a score', () => {
    render(
      <DiningCard meta={meta({ places: [place({ rating: null, review_count: null, unrated: true })] })} locale="en" />,
    );
    expect(screen.getAllByTestId('dining-unrated-badge').length).toBeGreaterThan(0);
    expect(screen.getByTestId('dining-unrated')).toHaveTextContent(DINING_COPY.en.unrated);
  });

  it('renders the empty line when nothing survived', () => {
    render(<DiningCard meta={meta({ places: [] })} locale="en" />);
    expect(screen.getByTestId('dining-empty')).toHaveTextContent(DINING_COPY.en.empty);
  });
});

describe('DiningCard — K7: links, never a map tile', () => {
  it('upgrades the Kakao deep link to https and offers directions', () => {
    render(<DiningCard meta={meta()} locale="en" />);
    expect(screen.getByTestId('dining-map-link')).toHaveAttribute('href', 'https://place.map.kakao.com/1');
    expect(screen.getByTestId('dining-directions-link')).toHaveAttribute(
      'href',
      expect.stringContaining('https://map.kakao.com/link/to/'),
    );
  });

  it('never renders a static map card', () => {
    render(<DiningCard meta={meta()} locale="en" />);
    expect(screen.queryByTestId('facility-map-card')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('DiningCard — the dietary contract', () => {
  it('renders the mandatory caution whenever a filter was applied', () => {
    render(<DiningCard meta={meta({ dietary: ['no_pork'] })} locale="ko" />);
    expect(screen.getByTestId('dining-caution')).toHaveTextContent(DINING_COPY.ko.caution);
    expect(screen.getByTestId('dining-applied')).toHaveTextContent('돼지고기 제외');
  });

  it('shows no caution when nothing was filtered', () => {
    render(<DiningCard meta={meta()} locale="ko" />);
    expect(screen.queryByTestId('dining-caution')).not.toBeInTheDocument();
  });

  it('a chip re-filters the loaded payload with zero network', () => {
    const noodles = place({ place_key: 'kakao:1', name: '올래국수', cuisine: '국수' });
    const pork = place({ place_key: 'kakao:2', name: '흑돼지 맛집', cuisine: '돼지고기', name_i18n: null });
    render(<DiningCard meta={meta({ places: [noodles, pork] })} locale="ko" />);
    expect(screen.getAllByTestId('dining-place')).toHaveLength(2);

    fireEvent.click(screen.getByTestId('dining-chip-no_pork'));
    expect(screen.getAllByTestId('dining-place')).toHaveLength(1);
    expect(screen.getByTestId('dining-place')).toHaveTextContent('올래국수');
    // The caution appears the moment a client-side filter is applied, too.
    expect(screen.getByTestId('dining-caution')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('DiningCard — feedback', () => {
  const auth = { bookingId: 'b1', roomSession: 'sess' };

  it('"we\'ll go here" posts a visited signal', () => {
    render(<DiningCard meta={meta()} locale="en" auth={auth} />);
    fireEvent.click(screen.getByTestId('dining-go-here'));
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/tour-rooms/b1/dining/feedback',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toEqual({ placeKey: 'kakao:1', cell: 'wydm9q1', action: 'visited' });
  });

  it('"this looks wrong" reports it AND optimistically hides the row', () => {
    render(<DiningCard meta={meta()} locale="en" auth={auth} />);
    fireEvent.click(screen.getByTestId('dining-report-wrong'));
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.action).toBe('wrong');
    expect(screen.queryByTestId('dining-place')).not.toBeInTheDocument();
    expect(screen.getByTestId('dining-empty')).toBeInTheDocument();
  });

  it('without credentials the deep links still work and nothing is posted', () => {
    render(<DiningCard meta={meta()} locale="en" />);
    fireEvent.click(screen.getByTestId('dining-go-here'));
    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.getByTestId('dining-map-link')).toBeInTheDocument();
  });
});

describe('ChatFeed dining_card routing', () => {
  const message = (metadata: Record<string, unknown>): RoomMessage => ({
    id: 'm1',
    sender_role: 'system',
    source_text: 'Lunch near Dongmun Market',
    created_at: '2026-07-24T02:00:00Z',
    metadata,
  });

  it('renders the dining card, not a system capsule', () => {
    render(<ChatFeed messages={[message({ ...meta() })]} viewerLocale="en" />);
    expect(screen.getByTestId('dining-card')).toBeInTheDocument();
    expect(screen.queryByTestId('arrival-bundle-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('approach-card')).not.toBeInTheDocument();
  });

  it('leaves the approach branch untouched', () => {
    render(
      <ChatFeed
        messages={[message({ kind: 'approach_card', spot_title: 'S', poi_key: 's', distance_m: 900 })]}
        viewerLocale="en"
      />,
    );
    expect(screen.getByTestId('approach-card')).toBeInTheDocument();
    expect(screen.queryByTestId('dining-card')).not.toBeInTheDocument();
  });
});
