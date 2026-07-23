'use client';

/**
 * W3.3 — the room drawer: tap a room anywhere (dashboard, map, SOS tab) and
 * its live feed slides up with an admin composer. Sends are optimistic — a
 * local pending bubble renders instantly and the server copy replacing it
 * arrives via the room broadcast (self-echo) or the POST response, whichever
 * lands first (mergeRoomMessages dedupes by id). Quick-reply presets reuse
 * the room's zero-LLM template set (§M-2 ②).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { MapPin, Phone, X } from 'lucide-react';
import type { OpsRoomStream } from '@/hooks/useOpsChannels';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';
import { GUIDE_QUICK_REPLIES } from '@/lib/tour-room/quickReplies';
import {
  getOpsToken,
  kstTimeLabel,
  opsReadableText,
  senderLabel,
  type OpsRoom,
  type SosInfo,
} from '@/components/tour-ops/opsShared';
import OpsManifestView from '@/components/tour-ops/OpsManifestView';

const FEED_LIMIT = 80;

export default function OpsRoomDrawer({
  room,
  stream,
  sos,
  onClose,
  onDelivered,
  onSeen,
}: {
  room: OpsRoom;
  stream: OpsRoomStream | undefined;
  sos: SosInfo | null;
  onClose: () => void;
  onDelivered: (message: RoomMessage) => void;
  onSeen: () => void;
}) {
  const [backlog, setBacklog] = useState<RoomMessage[]>([]);
  const [backlogLoading, setBacklogLoading] = useState(true);
  const [pending, setPending] = useState<RoomMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  // Phase 2 §3.2 — 룸 상세 세그먼트: 대화(기존) | 명단(같은 tour_id+tour_date).
  const [view, setView] = useState<'chat' | 'manifest'>('chat');
  const feedRef = useRef<HTMLDivElement | null>(null);
  const manifestAvailable = Boolean(room.tour_id && room.tour_date);

  // REST backlog on open — broadcast only carries what arrived while subscribed.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const token = await getOpsToken();
        const res = await fetch(`/api/tour-rooms/${encodeURIComponent(room.booking_id)}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
          cache: 'no-store',
        });
        const json = await res.json();
        if (!cancelled && res.ok) setBacklog((json.messages as RoomMessage[]) ?? []);
      } catch {
        /* stream-only feed still works */
      } finally {
        if (!cancelled) setBacklogLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [room.booking_id]);

  // Merge backlog + live stream + local pending; dedupe by id, cap the tail.
  const feed = useMemo(() => {
    const byId = new Map<string, RoomMessage>();
    for (const message of backlog) byId.set(message.id, message);
    for (const message of stream?.messages ?? []) byId.set(message.id, message);
    const merged = [...byId.values()].sort((a, b) => (a.created_at < b.created_at ? -1 : 1)).slice(-FEED_LIMIT);
    return [...merged, ...pending];
  }, [backlog, stream?.messages, pending]);

  // New content → stick to the bottom + keep the unread cursor current.
  const feedLength = feed.length;
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    onSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scroll/cursor track feed growth only
  }, [feedLength]);

  // Escape closes the drawer (a11y — the only other close path is the backdrop).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const send = useCallback(
    async (payload: { text?: string; presetKey?: string }, display: string) => {
      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: RoomMessage = {
        id: localId,
        sender_role: 'admin',
        source_text: display,
        created_at: new Date().toISOString(),
        _local: 'sending',
      };
      setPending((prev) => [...prev, optimistic]);
      setSending(true);
      try {
        const token = await getOpsToken();
        const res = await fetch(`/api/tour-rooms/${encodeURIComponent(room.booking_id)}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '발신 실패');
        if (json.message) onDelivered(json.message as RoomMessage);
        setPending((prev) => prev.filter((message) => message.id !== localId));
        return true;
      } catch (error) {
        setPending((prev) => prev.filter((message) => message.id !== localId));
        toast.error(error instanceof Error ? error.message : '발신 실패');
        return false;
      } finally {
        setSending(false);
      }
    },
    [room.booking_id, onDelivered],
  );

  const sendDraft = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    const ok = await send({ text }, text);
    // Restore the failed text for retry, but never clobber what the agent has
    // already started typing in the meantime.
    if (!ok) setDraft((current) => current || text);
  }, [draft, sending, send]);

  const locations = Object.values(stream?.locations ?? {});
  const joined = room.participants.filter((participant) => participant.role !== 'admin');
  const phone = room.booking?.contact_phone ?? null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="룸 대화">
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div
        className="relative flex max-h-[88dvh] flex-col rounded-t-3xl border-t border-[var(--tr-hairline)] bg-[var(--tr-surface)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <header className="flex items-center gap-3 border-b border-[var(--tr-hairline)] px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-[var(--tr-ink)]">
              {room.booking?.contact_name ?? '게스트'}
              <span className="ml-1.5 font-normal text-[var(--tr-ink-3)]">
                {room.booking?.number_of_guests ?? 1}명 · {room.booking?.preferred_language ?? 'en'}
              </span>
            </p>
            <p className="truncate text-[12px] text-[var(--tr-ink-2)]">
              {room.tour?.title ?? ''} · 입장 {joined.length}명
              {locations.length > 0 && ` · 위치공유 ${locations.length}`}
            </p>
          </div>
          {phone && (
            <a
              href={`tel:${phone}`}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]"
              aria-label="전화 걸기"
            >
              <Phone className="size-4" />
            </a>
          )}
          <a
            href={`/admin/orders/${room.booking_id}`}
            className="flex h-11 shrink-0 items-center rounded-xl bg-[var(--tr-surface-2)] px-3 text-[12px] font-medium text-[var(--tr-ink-2)]"
          >
            주문
          </a>
          <button
            type="button"
            onClick={onClose}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-[var(--tr-ink-2)]"
            aria-label="닫기"
          >
            <X className="size-5" />
          </button>
        </header>

        {/* Phase 2 §3.2 — [대화|명단] 세그먼트 (명단 = tour_id+tour_date 파생 뷰) */}
        {manifestAvailable && (
          <div className="flex gap-1.5 border-b border-[var(--tr-hairline)] px-4 py-2">
            {(
              [
                { key: 'chat', label: '대화' },
                { key: 'manifest', label: '명단' },
              ] as Array<{ key: 'chat' | 'manifest'; label: string }>
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                aria-pressed={view === key}
                className={`h-8 rounded-full px-3.5 text-[12px] font-semibold ${
                  view === key
                    ? 'bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)]'
                    : 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {view === 'manifest' && manifestAvailable && (
          <OpsManifestView tourId={room.tour_id!} tourDate={room.tour_date!} tourTitle={room.tour?.title ?? null} />
        )}

        {sos && (
          <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-200">
            <span className="animate-pulse">🆘</span>
            <span className="min-w-0 flex-1 truncate">
              {sos.metadata.sender_name && <b>{sos.metadata.sender_name}: </b>}
              {sos.metadata.note ?? 'SOS 발생'}
            </span>
            {typeof sos.metadata.latitude === 'number' && (
              <a
                className="flex h-11 shrink-0 items-center gap-1 rounded-lg bg-red-500/20 px-3 font-semibold text-red-700 dark:text-red-100"
                href={`https://maps.google.com/?q=${sos.metadata.latitude},${sos.metadata.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MapPin className="size-3.5" />
                위치
              </a>
            )}
          </div>
        )}

        {view === 'chat' && (
        <div ref={feedRef} className="min-h-[200px] flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {backlogLoading && feed.length === 0 && <p className="text-center text-[12px] text-[var(--tr-ink-3)]">피드를 불러오는 중…</p>}
          {!backlogLoading && feed.length === 0 && <p className="text-center text-[12px] text-[var(--tr-ink-3)]">아직 메시지가 없습니다.</p>}
          {feed.map((message) => {
            const mine = message.sender_role === 'admin';
            return (
              <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[82%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                    mine
                      ? `bg-blue-600 text-white ${message._local ? 'opacity-60' : ''}`
                      : message.sender_role === 'guide'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-100'
                        : 'bg-[var(--tr-surface-2)] text-[var(--tr-ink)]'
                  }`}
                >
                  {!mine && (
                    <p className="mb-0.5 text-[10px] font-semibold text-[var(--tr-ink-2)]">
                      {senderLabel(message.sender_role)}
                    </p>
                  )}
                  {/* Ops reads the ko translation; admin's own sends have none. */}
                  <p className="whitespace-pre-wrap break-words">
                    {mine ? message.source_text : opsReadableText(message)}
                  </p>
                  <p className={`mt-0.5 text-right text-[10px] ${mine ? 'text-blue-100' : 'text-[var(--tr-ink-3)]'}`}>
                    {message._local ? '전송 중…' : kstTimeLabel(message.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        )}

        {view === 'chat' && (
        <div className="border-t border-[var(--tr-hairline)] px-3 pt-2">
          <div className="flex gap-1.5 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {/* A6 — ops speaks with the staff (guide) set, never guest phrases. */}
            {GUIDE_QUICK_REPLIES.map((preset) => (
              <button
                key={preset.key}
                type="button"
                disabled={sending}
                onClick={() => void send({ presetKey: preset.key }, preset.text.ko)}
                className="flex h-11 shrink-0 items-center gap-1 rounded-full border border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] px-3.5 text-[12px] text-[var(--tr-ink-2)] disabled:opacity-40"
              >
                <span>{preset.emoji}</span>
                {preset.text.ko}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2 pb-3"
            onSubmit={(event) => {
              event.preventDefault();
              void sendDraft();
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={2000}
              placeholder="관제 메시지 (자동 번역되어 전달)"
              className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] px-3 text-[14px] text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)]"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="h-11 shrink-0 rounded-xl bg-blue-600 px-4 text-[14px] font-semibold text-white disabled:opacity-40"
            >
              발신
            </button>
          </form>
        </div>
        )}
      </div>
    </div>
  );
}
