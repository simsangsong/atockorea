/**
 * W2.4 — LEDGER capsule templates (P-D2: a transparency/record device, not a
 * payment rail — extras settle in cash to the guide on the day).
 *
 * Fixed 5-locale strings, zero LLM. The feed renders these capsules as the
 * interactive ExtraLedgerCard (guest [확인] on logged); the text here is the
 * fallback + notification surface.
 */

export const EXTRA_KINDS = ['advance', 'extension', 'parking', 'other'] as const;
export type ExtraKind = (typeof EXTRA_KINDS)[number];

export const EXTRA_ACTIONS = ['confirm', 'settle', 'void'] as const;
export type ExtraAction = (typeof EXTRA_ACTIONS)[number];

export type ExtraStatus = 'logged' | 'confirmed' | 'settled' | 'voided';

export function formatKrw(amount: number): string {
  return `₩${Math.max(0, Math.round(amount)).toLocaleString('en-US')}`;
}

type Bundle = { source_locale: string; source_text: string; translations: Record<string, string> };

const TEMPLATES: Record<ExtraStatus, (item: string, krw: string) => Record<string, string>> = {
  logged: (item, krw) => ({
    en: `💰 Expense logged: ${item} — ${krw}. Cash settlement with your guide today; please confirm.`,
    ko: `💰 지출 기록: ${item} — ${krw}. 당일 가이드에게 현금 정산해요 — 확인해 주세요.`,
    ja: `💰 立替を記録: ${item} — ${krw}。当日ガイドへ現金精算です — ご確認ください。`,
    es: `💰 Gasto registrado: ${item} — ${krw}. Se liquida hoy en efectivo con tu guía; confírmalo.`,
    zh: `💰 已记录费用:${item} — ${krw}。当日与导游现金结算——请确认。`,
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

export function renderExtraCapsule(status: ExtraStatus, item: string, amountKrw: number): Bundle {
  const translations = TEMPLATES[status](item, formatKrw(amountKrw));
  return { source_locale: 'en', source_text: translations.en, translations };
}

/** Which transition may which role perform? (G1/G2 flow, §C-3 extra machine) */
export function allowedExtraTransition(
  action: ExtraAction,
  role: string,
  currentStatus: string,
): ExtraStatus | null {
  if (action === 'confirm') {
    return role === 'customer' && currentStatus === 'logged' ? 'confirmed' : null;
  }
  if (action === 'settle') {
    return (role === 'guide' || role === 'admin') && (currentStatus === 'logged' || currentStatus === 'confirmed')
      ? 'settled'
      : null;
  }
  if (action === 'void') {
    return (role === 'guide' || role === 'admin') && currentStatus !== 'settled' ? 'voided' : null;
  }
  return null;
}
