'use client';

/**
 * "Turn on arrival commentary" — the missing door to the one promise the app
 * makes loudest and delivered least.
 *
 * The manual says each stop explains itself, and it does: arrival cards and the
 * 1 km approach preview fire off the geofence. But the geofence only runs while
 * the guest is sharing location, that switch defaults OFF (K-4), and NOTHING in
 * the app pointed at it — not the home tab, not the manual. A guest who never
 * opened the map tab and found a toggle got none of it, all day, silently.
 *
 * So this card exists only while the promise is unkept: on the tour day, when
 * the tour actually has geofenced stops, and sharing is off. One tap arms it.
 * The consent line is the same one the map toggle carries — turning it on from
 * here must not tell the guest less than turning it on there.
 *
 * It hides itself the moment sharing is on, and never appears when the browser
 * has denied or cannot do location: the map tab owns that guidance, and a card
 * nagging about something the guest cannot fix from here is just noise.
 */

import { IconMyLocation, TR_ICON } from '@/components/tour-mode/icons';
import type { GeoWatcherStatus } from '@/hooks/useGeoWatcher';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

export const ARRIVAL_UNLOCK_COPY: Record<
  RoomLocale,
  { title: string; body: string; consent: string; cta: string }
> = {
  en: {
    title: 'Turn on arrival commentary',
    body: 'Share your location and every stop introduces itself the moment you get there — what to see, how long you have, where the restrooms and photo spots are.',
    consent: 'Only while the app is open, only with your guide and group. Off anytime.',
    cta: 'Turn on',
  },
  ko: {
    title: '도착 해설 켜기',
    body: '위치 공유를 켜두면 관광지에 도착하는 순간 안내가 저절로 떠요 — 볼거리, 머무는 시간, 화장실과 포토스팟까지.',
    consent: '앱이 켜져 있는 동안만, 가이드와 우리 그룹에게만 공유돼요. 언제든 끌 수 있어요.',
    cta: '켜기',
  },
  ja: {
    title: '到着案内をオンにする',
    body: '位置情報を共有すると、到着した瞬間に案内が自動で届きます — 見どころ、滞在時間、トイレや写真スポットまで。',
    consent: 'アプリを開いている間だけ、ガイドとグループにのみ共有されます。いつでもオフにできます。',
    cta: 'オンにする',
  },
  es: {
    title: 'Activa el comentario de llegada',
    body: 'Comparte tu ubicación y cada parada se presentará sola al llegar: qué ver, cuánto tiempo tienes, dónde están los baños y los puntos de foto.',
    consent: 'Solo mientras la app esté abierta y solo con tu guía y grupo. Se apaga cuando quieras.',
    cta: 'Activar',
  },
  zh: {
    title: '开启到站讲解',
    body: '开启位置共享后，每到一站就会自动出现讲解——看点、停留时间、洗手间和拍照点。',
    consent: '仅在应用打开时，仅与导游和同团成员共享。随时可以关闭。',
    cta: '开启',
  },
  'zh-TW': {
    title: '開啟到站解說',
    body: '開啟位置分享後，每到一站就會自動出現解說——看點、停留時間、洗手間和拍照點。',
    consent: '僅在應用程式開啟時，僅與導遊和同團成員分享。隨時可以關閉。',
    cta: '開啟',
  },
  fr: {
    title: 'Activer les commentaires d’arrivée',
    body: 'Partagez votre position et chaque étape se présente dès votre arrivée : ce qu’il faut voir, le temps dont vous disposez, les toilettes et les spots photo.',
    consent: 'Seulement quand l’app est ouverte, et uniquement avec votre guide et votre groupe. Désactivable à tout moment.',
    cta: 'Activer',
  },
  de: {
    title: 'Ankunfts-Erklärungen einschalten',
    body: 'Teilen Sie Ihren Standort, und jeder Stopp stellt sich bei der Ankunft selbst vor — was sich lohnt, wie viel Zeit Sie haben, wo Toiletten und Fotopunkte sind.',
    consent: 'Nur solange die App geöffnet ist und nur mit Ihrem Guide und Ihrer Gruppe. Jederzeit abschaltbar.',
    cta: 'Einschalten',
  },
  ru: {
    title: 'Включить рассказ о месте',
    body: 'Поделитесь геопозицией — и каждая остановка расскажет о себе сразу по прибытии: что посмотреть, сколько есть времени, где туалеты и точки для фото.',
    consent: 'Только пока приложение открыто и только с гидом и вашей группой. Можно выключить в любой момент.',
    cta: 'Включить',
  },
  it: {
    title: 'Attiva il racconto all’arrivo',
    body: 'Condividi la posizione e ogni tappa si presenta appena arrivi: cosa vedere, quanto tempo hai, dove sono bagni e punti foto.',
    consent: 'Solo mentre l’app è aperta, solo con la tua guida e il tuo gruppo. Puoi disattivarla quando vuoi.',
    cta: 'Attiva',
  },
};

export default function ArrivalUnlockCard({
  locale,
  sharing,
  status,
  hasGeofencedStops,
  onEnable,
}: {
  locale: RoomLocale;
  sharing: boolean;
  status: GeoWatcherStatus;
  /** No geofenced stops → nothing to unlock, so nothing to ask for. */
  hasGeofencedStops: boolean;
  onEnable: () => void;
}) {
  if (sharing || !hasGeofencedStops) return null;
  if (status === 'denied' || status === 'unsupported') return null;

  const copy = ARRIVAL_UNLOCK_COPY[locale];

  return (
    <div className="tr-home-card mb-2 px-4 py-3.5" data-testid="arrival-unlock-card">
      <div className="flex items-start gap-3">
        <span className="tr-chip tr-chip--accent flex h-9 w-9 shrink-0 items-center justify-center !rounded-[13px]">
          <IconMyLocation size={TR_ICON.chip} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="tr-label font-semibold text-[var(--tr-ink)]">{copy.title}</p>
          <p className="tr-card-text mt-1 leading-relaxed text-[var(--tr-ink-2)]">{copy.body}</p>
        </div>
      </div>
      {/* Soft, not solid. The hero card above owns the one filled slab on this
          screen (U-D23 — two protagonists is none); a second identical black
          button would fight it. This still reads as the card's action. */}
      <button
        type="button"
        onClick={onEnable}
        data-testid="arrival-unlock-enable"
        className="tr-btn-physical tr-label text-cjk-safe mt-3 flex min-h-[44px] w-full items-center justify-center rounded-full bg-[var(--tr-accent-soft)] px-4 font-bold text-[var(--tr-accent-deep)]"
      >
        {copy.cta}
      </button>
      <p className="tr-meta mt-2 leading-relaxed text-[var(--tr-ink-3)]">{copy.consent}</p>
    </div>
  );
}
