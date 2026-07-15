'use client';

/**
 * W3.4 — map tab wrapper: builds per-room marker sets from the live streams
 * (broadcast 'location' frames; the aggregate has no coordinates) and hands
 * them to the dynamically-imported canvas. A legend below the map doubles as
 * a room switcher for rooms that have no live positions yet.
 */

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import type { OpsRoomStream } from '@/hooks/useOpsChannels';
import { roomHue } from '@/components/tour-mode/guide/GuideConsole';
import type { OpsRoom, SosInfo } from '@/components/tour-ops/opsShared';
import type { OpsMapRoom } from '@/components/tour-ops/OpsMapCanvas';

const OpsMapCanvas = dynamic(() => import('@/components/tour-ops/OpsMapCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[300px] items-center justify-center rounded-2xl bg-slate-900">
      <span className="text-[13px] text-slate-500">지도를 불러오는 중…</span>
    </div>
  ),
});

export default function OpsMapTab({
  rooms,
  streams,
  sosRooms,
  onSelectRoom,
}: {
  rooms: OpsRoom[];
  streams: Record<string, OpsRoomStream>;
  sosRooms?: Map<string, SosInfo>;
  onSelectRoom: (roomId: string) => void;
}) {
  const mapRooms = useMemo<OpsMapRoom[]>(
    () =>
      rooms.map((room) => ({
        roomId: room.id,
        label: `${room.booking?.contact_name ?? '게스트'} · ${room.tour?.title ?? ''}`,
        hue: roomHue(room.booking_id),
        sos: sosRooms?.has(room.id) ?? false,
        locations: Object.values(streams[room.id]?.locations ?? {}),
      })),
    [rooms, streams, sosRooms],
  );
  const sharingCount = mapRooms.reduce((sum, room) => sum + room.locations.length, 0);

  return (
    <div className="flex flex-col gap-3 pb-4">
      <div className="h-[52dvh] min-h-[300px]">
        <OpsMapCanvas rooms={mapRooms} onSelectRoom={onSelectRoom} />
      </div>
      <p className="px-1 text-[11px] text-slate-500">
        위치 공유 중 {sharingCount}명 — 마커를 탭하면 해당 룸이 열립니다.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {mapRooms.map((room) => (
          <button
            key={room.roomId}
            type="button"
            onClick={() => onSelectRoom(room.roomId)}
            className="flex h-11 items-center gap-1.5 rounded-full border border-white/10 bg-slate-900 px-3.5 text-[12px] text-slate-300"
          >
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: room.sos ? '#ef4444' : `hsl(${room.hue} 60% 50%)` }}
            />
            <span className="max-w-[160px] truncate">{room.label}</span>
            {room.locations.length > 0 && <span className="text-slate-500">{room.locations.length}</span>}
          </button>
        ))}
        {mapRooms.length === 0 && <p className="text-[12px] text-slate-500">이 날짜에 활성 룸이 없습니다.</p>}
      </div>
    </div>
  );
}
