'use client';

/**
 * T1.4/T1.5 room-entry client (full RoomShell tabs arrive with T1.6).
 *
 * Join credential ladder on mount:
 *   1. `?rt=` invite token (track 1) — consumed once, then scrubbed from the
 *      address bar via history.replaceState (§O-1 ③: no token in history,
 *      screen shares, or share sheets; the link itself stays re-clickable);
 *   2. stored room session (frictionless re-entry, §O-1 ④);
 *   3. guest credentials stashed by the entry page (sessionStorage, one-shot);
 *   4. plain cookie session (logged-in owner / merchant / admin).
 *
 * Once joined, messages flow through useTourRoomChannel (Realtime Broadcast →
 * SSE fallback → visibility resync, T1.5).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import CaptionBanner from '@/components/tour-mode/CaptionBanner';
import ChatFeed from '@/components/tour-mode/ChatFeed';
import Composer from '@/components/tour-mode/Composer';
import EndedCard from '@/components/tour-mode/EndedCard';
import GuideCaptionBar from '@/components/tour-mode/GuideCaptionBar';
import LobbyCard, { firstPickup } from '@/components/tour-mode/LobbyCard';
import PickupBoard from '@/components/tour-mode/PickupBoard';
import RoomMapTab from '@/components/tour-mode/map/RoomMapTab';
import RoomShell from '@/components/tour-mode/RoomShell';
import { detectEntryLocale, ENTRY_COPY } from '@/components/tour-mode/entryCopy';
import { GUEST_CREDS_STORAGE_PREFIX } from '@/components/tour-mode/TourModeEntry';
import SettingsTab from '@/components/tour-mode/SettingsTab';
import { useTourRoomSession, getOrCreateDeviceKey, type TourRoomJoinResult } from '@/hooks/useTourRoomSession';
import { useTourRoomChannel, type RoomMessage } from '@/hooks/useTourRoomChannel';
import { useTourRoomSettings } from '@/hooks/useTourRoomSettings';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { extensionForMime } from '@/lib/tour-room/recorder';
import { detectTtsTier, primeAudio, speakWithDevice } from '@/lib/tour-room/tts';
import { pickupBoardState } from '@/lib/tour-room/pickup';
import type { RoomLocale, PickupSequenceStop } from '@/lib/tour-room/snapshot';
import type { RoomLocation } from '@/hooks/useTourRoomChannel';
import type { VoiceTranscribeResult } from '@/components/tour-mode/Composer';

function consumeGuestCreds(bookingId: string): { contactEmail?: string; contactName?: string } | null {
  try {
    const key = `${GUEST_CREDS_STORAGE_PREFIX}${bookingId}`;
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as { contactEmail?: string; contactName?: string };
  } catch {
    return null;
  }
}

function scrubTokenFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('rt')) {
      url.searchParams.delete('rt');
      window.history.replaceState(window.history.state, '', url.toString());
    }
  } catch {
    /* noop */
  }
}

export default function TourRoomClient({ bookingId }: { bookingId: string }) {
  const copy = useMemo(() => ENTRY_COPY[detectEntryLocale()], []);
  const { state, join } = useTourRoomSession(bookingId);
  const attempted = useRef(false);
  const [locale, setLocale] = useState<RoomLocale>(() => detectEntryLocale());

  // T1.12: language switch re-joins so the participant row (and with it the
  // room's translation targeting, D-8) follows the new locale.
  const changeLocale = (next: RoomLocale) => {
    if (next === locale) return;
    setLocale(next);
    void join({ locale: next });
  };

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const url = new URL(window.location.href);
    const token = url.searchParams.get('rt');
    const guest = consumeGuestCreds(bookingId);

    void join({
      token: token || undefined,
      contactEmail: guest?.contactEmail,
      contactName: guest?.contactName,
      locale,
    }).then((result) => {
      if (result) scrubTokenFromUrl();
    });
  }, [bookingId, join, locale]);

  if (state.status === 'idle' || state.status === 'joining') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-[14px] text-gray-500">{copy.loading}</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="text-[32px]">🧭</div>
        <p className="mt-4 text-[14px] leading-relaxed text-gray-700">
          {state.httpStatus === 404 ? copy.errorNotFound : copy.errorGeneric}
        </p>
        <Link
          href="/tour-mode"
          className="mt-6 rounded-xl bg-amber-500 px-5 py-2.5 text-[13px] font-semibold text-white"
        >
          {copy.title}
        </Link>
      </div>
    );
  }

  return <TourRoomLive bookingId={bookingId} data={state.data} locale={locale} onLocaleChange={changeLocale} />;
}

function TourRoomLive({
  bookingId,
  data,
  locale,
  onLocaleChange,
}: {
  bookingId: string;
  data: TourRoomJoinResult;
  locale: RoomLocale;
  onLocaleChange: (locale: RoomLocale) => void;
}) {
  const { settings } = useTourRoomSettings();
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const theme = settings.theme === 'system' ? (systemDark ? 'dark' : 'light') : settings.theme;
  const snapshot = data.snapshot as {
    booking?: {
      tours?: { title?: string; city?: string } | null;
      tour_date?: string | null;
      tour_time?: string | null;
      booking_reference?: string | null;
      pickup_points?: unknown;
    } | null;
    messages?: RoomMessage[];
    locations?: RoomLocation[];
    tour_guide_spots?: Array<{
      id: string;
      title?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      trigger_radius_m?: number | null;
      exit_radius_m?: number | null;
    }>;
    tour_facilities?: Array<{ name?: string | null; lat?: number | null; lng?: number | null }>;
    pickup_sequence?: PickupSequenceStop[];
    schedule?: Array<Record<string, unknown>>;
  };
  const { messages, connection, sendText, sendPreset, retryFailed, failedCount, latestCaption, locations, presence } =
    useTourRoomChannel({
      bookingId,
      channelTopic: data.channel.topic,
      roomSession: data.session,
      initialMessages: snapshot.messages ?? [],
      initialLocations: snapshot.locations ?? [],
      presence: {
        participantId: data.participant.id,
        role: data.participant.role,
        displayName: data.participant.display_name,
      },
    });

  const viewerRole = data.participant.role;
  const readOnly = data.lifecycle === 'ended';
  const schedule = Array.isArray(snapshot.schedule) ? snapshot.schedule : [];
  const myPickup = firstPickup(snapshot.booking?.pickup_points);
  const guideLocation = Object.values(locations).find((l) => l.role === 'guide') ?? null;
  // T3.7 — pickup-morning board (customers only; hides itself off-morning).
  const pickup =
    viewerRole === 'customer' && data.lifecycle === 'live'
      ? pickupBoardState({
          tourDate: snapshot.booking?.tour_date,
          myBookingId: bookingId,
          pickupSequence: snapshot.pickup_sequence ?? [],
          guidePosition: guideLocation
            ? { latitude: guideLocation.latitude, longitude: guideLocation.longitude }
            : null,
        })
      : null;

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // T2.4: any first gesture in the room unlocks audio for later playback.
  useEffect(() => {
    const unlock = () => primeAudio();
    document.addEventListener('pointerdown', unlock, { once: true });
    return () => document.removeEventListener('pointerdown', unlock);
  }, []);

  // T2.2 — transcribe-only upload; the transcript comes back into the
  // Composer for confirmation (or auto-sends per the settings contract).
  const transcribeVoice = useCallback(
    async (blob: Blob, mimeType: string): Promise<VoiceTranscribeResult | null> => {
      try {
        const form = new FormData();
        form.append('audio', new File([blob], `voice.${extensionForMime(mimeType)}`, { type: mimeType }));
        const res = await fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/stt`, {
          method: 'POST',
          headers: { 'x-tour-room-auth': data.session },
          body: form,
        });
        if (!res.ok) return null;
        const json = (await res.json()) as { text?: string; needsConfirmation?: boolean };
        return { text: json.text ?? '', needsConfirmation: json.needsConfirmation !== false };
      } catch {
        return null;
      }
    },
    [bookingId, data.session],
  );

  // T4.7 — photo questions; the latest geofence arrival is the location
  // context injected into the vision prompt.
  const visionAsk = useCallback(
    async (file: File, options: { question: string; share: boolean }) => {
      try {
        const lastArrival = [...messagesRef.current]
          .reverse()
          .find((m) => m.metadata?.kind === 'spot_arrival');
        const form = new FormData();
        form.append('image', file);
        form.append('locale', locale);
        form.append('question', options.question);
        form.append('share', String(options.share));
        if (lastArrival?.metadata?.spot_title) {
          form.append('context', String(lastArrival.metadata.spot_title));
        }
        const res = await fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/vision-ask`, {
          method: 'POST',
          headers: { 'x-tour-room-auth': data.session },
          body: form,
        });
        if (!res.ok) return null;
        const json = (await res.json()) as { answer?: string; shared?: boolean };
        return json.answer ? { answer: json.answer, shared: Boolean(json.shared) } : null;
      } catch {
        return null;
      }
    },
    [bookingId, data.session, locale],
  );

  // T2.9 — report the device's TTS capability once per entry (background,
  // via the join upsert; no UI state churn).
  useEffect(() => {
    let cancelled = false;
    void detectTtsTier(locale).then((tier) => {
      if (cancelled) return;
      const deviceKey = getOrCreateDeviceKey();
      if (!deviceKey) return;
      void fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': data.session },
        body: JSON.stringify({ deviceKey, locale, ttsCapable: tier === 'device' }),
      }).catch(() => undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [bookingId, data.session, locale]);

  // T2.5 — optional auto-read of incoming guide notices (device TTS only,
  // never the paid path; silent when the tab is hidden).
  const spokenIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (spokenIdsRef.current === null) {
      // First render: everything already in the feed predates this visit.
      spokenIdsRef.current = new Set(messages.map((m) => m.id));
      return;
    }
    const seen = spokenIdsRef.current;
    for (const message of messages) {
      if (seen.has(message.id)) continue;
      seen.add(message.id);
      if (
        settings.autoRead &&
        message.sender_role === 'guide' &&
        viewerRole !== 'guide' &&
        !message._local &&
        document.visibilityState === 'visible'
      ) {
        const text = message.translations?.[locale] || message.source_text;
        void speakWithDevice(text, locale);
      }
    }
  }, [messages, settings.autoRead, viewerRole, locale]);

  return (
    <RoomShell
      title={snapshot.booking?.tours?.title ?? 'Your tour'}
      subtitle={[snapshot.booking?.tour_date, snapshot.booking?.tours?.city].filter(Boolean).join(' · ')}
      lifecycle={data.lifecycle}
      connection={connection}
      locale={locale}
      schedule={schedule}
      theme={theme}
      banner={viewerRole !== 'guide' ? <CaptionBanner caption={latestCaption} locale={locale} /> : null}
      map={
        <RoomMapTab
          bookingId={bookingId}
          roomSession={data.session}
          locale={locale}
          myParticipantId={data.participant.id}
          locations={locations}
          presence={presence}
          spots={(snapshot.tour_guide_spots ?? []).map((spot) => ({
            id: spot.id,
            title: spot.title ?? null,
            latitude: spot.latitude ?? null,
            longitude: spot.longitude ?? null,
          }))}
          facilities={snapshot.tour_facilities ?? []}
          pickup={myPickup}
          geofenceSpots={(snapshot.tour_guide_spots ?? [])
            .filter(
              (spot) =>
                typeof spot.latitude === 'number' &&
                typeof spot.longitude === 'number' &&
                typeof spot.trigger_radius_m === 'number',
            )
            .map((spot) => ({
              id: spot.id,
              latitude: spot.latitude!,
              longitude: spot.longitude!,
              trigger_radius_m: spot.trigger_radius_m!,
              exit_radius_m: spot.exit_radius_m ?? null,
            }))}
        />
      }
      settings={<SettingsTab locale={locale} onLocaleChange={onLocaleChange} />}
      chat={
        <>
          {viewerRole === 'guide' && !readOnly && (
            <GuideCaptionBar bookingId={bookingId} roomSession={data.session} locale={locale} />
          )}
          {pickup && (
            <PickupBoard state={pickup} locale={locale} onSendPreset={(preset) => void sendPreset(preset, locale)} />
          )}
          {data.lifecycle === 'lobby' && (
            <LobbyCard
              locale={locale}
              tourDate={snapshot.booking?.tour_date ?? null}
              tourTime={snapshot.booking?.tour_time ?? null}
              pickupPoints={snapshot.booking?.pickup_points}
            />
          )}
          {readOnly && <EndedCard locale={locale} bookingReference={snapshot.booking?.booking_reference} />}
          <ChatFeed
            messages={messages}
            viewerLocale={locale}
            viewerRole={viewerRole}
            textScale={settings.textScale}
            tts={{ bookingId, roomSession: data.session }}
          />
          {failedCount > 0 && (
            <button
              type="button"
              onClick={() => void retryFailed()}
              className="mb-2 w-full rounded-xl bg-red-50 py-2 text-[12px] font-medium text-red-600"
            >
              ↻ {failedCount}
            </button>
          )}
          {!readOnly && (
            <Composer
              locale={locale}
              onSendText={(text) => void sendText(text)}
              onSendPreset={(preset) => void sendPreset(preset, locale)}
              transcribeVoice={transcribeVoice}
              vision={{ ask: visionAsk }}
            />
          )}
        </>
      }
    />
  );
}
