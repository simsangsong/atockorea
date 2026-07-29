/**
 * SG-2b — the wait-ended (낙오) capsule and the rally push copy, all ten
 * locales, zero runtime LLM (SG-D17). Time slots are pre-formatted per
 * locale through formatTargetTime (SG-D20) so en keeps its 12h dialect.
 *
 * The capsule TEXT is the notification/accessibility surface; the rich
 * rejoin UI (big Korean destination for a taxi driver, nav deep link,
 * coordinator call) renders from the message metadata in WaitEndedCard.
 * The last line matters: guests already aboard see this too (the server
 * cannot know who is missing without bus hardware), so the copy addresses
 * the missing guest and waves the seated ones off in one breath.
 */
import type { RoomLocale } from '@/lib/tour-room/snapshot';
import { formatTargetTime } from '@/lib/tour-room/notices';

type Bundle = { source_locale: string; source_text: string; translations: Record<string, string> };

export interface WaitEndedSlots {
  /** target + RALLY_GRACE_MS — the declared departure instant. */
  departedAtMs: number;
  meetingPoint?: string | null;
  nextStopName?: string | null;
}

const WAIT_ENDED: Record<RoomLocale, (at: string, next: string | null) => string> = {
  en: (at, next) =>
    `The vehicle departed at ${at}.${next ? ` Rejoin the group at ${next}.` : ''} Open the card below for how to rejoin — if you are already aboard, please ignore this.`,
  ko: (at, next) =>
    `차량이 ${at}에 출발했습니다.${next ? ` ${next}에서 다시 합류해 주세요.` : ''} 아래 카드에서 재합류 안내를 확인하세요 — 이미 탑승하셨다면 무시하셔도 됩니다.`,
  ja: (at, next) =>
    `車両は${at}に出発しました。${next ? `${next}で合流してください。` : ''}下のカードで合流方法をご確認ください。すでに乗車済みの方はこの通知を無視してください。`,
  zh: (at, next) =>
    `车辆已于 ${at} 出发。${next ? `请在${next}与团队会合。` : ''}请查看下方卡片了解如何会合——如果您已在车上，请忽略此消息。`,
  'zh-TW': (at, next) =>
    `車輛已於 ${at} 出發。${next ? `請在${next}與團隊會合。` : ''}請查看下方卡片了解如何會合——如果您已在車上，請忽略此訊息。`,
  es: (at, next) =>
    `El vehículo salió a las ${at}.${next ? ` Reúnase con el grupo en ${next}.` : ''} Abra la tarjeta de abajo para saber cómo reunirse; si ya está a bordo, ignore este aviso.`,
  fr: (at, next) =>
    `Le véhicule est parti à ${at}.${next ? ` Rejoignez le groupe à ${next}.` : ''} Ouvrez la carte ci-dessous pour savoir comment le rejoindre — si vous êtes déjà à bord, ignorez ce message.`,
  de: (at, next) =>
    `Das Fahrzeug ist um ${at} abgefahren.${next ? ` Treffen Sie die Gruppe bei ${next}.` : ''} Öffnen Sie die Karte unten für die Wiederanschluss-Hinweise — wenn Sie bereits an Bord sind, ignorieren Sie diese Nachricht.`,
  ru: (at, next) =>
    `Транспорт отправился в ${at}.${next ? ` Присоединяйтесь к группе: ${next}.` : ''} Откройте карточку ниже, чтобы узнать, как присоединиться. Если вы уже в машине — не обращайте внимания.`,
  it: (at, next) =>
    `Il veicolo è partito alle ${at}.${next ? ` Raggiunga il gruppo a ${next}.` : ''} Apra la scheda qui sotto per sapere come raggiungerlo — se è già a bordo, ignori questo avviso.`,
};

export function waitEndedBundle(slots: WaitEndedSlots): Bundle {
  const translations = Object.fromEntries(
    (Object.keys(WAIT_ENDED) as RoomLocale[]).map((locale) => [
      locale,
      WAIT_ENDED[locale](formatTargetTime(slots.departedAtMs, locale), slots.nextStopName ?? null),
    ]),
  ) as Record<string, string>;
  return { source_locale: 'en', source_text: translations.en, translations };
}

const WAIT_ENDED_PUSH: Record<RoomLocale, (at: string) => string> = {
  en: (at) => `Departed at ${at} — rejoin instructions are in your tour room`,
  ko: (at) => `${at} 출발 — 투어룸에 재합류 안내가 도착했어요`,
  ja: (at) => `${at}に出発 — ツアールームに合流案内が届いています`,
  zh: (at) => `已于 ${at} 出发——会合指引已发送至您的旅行房间`,
  'zh-TW': (at) => `已於 ${at} 出發——會合指引已發送至您的旅行房間`,
  es: (at) => `Salida a las ${at}: las instrucciones para reunirse están en su sala`,
  fr: (at) => `Départ à ${at} — les instructions pour rejoindre le groupe sont dans votre salon`,
  de: (at) => `Abfahrt um ${at} — die Wiederanschluss-Hinweise sind in Ihrem Tour-Raum`,
  ru: (at) => `Отправление в ${at} — инструкции в вашей комнате тура`,
  it: (at) => `Partenza alle ${at} — le istruzioni per riunirsi sono nella sua stanza`,
};

export function waitEndedPush(slots: WaitEndedSlots): Record<string, string> {
  return Object.fromEntries(
    (Object.keys(WAIT_ENDED_PUSH) as RoomLocale[]).map((locale) => [
      locale,
      WAIT_ENDED_PUSH[locale](formatTargetTime(slots.departedAtMs, locale)),
    ]),
  ) as Record<string, string>;
}

/**
 * SG-2a / SG-D7 — the T-10 reminder, TARGET-TIME based ("10:30 집합"), never
 * offset-based ("10분 전") — a notice created at T-4 would make the offset a
 * lie. The point rides verbatim: it is already the operator's own words.
 */
const RALLY_REMIND_PUSH: Record<RoomLocale, (at: string, point: string | null) => string> = {
  en: (at, p) => `Meet at ${at}${p ? ` · ${p}` : ''}`,
  ko: (at, p) => `${at} 집합${p ? ` · ${p}` : ''}`,
  ja: (at, p) => `${at} 集合${p ? ` · ${p}` : ''}`,
  zh: (at, p) => `${at} 集合${p ? ` · ${p}` : ''}`,
  'zh-TW': (at, p) => `${at} 集合${p ? ` · ${p}` : ''}`,
  es: (at, p) => `Reunión a las ${at}${p ? ` · ${p}` : ''}`,
  fr: (at, p) => `Rassemblement à ${at}${p ? ` · ${p}` : ''}`,
  de: (at, p) => `Treffpunkt um ${at}${p ? ` · ${p}` : ''}`,
  ru: (at, p) => `Сбор в ${at}${p ? ` · ${p}` : ''}`,
  it: (at, p) => `Ritrovo alle ${at}${p ? ` · ${p}` : ''}`,
};

export function rallyRemindPush(targetMs: number, point: string | null): Record<string, string> {
  return Object.fromEntries(
    (Object.keys(RALLY_REMIND_PUSH) as RoomLocale[]).map((locale) => [
      locale,
      RALLY_REMIND_PUSH[locale](formatTargetTime(targetMs, locale), point),
    ]),
  ) as Record<string, string>;
}
