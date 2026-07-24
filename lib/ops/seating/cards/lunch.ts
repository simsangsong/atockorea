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
  [key: string]: unknown;
}

const LUNCH_HEADER: Record<RoomLocale, string> = {
  en: 'About lunch 🍜',
  ko: '점심 안내 🍜',
  ja: '昼食のご案内 🍜',
  es: 'Sobre el almuerzo 🍜',
  zh: '午餐说明 🍜',
};

const NOT_INCLUDED: Record<RoomLocale, string> = {
  en: 'Lunch is not included in the tour price — you choose your own place and pay there.',
  ko: '점심 식사는 투어 요금에 포함되어 있지 않아요 — 원하시는 곳에서 각자 결제하시면 됩니다.',
  ja: '昼食はツアー料金に含まれていません — お好きなお店で各自お支払いください。',
  es: 'El almuerzo no está incluido en el precio: eligen ustedes el sitio y pagan allí.',
  zh: '午餐不含在行程费用内 — 由您自行选择餐厅并现场付款。',
};

const INCLUDED: Record<RoomLocale, string> = {
  en: 'Lunch is included today — the staff will take you to the restaurant.',
  ko: '오늘은 점심이 포함되어 있어요 — 스태프가 식당으로 안내해 드립니다.',
  ja: '本日は昼食が含まれています — スタッフがレストランへご案内します。',
  es: 'El almuerzo está incluido hoy: el personal les llevará al restaurante.',
  zh: '今天含午餐 — 工作人员会带您前往餐厅。',
};

const PICKS: Record<RoomLocale, string> = {
  en: 'Near the lunch stop we will send restaurant picks in your language, with walking time and a map link.',
  ko: '점심 장소 근처에서는 도보 시간·지도 링크와 함께 식당 추천을 여러분의 언어로 보내드릴게요.',
  ja: 'ランチスポット付近では、徒歩時間と地図リンク付きのおすすめ店をご自身の言語でお送りします。',
  es: 'Cerca de la parada de comida les enviaremos sugerencias de restaurantes en su idioma, con tiempo a pie y enlace al mapa.',
  zh: '在午餐地点附近，我们会用您的语言发送餐厅推荐，附步行时间与地图链接。',
};

const INTAKE_PROMPT: Record<RoomLocale, string> = {
  en: 'Any dietary needs? Tap them below — every restaurant suggestion today will take them into account.',
  ko: '식단 관련 요청이 있으신가요? 아래에서 눌러주시면 오늘의 모든 식당 추천에 반영됩니다.',
  ja: '食事制限はありますか？下からタップいただくと、本日のお店の提案すべてに反映されます。',
  es: '¿Alguna necesidad alimentaria? Márquenla abajo y la tendremos en cuenta en todas las sugerencias de hoy.',
  zh: '有饮食方面的需要吗？在下方点选，今天所有餐厅推荐都会据此调整。',
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
};

export interface ComposeLunchArgs {
  lunchIncluded: boolean;
  /** Tags already stored for this booking (chips render pre-selected). */
  dietary?: readonly string[];
  tourDate?: string | null;
}

export function composeLunchTranslations(args: ComposeLunchArgs): Record<RoomLocale, string> {
  return joinLocaleLines([
    LUNCH_HEADER,
    args.lunchIncluded ? INCLUDED : NOT_INCLUDED,
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
  };
  return capsuleFrom(composeLunchTranslations(args), meta as unknown as Record<string, unknown>);
}
