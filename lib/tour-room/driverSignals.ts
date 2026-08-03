/**
 * W3 — driver one-tap signals (smart-guide private-mode plan SIGNAL/P-D15).
 *
 * Fixed, pre-translated 5-locale bundles (§M-2 / P-D10): the driver taps a
 * button, the server owns the copy, ZERO LLM calls are made. {minutes}
 * interpolates verbatim; the parking/vehicle pins append one shared Google
 * Maps link line (same URL in every locale).
 */

import { ROOM_LOCALES, type RoomLocale } from '@/lib/tour-room/snapshot';

/**
 * The signal set, as a runtime list so nothing has to repeat it.
 *
 * 🔴 It used to be a bare type union, and three separate places kept their own
 * copy: the route's SIGNAL_TYPES, the cockpit tray, and the locale test — which
 * iterated a hard-coded four of the six that existed. A seventh type could be
 * added, wired, and shipped with two of its ten locales missing and every test
 * still green. Same shape as EXTRA_KINDS, which carries the same warning.
 *
 * `found_item` (feature audit F4/F1) is why this mattered. The guest already
 * had `lost_item` — "I lost something". The driver, the person actually holding
 * the bag while cleaning the van, had nothing: the guest signals route answers a
 * driver 403 "Drivers use driver-signal", and driver-signal had no such type.
 * The only person who KNEW an item existed could not say so, and the only people
 * who could say so did not know.
 */
export const DRIVER_SIGNAL_TYPES = [
  'delay',
  'parking_pin',
  'vehicle_arrived',
  'vehicle_issue',
  'eta_reply',
  'departing',
  'found_item',
] as const;

export type DriverSignalType = (typeof DRIVER_SIGNAL_TYPES)[number];

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
    'zh-TW': '司機會晚到約{minutes}分鐘，請在接送地點稍候。',
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
    'zh-TW': '車輛停在這裡——回來時請參考這個位置。',
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
    'zh-TW': '車輛已抵達接送地點。',
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
    'zh-TW': '🚗 收到——司機約{minutes}分鐘後抵達，請在原地稍候。',
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
    'zh-TW': '✅ 人數確認完畢 — 現在出發。請就座。',
    fr: '✅ Comptage terminé — nous partons maintenant. Veuillez vous asseoir.',
    de: '✅ Alle an Bord — wir fahren jetzt los. Bitte nehmen Sie Platz.',
    ru: '✅ Все на месте — отправляемся. Пожалуйста, займите свои места.',
    it: '✅ Conteggio fatto — si parte. Prendete posto, per favore.',
  },
  /**
   * Deliberately does not name the item. The driver taps this the moment they
   * see something on a seat, before knowing whose it is, and a guess printed in
   * ten languages ("a phone") is worse than none — it tells nine people it is
   * not theirs. Ops gets the push and does the matching.
   */
  found_item: {
    en: '🧳 Something was left in the vehicle. If you are missing anything, tell us here — our team is holding it.',
    ko: '🧳 차량에 두고 내리신 물건이 있어요. 잃어버린 게 있으면 여기로 알려 주세요 — 저희가 보관 중입니다.',
    ja: '🧳 車内にお忘れ物がありました。心当たりがあればこちらにお知らせください — こちらで保管しています。',
    es: '🧳 Se quedó algo en el vehículo. Si te falta algo, dínoslo por aquí: lo tenemos guardado.',
    zh: '🧳 车内有遗留物品。如果您丢了东西，请在这里告诉我们——我们已代为保管。',
    'zh-TW': '🧳 車內有遺留物品。如果您掉了東西，請在這裡告訴我們——我們已代為保管。',
    fr: '🧳 Un objet a été oublié dans le véhicule. S’il vous manque quelque chose, dites-le ici : nous le gardons.',
    de: '🧳 Im Fahrzeug wurde etwas vergessen. Falls Ihnen etwas fehlt, schreiben Sie uns hier — wir bewahren es auf.',
    ru: '🧳 В машине осталась забытая вещь. Если вы что-то потеряли, напишите сюда — мы её сохранили.',
    it: '🧳 Qualcosa è rimasto nel veicolo. Se ti manca qualcosa, scrivici qui: lo stiamo conservando.',
  },
  vehicle_issue: {
    en: 'We are having a vehicle issue. The team is on it — updates will follow here shortly.',
    ko: '차량에 문제가 생겼어요. 팀이 조치 중이며 곧 안내드릴게요.',
    ja: '車両にトラブルが発生しました。対応中です。追ってこちらでご案内します。',
    es: 'Tenemos un problema con el vehículo. El equipo lo está resolviendo; pronto informaremos aquí.',
    zh: '车辆出现了问题。团队正在处理，稍后会在此更新说明。',
    'zh-TW': '車輛出了狀況。團隊正在處理中，稍後會在這裡更新說明。',
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
