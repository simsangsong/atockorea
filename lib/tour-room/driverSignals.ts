/**
 * W3 — driver one-tap signals (smart-guide private-mode plan SIGNAL/P-D15).
 *
 * Fixed, pre-translated 5-locale bundles (§M-2 / P-D10): the driver taps a
 * button, the server owns the copy, ZERO LLM calls are made. {minutes}
 * interpolates verbatim; the parking/vehicle pins append one shared Google
 * Maps link line (same URL in every locale).
 */

import { ROOM_LOCALES, type RoomLocale } from '@/lib/tour-room/snapshot';

export type DriverSignalType =
  | 'delay'
  | 'parking_pin'
  | 'vehicle_arrived'
  | 'vehicle_issue'
  | 'eta_reply'
  | 'departing';

export const DRIVER_DELAY_MINUTES = [5, 10, 15, 20, 30] as const;
/** A3 — one-tap numeric reply to a guest pickup/drop-off request. */
export const ETA_REPLY_MINUTES = [3, 5, 10, 15, 20] as const;

const TEMPLATES: Record<DriverSignalType, Record<RoomLocale, string>> = {
  delay: {
    en: 'The driver is running about {minutes} minutes late. Please wait at the pickup point.',
    ko: '기사님이 약 {minutes}분 늦어지고 있어요. 픽업 장소에서 기다려 주세요.',
    ja: 'ドライバーの到着が約{minutes}分遅れています。ピックアップ場所でお待ちください。',
    es: 'El conductor llegará con unos {minutes} minutos de retraso. Espera en el punto de recogida.',
    zh: '司机将晚到约{minutes}分钟，请在接送地点稍候。',
    fr: 'Le chauffeur a environ {minutes} minutes de retard. Merci de patienter au point de prise en charge.',
    de: 'Der Fahrer verspätet sich um etwa {minutes} Minuten. Bitte warten Sie am Abholpunkt.',
    ru: 'Водитель задерживается примерно на {minutes} минут. Пожалуйста, подождите на месте посадки.',
    it: 'L’autista è in ritardo di circa {minutes} minuti. Aspetta al punto di pick-up, per favore.',
  },
  parking_pin: {
    en: 'The vehicle is parked here — use this pin to find your way back.',
    ko: '차량이 여기에 주차되어 있어요 — 돌아올 때 이 위치를 참고하세요.',
    ja: '車両はこちらに駐車しています。戻る際はこのピンを参考にしてください。',
    es: 'El vehículo está aparcado aquí: usa este pin para volver.',
    zh: '车辆停在这里——返回时请参考此位置。',
    fr: 'Le véhicule est garé ici — utilisez ce repère pour retrouver votre chemin.',
    de: 'Das Fahrzeug parkt hier — nutzen Sie diesen Pin für den Rückweg.',
    ru: 'Машина припаркована здесь — вернуться поможет эта метка.',
    it: 'Il veicolo è parcheggiato qui — usa questo pin per ritrovare la strada.',
  },
  vehicle_arrived: {
    en: 'Your vehicle has arrived at the pickup point.',
    ko: '차량이 픽업 장소에 도착했어요.',
    ja: '車両がピックアップ場所に到着しました。',
    es: 'Tu vehículo ha llegado al punto de recogida.',
    zh: '车辆已抵达接送地点。',
    fr: 'Votre véhicule est arrivé au point de prise en charge.',
    de: 'Ihr Fahrzeug ist am Abholpunkt angekommen.',
    ru: 'Машина прибыла на место посадки.',
    it: 'Il tuo veicolo è arrivato al punto di pick-up.',
  },
  eta_reply: {
    en: '🚗 Got it — the driver is about {minutes} minutes away. Please wait where you are.',
    ko: '🚗 확인했어요 — 기사님이 약 {minutes}분 후 도착합니다. 그 자리에서 기다려 주세요.',
    ja: '🚗 承知しました — ドライバーは約{minutes}分で到着します。その場でお待ちください。',
    es: '🚗 Recibido: el conductor llegará en unos {minutes} minutos. Espera donde estás.',
    zh: '🚗 收到——司机约{minutes}分钟后到达，请在原地等候。',
    fr: '🚗 C’est noté — le chauffeur arrive dans environ {minutes} minutes. Merci d’attendre sur place.',
    de: '🚗 Verstanden — der Fahrer ist in etwa {minutes} Minuten da. Bitte warten Sie, wo Sie sind.',
    ru: '🚗 Принято — водитель будет примерно через {minutes} мин. Пожалуйста, оставайтесь на месте.',
    it: '🚗 Ricevuto — l’autista arriva tra circa {minutes} minuti. Aspetta dove sei.',
  },
  departing: {
    en: '✅ Headcount confirmed — we are departing now. Please take your seat.',
    ko: '✅ 인원 확인 완료 — 지금 출발합니다. 자리에 앉아 주세요.',
    ja: '✅ 人数確認完了 — ただいま出発します。お席にお座りください。',
    es: '✅ Recuento confirmado: salimos ahora. Tomen asiento, por favor.',
    zh: '✅ 人数确认完毕 — 现在出发。请就座。',
    fr: '✅ Comptage terminé — nous partons maintenant. Veuillez vous asseoir.',
    de: '✅ Alle an Bord — wir fahren jetzt los. Bitte nehmen Sie Platz.',
    ru: '✅ Все на месте — отправляемся. Пожалуйста, займите свои места.',
    it: '✅ Conteggio fatto — si parte. Prendete posto, per favore.',
  },
  vehicle_issue: {
    en: 'We are having a vehicle issue. The team is on it — updates will follow here shortly.',
    ko: '차량에 문제가 생겼어요. 팀이 조치 중이며 곧 안내드릴게요.',
    ja: '車両にトラブルが発生しました。対応中です。追ってこちらでご案内します。',
    es: 'Tenemos un problema con el vehículo. El equipo lo está resolviendo; pronto informaremos aquí.',
    zh: '车辆出现了问题。团队正在处理，稍后会在此更新说明。',
    fr: 'Nous avons un souci avec le véhicule. L’équipe s’en occupe — plus d’infos ici très vite.',
    de: 'Wir haben ein Problem mit dem Fahrzeug. Das Team kümmert sich darum — Updates folgen hier in Kürze.',
    ru: 'У нас проблема с машиной. Команда уже занимается — скоро напишем сюда новости.',
    it: 'Abbiamo un problema con il veicolo. Il team se ne sta occupando — presto aggiornamenti qui.',
  },
};

export interface DriverSignalBundle {
  source_locale: string;
  source_text: string;
  translations: Record<string, string>;
}

function interpolate(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => params[key] ?? `{${key}}`);
}

export function googleMapsPinUrl(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/**
 * Render the 5-locale bundle for a driver signal. `mapsUrl`, when given,
 * is appended as its own line to every locale (URLs are locale-neutral).
 */
export function renderDriverSignal(
  type: DriverSignalType,
  params: { minutes?: number; mapsUrl?: string } = {},
): DriverSignalBundle {
  const interpolationParams: Record<string, string> = {
    minutes: String(params.minutes ?? ''),
  };
  const translations: Record<string, string> = {};
  for (const locale of ROOM_LOCALES) {
    const base = interpolate(TEMPLATES[type][locale], interpolationParams);
    translations[locale] = params.mapsUrl ? `${base}\n${params.mapsUrl}` : base;
  }
  return { source_locale: 'en', source_text: translations.en, translations };
}
