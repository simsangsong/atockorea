/**
 * T3-4 — operator situational presets (§O operator→guests).
 *
 * The field assistant / guide broadcasts these one-tap phrases to the whole
 * vehicle. Pre-translated into the 5 room locales so they are ZERO-LLM (instant,
 * free, resilient when every AI provider is down) — the exact same contract as
 * the guest quick replies, but keyed for operator announcements. The operator is
 * Korean, so the console shows the `ko` string as the button label.
 *
 * These cover the real-world guiding moments the audit flagged (2026-07-20):
 * "따라오세요", "여기서 표 사세요", "여기서 대기", "출발합니다", …
 */

import type { RoomLocale } from '@/lib/tour-room/snapshot';

export interface OperatorPreset {
  key: string;
  emoji: string;
  text: Record<RoomLocale, string>;
}

export const OPERATOR_PRESETS: readonly OperatorPreset[] = [
  {
    key: 'follow_me',
    emoji: '🚶',
    text: {
      en: 'Please follow me.',
      ko: '저를 따라오세요.',
      ja: '私についてきてください。',
      es: 'Por favor, síganme.',
      zh: '请跟我来。',
    },
  },
  {
    key: 'buy_tickets_here',
    emoji: '🎟️',
    text: {
      en: 'Please buy your tickets here.',
      ko: '여기서 표를 구매해 주세요.',
      ja: 'ここでチケットをご購入ください。',
      es: 'Compren sus entradas aquí, por favor.',
      zh: '请在这里购买门票。',
    },
  },
  {
    key: 'wait_here',
    emoji: '✋',
    text: {
      en: 'Please wait here for a moment.',
      ko: '여기서 잠시 기다려 주세요.',
      ja: 'ここで少々お待ちください。',
      es: 'Esperen aquí un momento, por favor.',
      zh: '请在这里稍等片刻。',
    },
  },
  {
    key: 'stay_together',
    emoji: '👥',
    text: {
      en: 'Please stay together as a group.',
      ko: '다 함께 움직여 주세요.',
      ja: 'みなさま一緒に行動してください。',
      es: 'Por favor, permanezcan juntos en grupo.',
      zh: '请大家一起行动。',
    },
  },
  {
    key: 'board_now',
    emoji: '🚌',
    text: {
      en: 'Please board the vehicle now.',
      ko: '지금 차량에 탑승해 주세요.',
      ja: '今すぐ車両にご乗車ください。',
      es: 'Suban al vehículo ahora, por favor.',
      zh: '请现在上车。',
    },
  },
  {
    key: 'departing_soon',
    emoji: '⏱️',
    text: {
      en: 'We will be departing soon.',
      ko: '곧 출발합니다.',
      ja: 'まもなく出発します。',
      es: 'Saldremos en breve.',
      zh: '我们即将出发。',
    },
  },
  {
    key: 'rest_here',
    emoji: '☕',
    text: {
      en: "We'll take a short break here.",
      ko: '여기서 잠시 쉬어갑니다.',
      ja: 'ここで少し休憩します。',
      es: 'Haremos una breve pausa aquí.',
      zh: '我们在这里稍作休息。',
    },
  },
  {
    // C7 — shopping-stop expectation setting (buying is never required).
    key: 'shopping_optional',
    emoji: '🛍️',
    text: {
      en: 'This is a shopping stop — browsing is welcome and buying is entirely optional.',
      ko: '쇼핑 매장에 들르는 일정이에요 — 구경은 자유, 구매는 전혀 필수가 아닙니다.',
      ja: 'ここはショッピングの立ち寄りです — 見るだけで大丈夫、購入は一切必須ではありません。',
      es: 'Esta es una parada de compras: mirar es bienvenido y comprar es totalmente opcional.',
      zh: '这里是购物停靠点 — 欢迎随意逛逛，完全没有购买义务。',
    },
  },
  {
    key: 'take_photos',
    emoji: '📸',
    text: {
      en: 'Feel free to take photos here.',
      ko: '여기서 자유롭게 사진 찍으세요.',
      ja: 'ここで自由に写真をお撮りください。',
      es: 'Pueden tomar fotos aquí libremente.',
      zh: '请在这里自由拍照。',
    },
  },
];

export function getOperatorPreset(key: unknown): OperatorPreset | null {
  if (typeof key !== 'string') return null;
  return OPERATOR_PRESETS.find((preset) => preset.key === key) ?? null;
}
