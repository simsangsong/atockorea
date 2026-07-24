/**
 * C-16 cards ②~⑤ — guest render + the ChatFeed routing branches.
 *
 * The contracts that matter here:
 *   ① each metadata.kind reaches its own card and nothing else;
 *   ② the safety card's re-boarding variant is collapsed but recoverable;
 *   ③ the safety video renders TEN <track> elements with `default` on the
 *      viewer's language (the whole point of the multi-track design);
 *   ④ card ④'s chips PUT to /dietary, are optimistic, and roll back on failure.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BriefingSafetyCard from '@/components/tour-mode/BriefingSafetyCard';
import BriefingScheduleCard from '@/components/tour-mode/BriefingScheduleCard';
import BriefingLunchCard from '@/components/tour-mode/BriefingLunchCard';
import BriefingEtiquetteCard from '@/components/tour-mode/BriefingEtiquetteCard';
import ChatFeed from '@/components/tour-mode/ChatFeed';
import { __resetTourRoomSettingsForTests } from '@/hooks/useTourRoomSettings';
import { composeSafety, SAFETY_COPY, type BriefingSafetyMeta } from '@/lib/ops/seating/cards/safety';
import { composeSchedule, SCHEDULE_COPY, type BriefingScheduleMeta } from '@/lib/ops/seating/cards/schedule';
import { composeLunch, LUNCH_COPY, type BriefingLunchMeta } from '@/lib/ops/seating/cards/lunch';
import { composeEtiquette, ETIQUETTE_COPY, type BriefingEtiquetteMeta } from '@/lib/ops/seating/cards/etiquette';
import { SAFETY_SUBTITLE_TRACKS } from '@/lib/tour-room/safetyVideo';
import { DIETARY_LABELS } from '@/lib/ops/dining/dietary';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

jest.mock('@/lib/tour-room/tts', () => ({
  primeAudio: jest.fn(),
  speakWithDevice: jest.fn(async () => true),
  speakMessage: jest.fn(async () => 'device'),
  TTS_LANG: { en: 'en-US', ko: 'ko-KR', ja: 'ja-JP', es: 'es-ES', zh: 'zh-CN' },
}));

const VIDEO = {
  video_url: 'https://cdn/safety.mp4',
  poster_url: null,
  duration_seconds: 30,
  tracks: [...SAFETY_SUBTITLE_TRACKS],
};

const safety = (over: Partial<BriefingSafetyMeta> = {}) =>
  ({ ...(composeSafety({}).metadata as unknown as BriefingSafetyMeta), ...over });
const schedule = composeSchedule({
  schedule: [
    { time: '09:30', title: 'Seongsan Ilchulbong' },
    { title: 'Seopjikoji' },
  ],
  source: 'day_plan',
})!;
const lunch = (over: Partial<BriefingLunchMeta> = {}) =>
  ({ ...(composeLunch({ lunchIncluded: false }).metadata as unknown as BriefingLunchMeta), ...over });
const etiquette = composeEtiquette().metadata as unknown as BriefingEtiquetteMeta;

beforeEach(() => {
  window.localStorage.clear();
  __resetTourRoomSettingsForTests();
  jest.restoreAllMocks();
});

describe('card ② safety', () => {
  it.each(ROOM_LOCALES)('renders the full briefing in %s', (locale) => {
    render(
      <BriefingSafetyCard meta={safety()} text={composeSafety({}).translations[locale]} locale={locale} />,
    );
    expect(screen.getByTestId('briefing-safety-title')).toHaveTextContent(SAFETY_COPY[locale].title);
    expect(screen.getByTestId('briefing-safety-body').textContent?.trim()).not.toBe('');
    expect(screen.queryByTestId('briefing-safety-toggle')).not.toBeInTheDocument();
  });

  it('re-boarding: collapsed by default, full text one tap away', () => {
    const collapsed = composeSafety({ collapsed: true });
    render(
      <BriefingSafetyCard
        meta={collapsed.metadata as unknown as BriefingSafetyMeta}
        text={collapsed.translations.en}
        locale="en"
      />,
    );
    expect(screen.getByTestId('briefing-safety-title')).toHaveTextContent(SAFETY_COPY.en.collapsedTitle);
    expect(screen.getByTestId('briefing-safety-body')).toHaveTextContent(collapsed.translations.en);
    expect(screen.getByTestId('briefing-safety-body')).not.toHaveTextContent('Emergency numbers are always');

    fireEvent.click(screen.getByTestId('briefing-safety-toggle'));
    expect(screen.getByTestId('briefing-safety-body')).toHaveTextContent('Emergency numbers are always');
    fireEvent.click(screen.getByTestId('briefing-safety-toggle'));
    expect(screen.getByTestId('briefing-safety-body')).not.toHaveTextContent('Emergency numbers are always');
  });

  it('is complete as text when no video is approved', () => {
    render(<BriefingSafetyCard meta={safety()} text="body" locale="en" />);
    expect(screen.queryByTestId('safety-video-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('briefing-safety-card')).toBeInTheDocument();
  });

  it('shows the video slot when an approved render rides the metadata', () => {
    render(<BriefingSafetyCard meta={safety({ video_card: VIDEO })} text="body" locale="en" />);
    expect(screen.getByTestId('safety-video-card')).toBeInTheDocument();
    expect(screen.getByTestId('safety-video-poster')).toBeInTheDocument();
  });
});

describe('the multi-track safety player', () => {
  it('mounts all ten subtitle tracks with default on the viewer language', () => {
    render(<BriefingSafetyCard meta={safety({ video_card: VIDEO })} text="body" locale="en" preferredLocale="de" />);
    fireEvent.click(screen.getByTestId('safety-video-poster'));

    const player = screen.getByTestId('safety-video-player') as HTMLVideoElement;
    expect(player.muted).toBe(true);
    expect(player).toHaveAttribute('playsinline');
    for (const track of SAFETY_SUBTITLE_TRACKS) {
      expect(screen.getByTestId(`safety-track-${track.srclang}`)).toHaveAttribute('src', track.src);
    }
    // the German guest's track is the one marked default
    expect(screen.getByTestId('safety-track-de')).toHaveAttribute('default');
    expect(screen.getByTestId('safety-track-en')).not.toHaveAttribute('default');
  });

  it('falls back to the room locale when the chat language has no track', () => {
    render(<BriefingSafetyCard meta={safety({ video_card: VIDEO })} text="body" locale="ja" preferredLocale="pt-BR" />);
    fireEvent.click(screen.getByTestId('safety-video-poster'));
    expect(screen.getByTestId('safety-track-ja')).toHaveAttribute('default');
  });
});

describe('card ③ schedule', () => {
  it('lists the stops with their times and the traffic footnote', () => {
    render(<BriefingScheduleCard meta={schedule.metadata as unknown as BriefingScheduleMeta} locale="ko" />);
    const rows = screen.getAllByTestId('briefing-schedule-stop');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('09:30');
    expect(rows[0]).toHaveTextContent('Seongsan Ilchulbong');
    expect(rows[1]).toHaveTextContent('Seopjikoji');
    expect(screen.getByTestId('briefing-schedule-count')).toHaveTextContent('2곳');
    expect(screen.getByTestId('briefing-schedule-card')).toHaveTextContent(SCHEDULE_COPY.ko.footnote);
  });

  it('renders nothing when the metadata somehow carries no stops', () => {
    const { container } = render(
      <BriefingScheduleCard
        meta={{ kind: 'briefing_schedule', stops: [], source: 'none' } as BriefingScheduleMeta}
        locale="en"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('card ⑤ etiquette', () => {
  it.each(ROOM_LOCALES)('renders the rules and the preset pointer in %s', (locale) => {
    render(
      <BriefingEtiquetteCard meta={etiquette} text={composeEtiquette().translations[locale]} locale={locale} />,
    );
    expect(screen.getByTestId('briefing-etiquette-body').textContent?.trim()).not.toBe('');
    expect(screen.getByTestId('briefing-etiquette-preset-hint')).toHaveTextContent(
      ETIQUETTE_COPY[locale].presetHint,
    );
  });
});

describe('🔴 card ④ — the dietary intake write', () => {
  const auth = { bookingId: 'b1', roomSession: 'sess' };

  it('renders one chip per storable tag, labelled from the shared vocabulary', () => {
    render(<BriefingLunchCard meta={lunch()} text="body" locale="ko" auth={auth} />);
    expect(screen.getByTestId('briefing-lunch-chip-vegan')).toHaveTextContent(DIETARY_LABELS.vegan.ko);
    expect(screen.getByTestId('briefing-lunch-chip-halal')).toHaveTextContent(DIETARY_LABELS.halal.ko);
    // `kids` is derived and must never be offered as a storable chip.
    expect(screen.queryByTestId('briefing-lunch-chip-kids')).not.toBeInTheDocument();
  });

  it('pre-selects what is already on file', () => {
    render(<BriefingLunchCard meta={lunch({ dietary: ['halal'] })} text="body" locale="en" auth={auth} />);
    expect(screen.getByTestId('briefing-lunch-chip-halal')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('briefing-lunch-chip-vegan')).toHaveAttribute('aria-pressed', 'false');
  });

  it('PUTs the full tag set to /dietary and confirms', async () => {
    const fetchMock = jest.fn(async () => ({ ok: true, json: async () => ({ dietary: ['vegan'] }) }));
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<BriefingLunchCard meta={lunch()} text="body" locale="en" auth={auth} />);
    fireEvent.click(screen.getByTestId('briefing-lunch-chip-vegan'));

    expect(screen.getByTestId('briefing-lunch-chip-vegan')).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() =>
      expect(screen.getByTestId('briefing-lunch-status')).toHaveTextContent(LUNCH_COPY.en.saved),
    );

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/tour-rooms/b1/dietary');
    expect(init.method).toBe('PUT');
    expect((init.headers as Record<string, string>)['x-tour-room-auth']).toBe('sess');
    expect(JSON.parse(init.body as string)).toEqual({ dietary: ['vegan'] });
  });

  it('unticking sends the remaining tags (removal must reach the server)', async () => {
    const fetchMock = jest.fn(async () => ({ ok: true, json: async () => ({}) }));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<BriefingLunchCard meta={lunch({ dietary: ['vegan', 'halal'] })} text="body" locale="en" auth={auth} />);
    fireEvent.click(screen.getByTestId('briefing-lunch-chip-vegan'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(init.body as string)).toEqual({ dietary: ['halal'] });
  });

  it('rolls the chip back and says so when the save fails', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 500 })) as unknown as typeof fetch;
    render(<BriefingLunchCard meta={lunch()} text="body" locale="en" auth={auth} />);
    fireEvent.click(screen.getByTestId('briefing-lunch-chip-vegan'));
    await waitFor(() =>
      expect(screen.getByTestId('briefing-lunch-status')).toHaveTextContent(LUNCH_COPY.en.failed),
    );
    expect(screen.getByTestId('briefing-lunch-chip-vegan')).toHaveAttribute('aria-pressed', 'false');
  });

  it('is read-only (and sends nothing) without room credentials', () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<BriefingLunchCard meta={lunch()} text="body" locale="en" auth={null} />);
    const chip = screen.getByTestId('briefing-lunch-chip-vegan');
    expect(chip).toBeDisabled();
    fireEvent.click(chip);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('ChatFeed routing for the card stack', () => {
  const message = (metadata: Record<string, unknown>, text = 'body'): RoomMessage => ({
    id: `m-${metadata.kind}`,
    sender_role: 'system',
    source_text: text,
    created_at: '2099-07-24T02:00:00Z',
    metadata,
  });

  it('routes every kind to its own card and to nothing else', () => {
    render(
      <ChatFeed
        messages={[
          message(safety() as unknown as Record<string, unknown>),
          message(schedule.metadata),
          message(lunch() as unknown as Record<string, unknown>),
          message(etiquette as unknown as Record<string, unknown>),
        ]}
        viewerLocale="en"
      />,
    );
    expect(screen.getByTestId('briefing-safety-card')).toBeInTheDocument();
    expect(screen.getByTestId('briefing-schedule-card')).toBeInTheDocument();
    expect(screen.getByTestId('briefing-lunch-card')).toBeInTheDocument();
    expect(screen.getByTestId('briefing-etiquette-card')).toBeInTheDocument();
    // the pre-existing branches stay out of the way
    expect(screen.queryByTestId('arrival-bundle-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dining-card')).not.toBeInTheDocument();
  });

  it('card ① keeps rendering as the plain system capsule it always was', () => {
    render(
      <ChatFeed
        messages={[message({ kind: 'tour_start_briefing', fanout: true }, 'Good morning, and welcome aboard!')]}
        viewerLocale="en"
      />,
    );
    expect(screen.getByTestId('chat-feed')).toHaveTextContent('Good morning, and welcome aboard!');
    expect(screen.queryByTestId('briefing-safety-card')).not.toBeInTheDocument();
  });

  it('hands the lunch card room credentials only for a customer viewer', () => {
    const { rerender } = render(
      <ChatFeed
        messages={[message(lunch() as unknown as Record<string, unknown>)]}
        viewerLocale="en"
        viewerRole="customer"
        tts={{ bookingId: 'b1', roomSession: 'sess' }}
      />,
    );
    expect(screen.getByTestId('briefing-lunch-chip-vegan')).not.toBeDisabled();

    rerender(
      <ChatFeed
        messages={[message(lunch() as unknown as Record<string, unknown>)]}
        viewerLocale="en"
        viewerRole="guide"
        tts={{ bookingId: 'b1', roomSession: 'sess' }}
      />,
    );
    expect(screen.getByTestId('briefing-lunch-chip-vegan')).toBeDisabled();
  });
});
