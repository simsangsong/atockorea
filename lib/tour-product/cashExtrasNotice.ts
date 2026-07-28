/**
 * L1 — the sentence the listings never said.
 *
 * The smart app can create a real cash charge during a tour: `/extend` (hourly
 * time extension) and `/extras` (the in-tour ledger the guide records and the
 * guest settles in cash). Neither appeared in any listing copy — "what's not
 * included" stopped at meals, entrance fees and gratuities.
 *
 * 🔴 And this is not a precaution. `/extend` is gated on `tours.price_type ===
 * 'vehicle'`, and every live booking on a vehicle-charter product came from an
 * OTA — GetYourGuide 3, Klook 2, Viator 1, one test, direct sales ZERO
 * (§M-2, live query 2026-07-28). The entire population that can use the feature
 * is the population that was never told about it.
 *
 * Optional on-the-day payment is generally allowed; undisclosed on-the-day
 * payment is what draws a question in review. So this is one sentence, and the
 * only interesting decision is where it comes from: NOT hand-copied into five
 * products × six locales, because the second copy of a list in this repo has
 * never stayed in sync (§8 lesson 3). One constant, rendered wherever the app
 * can actually bill.
 */
import type { TourProductPageLocale } from '@/lib/tour-product/tourProductPageLocale';
// 🔴 Type-only. `snapshot` reaches the database, and this module renders inside
// listing pages — a value import here is the bundle leak this repo has already
// shipped once. `import type` is erased, so the key set is enforced by tsc with
// no runtime edge at all.
import type { RoomLocale } from '@/lib/tour-room/snapshot';

/**
 * Deliberately says three things: that add-ons are OPTIONAL (nothing is
 * compulsory), that payment is in CASH (so guests carry some), and that it goes
 * to the GUIDE ON THE DAY (not to us, not later).
 *
 * L2 widened this from the six listing locales to all ten room locales. The
 * booking confirmation and the voucher speak the guest's room language, and a
 * German guest reading the sentence in English is the same failure as not
 * having written it — quieter, and therefore worse. One constant still, which
 * was the point of L1: a second copy of a list in this repo has never stayed
 * in sync.
 */
export const CASH_EXTRAS_NOTICE: Record<RoomLocale, string> = {
  en: 'Not included: optional add-ons and time extensions arranged during the tour — these are paid in cash to your guide on the day.',
  ko: '불포함: 투어 중에 요청하시는 선택 옵션과 시간 연장 — 당일 현장에서 가이드에게 현금으로 결제하십니다.',
  ja: '含まれないもの: ツアー中にご希望いただくオプションおよび延長料金 — 当日、現地でガイドに現金でお支払いいただきます。',
  zh: '不包含：行程中另行选择的附加项目与延长时间费用 — 当天现场以现金支付给导游。',
  'zh-TW': '不包含：行程中另行選擇的附加項目與延長時間費用 — 當天現場以現金支付給導遊。',
  es: 'No incluye: los extras opcionales y las ampliaciones de horario solicitados durante el tour — se pagan en efectivo al guía el mismo día.',
  fr: "Non inclus : les options facultatives et les prolongations demandées pendant le tour — elles se règlent en espèces auprès de votre guide le jour même.",
  de: 'Nicht enthalten: optionale Zusatzleistungen und Verlängerungen, die während der Tour vereinbart werden — diese zahlen Sie am selben Tag bar an Ihre Reiseleitung.',
  ru: 'Не включено: дополнительные опции и продление времени, оформленные во время тура, — оплачиваются наличными гиду в тот же день.',
  it: 'Non incluso: le opzioni facoltative e le estensioni di orario richieste durante il tour — si pagano in contanti alla guida il giorno stesso.',
};

/**
 * The notice for a product, or null when the product cannot generate one of
 * these charges.
 *
 * The condition mirrors `/extend`'s own gate (`price_type === 'vehicle'`)
 * rather than restating it, so the listing promise and the code that bills
 * cannot drift apart. If extras are ever opened to per-person tours, this is the
 * one place that has to change with it.
 */
export function cashExtrasNoticeFor(
  priceType: string | null | undefined,
  locale: RoomLocale | TourProductPageLocale,
): string | null {
  if (priceType !== 'vehicle') return null;
  return CASH_EXTRAS_NOTICE[locale] ?? CASH_EXTRAS_NOTICE.en;
}
