/**
 * T1.7 — quick-reply presets (§M-2 ②): fixed phrases pre-translated into the
 * 5 room locales. The client sends only the preset key; the server builds
 * source_text + translations from these constants — runtime LLM calls: zero.
 * Shared by the Composer (labels) and the messages API (server-authoritative
 * content), so the two can never drift.
 *
 * A6 (plan §11.A) — presets are ROLE-SCOPED sets now. The old single list
 * mixed guest phrases ("Where is the bus?") into staff screens; each role
 * gets a fully separate set matched to its context:
 *   customer — riding context (restroom, A/C, carsickness, quick stop, late)
 *   guide    — touring context (follow me, gather here, on my way, arrived)
 *   driver   — driving context (departing, ETA, rest stop, vehicle delay,
 *              parking, seatbelt, belongings)
 * Presets that are legitimate for several roles are shared BY OBJECT (one key,
 * one text), so the server lookup stays key-unique. Retired keys remain
 * resolvable server-side (LEGACY) so an already-open client can still send.
 */

import type { RoomLocale } from '@/lib/tour-room/snapshot';

export interface QuickReplyPreset {
  key: string;
  emoji: string;
  text: Record<RoomLocale, string>;
}

export type QuickReplyRole = 'customer' | 'guide' | 'driver';

// ── shared presets (legitimate in more than one role's set) ────────────────

const ON_MY_WAY: QuickReplyPreset = {
  key: 'on_my_way',
  emoji: '🏃',
  text: {
    en: "I'm on my way.",
    ko: '지금 가고 있어요.',
    ja: '今向かっています。',
    es: 'Voy en camino.',
    zh: '我正在路上。',
    'zh-TW': '我在路上了。',
    fr: 'J’arrive.',
    de: 'Ich bin unterwegs.',
    ru: 'Уже иду.',
    it: 'Sto arrivando.',
  },
};

const ARRIVED: QuickReplyPreset = {
  key: 'arrived',
  emoji: '📍',
  text: {
    en: "I've arrived.",
    ko: '도착했어요.',
    ja: '到着しました。',
    es: 'Ya llegué.',
    zh: '我到了。',
    'zh-TW': '我到了。',
    fr: 'Je suis sur place.',
    de: 'Ich bin da.',
    ru: 'Я на месте.',
    it: 'Sono sul posto.',
  },
};

const RUNNING_LATE: QuickReplyPreset = {
  key: 'running_late',
  emoji: '⏰',
  text: {
    en: "I think I'll be a bit late.",
    ko: '조금 늦을 것 같아요.',
    ja: '少し遅れそうです。',
    es: 'Creo que llegaré un poco tarde.',
    zh: '我可能会晚到一点。',
    'zh-TW': '我可能會晚一點到。',
    fr: 'Je vais avoir un peu de retard.',
    de: 'Ich komme etwas später.',
    ru: 'Я немного опаздываю.',
    it: 'Farò un po’ tardi.',
  },
};

/** Kept in the customer set: this key drives the ops attention queue + push
 *  (W6.2 — lib/tour-ops/attention.ts matches preset_key === 'need_help'). */
const NEED_HELP: QuickReplyPreset = {
  key: 'need_help',
  emoji: '🙋',
  text: {
    en: 'I need some help, please.',
    ko: '도움이 필요해요.',
    ja: '助けが必要です。',
    es: 'Necesito ayuda, por favor.',
    zh: '我需要帮助。',
    'zh-TW': '我需要協助。',
    fr: 'J’ai besoin d’aide, s’il vous plaît.',
    de: 'Ich brauche bitte Hilfe.',
    ru: 'Мне нужна помощь, пожалуйста.',
    it: 'Ho bisogno di aiuto, per favore.',
  },
};

const THANK_YOU: QuickReplyPreset = {
  key: 'thank_you',
  emoji: '🙏',
  text: {
    en: 'Thank you!',
    ko: '감사합니다!',
    ja: 'ありがとうございます！',
    es: '¡Gracias!',
    zh: '谢谢！',
    'zh-TW': '謝謝！',
    fr: 'Merci!',
    de: 'Danke!',
    ru: 'Спасибо!',
    it: 'Grazie!',
  },
};

// ── customer set (A6 — riding context) ─────────────────────────────────────

export const CUSTOMER_QUICK_REPLIES: readonly QuickReplyPreset[] = [
  {
    key: 'need_toilet_urgent',
    emoji: '🚻',
    text: {
      en: 'I really need the restroom.',
      ko: '화장실이 급해요.',
      ja: 'トイレに行きたいです。',
      es: 'Necesito ir al baño, por favor.',
      zh: '我急需上洗手间。',
      'zh-TW': '我急著要上洗手間。',
      fr: 'J’ai vraiment besoin d’aller aux toilettes.',
      de: 'Ich muss dringend zur Toilette.',
      ru: 'Мне срочно нужен туалет.',
      it: 'Ho davvero bisogno del bagno.',
    },
  },
  {
    key: 'too_cold',
    emoji: '🥶',
    text: {
      en: "It's too cold in here.",
      ko: '에어컨이 추워요.',
      ja: '車内が寒いです。',
      es: 'Hace mucho frío aquí dentro.',
      zh: '车里太冷了。',
      'zh-TW': '車上太冷了。',
      fr: 'Il fait trop froid ici.',
      de: 'Hier drin ist es zu kalt.',
      ru: 'В салоне слишком холодно.',
      it: 'Qui dentro fa troppo freddo.',
    },
  },
  {
    key: 'too_hot',
    emoji: '🥵',
    text: {
      en: "It's too hot in here.",
      ko: '에어컨이 더워요.',
      ja: '車内が暑いです。',
      es: 'Hace mucho calor aquí dentro.',
      zh: '车里太热了。',
      'zh-TW': '車上太熱了。',
      fr: 'Il fait trop chaud ici.',
      de: 'Hier drin ist es zu warm.',
      ru: 'В салоне слишком жарко.',
      it: 'Qui dentro fa troppo caldo.',
    },
  },
  {
    key: 'feeling_carsick',
    emoji: '🤢',
    text: {
      en: "I'm feeling carsick.",
      ko: '속이 안 좋아요 (멀미).',
      ja: '車酔いして気分が悪いです。',
      es: 'Estoy mareado/a por el viaje.',
      zh: '我晕车，不太舒服。',
      'zh-TW': '我暈車，不太舒服。',
      fr: 'J’ai le mal des transports.',
      de: 'Mir ist übel (Reisekrankheit).',
      ru: 'Меня укачивает.',
      it: 'Ho il mal d’auto.',
    },
  },
  {
    key: 'request_short_stop',
    emoji: '🅿️',
    text: {
      en: 'Could we make a quick stop?',
      ko: '잠깐 정차할 수 있나요?',
      ja: '少し停車できますか？',
      es: '¿Podemos parar un momento?',
      zh: '可以稍微停一下车吗？',
      'zh-TW': '可以稍微停一下車嗎？',
      fr: 'Pourrait-on faire un petit arrêt?',
      de: 'Könnten wir kurz anhalten?',
      ru: 'Можно ненадолго остановиться?',
      it: 'Possiamo fare una breve sosta?',
    },
  },
  // W5 (U4-D12) — the three things guests actually say at a stop, distilled
  // from tour-day transcripts: photos, snacks, kids' pace.
  {
    key: 'taking_photos',
    emoji: '📸',
    text: {
      en: 'Just taking a few photos — coming right back!',
      ko: '사진 몇 장만 찍고 바로 갈게요!',
      ja: '写真を数枚撮ったらすぐ戻ります！',
      es: 'Solo unas fotos y vuelvo enseguida.',
      zh: '拍几张照片，马上就回来！',
      'zh-TW': '拍幾張照片，馬上就回來！',
      fr: 'Je prends quelques photos — je reviens tout de suite!',
      de: 'Nur schnell ein paar Fotos — bin gleich zurück!',
      ru: 'Сделаю пару фото — сразу вернусь!',
      it: 'Faccio giusto qualche foto — torno subito!',
    },
  },
  {
    key: 'buying_snack',
    emoji: '☕',
    text: {
      en: "Grabbing a coffee/snack — I'll be quick.",
      ko: '커피/간식 사서 바로 갈게요.',
      ja: 'コーヒー/軽食を買ってすぐ行きます。',
      es: 'Compro un café/algo de picar y voy.',
      zh: '买杯咖啡/小吃，马上就来。',
      'zh-TW': '買杯咖啡/點心，馬上就來。',
      fr: 'Je prends un café/un en-cas — je fais vite.',
      de: 'Hole nur schnell Kaffee/Snack — dauert nicht lang.',
      ru: 'Куплю кофе/перекус — я быстро.',
      it: 'Prendo un caffè/uno snack — faccio in fretta.',
    },
  },
  {
    key: 'with_kids',
    emoji: '👶',
    text: {
      en: "We're moving a little slowly with the kids.",
      ko: '아이가 있어서 조금 천천히 갈게요.',
      ja: '子ども連れなので少しゆっくり行きます。',
      es: 'Vamos un poco despacio con los niños.',
      zh: '带着孩子，走得稍慢一些。',
      'zh-TW': '帶著小朋友，走得比較慢一點。',
      fr: 'Nous avançons un peu lentement avec les enfants.',
      de: 'Mit den Kindern sind wir etwas langsamer.',
      ru: 'Мы с детьми — идем чуть медленнее.',
      it: 'Con i bambini andiamo un po’ più piano.',
    },
  },
  RUNNING_LATE,
  ARRIVED, // pickup-board replies (T6.x) reuse this key
  NEED_HELP, // ops attention queue trigger (W6.2)
  THANK_YOU,
] as const;

// ── guide set (A6 — touring context) ───────────────────────────────────────

export const GUIDE_QUICK_REPLIES: readonly QuickReplyPreset[] = [
  {
    key: 'follow_me',
    emoji: '🚶',
    text: {
      en: 'Please follow me.',
      ko: '저를 따라오세요.',
      ja: '私についてきてください。',
      es: 'Síganme, por favor.',
      zh: '请跟我来。',
      'zh-TW': '請跟我來。',
      fr: 'Suivez-moi, s’il vous plaît.',
      de: 'Bitte folgen Sie mir.',
      ru: 'Пожалуйста, следуйте за мной.',
      it: 'Seguitemi, per favore.',
    },
  },
  {
    key: 'gather_here',
    emoji: '🧭',
    text: {
      en: 'Please gather here.',
      ko: '여기로 모여 주세요.',
      ja: 'ここに集合してください。',
      es: 'Reúnanse aquí, por favor.',
      zh: '请在这里集合。',
      'zh-TW': '請在這裡集合。',
      fr: 'Rassemblez-vous ici, s’il vous plaît.',
      de: 'Bitte sammeln Sie sich hier.',
      ru: 'Пожалуйста, соберитесь здесь.',
      it: 'Radunatevi qui, per favore.',
    },
  },
  ON_MY_WAY,
  ARRIVED,
  RUNNING_LATE,
  THANK_YOU,
] as const;

// ── driver set (A6 — driving context, one-tap while at the wheel) ──────────

export const DRIVER_QUICK_REPLIES: readonly QuickReplyPreset[] = [
  {
    key: 'departing_soon',
    emoji: '🚐',
    text: {
      en: "We're departing shortly.",
      ko: '곧 출발합니다.',
      ja: 'まもなく出発します。',
      es: 'Salimos en breve.',
      zh: '马上出发。',
      'zh-TW': '馬上出發。',
      fr: 'Nous partons dans un instant.',
      de: 'Wir fahren gleich los.',
      ru: 'Скоро отправляемся.',
      it: 'Partiamo a breve.',
    },
  },
  {
    key: 'arriving_soon',
    emoji: '⏱️',
    text: {
      en: "We'll arrive in about 5 minutes.",
      ko: '약 5분 후 도착합니다.',
      ja: 'あと5分ほどで到着します。',
      es: 'Llegaremos en unos 5 minutos.',
      zh: '大约5分钟后到达。',
      'zh-TW': '大約5分鐘後抵達。',
      fr: 'Nous arrivons dans environ 5 minutes.',
      de: 'Wir sind in etwa 5 Minuten da.',
      ru: 'Прибудем примерно через 5 минут.',
      it: 'Arriviamo tra circa 5 minuti.',
    },
  },
  {
    key: 'return_to_vehicle',
    emoji: '🚗',
    text: {
      en: 'Please return to the vehicle now.',
      ko: '차량으로 돌아와 주세요. 곧 출발해요.',
      ja: '車にお戻りください。まもなく出発します。',
      es: 'Vuelvan al vehículo, por favor; salimos pronto.',
      zh: '请回到车上，马上出发。',
      'zh-TW': '請回到車上，馬上要出發了。',
      fr: 'Merci de revenir au véhicule — nous partons bientôt.',
      de: 'Bitte kommen Sie zum Fahrzeug zurück — wir fahren bald los.',
      ru: 'Пожалуйста, возвращайтесь к машине — скоро отправляемся.',
      it: 'Tornate al veicolo, per favore — partiamo a breve.',
    },
  },
  {
    key: 'rest_stop',
    emoji: '🅿️',
    text: {
      en: "We're making a short stop (rest area).",
      ko: '잠시 정차합니다 (휴게소).',
      ja: 'しばらく停車します（休憩所）。',
      es: 'Haremos una parada breve (área de descanso).',
      zh: '短暂停车（休息站）。',
      'zh-TW': '短暫停車（休息站）。',
      fr: 'Petit arrêt (aire de repos).',
      de: 'Kurzer Halt (Raststätte).',
      ru: 'Короткая остановка (зона отдыха).',
      it: 'Breve sosta (area di servizio).',
    },
  },
  {
    key: 'fuel_stop',
    emoji: '⛽',
    text: {
      en: "Quick fuel stop — we'll be moving again shortly.",
      ko: '주유소에 잠깐 들릅니다. 곧 출발해요.',
      ja: 'ガソリンスタンドに少し寄ります。すぐ出発します。',
      es: 'Parada rápida para repostar; seguimos enseguida.',
      zh: '去加油站稍作停留，马上继续出发。',
      'zh-TW': '到加油站稍作停留，馬上繼續出發。',
      fr: 'Arrêt carburant rapide — nous repartons très vite.',
      de: 'Kurzer Tankstopp — gleich geht es weiter.',
      ru: 'Заедем на заправку — скоро поедем дальше.',
      it: 'Sosta veloce per il carburante — ripartiamo a breve.',
    },
  },
  {
    key: 'vehicle_delay',
    emoji: '🔧',
    text: {
      en: "We're slightly delayed due to a vehicle issue.",
      ko: '차량 문제로 조금 지연되고 있습니다.',
      ja: '車両の問題で少し遅れています。',
      es: 'Vamos con un poco de retraso por un problema del vehículo.',
      zh: '因车辆问题稍有延误。',
      'zh-TW': '因車輛問題稍有延誤。',
      fr: 'Nous avons un léger retard à cause d’un souci de véhicule.',
      de: 'Wegen eines Fahrzeugproblems verzögert es sich etwas.',
      ru: 'Немного задерживаемся из-за проблемы с машиной.',
      it: 'Siamo leggermente in ritardo per un problema al veicolo.',
    },
  },
  {
    key: 'traffic_delay',
    emoji: '🚦',
    text: {
      en: "Traffic is heavy — we're running a bit behind.",
      ko: '교통 정체로 도착이 조금 늦어지고 있어요.',
      ja: '渋滞のため到着が少し遅れています。',
      es: 'Hay mucho tráfico; llegaremos con algo de retraso.',
      zh: '路上堵车，到达时间稍有延后。',
      'zh-TW': '路上塞車，抵達時間會稍微延後。',
      fr: 'La circulation est dense — nous avons un peu de retard.',
      de: 'Viel Verkehr — wir sind etwas später dran.',
      ru: 'Плотное движение — немного отстаем от графика.',
      it: 'C’è molto traffico — siamo un po’ in ritardo.',
    },
  },
  {
    key: 'moving_to_parking',
    emoji: '🚗',
    text: {
      en: "I'm moving the vehicle to parking — please wait where you are.",
      ko: '주차 이동 중입니다. 그 자리에서 기다려 주세요.',
      ja: '駐車場へ移動中です。その場でお待ちください。',
      es: 'Estoy moviendo el vehículo al estacionamiento; esperen donde están.',
      zh: '正在挪车，请在原地稍候。',
      'zh-TW': '正在移車，請在原地稍候。',
      fr: 'Je déplace le véhicule au parking — attendez sur place, s’il vous plaît.',
      de: 'Ich fahre das Fahrzeug zum Parkplatz — bitte warten Sie, wo Sie sind.',
      ru: 'Отгоняю машину на парковку — подождите, пожалуйста, на месте.',
      it: 'Sposto il veicolo al parcheggio — aspettate dove siete, per favore.',
    },
  },
  {
    key: 'seatbelt_check',
    emoji: '💺',
    text: {
      en: 'Please check your seatbelt.',
      ko: '안전벨트를 확인해 주세요.',
      ja: 'シートベルトをご確認ください。',
      es: 'Por favor, revisen su cinturón de seguridad.',
      zh: '请系好安全带。',
      'zh-TW': '請繫好安全帶。',
      fr: 'Vérifiez votre ceinture de sécurité, s’il vous plaît.',
      de: 'Bitte prüfen Sie Ihren Sicherheitsgurt.',
      ru: 'Пожалуйста, проверьте ремень безопасности.',
      it: 'Controllate la cintura di sicurezza, per favore.',
    },
  },
  {
    key: 'check_belongings',
    emoji: '🎒',
    text: {
      en: 'Please check your belongings when getting off.',
      ko: '내리실 때 소지품을 확인해 주세요.',
      ja: 'お降りの際はお忘れ物にご注意ください。',
      es: 'Al bajar, revisen sus pertenencias.',
      zh: '下车时请带好随身物品。',
      'zh-TW': '下車時請記得帶走隨身物品。',
      fr: 'Vérifiez vos affaires en descendant, s’il vous plaît.',
      de: 'Bitte denken Sie beim Aussteigen an Ihre Sachen.',
      ru: 'Пожалуйста, не забывайте свои вещи при выходе.',
      it: 'Controllate le vostre cose quando scendete.',
    },
  },
  // W5 (U4-D12) — three real road situations that had no one-tap line:
  // a fuel stop, calling everyone back to the vehicle, plain traffic.
] as const;

/**
 * Back-compat alias — historically the one preset list shown to everyone.
 * It now means "the customer set"; role-aware surfaces should call
 * quickRepliesForRole instead.
 */
export const QUICK_REPLY_PRESETS: readonly QuickReplyPreset[] = CUSTOMER_QUICK_REPLIES;

const ROLE_SETS: Record<QuickReplyRole, readonly QuickReplyPreset[]> = {
  customer: CUSTOMER_QUICK_REPLIES,
  guide: GUIDE_QUICK_REPLIES,
  driver: DRIVER_QUICK_REPLIES,
};

/** The preset set for a participant role; unknown/absent roles get the customer set. */
export function quickRepliesForRole(role: string | null | undefined): readonly QuickReplyPreset[] {
  if (role === 'guide' || role === 'driver') return ROLE_SETS[role];
  return ROLE_SETS.customer;
}

/**
 * Retired keys (pre-A6 single list). Kept resolvable so a client that loaded
 * the old bundle can still send them; never shown in any role's strip.
 */
const LEGACY_QUICK_REPLIES: readonly QuickReplyPreset[] = [
  {
    key: 'where_bus',
    emoji: '🚌',
    text: {
      en: 'Where is the bus?',
      ko: '버스가 어디에 있나요?',
      ja: 'バスはどこですか？',
      es: '¿Dónde está el autobús?',
      zh: '巴士在哪里？',
      'zh-TW': '巴士在哪裡？',
      fr: 'Où est le bus?',
      de: 'Wo ist der Bus?',
      ru: 'Где автобус?',
      it: 'Dov’è il bus?',
    },
  },
  {
    key: 'where_meet',
    emoji: '🧭',
    text: {
      en: 'Where should we meet?',
      ko: '어디에서 모이나요?',
      ja: 'どこに集合しますか？',
      es: '¿Dónde nos reunimos?',
      zh: '在哪里集合？',
      'zh-TW': '在哪裡集合？',
      fr: 'Où se retrouve-t-on?',
      de: 'Wo treffen wir uns?',
      ru: 'Где мы собираемся?',
      it: 'Dove ci troviamo?',
    },
  },
  {
    key: 'need_restroom',
    emoji: '🚻',
    text: {
      en: 'Where is the nearest restroom?',
      ko: '가까운 화장실이 어디인가요?',
      ja: '近くのトイレはどこですか？',
      es: '¿Dónde está el baño más cercano?',
      zh: '最近的洗手间在哪里？',
      'zh-TW': '最近的洗手間在哪裡？',
      fr: 'Où sont les toilettes les plus proches?',
      de: 'Wo ist die nächste Toilette?',
      ru: 'Где ближайший туалет?',
      it: 'Dov’è il bagno più vicino?',
    },
  },
] as const;

const ALL_PRESETS_BY_KEY: ReadonlyMap<string, QuickReplyPreset> = (() => {
  const map = new Map<string, QuickReplyPreset>();
  for (const preset of [
    ...CUSTOMER_QUICK_REPLIES,
    ...GUIDE_QUICK_REPLIES,
    ...DRIVER_QUICK_REPLIES,
    ...LEGACY_QUICK_REPLIES,
  ]) {
    const existing = map.get(preset.key);
    if (existing && existing !== preset) {
      // Same key must always mean the same content (server-authoritative text).
      throw new Error(`Duplicate quick-reply key with divergent content: ${preset.key}`);
    }
    map.set(preset.key, preset);
  }
  return map;
})();

/** Server-side resolver — accepts any known key from any role set (or legacy). */
export function getQuickReplyPreset(key: unknown): QuickReplyPreset | null {
  if (typeof key !== 'string') return null;
  return ALL_PRESETS_BY_KEY.get(key) ?? null;
}
