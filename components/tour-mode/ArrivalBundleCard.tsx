'use client';

/**
 * A0 — guest-facing arrival bundle card (one card per stop, P-D8).
 *
 * The operator's single tap lands here: meeting-time strip (the live
 * countdown itself stays in the NoticeBanner — this strip is the in-feed
 * record), follow-vs-free + ticket badges, the viewing-route note, the
 * restroom map, a parking-pin link, and the full spot briefing (SpotArrivalCard
 * reused as-is). tr-* tokens only — works in light/dark and the cockpit.
 */

import { AlarmClock, MapPin, Footprints, Compass, Ticket, Route, BusFront, CalendarCheck, CalendarX } from 'lucide-react';
import { renderNextLegLine } from '@/lib/tour-room/eta';
import SpotArrivalCard from '@/components/tour-mode/SpotArrivalCard';
import FacilityMapCard from '@/components/tour-mode/FacilityMapCard';
import { selectFacilityPins, type FacilityPin } from '@/lib/tour-room/facilityPins';
import { BUNDLE_COPY, renderEventLine, type ArrivalBundleMeta } from '@/lib/tour-room/arrivalBundle';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

function mapsUrl(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export default function ArrivalBundleCard({
  meta,
  arrivedLine,
  locale,
}: {
  meta: ArrivalBundleMeta;
  /** First line of the translated bundle text ("You have arrived near …"). */
  arrivedLine: string;
  locale: RoomLocale;
}) {
  const copy = BUNDLE_COPY[locale];
  const point = meta.meeting_point_i18n?.[locale]?.trim() || meta.meeting_point || null;
  const routeNote = meta.route_note_i18n?.[locale]?.trim() || meta.route_note || null;
  const restrooms = selectFacilityPins((meta.facility_pins as FacilityPin[] | undefined) ?? [], 'restroom');
  const meetingCoords =
    typeof meta.meeting_lat === 'number' && typeof meta.meeting_lng === 'number'
      ? { lat: meta.meeting_lat, lng: meta.meeting_lng }
      : null;
  const parkingCoords =
    typeof meta.parking_lat === 'number' && typeof meta.parking_lng === 'number'
      ? { lat: meta.parking_lat, lng: meta.parking_lng }
      : null;

  const hasContent = Boolean(meta.content && Object.keys(meta.content).length > 0);

  return (
    <div className="flex flex-col gap-2" data-testid="arrival-bundle-card">
      {/* content-less stop: the arrived line still leads the card */}
      {!hasContent ? (
        <p className="px-1 text-sm font-semibold text-[var(--tr-ink)]">{arrivedLine}</p>
      ) : null}

      {/* meeting-time strip — the stop's single most important line */}
      {meta.meeting_time ? (
        <div className="flex items-center gap-3 rounded-[var(--tr-radius-card)] border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-4 py-3">
          <AlarmClock size={20} strokeWidth={2} aria-hidden className="shrink-0 text-[var(--tr-accent)]" />
          <div className="min-w-0 flex-1">
            <p className="tr-meta font-medium">{copy.meeting}</p>
            <p className="text-lg font-bold leading-tight text-[var(--tr-ink)]">
              {meta.meeting_time}
              {point ? <span className="ml-2 text-sm font-medium text-[var(--tr-ink-2)]">{point}</span> : null}
            </p>
          </div>
          {meetingCoords ? (
            <a
              href={mapsUrl(meetingCoords.lat, meetingCoords.lng)}
              target="_blank"
              rel="noreferrer"
              className="tr-pill flex shrink-0 items-center gap-1 px-3 py-1.5 text-sm font-semibold text-[var(--tr-ink)]"
            >
              <MapPin size={14} strokeWidth={2} aria-hidden />
              {copy.map}
            </a>
          ) : null}
        </div>
      ) : null}

      {/* follow / ticket badges */}
      <div className="flex flex-wrap gap-1.5">
        <span className="tr-pill inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-[var(--tr-ink)]">
          {meta.follow_mode === 'follow' ? (
            <Footprints size={14} strokeWidth={2} aria-hidden />
          ) : (
            <Compass size={14} strokeWidth={2} aria-hidden />
          )}
          {meta.follow_mode === 'follow' ? copy.follow : copy.free}
        </span>
        {meta.ticket_required ? (
          <span className="tr-pill inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-[var(--tr-ink)]">
            <Ticket size={14} strokeWidth={2} aria-hidden />
            {copy.ticket}
          </span>
        ) : null}
        {!meta.meeting_time && parkingCoords ? (
          <a
            href={mapsUrl(parkingCoords.lat, parkingCoords.lng)}
            target="_blank"
            rel="noreferrer"
            className="tr-pill inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-[var(--tr-ink)]"
          >
            <MapPin size={14} strokeWidth={2} aria-hidden />
            {copy.parking}
          </a>
        ) : null}
      </div>

      {/* viewing-route note */}
      {routeNote ? (
        <div className="flex items-start gap-2.5 rounded-[var(--tr-radius-card)] border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-4 py-3">
          <Route size={16} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0 text-[var(--tr-ink-2)]" />
          <div className="min-w-0">
            <p className="tr-meta font-medium">{copy.route}</p>
            <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--tr-ink)]">{routeNote}</p>
          </div>
        </div>
      ) : null}

      {/* A4 — today's event confirmation (operator one-tap citation) */}
      {meta.event_status && (meta.event_label || meta.event_label_i18n) ? (
        <div
          className="flex items-center gap-2.5 rounded-[var(--tr-radius-card)] border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-4 py-2.5"
          data-testid="arrival-event-line"
        >
          {meta.event_status === 'on' ? (
            <CalendarCheck size={16} strokeWidth={2} aria-hidden className="shrink-0 text-[var(--tr-safe)]" />
          ) : (
            <CalendarX size={16} strokeWidth={2} aria-hidden className="shrink-0 text-[var(--tr-ink-2)]" />
          )}
          <p className="text-sm font-medium text-[var(--tr-ink)]">
            {renderEventLine(
              meta.event_status,
              locale,
              meta.event_label_i18n?.[locale]?.trim() || meta.event_label || '',
            )}
          </p>
        </div>
      ) : null}

      {/* A2 — next-stop ETA footer line */}
      {meta.next_leg ? (
        <div className="flex items-center gap-2.5 rounded-[var(--tr-radius-card)] border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-4 py-2.5">
          <BusFront size={16} strokeWidth={2} aria-hidden className="shrink-0 text-[var(--tr-ink-2)]" />
          <p className="text-sm font-medium text-[var(--tr-ink)]" data-testid="arrival-next-leg">
            {renderNextLegLine(locale, {
              title: meta.next_leg.title,
              distanceM: meta.next_leg.distance_m,
              minutes: meta.next_leg.minutes,
            })}
          </p>
        </div>
      ) : null}

      {/* restroom map (verified pins only, W2.1) */}
      {restrooms.length > 0 ? <FacilityMapCard kind="restroom" pins={restrooms} locale={locale} /> : null}

      {/* the spot briefing itself (3-tier content) */}
      {hasContent && meta.content ? (
        <SpotArrivalCard
          content={meta.content}
          messageText={arrivedLine}
          audioUrl={meta.audio_url ?? null}
          locale={locale}
          contentTier={meta.content_tier ?? null}
        />
      ) : null}
    </div>
  );
}
