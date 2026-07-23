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
    },
  },
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
