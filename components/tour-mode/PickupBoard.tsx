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
import { IconPickup } from '@/components/tour-mode/icons';
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

const ONBOARD_COPY: Record<RoomLocale, { button: string; done: string }> = {
  en: { button: "I'm on the bus", done: 'On board ✓' },
  ko: { button: '탑승했어요', done: '탑승 완료 ✓' },
  ja: { button: '乗車しました', done: '乗車済み ✓' },
  es: { button: 'Ya estoy en el bus', done: 'A bordo ✓' },
  zh: { button: '我已上车', done: '已上车 ✓' },
};

export default function PickupBoard({
  state,
  locale,
  onSendPreset,
  onboardAcked = false,
  onOnboardAck,
}: {
  state: PickupBoardState;
  locale: RoomLocale;
  onSendPreset: (preset: QuickReplyPreset) => void;
  /** T6.4 — headcount ack; button hides once acknowledged. */
  onboardAcked?: boolean;
  onOnboardAck?: () => void;
}) {
  if (!state.visible || !state.myStop) return null;
  const copy = COPY[locale];
  const presets = QUICK_REPLY_PRESETS.filter((p) =>
    (PICKUP_PRESET_KEYS as readonly string[]).includes(p.key),
  );
  const time = state.myStop.pickup_time ? state.myStop.pickup_time.slice(0, 5) : null;

  return (
    <div className="tr-card mb-2 px-4 py-3.5" data-testid="pickup-board">
      <div className="flex items-center justify-between gap-2">
        <p className="tr-title flex items-center gap-1.5 text-[var(--tr-ink)]">
          <IconPickup size={16} className="text-[var(--tr-safe)]" aria-hidden />
          {copy.title}
        </p>
        {state.mode === 'live' && state.etaMinutes !== null && (
          <span
            className="tr-label shrink-0 rounded-full bg-[var(--tr-safe)] px-2.5 py-1 font-bold text-white"
            data-testid="pickup-eta"
          >
            ~{state.etaMinutes}′
          </span>
        )}
      </div>

      {state.rank !== null && (
        <p className="tr-card-text mt-1 text-[var(--tr-ink)]">{copy.stop(state.rank, state.totalStops)}</p>
      )}
      <p className="tr-label mt-0.5 text-[var(--tr-ink-2)]">
        {state.mode === 'live' && state.etaMinutes !== null ? copy.eta(state.etaMinutes) : `${copy.scheduled}${time ? ` · ${time}` : ''}`}
        {state.myStop.name ? ` · ${state.myStop.name}` : ''}
      </p>

      <div className="mt-2.5 flex gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => onSendPreset(preset)}
            className="tr-label min-h-[44px] flex-1 rounded-xl bg-[var(--tr-surface-2)] px-2 font-medium text-[var(--tr-ink)] transition-transform active:scale-[0.98]"
          >
            {preset.emoji} {preset.text[locale]}
          </button>
        ))}
        {onOnboardAck &&
          (onboardAcked ? (
            <span
              className="tr-label flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-[var(--tr-safe)] px-2 text-center font-semibold text-white"
              data-testid="onboard-done"
            >
              {ONBOARD_COPY[locale].done}
            </span>
          ) : (
            <button
              type="button"
              onClick={onOnboardAck}
              className="tr-label min-h-[44px] flex-1 rounded-xl bg-[var(--tr-safe-soft)] px-2 font-semibold text-[var(--tr-safe)] transition-transform active:scale-[0.98]"
              data-testid="onboard-ack"
            >
              {ONBOARD_COPY[locale].button}
            </button>
          ))}
      </div>
      {state.mode === 'live' && <p className="tr-meta mt-1.5 text-[var(--tr-ink-3)]">{copy.mapHint}</p>}
    </div>
  );
}
