'use client';

/**
 * 메시지 모아보기 — every room's messages merged into one reverse-chron
 * timeline, so ops can skim the whole day without opening rooms one by one.
 * Live streams are the source (up to 200/room); the aggregate last_message
 * fills rooms whose stream hasn't produced anything yet. Tapping a row opens
 * that room's drawer.
 */

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { OpsRoomStream } from '@/hooks/useOpsChannels';
import {
  kstTimeLabel,
  opsReadableText,
  senderLabel,
  type OpsRoom,
} from '@/components/tour-ops/opsShared';

interface InboxRow {
  key: string;
  roomId: string;
  guestName: string;
  tourTitle: string;
  senderRole: string;
  text: string;
  createdAt: string;
}

type Filter = 'all' | 'customer';

const MAX_ROWS = 120;

export function buildInboxRows(
  rooms: OpsRoom[],
  streams: Record<string, OpsRoomStream | undefined>,
  filter: Filter,
): InboxRow[] {
  const rows: InboxRow[] = [];
  for (const room of rooms) {
    const guestName = room.booking?.contact_name ?? '게스트';
    const tourTitle = room.tour?.title ?? '';
    const streamMessages = streams[room.id]?.messages ?? [];
    const source = streamMessages.length
      ? streamMessages
      : room.last_message?.created_at
        ? [room.last_message]
        : [];
    for (const message of source) {
      if (!message?.created_at) continue;
      const senderRole = message.sender_role ?? 'system';
      if (filter === 'customer' && senderRole !== 'customer') continue;
      const text = opsReadableText(message);
      if (!text) continue;
      rows.push({
        key: `${room.id}:${message.id ?? message.created_at}`,
        roomId: room.id,
        guestName,
        tourTitle,
        senderRole,
        text,
        createdAt: message.created_at,
      });
    }
  }
  rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return rows.slice(0, MAX_ROWS);
}

export default function OpsInboxView({
  rooms,
  streams,
  onClose,
  onOpenRoom,
}: {
  rooms: OpsRoom[];
  streams: Record<string, OpsRoomStream | undefined>;
  onClose: () => void;
  onOpenRoom: (roomId: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>('customer');
  const rows = useMemo(() => buildInboxRows(rooms, streams, filter), [rooms, streams, filter]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100" data-testid="ops-inbox">
      <header
        className="border-b border-white/10 px-4 pb-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
      >
        <div className="flex min-h-[40px] items-center justify-between">
          <h2 className="text-[15px] font-bold">메시지 모아보기</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex size-10 items-center justify-center rounded-lg text-slate-400 active:bg-white/10"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="flex gap-1.5 pb-1">
          {(
            [
              { key: 'customer', label: '손님 메시지' },
              { key: 'all', label: '전체' },
            ] as Array<{ key: Filter; label: string }>
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={`h-8 rounded-full px-3.5 text-[12px] font-semibold ${
                filter === key ? 'bg-white text-slate-950' : 'bg-white/10 text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-2 pb-8">
        {rows.length === 0 ? (
          <p className="mt-16 text-center text-[13px] text-slate-500">
            {filter === 'customer' ? '오늘 손님 메시지가 아직 없습니다.' : '오늘 메시지가 아직 없습니다.'}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {rows.map((row) => (
              <li key={row.key}>
                <button
                  type="button"
                  onClick={() => onOpenRoom(row.roomId)}
                  className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2.5 text-left active:bg-white/10"
                >
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-[12px] font-semibold text-slate-300">
                      <span
                        className={
                          row.senderRole === 'customer'
                            ? 'text-emerald-300'
                            : row.senderRole === 'guide'
                              ? 'text-violet-300'
                              : 'text-slate-400'
                        }
                      >
                        {senderLabel(row.senderRole)}
                      </span>
                      {' · '}
                      {row.guestName}
                      {row.tourTitle && <span className="font-normal text-slate-500"> · {row.tourTitle}</span>}
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums text-slate-500">
                      {kstTimeLabel(row.createdAt)}
                    </span>
                  </p>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-slate-100">{row.text}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
