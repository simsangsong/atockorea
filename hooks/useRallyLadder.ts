'use client';

/**
 * SG-2a — the headless rally firer (SG-D7). Crossing detection used to live
 * inside NoticeBanner, which broke three ways at once: the cockpit renders
 * no banner (so the wake-locked staff device — the one screen guaranteed ON
 * during a tour — never fired), the banner's `notice` is activeNotice-based
 * (null at exactly T+GRACE, the width-zero window P0), and 1e's countdown
 * suppression would have killed the firer with the row. So the ladder is a
 * hook with no pixels: TourRoomClient mounts it for guests (backup) and the
 * Cockpit mounts it for staff (primary).
 *
 * Fires at most once per notice per mount per crossing; the server's UNIQUE
 * subjects are the real dedupe — these refs only spare the network.
 */
import { useEffect, useRef } from 'react';
import { activeNotice, rallyResolution, rallyStage } from '@/lib/tour-room/notices';
import { useRoomClock } from '@/components/tour-mode/roomClock';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

const LADDER_TICK_MS = 30_000;

/**
 * Headless mount: a provider cannot consume its own context, so the hosts
 * that RENDER RoomClockProvider (TourRoomClient) mount this child instead of
 * calling the hook directly.
 */
export function RallyLadder(props: Parameters<typeof useRallyLadder>[0]): null {
  useRallyLadder(props);
  return null;
}

export function useRallyLadder({
  bookingId,
  roomSession,
  messages,
  tourDate,
  enabled,
}: {
  bookingId: string | null | undefined;
  roomSession: string | null | undefined;
  messages: readonly RoomMessage[];
  tourDate: string | null | undefined;
  enabled: boolean;
}) {
  const roomNow = useRoomClock();
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const remindFiredRef = useRef<string | null>(null);
  const departedFiredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !bookingId || !roomSession) return undefined;

    const post = (type: 'rally_remind' | 'rally_departed', noticeId: string) => {
      void fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/signals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': roomSession },
        body: JSON.stringify({ type, noticeId }),
      }).catch(() => undefined);
    };

    const tick = () => {
      const now = roomNow();
      const msgs = [...messagesRef.current];

      // T-10 — the reminder push. 'remind' only: a notice born inside the
      // window STARTS at remind (covered); past-target posts would just 409.
      const notice = activeNotice(msgs, tourDate, now);
      if (notice && !notice.cancelled && notice.targetMs !== null) {
        const stage = rallyStage(notice, now);
        if (stage === 'remind' && remindFiredRef.current !== notice.messageId) {
          remindFiredRef.current = notice.messageId;
          post('rally_remind', notice.messageId);
        }
      }

      // T+GRACE — the departed crossing, from the derivation that survives
      // activeNotice's expiry (rallyResolution, SG-D6).
      const resolution = rallyResolution(msgs, tourDate, now);
      if (resolution && resolution.phase === 'window' && departedFiredRef.current !== resolution.noticeId) {
        departedFiredRef.current = resolution.noticeId;
        post('rally_departed', resolution.noticeId);
      }
    };

    tick();
    const timer = setInterval(tick, LADDER_TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, bookingId, roomSession, tourDate, roomNow]);
}
