/**
 * T1.7 — quick-reply presets (§M-2 ②): 8 fixed phrases pre-translated into
 * the 5 room locales. The client sends only the preset key; the server builds
 * source_text + translations from these constants — runtime LLM calls: zero.
 * Shared by the Composer (labels) and the messages API (server-authoritative
 * content), so the two can never drift.
 */

import type { RoomLocale } from '@/lib/tour-room/snapshot';

export interface QuickReplyPreset {
  key: string;
  emoji: string;
  text: Record<RoomLocale, string>;
}

export const QUICK_REPLY_PRESETS: readonly QuickReplyPreset[] = [
  {
    key: 'on_my_way',
    emoji: '🏃',
    text: {
      en: "I'm on my way.",
      ko: '지금 가고 있어요.',
      ja: '今向かっています。',
      es: 'Voy en camino.',
      zh: '我正在路上。',
    },
  },
  {
    key: 'arrived',
    emoji: '📍',
    text: {
      en: "I've arrived.",
      ko: '도착했어요.',
      ja: '到着しました。',
      es: 'Ya llegué.',
      zh: '我到了。',
    },
  },
  {
    key: 'running_late',
    emoji: '⏰',
    text: {
      en: "I'll be about 5 minutes late.",
      ko: '5분 정도 늦을 것 같아요.',
      ja: '5分ほど遅れます。',
      es: 'Llegaré unos 5 minutos tarde.',
      zh: '我会晚到5分钟左右。',
    },
  },
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
  {
    key: 'need_help',
    emoji: '🙋',
    text: {
      en: 'I need some help, please.',
      ko: '도움이 필요해요.',
      ja: '助けが必要です。',
      es: 'Necesito ayuda, por favor.',
      zh: '我需要帮助。',
    },
  },
  {
    key: 'thank_you',
    emoji: '🙏',
    text: {
      en: 'Thank you!',
      ko: '감사합니다!',
      ja: 'ありがとうございます！',
      es: '¡Gracias!',
      zh: '谢谢！',
    },
  },
] as const;

export function getQuickReplyPreset(key: unknown): QuickReplyPreset | null {
  if (typeof key !== 'string') return null;
  return QUICK_REPLY_PRESETS.find((preset) => preset.key === key) ?? null;
}
