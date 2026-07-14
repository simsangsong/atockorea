'use client';

/**
 * T3.7 — pickup-morning board, pinned above the chat feed on tour morning.
 *
 * Live mode (guide sharing): "my pickup: Nth stop · ~X min" from the bus's
 * straight-line range. Static mode (no bus position): scheduled time only.
 * The arrived / running-late buttons reuse the pre-translated quick-reply
 * presets ('arrived' / 'running_late') — zero LLM, and the guide console can
 * aggregate on metadata.preset_key.
 */

import { QUICK_REPLY_PRESETS, type QuickReplyPreset } from '@/lib/tour-room/quickReplies';
import type { PickupBoardState } from '@/lib/tour-room/pickup';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const COPY: Record<
  RoomLocale,
  {
    title: string;
    stop: (n: number, total: number) => string;
    eta: (min: number) => string;
    scheduled: string;
    mapHint: string;
  }
> = {
  en: {
    title: 'Pickup this morning',
    stop: (n, total) => `Your pickup is stop ${n} of ${total}`,
    eta: (min) => `Bus about ${min} min away`,
    scheduled: 'Scheduled pickup',
    mapHint: 'Live bus position is on the Map tab',
  },
  ko: {
    title: '오늘 아침 픽업',
    stop: (n, total) => `내 픽업은 ${total}곳 중 ${n}번째 정차예요`,
    eta: (min) => `버스가 약 ${min}분 거리에 있어요`,
    scheduled: '픽업 예정 시간',
    mapHint: '버스 실시간 위치는 지도 탭에서 볼 수 있어요',
  },
  ja: {
    title: '今朝のお迎え',
    stop: (n, total) => `お迎えは全${total}か所中${n}番目です`,
    eta: (min) => `バスは約${min}分の距離です`,
    scheduled: 'お迎え予定時刻',
    mapHint: 'バスの現在地は地図タブで確認できます',
  },
  es: {
    title: 'Recogida de esta mañana',
    stop: (n, total) => `Tu parada es la ${n} de ${total}`,
    eta: (min) => `El bus está a unos ${min} min`,
    scheduled: 'Hora programada',
    mapHint: 'La posición del bus está en la pestaña Mapa',
  },
  zh: {
    title: '今早接送',
    stop: (n, total) => `您的接送点是 ${total} 站中的第 ${n} 站`,
    eta: (min) => `大巴距离约 ${min} 分钟`,
    scheduled: '预定接送时间',
    mapHint: '大巴实时位置请看地图标签',
  },
};

const PICKUP_PRESET_KEYS = ['arrived', 'running_late'] as const;

export default function PickupBoard({
  state,
  locale,
  onSendPreset,
}: {
  state: PickupBoardState;
  locale: RoomLocale;
  onSendPreset: (preset: QuickReplyPreset) => void;
}) {
  if (!state.visible || !state.myStop) return null;
  const copy = COPY[locale];
  const presets = QUICK_REPLY_PRESETS.filter((p) =>
    (PICKUP_PRESET_KEYS as readonly string[]).includes(p.key),
  );
  const time = state.myStop.pickup_time ? state.myStop.pickup_time.slice(0, 5) : null;

  return (
    <div
      className="mb-2 rounded-2xl bg-gradient-to-br from-emerald-50 to-white px-4 py-3.5 shadow-sm ring-1 ring-emerald-100 dark:from-emerald-950 dark:to-gray-900 dark:ring-emerald-900"
      data-testid="pickup-board"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-50">🚌 {copy.title}</p>
        {state.mode === 'live' && state.etaMinutes !== null && (
          <span className="shrink-0 rounded-full bg-emerald-500 px-2.5 py-1 text-[12px] font-bold text-white" data-testid="pickup-eta">
            ~{state.etaMinutes}′
          </span>
        )}
      </div>

      {state.rank !== null && (
        <p className="mt-1 text-[13px] text-gray-700 dark:text-gray-200">{copy.stop(state.rank, state.totalStops)}</p>
      )}
      <p className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">
        {state.mode === 'live' && state.etaMinutes !== null ? copy.eta(state.etaMinutes) : `${copy.scheduled}${time ? ` · ${time}` : ''}`}
        {state.myStop.name ? ` · ${state.myStop.name}` : ''}
      </p>

      <div className="mt-2.5 flex gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => onSendPreset(preset)}
            className="flex-1 rounded-xl bg-white py-2 text-[12px] font-medium text-gray-700 shadow-sm ring-1 ring-gray-100 active:bg-emerald-50 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-800"
          >
            {preset.emoji} {preset.text[locale]}
          </button>
        ))}
      </div>
      {state.mode === 'live' && (
        <p className="mt-1.5 text-[11px] text-gray-400">{copy.mapHint}</p>
      )}
    </div>
  );
}
