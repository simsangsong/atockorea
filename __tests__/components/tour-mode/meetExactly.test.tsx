/**
 * M-D2/M-D5 (docs/meet-exactly-master-plan-2026-07-27.md) — one WGS84 pin,
 * two audiences: staff open it in Kakao (navigable), guests in Google; and
 * the private-tour MeetSetCard fires the meeting_propose contract.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ChatFeed from '@/components/tour-mode/ChatFeed';
import LocationPreview from '@/components/tour-mode/LocationPreview';
import MeetSetCard from '@/components/tour-mode/MeetSetCard';
import { navChipsFor } from '@/lib/tour-room/nav-links';

describe('navChipsFor (M-D2)', () => {
  const dest = { lat: 37.5665, lng: 126.978, name: 'Cartier 1F' };

  it('staff chips are Kakao-first (app scheme + web fallback) plus TMAP — all WGS84, no conversion', () => {
    const chips = navChipsFor('staff', dest);
    expect(chips.map((c) => c.key)).toEqual(['kakao-navi', 'kakao-web', 'tmap']);
    expect(chips[0].href).toBe('kakaomap://route?ep=37.5665,126.978&by=CAR');
    expect(chips[1].href).toContain('map.kakao.com/link/to/');
    expect(chips[1].href).toContain('37.5665,126.978');
    expect(chips[2].href).toContain('tmap://route');
  });

  it('guest chips stay Google + Naver walking', () => {
    const chips = navChipsFor('guest', dest);
    expect(chips.map((c) => c.key)).toEqual(['google', 'naver']);
    expect(chips[0].href).toContain('google.com/maps/dir');
  });
});

describe('LocationPreview audiences (M-D2)', () => {
  const base = { lat: 37.5665, lng: 126.978, label: '집합 지점', url: 'https://maps.google.com/?q=37.5665,126.978' };

  it('staff variant renders Kakao chips and opens the thumbnail into the Kakao route', () => {
    render(<LocationPreview {...base} audience="staff" />);
    expect(screen.getByTestId('nav-chip-kakao-navi')).toHaveAttribute(
      'href',
      expect.stringContaining('kakaomap://route'),
    );
    expect(screen.getByTestId('nav-chip-tmap')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-chip-google')).not.toBeInTheDocument();
    const open = screen.getByText('집합 지점').closest('a');
    expect(open).toHaveAttribute('href', expect.stringContaining('map.kakao.com'));
  });

  it('guest variant (default) keeps the Google open target', () => {
    render(<LocationPreview {...base} />);
    expect(screen.getByTestId('nav-chip-google')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-chip-kakao-navi')).not.toBeInTheDocument();
    const open = screen.getByText('집합 지점').closest('a');
    expect(open).toHaveAttribute('href', base.url);
  });
});

describe('system capsule with a pin renders the map card (M-D2 regression)', () => {
  const PIN_TEXT =
    '📍 Sim Alex shared their exact location — https://maps.google.com/?q=37.566500,126.978000';
  const msg = (over: Record<string, unknown> = {}) => ({
    id: 'm1',
    room_id: 'r1',
    sender_role: 'system',
    input_kind: 'text',
    source_text: PIN_TEXT,
    source_locale: 'en',
    translations: {},
    created_at: '2026-07-27T05:00:00Z',
    metadata: { kind: 'guest_share_location', signal_type: 'share_location' },
    ...over,
  });

  it('guest viewer: pill text loses the raw URL, map card + Google chips appear', () => {
    render(<ChatFeed messages={[msg()] as never} viewerLocale="en" viewerRole="customer" />);
    expect(screen.getByTestId('location-preview')).toBeInTheDocument();
    expect(screen.getByTestId('nav-chip-google')).toBeInTheDocument();
    expect(screen.queryByText(/maps\.google\.com/)).not.toBeInTheDocument();
  });

  it('guide viewer: the SAME capsule carries KakaoNavi chips', () => {
    render(<ChatFeed messages={[msg({ id: 'm2' })] as never} viewerLocale="ko" viewerRole="guide" />);
    expect(screen.getByTestId('nav-chip-kakao-navi')).toHaveAttribute(
      'href',
      expect.stringContaining('kakaomap://route?ep=37.5665,126.978'),
    );
  });
});

describe('MeetSetCard (M-D5)', () => {
  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, status: 201, json: () => Promise.resolve({}) } as Response),
    ) as unknown as typeof fetch;
    Object.defineProperty(global.navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({ coords: { latitude: 37.51, longitude: 127.06, accuracy: 5 } } as GeolocationPosition),
      },
    });
  });

  it('submit stays disabled until a time is picked', () => {
    render(<MeetSetCard bookingId="b1" roomSession="sess-1" locale="en" />);
    expect(screen.getByTestId('meet-set-submit')).toBeDisabled();
    fireEvent.change(screen.getByTestId('meet-set-time'), { target: { value: '18:30' } });
    expect(screen.getByTestId('meet-set-submit')).not.toBeDisabled();
  });

  it('refuses to send with no place AND the pin toggle off', async () => {
    render(<MeetSetCard bookingId="b1" roomSession="sess-1" locale="ko" />);
    fireEvent.change(screen.getByTestId('meet-set-time'), { target: { value: '18:30' } });
    fireEvent.click(screen.getByTestId('meet-set-pin-toggle')); // ON → OFF
    fireEvent.click(screen.getByTestId('meet-set-submit'));
    expect(await screen.findByText(/장소 이름을 적거나/)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends meeting_propose with time + place + current-location pin, then shows the sent state', async () => {
    render(<MeetSetCard bookingId="b1" roomSession="sess-1" locale="ko" />);
    fireEvent.change(screen.getByTestId('meet-set-time'), { target: { value: '18:30' } });
    fireEvent.change(screen.getByTestId('meet-set-place'), { target: { value: '1층 까르띠에 앞' } });
    fireEvent.click(screen.getByTestId('meet-set-submit'));
    await waitFor(() => expect(screen.getByTestId('meet-set-sent')).toBeInTheDocument());

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/tour-rooms/b1/signals');
    expect((init.headers as Record<string, string>)['x-tour-room-auth']).toBe('sess-1');
    expect(JSON.parse(init.body as string)).toEqual({
      type: 'meeting_propose',
      time: '18:30',
      point: '1층 까르띠에 앞',
      lat: 37.51,
      lng: 127.06,
    });
  });
});
