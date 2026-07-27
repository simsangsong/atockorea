/**
 * C-16 card ④ — lunch notice + dietary intake (`briefing_lunch`).
 *
 * 🔴 The highest-value card in the stack: it is the ORIGINAL intake path the
 * dining RAG was designed around (§5.7 R-1 intake ①). Until now `needs.dietary`
 * could only be filled from the /plan A10 checklist (private tours) or the
 * card's own client-side chips (which never persist), so a join-tour guest had
 * no way to declare a restriction before the restaurant list was built. Tapping
 * a chip here writes `tour_day_plans.needs.dietary`, which is exactly what
 * `resolveDietary()` reads first — no other wiring is involved.
 *
 * The vocabulary is imported verbatim from lib/ops/dining/dietary.ts. The one
 * subtraction is `kids`, which that module defines as DERIVED (from
 * needs.children) and explicitly "never stored" — offering it as a storable
 * chip would put a value into needs.dietary that its own reader ignores.
 *
 * Pre-translated 5-locale constants, zero LLM at send time.
 */

import { capsuleFrom, joinLocaleLines, type ComposedBriefingCard } from '@/lib/ops/seating/cards/types';
import {
  DIETARY_FILTER_TAGS,
  isDietaryTag,
  type DietaryTag,
} from '@/lib/ops/dining/dietary';
import type { TourKind } from '@/lib/tour-room/tourKind';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

/** The storable chips, derived from the shared vocabulary (kids is derived). */
export const LUNCH_INTAKE_TAGS: readonly DietaryTag[] = DIETARY_FILTER_TAGS.filter(isDietaryTag);

/** The `metadata` contract of a `briefing_lunch` message row. */
export interface BriefingLunchMeta {
  kind: 'briefing_lunch';
  /** tours.lunch_included — drives which of the two opening lines was sent. */
  lunch_included: boolean;
  /** Tags already on file when the card was composed (chips pre-selected). */
  dietary: string[];
  tour_date?: string | null;
  /** §11.D D3 — which wording shape was sent ('join' | 'private'). */
  tour_kind?: TourKind;
  [key: string]: unknown;
}

const LUNCH_HEADER: Record<RoomLocale, string> = {
  en: 'About lunch 🍜',
  ko: '점심 안내 🍜',
  ja: '昼食のご案内 🍜',
  es: 'Sobre el almuerzo 🍜',
  zh: '午餐说明 🍜',
  fr: 'À propos du déjeuner 🍜',
  de: 'Zum Mittagessen 🍜',
  ru: 'Об обеде 🍜',
  it: 'A proposito del pranzo 🍜',
};

const NOT_INCLUDED: Record<RoomLocale, string> = {
  en: 'Lunch is not included in the tour price — you choose your own place and pay there.',
  ko: '점심 식사는 투어 요금에 포함되어 있지 않아요 — 원하시는 곳에서 각자 결제하시면 됩니다.',
  ja: '昼食はツアー料金に含まれていません — お好きなお店で各自お支払いください。',
  es: 'El almuerzo no está incluido en el precio: eligen ustedes el sitio y pagan allí.',
  zh: '午餐不含在行程费用内 — 由您自行选择餐厅并现场付款。',
  fr: 'Le déjeuner n’est pas compris dans le prix du tour — vous choisissez votre restaurant et réglez sur place.',
  de: 'Das Mittagessen ist im Tourpreis nicht enthalten — Sie wählen selbst ein Lokal und zahlen dort.',
  ru: 'Обед не включен в стоимость тура — вы сами выбираете место и оплачиваете на месте.',
  it: 'Il pranzo non è incluso nel prezzo del tour — scegli tu il posto e paghi lì.',
};

/**
 * §11.D D3 — the ONE kind-dependent line: who walks you to the restaurant.
 * A private charter has no field staff, so "the staff will take you" names
 * somebody who is not there. Every other line (not-included, the picks promise,
 * the intake prompt) is identical for both kinds and is not duplicated.
 */
const INCLUDED: Record<TourKind, Record<RoomLocale, string>> = {
  join: {
    en: 'Lunch is included today — the staff will take you to the restaurant.',
    ko: '오늘은 점심이 포함되어 있어요 — 스태프가 식당으로 안내해 드립니다.',
    ja: '本日は昼食が含まれています — スタッフがレストランへご案内します。',
    es: 'El almuerzo está incluido hoy: el personal les llevará al restaurante.',
    zh: '今天含午餐 — 工作人员会带您前往餐厅。',
    fr: 'Le déjeuner est compris aujourd’hui — l’équipe vous accompagnera au restaurant.',
    de: 'Heute ist das Mittagessen inklusive — das Team bringt Sie zum Restaurant.',
    ru: 'Сегодня обед включен — сотрудники проводят вас в ресторан.',
    it: 'Oggi il pranzo è incluso — lo staff ti accompagnerà al ristorante.',
  },
  private: {
    en: 'Lunch is included today — your driver will take you to the restaurant.',
    ko: '오늘은 점심이 포함되어 있어요 — 기사님이 식당으로 안내해 드립니다.',
    ja: '本日は昼食が含まれています — ドライバーがレストランへご案内します。',
    es: 'El almuerzo está incluido hoy: su conductor les llevará al restaurante.',
    zh: '今天含午餐 — 司机会带您前往餐厅。',
    fr: 'Le déjeuner est compris aujourd’hui — votre chauffeur vous accompagnera au restaurant.',
    de: 'Heute ist das Mittagessen inklusive — Ihr Fahrer bringt Sie zum Restaurant.',
    ru: 'Сегодня обед включен — водитель проводит вас в ресторан.',
    it: 'Oggi il pranzo è incluso — il tuo autista ti accompagnerà al ristorante.',
  },
};

const PICKS: Record<RoomLocale, string> = {
  en: 'Near the lunch stop we will send restaurant picks in your language, with walking time and a map link.',
  ko: '점심 장소 근처에서는 도보 시간·지도 링크와 함께 식당 추천을 여러분의 언어로 보내드릴게요.',
  ja: 'ランチスポット付近では、徒歩時間と地図リンク付きのおすすめ店をご自身の言語でお送りします。',
  es: 'Cerca de la parada de comida les enviaremos sugerencias de restaurantes en su idioma, con tiempo a pie y enlace al mapa.',
  zh: '在午餐地点附近，我们会用您的语言发送餐厅推荐，附步行时间与地图链接。',
  fr: 'Près de la pause déjeuner, nous vous enverrons des suggestions de restaurants dans votre langue, avec le temps de marche et un lien vers la carte.',
  de: 'In der Nähe des Mittagsstopps schicken wir Ihnen Restaurantvorschläge in Ihrer Sprache — mit Gehzeit und Kartenlink.',
  ru: 'Рядом с местом обеда мы пришлем подборку ресторанов на вашем языке — с временем пешком и ссылкой на карту.',
  it: 'Vicino alla tappa del pranzo ti invieremo qualche ristorante consigliato nella tua lingua, con tempo a piedi e link alla mappa.',
};

const INTAKE_PROMPT: Record<RoomLocale, string> = {
  en: 'Any dietary needs? Tap them below — every restaurant suggestion today will take them into account.',
  ko: '식단 관련 요청이 있으신가요? 아래에서 눌러주시면 오늘의 모든 식당 추천에 반영됩니다.',
  ja: '食事制限はありますか？下からタップいただくと、本日のお店の提案すべてに反映されます。',
  es: '¿Alguna necesidad alimentaria? Márquenla abajo y la tendremos en cuenta en todas las sugerencias de hoy.',
  zh: '有饮食方面的需要吗？在下方点选，今天所有餐厅推荐都会据此调整。',
  fr: 'Des restrictions alimentaires? Indiquez-les ci-dessous — toutes les suggestions de restaurants d’aujourd’hui en tiendront compte.',
  de: 'Besondere Ernährungswünsche? Einfach unten antippen — alle heutigen Restaurantvorschläge berücksichtigen sie.',
  ru: 'Есть пожелания по питанию? Отметьте их ниже — все сегодняшние рекомендации ресторанов будут их учитывать.',
  it: 'Esigenze alimentari? Toccale qui sotto — ne terremo conto in tutti i ristoranti consigliati oggi.',
};

/** Card chrome — the 5-locale labels the guest component renders. */
export const LUNCH_COPY: Record<
  RoomLocale,
  { title: string; intake: string; saved: string; failed: string; none: string; hint: string }
> = {
  en: {
    title: 'Lunch',
    intake: 'Dietary needs',
    saved: 'Saved — your picks will respect this',
    failed: "Couldn't save — tap again",
    none: 'No restrictions',
    hint: 'You can change this any time.',
  },
  ko: {
    title: '점심 안내',
    intake: '식단 요청',
    saved: '저장됐어요 — 추천에 반영됩니다',
    failed: '저장하지 못했어요 — 다시 눌러주세요',
    none: '제한 없음',
    hint: '언제든지 바꾸실 수 있어요.',
  },
  ja: {
    title: '昼食',
    intake: '食事制限',
    saved: '保存しました — おすすめに反映されます',
    failed: '保存できませんでした — もう一度お試しください',
    none: '制限なし',
    hint: 'いつでも変更できます。',
  },
  es: {
    title: 'Almuerzo',
    intake: 'Necesidades alimentarias',
    saved: 'Guardado: lo tendremos en cuenta',
    failed: 'No se pudo guardar: inténtalo otra vez',
    none: 'Sin restricciones',
    hint: 'Puedes cambiarlo cuando quieras.',
  },
  zh: {
    title: '午餐',
    intake: '饮食需求',
    saved: '已保存 — 推荐将据此调整',
    failed: '保存失败 — 请再试一次',
    none: '无限制',
    hint: '随时可以修改。',
  },
  fr: {
    title: 'Déjeuner',
    intake: 'Restrictions alimentaires',
    saved: 'Enregistré — vos suggestions en tiendront compte',
    failed: 'Échec de l’enregistrement — réessayez',
    none: 'Aucune restriction',
    hint: 'Vous pouvez modifier cela à tout moment.',
  },
  de: {
    title: 'Mittagessen',
    intake: 'Ernährungswünsche',
    saved: 'Gespeichert — wird bei den Vorschlägen berücksichtigt',
    failed: 'Speichern fehlgeschlagen — bitte erneut antippen',
    none: 'Keine Einschränkungen',
    hint: 'Sie können das jederzeit ändern.',
  },
  ru: {
    title: 'Обед',
    intake: 'Пожелания по питанию',
    saved: 'Сохранено — учтем в рекомендациях',
    failed: 'Не удалось сохранить — нажмите еще раз',
    none: 'Без ограничений',
    hint: 'Это можно изменить в любой момент.',
  },
  it: {
    title: 'Pranzo',
    intake: 'Esigenze alimentari',
    saved: 'Salvato — ne terremo conto nei consigli',
    failed: 'Salvataggio non riuscito — riprova',
    none: 'Nessuna restrizione',
    hint: 'Puoi cambiarlo quando vuoi.',
  },
};

export interface ComposeLunchArgs {
  lunchIncluded: boolean;
  /** Tags already stored for this booking (chips render pre-selected). */
  dietary?: readonly string[];
  tourDate?: string | null;
  /** §11.D D3 — defaults to 'join' (the shipped wording). */
  tourKind?: TourKind;
}

export function composeLunchTranslations(args: ComposeLunchArgs): Record<RoomLocale, string> {
  return joinLocaleLines([
    LUNCH_HEADER,
    args.lunchIncluded ? INCLUDED[args.tourKind ?? 'join'] : NOT_INCLUDED,
    PICKS,
    INTAKE_PROMPT,
  ]);
}

export function composeLunch(args: ComposeLunchArgs): ComposedBriefingCard {
  const meta: BriefingLunchMeta = {
    kind: 'briefing_lunch',
    lunch_included: Boolean(args.lunchIncluded),
    dietary: (args.dietary ?? []).filter(isDietaryTag),
    tour_date: args.tourDate ?? null,
    tour_kind: args.tourKind ?? 'join',
  };
  return capsuleFrom(composeLunchTranslations(args), meta as unknown as Record<string, unknown>);
}
