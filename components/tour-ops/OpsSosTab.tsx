'use client';

/**
 * W3.1/W4.1 — SOS tab: every active SOS as a card with one-tap actions
 * (open room, open location, call). Empty state doubles as reassurance that
 * the alert channel is up.
 */

import { MapPin, MessageSquareText, Phone } from 'lucide-react';
import { kstTimeLabel, type OpsRoom, type SosInfo } from '@/components/tour-ops/opsShared';

export default function OpsSosTab({
  rooms,
  sosRooms,
  onOpenRoom,
}: {
  rooms: OpsRoom[];
  sosRooms: Map<string, SosInfo>;
  onOpenRoom: (roomId: string) => void;
}) {
  const entries = rooms.filter((room) => sosRooms.has(room.id));

  if (entries.length === 0) {
    return (
      <div className="mt-16 text-center">
        <p className="text-3xl">🟢</p>
        <p className="mt-2 text-sm font-medium text-slate-300">활성 SOS가 없습니다</p>
        <p className="mt-1 text-[12px] text-slate-500">SOS 발생 시 이 탭에 즉시 표시되고 사운드가 울립니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-4">
      {entries.map((room) => {
        const sos = sosRooms.get(room.id)!;
        const phone = room.booking?.contact_phone ?? null;
        return (
          <div
            key={room.id}
            className="rounded-2xl border border-red-500/50 bg-red-950/40 p-4 ring-1 ring-red-500/30"
            data-testid="ops-sos-card"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-red-100">
                  <span className="animate-pulse">🆘</span> {room.booking?.contact_name ?? '게스트'}
                  <span className="ml-1.5 font-normal text-red-300/70">
                    {room.booking?.number_of_guests ?? 1}명 · {room.booking?.preferred_language ?? 'en'}
                  </span>
                </p>
                <p className="mt-0.5 truncate text-[12px] text-red-200/80">{room.tour?.title ?? ''}</p>
              </div>
              <span className="shrink-0 text-[11px] text-red-300/70">{kstTimeLabel(sos.created_at)}</span>
            </div>

            <p className="mt-2 rounded-xl bg-red-500/10 px-3 py-2 text-[13px] text-red-100">
              {sos.metadata.sender_name && <b>{sos.metadata.sender_name}: </b>}
              {sos.metadata.note ?? '메모 없는 SOS — 즉시 연락 필요'}
            </p>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onOpenRoom(room.id)}
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-red-500 text-[13px] font-semibold text-white"
              >
                <MessageSquareText className="size-4" />
                룸 열기
              </button>
              {typeof sos.metadata.latitude === 'number' ? (
                <a
                  href={`https://maps.google.com/?q=${sos.metadata.latitude},${sos.metadata.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-red-500/20 text-[13px] font-semibold text-red-100"
                >
                  <MapPin className="size-4" />
                  위치
                </a>
              ) : (
                <span className="flex h-11 items-center justify-center rounded-xl bg-red-500/10 text-[12px] text-red-300/50">
                  위치 없음
                </span>
              )}
              {phone ? (
                <a
                  href={`tel:${phone}`}
                  className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-red-500/20 text-[13px] font-semibold text-red-100"
                >
                  <Phone className="size-4" />
                  전화
                </a>
              ) : (
                <span className="flex h-11 items-center justify-center rounded-xl bg-red-500/10 text-[12px] text-red-300/50">
                  번호 없음
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
