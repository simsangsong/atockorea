'use client';

/**
 * SG-2b-γ — the rejoin capsule (낙오 캡슐), rendered from wait_ended message
 * metadata. Zero-based §G-2's grammar, kept literally: the FIRST line is a
 * fact, not an apology; the BIGGEST text is the Korean destination card a
 * guest shows to any taxi driver; and the coordinator is one tap away. The
 * destination was resolved by the SERVER (a client-supplied one would be a
 * spoofing surface); when the day had no later stop the card degrades to
 * the coordinator-only variant. Guests already aboard get one quiet hedge
 * line — the server cannot know who is missing without bus hardware.
 */
import { OPS_PHONE } from '@/lib/tour-room/emergency';
import { formatTargetTime } from '@/lib/tour-room/notices';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

export interface WaitEndedMeta {
  kind: 'wait_ended';
  notice_id?: string;
  departed_at_ms?: number;
  meeting_point?: string | null;
  next_stop_name?: string | null;
  next_stop_time?: string | null;
  next_poi_key?: string | null;
  manual?: boolean;
}

const COPY: Record<
  RoomLocale,
  {
    departedAt: (t: string) => string;
    rejoinAt: string;
    showTaxi: string;
    openMap: string;
    callCoordinator: string;
    noNextStop: string;
    groupTold: string;
    aboardHint: string;
  }
> = {
  en: {
    departedAt: (t) => `The vehicle departed at ${t}`,
    rejoinAt: 'Rejoin the group at',
    showTaxi: 'Show this to any taxi driver',
    openMap: 'Open in map',
    callCoordinator: 'Call the coordinator',
    noNextStop: 'The coordinator will arrange your rejoin — call now.',
    groupTold: 'Your group has been told.',
    aboardHint: 'Already aboard? Please ignore this card.',
  },
  ko: {
    departedAt: (t) => `차량이 ${t}에 출발했습니다`,
    rejoinAt: '재합류 장소',
    showTaxi: '택시 기사님께 이 카드를 보여주세요',
    openMap: '지도에서 보기',
    callCoordinator: '코디네이터 통화',
    noNextStop: '코디네이터가 재합류를 도와드립니다 — 지금 연락하세요.',
    groupTold: '일행에게도 안내되었습니다.',
    aboardHint: '이미 탑승하셨다면 이 카드는 무시하세요.',
  },
  ja: {
    departedAt: (t) => `車両は${t}に出発しました`,
    rejoinAt: '合流場所',
    showTaxi: 'タクシー運転手にこのカードを見せてください',
    openMap: '地図で見る',
    callCoordinator: 'コーディネーターに電話',
    noNextStop: 'コーディネーターが合流をご案内します。今すぐお電話ください。',
    groupTold: 'ご一行にも案内済みです。',
    aboardHint: 'すでに乗車済みの方はこのカードを無視してください。',
  },
  zh: {
    departedAt: (t) => `车辆已于 ${t} 出发`,
    rejoinAt: '会合地点',
    showTaxi: '请向出租车司机出示此卡片',
    openMap: '在地图中查看',
    callCoordinator: '致电协调员',
    noNextStop: '协调员将协助您会合——请立即致电。',
    groupTold: '已通知您的同行伙伴。',
    aboardHint: '如果您已在车上，请忽略此卡片。',
  },
  'zh-TW': {
    departedAt: (t) => `車輛已於 ${t} 出發`,
    rejoinAt: '會合地點',
    showTaxi: '請向計程車司機出示此卡片',
    openMap: '在地圖中查看',
    callCoordinator: '致電協調員',
    noNextStop: '協調員將協助您會合——請立即致電。',
    groupTold: '已通知您的同行夥伴。',
    aboardHint: '如果您已在車上，請忽略此卡片。',
  },
  es: {
    departedAt: (t) => `El vehículo salió a las ${t}`,
    rejoinAt: 'Reúnase con el grupo en',
    showTaxi: 'Muestre esta tarjeta a cualquier taxista',
    openMap: 'Abrir en el mapa',
    callCoordinator: 'Llamar al coordinador',
    noNextStop: 'El coordinador organizará su reencuentro — llame ahora.',
    groupTold: 'Su grupo ya fue avisado.',
    aboardHint: '¿Ya está a bordo? Ignore esta tarjeta.',
  },
  fr: {
    departedAt: (t) => `Le véhicule est parti à ${t}`,
    rejoinAt: 'Rejoignez le groupe à',
    showTaxi: 'Montrez cette carte à nʼimporte quel taxi',
    openMap: 'Ouvrir la carte',
    callCoordinator: 'Appeler le coordinateur',
    noNextStop: 'Le coordinateur organisera votre retour — appelez maintenant.',
    groupTold: 'Votre groupe a été prévenu.',
    aboardHint: 'Déjà à bord ? Ignorez cette carte.',
  },
  de: {
    departedAt: (t) => `Das Fahrzeug ist um ${t} abgefahren`,
    rejoinAt: 'Treffen Sie die Gruppe bei',
    showTaxi: 'Zeigen Sie diese Karte jedem Taxifahrer',
    openMap: 'In Karte öffnen',
    callCoordinator: 'Koordinator anrufen',
    noNextStop: 'Der Koordinator organisiert Ihren Anschluss — rufen Sie jetzt an.',
    groupTold: 'Ihre Gruppe wurde informiert.',
    aboardHint: 'Schon an Bord? Bitte ignorieren Sie diese Karte.',
  },
  ru: {
    departedAt: (t) => `Транспорт отправился в ${t}`,
    rejoinAt: 'Место воссоединения',
    showTaxi: 'Покажите эту карточку любому таксисту',
    openMap: 'Открыть на карте',
    callCoordinator: 'Позвонить координатору',
    noNextStop: 'Координатор поможет вам присоединиться — позвоните сейчас.',
    groupTold: 'Ваша группа предупреждена.',
    aboardHint: 'Уже в машине? Игнорируйте эту карточку.',
  },
  it: {
    departedAt: (t) => `Il veicolo è partito alle ${t}`,
    rejoinAt: 'Raggiunga il gruppo a',
    showTaxi: 'Mostri questa scheda a qualsiasi tassista',
    openMap: 'Apri nella mappa',
    callCoordinator: 'Chiama il coordinatore',
    noNextStop: 'Il coordinatore organizzerà il ricongiungimento — chiami ora.',
    groupTold: 'Il suo gruppo è stato avvisato.',
    aboardHint: 'Già a bordo? Ignori questa scheda.',
  },
};

export default function WaitEndedCard({ meta, locale }: { meta: WaitEndedMeta; locale: RoomLocale }) {
  const copy = COPY[locale];
  const departedAt =
    typeof meta.departed_at_ms === 'number' ? formatTargetTime(meta.departed_at_ms, locale) : null;
  const next = meta.next_stop_name?.trim() || null;
  const mapHref = next ? `https://map.kakao.com/?q=${encodeURIComponent(next)}` : null;

  return (
    <div
      data-testid="wait-ended-card"
      className="tr-card mx-auto w-full max-w-[340px] overflow-hidden border border-[var(--tr-danger)] bg-[var(--tr-danger-soft)] px-4 py-4"
    >
      {/* Fact first — never an apology. */}
      <p className="tr-title text-cjk-body font-semibold text-[var(--tr-ink)]">
        {departedAt ? copy.departedAt(departedAt) : copy.noNextStop}
      </p>

      {next ? (
        <div className="mt-3 rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-4 py-3 text-center">
          <p className="tr-meta text-cjk-safe font-semibold uppercase tracking-[0.08em] text-[var(--tr-ink-3)]">
            {copy.rejoinAt}
          </p>
          {/* The taxi card — the biggest text on it is the KOREAN name. */}
          <p className="text-cjk-safe tr-body-lg mt-1 font-bold leading-snug text-[var(--tr-ink)]">
            {next}
          </p>
          {meta.next_stop_time && (
            <p className="tr-card-text tr-num mt-0.5 text-[var(--tr-ink-2)]">{meta.next_stop_time}</p>
          )}
          <p className="tr-meta text-cjk-body mt-1.5 text-[var(--tr-ink-3)]">{copy.showTaxi}</p>
        </div>
      ) : (
        <p className="tr-card-text text-cjk-body mt-2 text-[var(--tr-ink-2)]">{copy.noNextStop}</p>
      )}

      <div className="mt-3 flex gap-2">
        {mapHref && (
          <a
            href={mapHref}
            target="_blank"
            rel="noreferrer"
            data-testid="wait-ended-map"
            className="tr-btn-physical text-cjk-safe flex min-h-[44px] flex-1 items-center justify-center rounded-full bg-[var(--tr-surface)] px-3 tr-label font-semibold text-[var(--tr-ink)]"
          >
            {copy.openMap}
          </a>
        )}
        {OPS_PHONE && (
          <a
            href={`tel:${OPS_PHONE}`}
            data-testid="wait-ended-call"
            className="tr-btn-physical text-cjk-safe flex min-h-[44px] flex-1 items-center justify-center rounded-full bg-[var(--tr-accent)] px-3 tr-label font-bold text-[var(--tr-on-accent)]"
          >
            {copy.callCoordinator}
          </a>
        )}
      </div>

      <p className="tr-meta text-cjk-body mt-2.5 text-[var(--tr-ink-3)]">
        {copy.groupTold} {copy.aboardHint}
      </p>
    </div>
  );
}
