'use client';

/**
 * T3.4 — location-sharing opt-in card: one honest consent line, a switch,
 * and a graceful permission-denied state that points at browser settings
 * instead of re-requesting in a loop. T3.6 pairs the active state with a
 * screen wake lock ("keep your screen on" hint where the API is missing).
 */

import type { GeoWatcherStatus } from '@/hooks/useGeoWatcher';
import { isWakeLockSupported } from '@/lib/tour-room/wakeLock';
import { IconMyLocation, TR_ICON } from '@/components/tour-mode/icons';
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
  fr: {
    title: 'Partager ma position',
    consent: 'Seulement tant que cet écran est ouvert, et uniquement avec votre guide et votre groupe. Désactivable à tout moment.',
    sharing: 'Partage en direct — visible sur la carte du groupe',
    denied: 'La localisation est bloquée. Autorisez-la pour ce site dans les réglages du navigateur, puis rouvrez.',
    keepOn: 'Gardez l’écran allumé pour que le partage reste actif.',
    unsupported: 'Ce navigateur ne peut pas partager la position — la carte montre quand même les autres.',
  },
  de: {
    title: 'Meinen Standort teilen',
    consent: 'Nur solange dieser Bildschirm geöffnet ist und nur mit Ihrem Guide und Ihrer Gruppe. Jederzeit abschaltbar.',
    sharing: 'Live geteilt — auf der Gruppenkarte sichtbar',
    denied: 'Standort ist blockiert. Erlauben Sie ihn für diese Seite in den Browser-Einstellungen und öffnen Sie neu.',
    keepOn: 'Lassen Sie den Bildschirm an, damit das Teilen aktiv bleibt.',
    unsupported: 'Dieser Browser kann den Standort nicht teilen — die Karte zeigt weiterhin alle anderen.',
  },
  ru: {
    title: 'Делиться геопозицией',
    consent: 'Только пока открыт этот экран и только с гидом и вашей группой. Можно выключить в любой момент.',
    sharing: 'Геопозиция транслируется — видно на карте группы',
    denied: 'Геолокация заблокирована. Разрешите ее для этого сайта в настройках браузера и откройте заново.',
    keepOn: 'Не гасите экран, чтобы трансляция продолжалась.',
    unsupported: 'Этот браузер не может делиться геопозицией — карта по-прежнему показывает остальных.',
  },
  it: {
    title: 'Condividi la mia posizione',
    consent: 'Solo finché questa schermata è aperta, solo con la tua guida e il tuo gruppo. Puoi disattivarla quando vuoi.',
    sharing: 'Condivisione in diretta — visibile sulla mappa del gruppo',
    denied: 'La posizione è bloccata. Consentila per questo sito nelle impostazioni del browser e riapri.',
    keepOn: 'Tieni lo schermo acceso perché la condivisione resti attiva.',
    unsupported: 'Questo browser non può condividere la posizione — la mappa mostra comunque gli altri.',
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
          <IconMyLocation size={TR_ICON.chip} className="text-[var(--tr-safe)]" aria-hidden />
          {copy.title}
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={denied || unsupported}
          onClick={() => onToggle(!enabled)}
          /* 컴팩트 스위치 — SettingsTab.Toggle과 동일 지오메트리(트랙 26px가
             노브 22px를 2px 패딩으로 감싼다), 히트영역은 after로 44px 유지. */
          className={`relative h-[26px] min-h-0 w-11 min-w-0 shrink-0 rounded-full transition-colors disabled:opacity-40 after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-[''] ${
            enabled ? 'bg-[var(--tr-safe)]' : 'bg-[var(--tr-bubble-system)]'
          }`}
          data-testid="location-toggle"
        >
          <span
            /* T-D6와 같은 상태분리 색 — 고대비 다크에선 safe가 흰색이라
               흰 노브가 트랙에 파묻힌다; bubble-me-ink는 전 스킨에서
               액센트/세이프 계열 위에 보이는 페어링 불변식의 색이다. */
            className={`tr-knob absolute top-[2px] h-[22px] w-[22px] rounded-full shadow ${
              enabled
                ? 'left-5 bg-[var(--tr-bubble-me-ink)]'
                : 'left-[2px] border border-[var(--tr-hairline)] bg-[var(--tr-surface)]'
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
