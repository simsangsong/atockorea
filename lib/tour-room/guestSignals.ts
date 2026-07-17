/**
 * W2.4 — guest one-tap signals (SIGNAL primitive, §D): fixed 5-locale
 * templates, zero LLM — the customer counterpart of driverSignals.ts.
 *
 *   running_late  — B6: "we're late to pickup / to the rally point"
 *   rest_stop     — C2: "please stop soon" (guide + driver both see it)
 *   lost          — E3: "I'm lost" + optional one-shot lost_me pin (TTL 30min)
 *   rally_overdue — E2 ladder side-effect: the T+5 crossing, fired once per
 *                   notice via the events UNIQUE dedupe (P-D6)
 */

export const GUEST_SIGNAL_TYPES = ['running_late', 'rest_stop', 'lost', 'rally_overdue', 'lost_item'] as const;
export type GuestSignalType = (typeof GUEST_SIGNAL_TYPES)[number];

/** lost_me pins auto-expire (§C-7 — one-shot location, never tracking). */
export const LOST_PIN_TTL_MS = 30 * 60 * 1000;

interface SignalArgs {
  name?: string;
  mapsUrl?: string;
}

type Bundle = { source_locale: string; source_text: string; translations: Record<string, string> };

const TEMPLATES: Record<GuestSignalType, (args: SignalArgs) => Record<string, string>> = {
  running_late: ({ name }) => ({
    en: `🕒 ${name ?? 'A guest'} is running a little late — thanks for waiting.`,
    ko: `🕒 ${name ?? '손님'}이 조금 늦고 있어요 — 조금만 기다려 주세요.`,
    ja: `🕒 ${name ?? 'ゲスト'}が少し遅れています — 少々お待ちください。`,
    es: `🕒 ${name ?? 'Un huésped'} llega un poco tarde; gracias por esperar.`,
    zh: `🕒 ${name ?? '客人'}稍有延迟——请稍候。`,
  }),
  rest_stop: ({ name }) => ({
    en: `🚻 ${name ?? 'A guest'} asked for a quick stop when convenient.`,
    ko: `🚻 ${name ?? '손님'}이 잠깐 정차를 요청했어요 — 가까운 곳에서 부탁드려요.`,
    ja: `🚻 ${name ?? 'ゲスト'}が短い休憩を希望しています — 都合の良い場所でお願いします。`,
    es: `🚻 ${name ?? 'Un huésped'} pidió una parada corta cuando sea posible.`,
    zh: `🚻 ${name ?? '客人'}请求方便时短暂停车。`,
  }),
  lost: ({ name, mapsUrl }) => ({
    en: `🧭 ${name ?? 'A guest'} may be lost${mapsUrl ? ` — location: ${mapsUrl}` : ' — please check in the chat.'}`,
    ko: `🧭 ${name ?? '손님'}이 길을 잃은 것 같아요${mapsUrl ? ` — 위치: ${mapsUrl}` : ' — 채팅으로 확인해 주세요.'}`,
    ja: `🧭 ${name ?? 'ゲスト'}が道に迷ったようです${mapsUrl ? ` — 位置: ${mapsUrl}` : ' — チャットでご確認ください。'}`,
    es: `🧭 ${name ?? 'Un huésped'} puede estar perdido${mapsUrl ? `; ubicación: ${mapsUrl}` : '; revisa el chat.'}`,
    zh: `🧭 ${name ?? '客人'}可能迷路了${mapsUrl ? `——位置：${mapsUrl}` : '——请在聊天中确认。'}`,
  }),
  lost_item: ({ name }) => ({
    en: `🧳 Lost-item report from ${name ?? 'a guest'} — something may have been left in the vehicle. Please check and reply here.`,
    ko: `🧳 ${name ?? '손님'}의 분실물 신고 — 차량에 물건을 두고 내렸을 수 있어요. 확인 후 여기에 답장해 주세요.`,
    ja: `🧳 ${name ?? 'ゲスト'}より忘れ物のご連絡 — 車内に忘れ物があるかもしれません。ご確認のうえこちらへご返信ください。`,
    es: `🧳 Aviso de objeto perdido de ${name ?? 'un huésped'}: puede haber quedado algo en el vehículo. Revísalo y responde aquí.`,
    zh: `🧳 ${name ?? '客人'}的失物报告——可能有物品落在车上。请确认后在此回复。`,
  }),
  rally_overdue: () => ({
    en: '⏰ Meeting time has passed — part of the party hasn’t returned yet. The guide is checking.',
    ko: '⏰ 집합 시간이 지났어요 — 아직 복귀하지 않은 일행이 있어요. 가이드가 확인 중이에요.',
    ja: '⏰ 集合時間を過ぎました — まだ戻っていない方がいます。ガイドが確認しています。',
    es: '⏰ Pasó la hora de reunión y parte del grupo no ha vuelto. El guía lo está verificando.',
    zh: '⏰ 已过集合时间——还有同行者未返回。导游正在确认。',
  }),
};

export function renderGuestSignal(type: GuestSignalType, args: SignalArgs = {}): Bundle {
  const translations = TEMPLATES[type](args);
  return { source_locale: 'en', source_text: translations.en, translations };
}
