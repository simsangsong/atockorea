'use client';

/**
 * T3.4 — location-sharing opt-in card: one honest consent line, a switch,
 * and a graceful permission-denied state that points at browser settings
 * instead of re-requesting in a loop. T3.6 pairs the active state with a
 * screen wake lock ("keep your screen on" hint where the API is missing).
 */

import type { GeoWatcherStatus } from '@/hooks/useGeoWatcher';
import { isWakeLockSupported } from '@/lib/tour-room/wakeLock';
import { IconMyLocation } from '@/components/tour-mode/icons';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const COPY: Record<
  RoomLocale,
  { title: string; consent: string; sharing: string; denied: string; keepOn: string; unsupported: string }
> = {
  en: {
    title: 'Share my location',
    consent: 'Only while this screen is open, only with your guide and group. Turns off anytime.',
    sharing: 'Sharing live — visible on the group map',
    denied: 'Location is blocked. Allow it for this site in your browser settings, then reopen.',
    keepOn: 'Keep your screen on so sharing stays live.',
    unsupported: 'This browser cannot share location — the map still shows everyone else.',
  },
  ko: {
    title: '내 위치 공유',
    consent: '이 화면이 켜져 있는 동안만, 가이드와 우리 그룹에게만 공유돼요. 언제든 끌 수 있어요.',
    sharing: '실시간 공유 중 — 그룹 지도에 표시돼요',
    denied: '위치가 차단되어 있어요. 브라우저 설정에서 이 사이트의 위치를 허용한 뒤 다시 열어주세요.',
    keepOn: '화면을 켜두면 공유가 계속 유지돼요.',
    unsupported: '이 브라우저는 위치 공유를 지원하지 않아요 — 지도는 계속 볼 수 있어요.',
  },
  ja: {
    title: '位置情報を共有',
    consent: 'この画面を開いている間だけ、ガイドとグループにのみ共有されます。いつでもオフにできます。',
    sharing: 'ライブ共有中 — グループ地図に表示されます',
    denied: '位置情報がブロックされています。ブラウザ設定でこのサイトを許可して開き直してください。',
    keepOn: '画面をつけたままにすると共有が続きます。',
    unsupported: 'このブラウザは位置共有に対応していません — 地図の閲覧はできます。',
  },
  es: {
    title: 'Compartir mi ubicación',
    consent: 'Solo mientras esta pantalla esté abierta y solo con tu guía y grupo. Se apaga cuando quieras.',
    sharing: 'Compartiendo en vivo — visible en el mapa del grupo',
    denied: 'La ubicación está bloqueada. Permítela para este sitio en los ajustes del navegador y vuelve a abrir.',
    keepOn: 'Mantén la pantalla encendida para que siga en vivo.',
    unsupported: 'Este navegador no puede compartir ubicación — el mapa sigue mostrando al resto.',
  },
  zh: {
    title: '共享我的位置',
    consent: '仅在此页面打开时，仅与导游和同团成员共享。随时可以关闭。',
    sharing: '实时共享中 — 显示在团队地图上',
    denied: '位置已被禁用。请在浏览器设置中允许本网站的位置权限后重新打开。',
    keepOn: '请保持屏幕常亮以持续共享。',
    unsupported: '此浏览器不支持位置共享 — 仍可查看地图。',
  },
};

export default function LocationShareCard({
  locale,
  enabled,
  status,
  onToggle,
}: {
  locale: RoomLocale;
  enabled: boolean;
  status: GeoWatcherStatus;
  onToggle: (next: boolean) => void;
}) {
  const copy = COPY[locale];
  const denied = status === 'denied';
  const unsupported = status === 'unsupported';
  const live = enabled && status === 'watching';

  return (
    <div className="tr-card px-4 py-3" data-testid="location-share-card">
      <div className="flex items-center justify-between gap-3">
        <p className="tr-title flex items-center gap-1.5 text-[var(--tr-ink)]">
          <IconMyLocation size={16} className="text-[var(--tr-safe)]" aria-hidden />
          {copy.title}
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={denied || unsupported}
          onClick={() => onToggle(!enabled)}
          className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors disabled:opacity-40 ${
            enabled ? 'bg-[var(--tr-safe)]' : 'bg-[var(--tr-bubble-system)]'
          }`}
          data-testid="location-toggle"
        >
          <span
            className={`tr-knob absolute top-1 h-6 w-6 rounded-full bg-white shadow ${
              enabled ? 'left-[24px]' : 'left-1'
            }`}
          />
        </button>
      </div>
      {denied ? (
        <p className="tr-label mt-1.5 leading-relaxed text-[var(--tr-danger)]">{copy.denied}</p>
      ) : unsupported ? (
        <p className="tr-label mt-1.5 leading-relaxed text-[var(--tr-ink-2)]">{copy.unsupported}</p>
      ) : live ? (
        <p className="tr-label mt-1.5 leading-relaxed text-[var(--tr-safe)]">
          <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--tr-safe)] align-middle" />
          {copy.sharing}
          {!isWakeLockSupported() && <span className="block text-[var(--tr-ink-2)]">{copy.keepOn}</span>}
        </p>
      ) : (
        <p className="tr-label mt-1.5 leading-relaxed text-[var(--tr-ink-2)]">{copy.consent}</p>
      )}
    </div>
  );
}
