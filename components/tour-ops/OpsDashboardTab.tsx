'use client';

/**
 * W3.2 — dashboard tab: rooms grouped by tour, SOS pinned first inside each
 * group, live/unread/boarding signals per card. Rendering stays flat DOM with
 * `content-visibility: auto` on cards — the browser skips layout/paint for
 * off-screen rooms, which is the windowing the 30-room AC needs without a
 * virtualization dependency (§3-E: no heavy deps).
 */

import { useMemo } from 'react';
import type { OpsRoomStream } from '@/hooks/useOpsChannels';
import { roomHue } from '@/components/tour-mode/guide/GuideConsole';
import ChatListRow from '@/components/tour-mode/chatlist/ChatListRow';
import type { AttentionItem, AttentionReason } from '@/lib/tour-ops/attention';
import {
  isRecent,
  kstTimeLabel,
  opsReadableText,
  senderLabel,
  type OpsRoom,
  type SosInfo,
} from '@/components/tour-ops/opsShared';

const ATTENTION_LABELS: Record<AttentionReason, string> = {
  need_help: '🙋 도움 요청',
  concierge: '🤝 AI 에스컬레이션',
  keyword: '⚠️ 키워드 감지',
  unanswered: '⏳ 5분 무응답',
};

interface TourGroup {
  key: string;
  title: string;
  city: string | null;
  rooms: OpsRoom[];
  boarded: number;
  guests: number;
}

export default function OpsDashboardTab({
  rooms,
  loading,
  loadError = false,
  onRetry,
  streams,
  unread,
  sosRooms,
  attention = [],
  onOpenRoom,
}: {
  rooms: OpsRoom[];
  loading: boolean;
  loadError?: boolean;
  onRetry?: () => void;
  streams: Record<string, OpsRoomStream>;
  unread: Record<string, number>;
  sosRooms: Map<string, SosInfo>;
  attention?: AttentionItem[];
  onOpenRoom: (roomId: string) => void;
}) {
  const roomById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);
  const groups = useMemo<TourGroup[]>(() => {
    const byTour = new Map<string, TourGroup>();
    for (const room of rooms) {
      const key = room.tour?.id ?? room.tour?.title ?? '기타';
      let group = byTour.get(key);
      if (!group) {
        group = { key, title: room.tour?.title ?? '투어 미지정', city: room.tour?.city ?? null, rooms: [], boarded: 0, guests: 0 };
        byTour.set(key, group);
      }
      group.rooms.push(room);
      if (room.onboard_ack) group.boarded += 1;
      group.guests += room.booking?.number_of_guests ?? 1;
    }
    // Effective recency = newer of the aggregate row and the live stream tail
    // (a room active only over the socket must still sort to the top).
    const latestAt = (room: OpsRoom): string => {
      const liveMessages = streams[room.id]?.messages;
      const liveAt = liveMessages && liveMessages.length > 0 ? liveMessages[liveMessages.length - 1].created_at : '';
      const aggAt = room.last_message?.created_at ?? '';
      return liveAt > aggAt ? liveAt : aggAt;
    };
    const list = [...byTour.values()];
    // SOS rooms pin to the top of their group; SOS groups pin to the top of the list.
    for (const group of list) {
      group.rooms.sort((a, b) => {
        const aSos = sosRooms.has(a.id) ? 1 : 0;
        const bSos = sosRooms.has(b.id) ? 1 : 0;
        if (aSos !== bSos) return bSos - aSos;
        const at = latestAt(a);
        const bt = latestAt(b);
        return at === bt ? 0 : at < bt ? 1 : -1;
      });
    }
    list.sort((a, b) => {
      const aSos = a.rooms.some((room) => sosRooms.has(room.id)) ? 1 : 0;
      const bSos = b.rooms.some((room) => sosRooms.has(room.id)) ? 1 : 0;
      if (aSos !== bSos) return bSos - aSos;
      return a.title.localeCompare(b.title, 'ko');
    });
    return list;
  }, [rooms, sosRooms, streams]);

  if (loading && rooms.length === 0) {
    return <p className="mt-12 text-center tr-body text-[var(--tr-ink-3)]">불러오는 중…</p>;
  }
  // Distinguish a genuine "no rooms today" from a fetch failure — the latter
  // must never read as "no tours" on the SOS-monitoring surface.
  if (loadError && rooms.length === 0) {
    return (
      <div className="mt-12 text-center">
        <p className="tr-body font-medium text-[var(--tr-ink)]">불러오기에 실패했어요</p>
        <p className="mt-1 tr-label text-[var(--tr-ink-3)]">네트워크를 확인한 뒤 다시 시도해 주세요.</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 min-h-[44px] rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] px-5 tr-card-text font-semibold text-[var(--tr-ink)]"
          >
            다시 시도
          </button>
        )}
      </div>
    );
  }
  if (rooms.length === 0) {
    return <p className="mt-12 text-center tr-body text-[var(--tr-ink-3)]">이 날짜에 활성 룸이 없습니다.</p>;
  }

  return (
    <div className="space-y-4 pb-4">
      {attention.length > 0 && (
        <section data-testid="ops-attention-queue">
          <h2 className="px-1 pb-1.5 tr-card-text font-semibold text-[var(--tr-warn)] ">응대 필요 {attention.length}</h2>
          <div className="space-y-2">
            {attention.map((item) => {
              const room = roomById.get(item.roomId);
              return (
                <button
                  key={`${item.roomId}-${item.reason}`}
                  type="button"
                  onClick={() => onOpenRoom(item.roomId)}
                  className="block w-full rounded-2xl border border-[var(--tr-warn-soft)] bg-[var(--tr-warn-soft)]   px-4 py-3 text-left"
                >
                  <p className="flex items-center gap-2 tr-card-text font-semibold text-[var(--tr-warn)] ">
                    <span className="shrink-0 rounded-full bg-[var(--tr-warn-soft)] px-2 py-0.5 tr-meta font-bold">
                      {ATTENTION_LABELS[item.reason]}
                    </span>
                    <span className="truncate">{room?.booking?.contact_name ?? '게스트'}</span>
                    <span className="ml-auto shrink-0 tr-meta font-normal text-[var(--tr-warn)] ">
                      {kstTimeLabel(item.created_at)}
                    </span>
                  </p>
                  {item.excerpt && <p className="mt-1 truncate tr-label text-[var(--tr-warn)] ">{item.excerpt}</p>}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {groups.map((group) => (
        <section key={group.key}>
          <div className="flex items-baseline justify-between gap-2 px-1 pb-1.5">
            <h2 className="min-w-0 truncate tr-card-text font-semibold text-[var(--tr-ink-2)]">
              {group.title}
              {group.city ? <span className="ml-1 font-normal text-[var(--tr-ink-3)]">· {group.city}</span> : null}
            </h2>
            <span className="shrink-0 tr-meta text-[var(--tr-ink-3)]">
              룸 {group.rooms.length} · 탑승 {group.boarded}/{group.rooms.length} · {group.guests}명
            </span>
          </div>

          <div className="space-y-2">
            {group.rooms.map((room) => {
              const sos = sosRooms.get(room.id) ?? null;
              const stream = streams[room.id];
              const liveMessages = stream?.messages ?? [];
              const lastLive = liveMessages.length > 0 ? liveMessages[liveMessages.length - 1] : null;
              // Prefer whichever is actually newer, and show ko translation.
              const aggAt = room.last_message?.created_at ?? '';
              const useLive = lastLive != null && (lastLive.created_at ?? '') >= aggAt;
              const lastSource = useLive ? lastLive : room.last_message;
              const lastText = opsReadableText(lastSource) || '메시지 없음';
              const lastAt = useLive ? lastLive!.created_at : room.last_message?.created_at;
              const isLive = isRecent(lastAt) || Object.keys(stream?.locations ?? {}).length > 0;
              const unreadCount = unread[room.id] ?? 0;
              const hue = roomHue(room.booking_id);

              return (
                <ChatListRow
                  key={room.id}
                  testId="ops-room-card"
                  linkTestId="ops-room-open"
                  onClick={() => onOpenRoom(room.id)}
                  alarm={Boolean(sos)}
                  hue={hue}
                  avatar={sos ? '🆘' : (room.booking?.contact_name ?? 'G').trim().charAt(0).toUpperCase()}
                  title={room.booking?.contact_name ?? '게스트'}
                  meta={`${room.booking?.number_of_guests ?? 1}명 · ${room.booking?.preferred_language ?? 'en'}`}
                  badges={
                    <>
                      {isLive && (
                        <span className="tr-meta inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--tr-safe-soft)] px-1.5 py-0.5 font-bold text-[var(--tr-safe)]">
                          <span className="size-1.5 rounded-full bg-[var(--tr-safe)]" />
                          LIVE
                        </span>
                      )}
                      {room.onboard_ack && <span className="tr-meta shrink-0">🚌</span>}
                    </>
                  }
                  preview={
                    <>
                      <span className="text-[var(--tr-ink-2)]">{senderLabel(lastSource?.sender_role)}</span>{' '}
                      {lastText}
                    </>
                  }
                  time={kstTimeLabel(lastAt)}
                  indicator={
                    unreadCount > 0 ? (
                      <span className="tr-meta flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--tr-accent)] px-1.5 font-bold text-[var(--tr-on-accent)]">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    ) : null
                  }
                  footer={
                    sos ? (
                      <p className="tr-label border-t border-[var(--tr-danger)] px-4 py-2 text-[var(--tr-danger)]">
                        {sos.metadata.sender_name && <b>{sos.metadata.sender_name}: </b>}
                        {sos.metadata.note ?? 'SOS 발생'}
                        {typeof sos.metadata.latitude === 'number' && ' · 📍 위치 포함'}
                      </p>
                    ) : null
                  }
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
