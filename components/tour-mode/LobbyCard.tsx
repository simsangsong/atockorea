'use client';

/**
 * T1.11 / §O-1 ⑥ — lobby view: what a traveller sees when they open their
 * room link before the tour day. No error screen, no dead end — a warm
 * D-day countdown, the pickup plan, and a nudge that the chat below already
 * works (guide greetings land here as ordinary messages).
 *
 * Static 5-locale constants, zero LLM calls — same pattern as entryCopy /
 * emergency.ts, so the card renders offline from the join snapshot.
 */

import { kstDaysUntil } from '@/lib/tour-room/time';
import HeroMediaBand from '@/components/tour-mode/HeroMediaBand';
import { IconDate, IconPickup, TR_ICON } from '@/components/tour-mode/icons';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

export interface PickupPoint {
  name?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  pickup_time?: string | null;
}

const COPY: Record<
  RoomLocale,
  {
    dday: (n: number) => string;
    title: string;
    meetOn: string;
    pickupTitle: string;
    vehicleTitle: string;
    chatHint: string;
    /** E4 (D4) — cost is baked into the price; UNSEEN it is pure loss. */
    amenities: string;
  }
> = {
  en: {
    dday: (n) => (n === 0 ? 'Today' : `D-${n}`),
    title: 'Your tour room is ready',
    meetOn: 'We meet on',
    pickupTitle: 'Pickup',
    vehicleTitle: 'Your vehicle',
    chatHint: 'Messages from your guide will arrive here. Questions? Ask below anytime.',
    amenities: 'Charger, Wi-Fi, water and umbrellas are ready in the car.',
  },
  ko: {
    dday: (n) => (n === 0 ? '오늘' : `D-${n}`),
    title: '투어룸이 준비됐어요',
    meetOn: '만나는 날',
    pickupTitle: '픽업',
    vehicleTitle: '이용 차량',
    chatHint: '가이드의 안내 메시지가 여기에 도착해요. 궁금한 점은 지금 남겨도 좋아요.',
    amenities: '충전기 · 와이파이 · 생수 · 우산이 차에 준비되어 있어요.',
  },
  ja: {
    dday: (n) => (n === 0 ? '本日' : `あと${n}日`),
    title: 'ツアールームの準備ができました',
    meetOn: '集合日',
    pickupTitle: 'お迎え',
    vehicleTitle: 'ご利用の車両',
    chatHint: 'ガイドからのご案内はここに届きます。ご質問はいつでもどうぞ。',
    amenities: '充電器・Wi-Fi・お水・傘を車内にご用意しています。',
  },
  es: {
    dday: (n) => (n === 0 ? 'Hoy' : n === 1 ? 'Falta 1 día' : `Faltan ${n} días`),
    title: 'Tu sala de tour está lista',
    meetOn: 'Nos vemos el',
    pickupTitle: 'Recogida',
    vehicleTitle: 'Tu vehículo',
    chatHint: 'Los mensajes de tu guía llegarán aquí. ¿Preguntas? Escríbenos abajo.',
    amenities: 'Cargador, Wi-Fi, agua y paraguas listos en el vehículo.',
  },
  zh: {
    dday: (n) => (n === 0 ? '今天' : `还有${n}天`),
    title: '您的旅行房间已就绪',
    meetOn: '集合日期',
    pickupTitle: '接送',
    vehicleTitle: '乘坐车辆',
    chatHint: '导游的通知会显示在这里。有问题随时在下方留言。',
    amenities: '车内已备好充电器、Wi-Fi、饮用水和雨伞。',
  },
  'zh-TW': {
    dday: (n) => (n === 0 ? '今天' : `還有${n}天`),
    title: '您的旅遊房間已就緒',
    meetOn: '集合日期',
    pickupTitle: '接送',
    vehicleTitle: '乘坐車輛',
    chatHint: '導遊的通知會顯示在這裡。有問題隨時在下方留言。',
    amenities: '車內已備好充電器、Wi-Fi、飲用水和雨傘。',
  },
  fr: {
    dday: (n) => (n === 0 ? 'Aujourd’hui' : `J-${n}`),
    title: 'Votre espace tour est prêt',
    meetOn: 'Rendez-vous le',
    pickupTitle: 'Prise en charge',
    vehicleTitle: 'Votre véhicule',
    chatHint: 'Les messages de votre guide arriveront ici. Une question? Écrivez-nous quand vous voulez.',
    amenities: 'Chargeur, Wi-Fi, eau et parapluies sont prêts dans le véhicule.',
  },
  de: {
    dday: (n) => (n === 0 ? 'Heute' : n === 1 ? 'Noch 1 Tag' : `Noch ${n} Tage`),
    title: 'Ihr Tour-Raum ist bereit',
    meetOn: 'Wir treffen uns am',
    pickupTitle: 'Abholung',
    vehicleTitle: 'Ihr Fahrzeug',
    chatHint: 'Nachrichten Ihres Guides kommen hier an. Fragen? Schreiben Sie uns jederzeit.',
    amenities: 'Ladegerät, WLAN, Wasser und Schirme liegen im Fahrzeug bereit.',
  },
  ru: {
    dday: (n) => (n === 0 ? 'Сегодня' : `Осталось ${n} дн.`),
    title: 'Ваша комната тура готова',
    meetOn: 'Встречаемся',
    pickupTitle: 'Трансфер',
    vehicleTitle: 'Ваш транспорт',
    chatHint: 'Сообщения гида будут приходить сюда. Есть вопросы? Пишите в любое время.',
    amenities: 'Зарядка, Wi-Fi, вода и зонты уже в машине.',
  },
  it: {
    dday: (n) => (n === 0 ? 'Oggi' : n === 1 ? 'Manca 1 giorno' : `Mancano ${n} giorni`),
    title: 'La tua stanza del tour è pronta',
    meetOn: 'Ci vediamo il',
    pickupTitle: 'Pick-up',
    vehicleTitle: 'Il tuo veicolo',
    chatHint: 'I messaggi della guida arriveranno qui. Domande? Scrivici quando vuoi.',
    amenities: 'Caricatore, Wi-Fi, acqua e ombrelli sono pronti in auto.',
  },
};

/**
 * W4.3/B1 — a display line from the loosely-shaped tour_bus_details payload
 * (ops have used several key spellings over time; show what exists).
 */
export function vehicleLineFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const pick = (keys: string[]) => {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return null;
  };
  const parts = [
    pick(['vehicle_model', 'model', 'bus_model', 'car_model']),
    pick(['color', 'vehicle_color']),
    pick(['vehicle', 'vehicle_number', 'vehicleNumber', 'plate', 'plate_number', 'bus_number']),
    pick(['driver_name', 'driver']),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** E3 — the driver's display name alone, for the arrived-state credit. */
export function driverNameFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  for (const key of ['driver_name', 'driver']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/** Booking→pickup joins come back as an object or a 1-element array. */
export function firstPickup(pickupPoints: unknown): PickupPoint | null {
  if (!pickupPoints) return null;
  const point = Array.isArray(pickupPoints) ? pickupPoints[0] : pickupPoints;
  if (!point || typeof point !== 'object') return null;
  return point as PickupPoint;
}

export default function LobbyCard({
  locale,
  tourDate,
  tourTime,
  pickupPoints,
  busPayload,
  viewerRole,
  showHeroNumeral = false,
  heroPhotoUrl = null,
}: {
  locale: RoomLocale;
  tourDate: string | null;
  tourTime?: string | null;
  pickupPoints?: unknown;
  /** W4.3/B1 — tour_bus_details payload for the vehicle line. */
  busPayload?: unknown;
  /** P1-4 — the chat hint is written to a guest; operators must not see it. */
  viewerRole?: string | null;
  /**
   * SG-1d — the D-day numeral, HOME MOUNT ONLY. This card also mounts in
   * the pickup sheet and the chat tab's lobby slot; a numeral there would
   * either double the screen's one big number (SG-D1) or leak the redesign
   * into the chat surface (owner invariant ①). The compact `D-3` form only —
   * the localized D-day SENTENCES are 13–16 chars and cannot hold one line
   * at 45.9px on a 320px viewport (measured, v1.2 2차 감사 #13).
   */
  showHeroNumeral?: boolean;
  /** SG-4b — the tour's own hero (tours.image_url); home mount only. */
  heroPhotoUrl?: string | null;
}) {
  const copy = COPY[locale];
  const pickup = firstPickup(pickupPoints);
  const vehicleLine = vehicleLineFromPayload(busPayload);
  const days = tourDate ? kstDaysUntil(tourDate) : null;
  const time = tourTime ? String(tourTime).slice(0, 5) : null;

  const heroNumeral = showHeroNumeral && days !== null && days >= 0;

  return (
    <div data-testid="lobby-card" className="tr-card mb-2 px-4 py-4">
      {showHeroNumeral && <HeroMediaBand photoUrl={heroPhotoUrl} seed="tour-hero" />}
      {heroNumeral && (
        <p
          data-testid="lobby-dday-numeral"
          aria-hidden="true"
          className="tr-numeral tr-num text-[var(--tr-ink)]"
        >
          {`D-${days}`}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="tr-title text-[var(--tr-ink)]">{copy.title}</p>
        {days !== null && !heroNumeral && (
          <span className="tr-label shrink-0 rounded-full bg-[var(--tr-accent)] px-3 py-1 font-bold text-[var(--tr-bubble-me-ink)]">
            {copy.dday(days)}
          </span>
        )}
        {heroNumeral && (
          <span className="sr-only text-cjk-body" role="status">
            {copy.dday(days as number)}
          </span>
        )}
      </div>

      {tourDate && (
        <p className="tr-card-text mt-2 flex items-center gap-1.5 text-[var(--tr-ink-2)]">
          <IconDate size={TR_ICON.meta} className="shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
          {copy.meetOn} <span className="font-semibold text-[var(--tr-ink)]">{tourDate}</span>
          {time && <span className="font-semibold text-[var(--tr-ink)]">· {time}</span>}
        </p>
      )}

      {pickup && (pickup.name || pickup.address) && (
        <div className="mt-2.5 rounded-xl bg-[var(--tr-surface-2)] px-3 py-2.5">
          <p className="tr-meta flex items-center gap-1 font-semibold uppercase tracking-wide text-[var(--tr-ink-3)]">
            <IconPickup size={TR_ICON.meta} aria-hidden />
            {copy.pickupTitle}
          </p>
          {pickup.name && (
            <p className="tr-card-text mt-0.5 font-medium text-[var(--tr-ink)]">
              {pickup.name}
              {pickup.pickup_time && (
                <span className="font-semibold text-[var(--tr-accent-deep)]">
                  {' '}
                  · {String(pickup.pickup_time).slice(0, 5)}
                </span>
              )}
            </p>
          )}
          {pickup.address && <p className="tr-label mt-0.5 text-[var(--tr-ink-2)]">{pickup.address}</p>}
        </div>
      )}

      {vehicleLine && (
        <div className="mt-2.5 rounded-xl bg-[var(--tr-surface-2)] px-3 py-2.5" data-testid="vehicle-line">
          <p className="tr-meta font-semibold uppercase tracking-wide text-[var(--tr-ink-3)]">🚐 {copy.vehicleTitle}</p>
          <p className="tr-card-text mt-0.5 font-medium text-[var(--tr-ink)]">{vehicleLine}</p>
        </div>
      )}

      {/* E4 (사장님 D4) — the cost is baked into the price; the line is the
          only place the guest ever finds out. 자랑해야 손실이 아니다. */}
      <p data-testid="lobby-amenities" className="tr-label text-cjk-body mt-2.5 text-[var(--tr-ink-2)]">
        {copy.amenities}
      </p>

      {/* P1-4 — "가이드의 안내 메시지가 여기에 도착해요" addresses a guest;
          a guide/driver reading their own lobby is not waiting on themselves. */}
      {viewerRole !== 'guide' && viewerRole !== 'driver' && viewerRole !== 'admin' && (
        <p className="tr-label mt-2.5 leading-relaxed text-[var(--tr-ink-2)]">{copy.chatHint}</p>
      )}
    </div>
  );
}
