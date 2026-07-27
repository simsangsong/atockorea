/**
 * V1 대면 통역 화면 문구 — ROOM_LOCALES 10종.
 *
 * 🔴 `localPrompt` 만 **항상 한국어**다. 그 면을 읽는 사람은 눈앞의 한국인이고,
 * 손님 폰의 UI 언어와 아무 상관이 없다. 여기를 손님 로케일로 번역하면 식당
 * 주인이 이탈리아어 버튼을 보게 된다 — 이 기능이 정확히 못 하게 막아야 할 일이다.
 */

import { ROOM_LOCALES, type RoomLocale } from '@/lib/tour-room/snapshot';

export interface InterpretCopy {
  /** 손님 면 버튼 — 손님 언어. */
  guestPrompt: string;
  /** 상대 면 버튼 — 언제나 한국어. */
  localPrompt: string;
  listening: string;
  working: string;
  numbersWarning: string;
  empty: string;
  error: string;
  needRoom: string;
  openRoom: string;
}

/** 상대 면은 로케일과 무관하게 고정이다. */
const LOCAL_SIDE_KO = '눌러서 한국어로 말하기';

const BASE: Record<RoomLocale, Omit<InterpretCopy, 'localPrompt'>> = {
  en: {
    guestPrompt: 'Hold to speak',
    listening: 'Listening…',
    working: 'Translating…',
    numbersWarning: 'Check these numbers:',
    empty: "Didn't catch that — try again",
    error: 'Translation failed. Try again.',
    needRoom: 'Open your tour room first, then come back.',
    openRoom: 'Open tour room',
  },
  ko: {
    guestPrompt: '누르고 말하기',
    listening: '듣는 중…',
    working: '옮기는 중…',
    numbersWarning: '이 숫자를 확인하세요:',
    empty: '잘 안 들렸어요 — 다시 해보세요',
    error: '통역에 실패했어요. 다시 시도해주세요.',
    needRoom: '투어룸에 먼저 들어간 뒤 다시 열어주세요.',
    openRoom: '투어룸 열기',
  },
  zh: {
    guestPrompt: '按住说话',
    listening: '正在聆听…',
    working: '翻译中…',
    numbersWarning: '请核对这些数字：',
    empty: '没有听清，请再试一次',
    error: '翻译失败，请重试。',
    needRoom: '请先进入行程房间，然后再回来。',
    openRoom: '打开行程房间',
  },
  'zh-TW': {
    guestPrompt: '按住說話',
    listening: '正在聆聽…',
    working: '翻譯中…',
    numbersWarning: '請核對這些數字：',
    empty: '沒有聽清，請再試一次',
    error: '翻譯失敗，請重試。',
    needRoom: '請先進入行程房間，然後再回來。',
    openRoom: '開啟行程房間',
  },
  ja: {
    guestPrompt: '押して話す',
    listening: '聞いています…',
    working: '翻訳中…',
    numbersWarning: 'この数字をご確認ください：',
    empty: '聞き取れませんでした。もう一度お試しください',
    error: '翻訳に失敗しました。もう一度お試しください。',
    needRoom: '先にツアールームに入ってから、もう一度開いてください。',
    openRoom: 'ツアールームを開く',
  },
  es: {
    guestPrompt: 'Mantén pulsado para hablar',
    listening: 'Escuchando…',
    working: 'Traduciendo…',
    numbersWarning: 'Compruebe estos números:',
    empty: 'No se ha entendido, inténtelo de nuevo',
    error: 'La traducción ha fallado. Inténtelo de nuevo.',
    needRoom: 'Abra primero su sala del tour y vuelva aquí.',
    openRoom: 'Abrir sala del tour',
  },
  fr: {
    guestPrompt: 'Maintenez pour parler',
    listening: 'Écoute en cours…',
    working: 'Traduction en cours…',
    numbersWarning: 'Vérifiez ces chiffres :',
    empty: "Je n'ai pas bien entendu — réessayez",
    error: 'La traduction a échoué. Veuillez réessayer.',
    needRoom: "Ouvrez d'abord votre salon de visite, puis revenez ici.",
    openRoom: 'Ouvrir le salon',
  },
  de: {
    guestPrompt: 'Zum Sprechen gedrückt halten',
    listening: 'Ich höre zu…',
    working: 'Wird übersetzt…',
    numbersWarning: 'Bitte prüfen Sie diese Zahlen:',
    empty: 'Das habe ich nicht verstanden — bitte noch einmal',
    error: 'Die Übersetzung ist fehlgeschlagen. Bitte erneut versuchen.',
    needRoom: 'Öffnen Sie bitte zuerst Ihren Tour-Raum und kommen Sie dann zurück.',
    openRoom: 'Tour-Raum öffnen',
  },
  ru: {
    guestPrompt: 'Нажмите и говорите',
    listening: 'Слушаю…',
    working: 'Перевожу…',
    numbersWarning: 'Проверьте эти числа:',
    empty: 'Не расслышал — попробуйте ещё раз',
    error: 'Не удалось перевести. Попробуйте ещё раз.',
    needRoom: 'Сначала откройте комнату тура, затем вернитесь сюда.',
    openRoom: 'Открыть комнату тура',
  },
  it: {
    guestPrompt: 'Tieni premuto per parlare',
    listening: 'In ascolto…',
    working: 'Traduzione in corso…',
    numbersWarning: 'Controlli questi numeri:',
    empty: 'Non ho capito — riprovi',
    error: 'Traduzione non riuscita. Riprovi.',
    needRoom: 'Apra prima la sala del tour, poi torni qui.',
    openRoom: 'Apri la sala del tour',
  },
};

export const INTERPRET_COPY: Record<RoomLocale, InterpretCopy> = Object.fromEntries(
  ROOM_LOCALES.map((locale) => [locale, { ...BASE[locale], localPrompt: LOCAL_SIDE_KO }]),
) as Record<RoomLocale, InterpretCopy>;

/** 모르는 로케일은 영어로. 화면이 비는 것보다 낫다. */
export function interpretCopyFor(locale: string | null | undefined): InterpretCopy {
  const key = (locale ?? '').trim();
  return INTERPRET_COPY[key as RoomLocale] ?? INTERPRET_COPY.en;
}
