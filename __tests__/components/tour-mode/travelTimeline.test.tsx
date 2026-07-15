/**
 * V4 — TravelTimeline: the feed entry opens a recap sheet; the review CTA is
 * always present and decoupled from the reward; the claim button appears only
 * when complete and reflects the server's grant / login / unavailable verdict.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TravelTimelineEntry from '@/components/tour-mode/TravelTimeline';
import { TIMELINE_COPY } from '@/lib/tour-room/timeline';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

const COMPLETE: RoomMessage[] = [
  { id: 'a1', sender_role: 'system', source_text: 'arrived', created_at: '2099-07-20T03:00:00Z', metadata: { kind: 'spot_arrival', spot_title: 'Jusangjeolli' } },
  { id: 'a2', sender_role: 'system', source_text: 'arrived', created_at: '2099-07-20T05:00:00Z', metadata: { kind: 'spot_arrival', spot_title: 'Osulloc' } },
  { id: 'p1', sender_role: 'system', source_text: 'my photo', created_at: '2099-07-20T04:00:00Z', metadata: { kind: 'vision_answer', image_url: 'https://cdn/x.jpg' } },
];

function renderEntry(overrides: Partial<Parameters<typeof TravelTimelineEntry>[0]> = {}) {
  return render(
    <TravelTimelineEntry
      locale="en"
      messages={COMPLETE}
      bookingId="booking-1"
      roomSession="session"
      tourSlug="jeju-south-1day"
      variant="live"
      {...overrides}
    />,
  );
}

beforeEach(() => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ eligible: true, granted: true, code: 'TIMELINE10' }),
  })) as unknown as typeof fetch;
});

describe('TravelTimelineEntry (V4)', () => {
  it('renders a summary and opens the recap sheet', () => {
    renderEntry();
    expect(screen.getByTestId('timeline-open')).toHaveTextContent('2 stops · 1 photo');
    fireEvent.click(screen.getByTestId('timeline-open'));
    expect(screen.getByTestId('timeline-panel')).toBeInTheDocument();
    expect(screen.getByText('Jusangjeolli')).toBeInTheDocument();
    expect(screen.getByText('Osulloc')).toBeInTheDocument();
  });

  it('always shows the review CTA pointing at the tour, decoupled from the reward', () => {
    renderEntry();
    fireEvent.click(screen.getByTestId('timeline-open'));
    const review = screen.getByTestId('timeline-review');
    expect(review).toHaveAttribute('href', '/tour-product/jeju-south-1day#reviews');
    expect(review).toHaveTextContent(TIMELINE_COPY.en.reviewCta);
  });

  it('falls back to mypage for the review link without a slug', () => {
    renderEntry({ tourSlug: null });
    fireEvent.click(screen.getByTestId('timeline-open'));
    expect(screen.getByTestId('timeline-review')).toHaveAttribute('href', '/mypage');
  });

  it('offers a claim when complete and shows the granted code', async () => {
    renderEntry();
    fireEvent.click(screen.getByTestId('timeline-open'));
    expect(screen.getByTestId('timeline-reward-ready')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('timeline-claim'));
    await waitFor(() => expect(screen.getByTestId('timeline-reward')).toBeInTheDocument());
    expect(screen.getByText(/TIMELINE10/)).toBeInTheDocument();
  });

  it('shows the honest login prompt when the server needs an account', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ eligible: true, granted: false, reason: 'login_required' }),
    })) as unknown as typeof fetch;
    renderEntry();
    fireEvent.click(screen.getByTestId('timeline-open'));
    fireEvent.click(screen.getByTestId('timeline-claim'));
    await waitFor(() => expect(screen.getByText(TIMELINE_COPY.en.rewardLogin)).toBeInTheDocument());
  });

  it('shows progress (no claim button) when the timeline is incomplete', () => {
    renderEntry({
      messages: [
        { id: 'a1', sender_role: 'system', source_text: 'arrived', created_at: '2099-07-20T03:00:00Z', metadata: { kind: 'spot_arrival', spot_title: 'Jusangjeolli' } },
      ],
    });
    fireEvent.click(screen.getByTestId('timeline-open'));
    expect(screen.getByTestId('timeline-reward-progress')).toBeInTheDocument();
    expect(screen.queryByTestId('timeline-claim')).not.toBeInTheDocument();
  });

  it('renders nothing mid-tour with no content, but always in the ended view', () => {
    const { container, rerender } = render(
      <TravelTimelineEntry locale="en" messages={[]} bookingId="b" roomSession="s" variant="live" />,
    );
    expect(container.querySelector('[data-testid="timeline-open"]')).toBeNull();
    rerender(<TravelTimelineEntry locale="en" messages={[]} bookingId="b" roomSession="s" variant="ended" />);
    expect(screen.getByTestId('timeline-open')).toBeInTheDocument();
  });

  it('renders chrome in every room locale', () => {
    for (const locale of ROOM_LOCALES) {
      const { unmount } = renderEntry({ locale });
      expect(screen.getByTestId('timeline-open')).toHaveTextContent(TIMELINE_COPY[locale].title);
      unmount();
    }
  });
});
