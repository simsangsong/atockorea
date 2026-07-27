/**
 * 동행자 개별 등록 — 정원 규칙 (AtoC 통합 플랜 §5.2 C-6).
 *
 * 순수 함수만. "2인 예약에 디바이스 9개가 쌓이는" 사태를 막는 유일한 산술이
 * 여기 있고, 링크 발급(경고)과 redeem(하드 거절)이 같은 함수를 쓴다 — 두
 * 화면이 다른 정원을 말하면 안 된다.
 *
 * 정원 = bookings.number_of_guests. participant는 디바이스 단위이므로
 * "일행 N명 = 디바이스 N대"가 상한이다: lead가 1칸을 이미 쓰고 있으므로
 * 2인 예약이면 동행자 링크로 들어올 수 있는 디바이스는 1대다.
 *
 * 정원 초과는 500이 아니라 409 + 사람이 읽을 수 있는 문장으로 끝난다
 * (플랜: "degrade gracefully").
 */

import { normalizeRoomLocale } from '@/lib/tour-room/snapshot';

/** 이 예약이 허용하는 총 디바이스 수. 값이 이상하면 보수적으로 1. */
export function companionCapacity(numberOfGuests: number | null | undefined): number {
  const n = Number(numberOfGuests);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(20, Math.floor(n)));
}

export interface CompanionSlots {
  /** 총 정원 (= 일행 수). */
  capacity: number;
  /** 이미 등록된 고객 디바이스 수 (lead 포함). */
  used: number;
  /** 남은 자리. 0이면 더 못 받는다. */
  remaining: number;
  full: boolean;
}

export function companionSlots(
  numberOfGuests: number | null | undefined,
  registeredCustomerDevices: number,
): CompanionSlots {
  const capacity = companionCapacity(numberOfGuests);
  const used = Math.max(0, Math.floor(Number(registeredCustomerDevices) || 0));
  const remaining = Math.max(0, capacity - used);
  return { capacity, used, remaining, full: remaining === 0 };
}

/** 정원이 찼을 때 동행자에게 보여줄 문장 (5로케일 — 룸 로케일 규약). */
export const COMPANION_FULL_MESSAGE: Record<string, string> = {
  en: 'This booking already has all of its devices registered. Ask the person who booked to share their screen, or contact the guide.',
  ko: '이 예약은 등록 가능한 기기를 이미 다 썼어요. 예약하신 분께 문의하거나 가이드에게 알려 주세요.',
  ja: 'この予約はすでに登録可能な端末数に達しています。予約された方かガイドにご連絡ください。',
  es: 'Esta reserva ya tiene todos sus dispositivos registrados. Consulta con quien hizo la reserva o avisa al guía.',
  zh: '此预订的可注册设备已用完。请联系预订人或导游。',
  'zh-TW': '此預訂可註冊的裝置已用完。請聯絡當初預訂的人，或告知導遊。',
  fr: 'Tous les appareils autorisés pour cette réservation sont déjà enregistrés. Demandez à la personne qui a réservé de partager son écran, ou contactez le guide.',
  de: 'Für diese Buchung sind bereits alle Geräte registriert. Bitten Sie die buchende Person, ihren Bildschirm zu teilen, oder wenden Sie sich an den Guide.',
  ru: 'Для этого бронирования уже зарегистрированы все устройства. Попросите оформившего бронь показать свой экран или свяжитесь с гидом.',
  it: 'Questa prenotazione ha già registrato tutti i dispositivi disponibili. Chiedi a chi ha prenotato di condividere lo schermo, oppure contatta la guida.',
};

export function companionFullMessage(locale: string | null | undefined): string {
  // normalizeRoomLocale keeps zh-TW whole; a bare slice(0,2) folded it to 'zh'
  // and stranded the Traditional string entirely (2026-07-27).
  const key = normalizeRoomLocale(locale, 'en');
  return COMPANION_FULL_MESSAGE[key] ?? COMPANION_FULL_MESSAGE.en;
}
