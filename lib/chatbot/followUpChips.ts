// W4.3 / W2.10 — contextual follow-up chips.
//
// The server decides which one-tap follow-ups make sense for the turn it just
// answered; the widget renders them as pill buttons that send the chip text
// as a normal user message. Chip wording is therefore load-bearing: the
// affirmation/decline/edit chips MUST keep matching the deterministic
// routing regexes in quoteFlow (looksLikeAffirmation / looksLikeDecline /
// emailConfirmOutcome) — change them together or the tap dead-ends.

import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";

type ChipMap = Record<TourProductPageLocale, string[]>;

const RECOMMEND_CHIPS: ChipMap = {
  en: ["What's included in these tours?", "Where does pickup start?", "Get a private tour quote"],
  ko: ["이 투어들엔 뭐가 포함돼 있나요?", "픽업은 어디서 시작하나요?", "프라이빗 투어 견적 받기"],
  ja: ["これらのツアーには何が含まれますか？", "ピックアップはどこからですか？", "プライベートツアーの見積もりが欲しい"],
  zh: ["这些行程包含什么？", "在哪里接送？", "我想要私人包车报价"],
  "zh-TW": ["這些行程包含什麼？", "在哪裡接送？", "我想要私人包車報價"],
  es: ["¿Qué incluyen estos tours?", "¿Dónde empieza la recogida?", "Quiero una cotización de tour privado"],
};

const PRICE_CHIPS: ChipMap = {
  en: ["Get a custom private tour quote", "What's included in the price?"],
  ko: ["맞춤 프라이빗 투어 견적 받기", "가격에 뭐가 포함되나요?"],
  ja: ["プライベートツアーの見積もりが欲しい", "料金には何が含まれますか？"],
  zh: ["我想要私人包车报价", "价格包含什么？"],
  "zh-TW": ["我想要私人包車報價", "價格包含什麼？"],
  es: ["Quiero una cotización de tour privado", "¿Qué incluye el precio?"],
};

// Tap targets for the "Estimated quote: … Want me to set up checkout?" turn.
// Affirm chip must pass looksLikeAffirmation; decline chip must pass
// looksLikeDecline (both anchored patterns — see quoteFlow).
const QUOTE_CONFIRM_CHIPS: ChipMap = {
  en: ["Yes, go ahead", "Not now"],
  ko: ["네, 진행해주세요", "아니요, 괜찮아요"],
  ja: ["はい、お願いします", "いいえ、結構です"],
  zh: ["好的，请继续", "不用了，谢谢"],
  "zh-TW": ["好的，請繼續", "不用了，謝謝"],
  es: ["Sí, adelante", "Ahora no, gracias"],
};

// Tap targets for the email confirmation turn (W2.10). The "yes" chip must
// pass emailConfirmOutcome's confirm patterns; the "edit" chip its edit
// patterns (edit is checked FIRST there, so e.g. ko "…할게요" in the edit
// chip can't be misread as an affirmation).
const EMAIL_CONFIRM_CHIPS: ChipMap = {
  en: ["Yes, that's the right email", "Use a different email"],
  ko: ["네, 맞아요", "다른 이메일로 할게요"],
  ja: ["はい、合っています", "別のメールにします"],
  zh: ["对，没错", "换一个邮箱"],
  "zh-TW": ["對，沒錯", "換一個電子郵件"],
  es: ["Sí, es correcto", "Usar otro correo"],
};

export function recommendationChips(locale: TourProductPageLocale): string[] {
  return RECOMMEND_CHIPS[locale] ?? RECOMMEND_CHIPS.en;
}

export function priceChips(locale: TourProductPageLocale): string[] {
  return PRICE_CHIPS[locale] ?? PRICE_CHIPS.en;
}

export function quoteConfirmChips(locale: TourProductPageLocale): string[] {
  return QUOTE_CONFIRM_CHIPS[locale] ?? QUOTE_CONFIRM_CHIPS.en;
}

export function emailConfirmChips(locale: TourProductPageLocale): string[] {
  return EMAIL_CONFIRM_CHIPS[locale] ?? EMAIL_CONFIRM_CHIPS.en;
}

/**
 * Chips for a free-form (finalize-path) answer, by deterministic intent.
 * Empty array = the widget renders nothing (most intents: policy, legal,
 * booking-specific answers should not be nudged toward products).
 */
export function followUpChipsForIntent(
  intent: string,
  locale: TourProductPageLocale,
  opts: { hasCards: boolean },
): string[] {
  if (intent === "tour_recommendation" || intent === "tour_catalog") {
    return opts.hasCards ? recommendationChips(locale) : [];
  }
  if (intent === "price_question") return priceChips(locale);
  return [];
}
