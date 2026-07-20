/**
 * W2.4 — LEDGER capsule templates (P-D2: a transparency/record device, not a
 * payment rail — extras settle in cash to the guide on the day).
 *
 * Fixed 5-locale strings, zero LLM. The feed renders these capsules as the
 * interactive ExtraLedgerCard (guest [확인] on logged); the text here is the
 * fallback + notification surface.
 */

// Single source of truth for expense kinds (T1-5): the API whitelist, the SQL
// CHECK, and the cockpit picker all resolve here, so a new kind is never
// silently downgraded to 'other' by an out-of-sync consumer.
export const EXTRA_KINDS = ['advance', 'ticket', 'overtime', 'extension', 'parking', 'pickup', 'other'] as const;
export type ExtraKind = (typeof EXTRA_KINDS)[number];

/** Operator-facing Korean labels (cockpit + guide panel). */
export const EXTRA_KIND_LABELS: Record<ExtraKind, string> = {
  advance: '대납',
  ticket: '입장권',
  overtime: '초과근무',
  extension: '연장',
  parking: '주차',
  pickup: '픽업비',
  other: '기타',
};

export const EXTRA_ACTIONS = ['confirm', 'settle', 'void'] as const;
export type ExtraAction = (typeof EXTRA_ACTIONS)[number];

export type ExtraStatus = 'logged' | 'confirmed' | 'settled' | 'voided';

/** Who receives the cash for a given expense — the operator who advanced it. */
export type ExtraPayer = 'guide' | 'driver';

export function formatKrw(amount: number): string {
  return `₩${Math.max(0, Math.round(amount)).toLocaleString('en-US')}`;
}

type Bundle = { source_locale: string; source_text: string; translations: Record<string, string> };

/** The recipient noun per locale — a guide-less private tour settles to the
 *  driver directly, so the capsule must name the right person. */
const RECIPIENT: Record<ExtraPayer, Record<string, string>> = {
  guide: { en: 'your guide', ko: '가이드', ja: 'ガイド', es: 'tu guía', zh: '导游' },
  driver: { en: 'your driver', ko: '기사님', ja: 'ドライバー', es: 'tu conductor', zh: '司机' },
};

const TEMPLATES: Record<ExtraStatus, (item: string, krw: string, who: Record<string, string>) => Record<string, string>> = {
  logged: (item, krw, who) => ({
    en: `💰 Expense logged: ${item} — ${krw}. Cash settlement with ${who.en} today; please confirm.`,
    ko: `💰 지출 기록: ${item} — ${krw}. 당일 ${who.ko}에게 현금 정산해요 — 확인해 주세요.`,
    ja: `💰 立替を記録: ${item} — ${krw}。当日${who.ja}へ現金精算です — ご確認ください。`,
    es: `💰 Gasto registrado: ${item} — ${krw}. Se liquida hoy en efectivo con ${who.es}; confírmalo.`,
    zh: `💰 已记录费用:${item} — ${krw}。当日与${who.zh}现金结算——请确认。`,
  }),
  confirmed: (item, krw) => ({
    en: `✅ Confirmed: ${item} — ${krw}.`,
    ko: `✅ 확인 완료: ${item} — ${krw}.`,
    ja: `✅ 確認済み: ${item} — ${krw}。`,
    es: `✅ Confirmado: ${item} — ${krw}.`,
    zh: `✅ 已确认:${item} — ${krw}。`,
  }),
  settled: (item, krw) => ({
    en: `💵 Settled in cash: ${item} — ${krw}. Thank you!`,
    ko: `💵 현금 수취 완료: ${item} — ${krw}. 감사합니다!`,
    ja: `💵 現金受領済み: ${item} — ${krw}。ありがとうございました!`,
    es: `💵 Liquidado en efectivo: ${item} — ${krw}. ¡Gracias!`,
    zh: `💵 已现金结清:${item} — ${krw}。谢谢!`,
  }),
  voided: (item, krw) => ({
    en: `↩️ Cancelled: ${item} — ${krw}.`,
    ko: `↩️ 취소됨: ${item} — ${krw}.`,
    ja: `↩️ 取消: ${item} — ${krw}。`,
    es: `↩️ Cancelado: ${item} — ${krw}.`,
    zh: `↩️ 已取消:${item} — ${krw}。`,
  }),
};

export function renderExtraCapsule(
  status: ExtraStatus,
  item: string,
  amountKrw: number,
  payer: ExtraPayer = 'guide',
): Bundle {
  const who = RECIPIENT[payer === 'driver' ? 'driver' : 'guide'];
  const translations = TEMPLATES[status](item, formatKrw(amountKrw), who);
  return { source_locale: 'en', source_text: translations.en, translations };
}

/**
 * G4/G7 — the end-of-day settlement summary capsule: item lines + total +
 * "cash to your guide" + the global-card ATM hint (convenience-store ATMs
 * accept foreign cards). Fired by the guide from the ledger panel.
 */
export function renderSettlementSummary(
  rows: Array<{ item: string; amount_krw: number }>,
  totalKrw: number,
): Bundle {
  const lines = rows.slice(0, 6).map((r) => `${r.item} ${formatKrw(r.amount_krw)}`).join(' · ');
  const total = formatKrw(totalKrw);
  const translations = {
    en: `🧾 Today's expenses: ${lines} — total ${total}. Please settle in cash with your guide. Need cash? Convenience-store ATMs (GS25/CU) take global cards.`,
    ko: `🧾 오늘의 지출: ${lines} — 합계 ${total}. 가이드에게 현금으로 정산해 주세요. 현금이 필요하면 편의점 ATM(GS25/CU)에서 해외 카드 출금이 가능해요.`,
    ja: `🧾 本日の支出: ${lines} — 合計 ${total}。ガイドへ現金でご精算ください。現金が必要な場合はコンビニATM(GS25/CU)で海外カードが使えます。`,
    es: `🧾 Gastos de hoy: ${lines} — total ${total}. Liquida en efectivo con tu guía. ¿Necesitas efectivo? Los cajeros de tiendas (GS25/CU) aceptan tarjetas internacionales.`,
    zh: `🧾 今日支出:${lines} — 合计 ${total}。请与导游现金结算。需要现金?便利店ATM(GS25/CU)支持国际卡取现。`,
  };
  return { source_locale: 'en', source_text: translations.en, translations };
}

/**
 * Which transition may which role perform? (G1/G2 flow, §C-3 extra machine)
 *
 * T1-2: a driver may settle/void the expenses THEY advanced (payer='driver') —
 * the guide-less private tour where the guest hands the cash to the driver
 * directly. The guide/admin can still act on any row. `payer` is the row's
 * payer; omit it and only the operator (guide/admin) may settle/void.
 */
export function allowedExtraTransition(
  action: ExtraAction,
  role: string,
  currentStatus: string,
  payer?: string,
): ExtraStatus | null {
  if (action === 'confirm') {
    return role === 'customer' && currentStatus === 'logged' ? 'confirmed' : null;
  }
  const isOperator = role === 'guide' || role === 'admin';
  const isOwningDriver = role === 'driver' && payer === 'driver';
  if (action === 'settle') {
    if (currentStatus !== 'logged' && currentStatus !== 'confirmed') return null;
    return isOperator || isOwningDriver ? 'settled' : null;
  }
  if (action === 'void') {
    if (currentStatus === 'settled') return null;
    return isOperator || isOwningDriver ? 'voided' : null;
  }
  return null;
}
