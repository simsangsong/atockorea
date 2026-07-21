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

export const GUEST_SIGNAL_TYPES = [
  'running_late',
  'rest_stop',
  'lost',
  'rally_overdue',
  'lost_item',
  'pickup_request',
  'dropoff_change',
] as const;
export type GuestSignalType = (typeof GUEST_SIGNAL_TYPES)[number];

/** lost_me pins auto-expire (§C-7 — one-shot location, never tracking). */
export const LOST_PIN_TTL_MS = 30 * 60 * 1000;

interface SignalArgs {
  name?: string;
  mapsUrl?: string;
  /** A3 dropoff_change — the guest's typed place (translated by the route). */
  note?: string;
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
  lost_item: ({ name, note }) => ({
    en: `🧳 Lost-item report from ${name ?? 'a guest'}${note ? ` — "${note}"` : ' — something may have been left in the vehicle'}. Please check and reply here.`,
    ko: `🧳 ${name ?? '손님'}의 분실물 신고${note ? ` — "${note}"` : ' — 차량에 물건을 두고 내렸을 수 있어요'}. 확인 후 여기에 답장해 주세요.`,
    ja: `🧳 ${name ?? 'ゲスト'}より忘れ物のご連絡${note ? `——「${note}」` : ' — 車内に忘れ物があるかもしれません'}。ご確認のうえこちらへご返信ください。`,
    es: `🧳 Aviso de objeto perdido de ${name ?? 'un huésped'}${note ? `: "${note}"` : ': puede haber quedado algo en el vehículo'}. Revísalo y responde aquí.`,
    zh: `🧳 ${name ?? '客人'}的失物报告${note ? `——「${note}」` : '——可能有物品落在车上'}。请确认后在此回复。`,
  }),
  pickup_request: ({ name, mapsUrl }) => ({
    en: `🚕 ${name ?? 'A guest'} asks to be picked up here${mapsUrl ? ` — location: ${mapsUrl}` : ' — please check in the chat.'}`,
    ko: `🚕 ${name ?? '손님'}이 이 위치로 픽업을 요청했어요${mapsUrl ? ` — 위치: ${mapsUrl}` : ' — 채팅으로 확인해 주세요.'}`,
    ja: `🚕 ${name ?? 'ゲスト'}がこの場所への迎車を希望しています${mapsUrl ? ` — 位置: ${mapsUrl}` : ' — チャットでご確認ください。'}`,
    es: `🚕 ${name ?? 'Un huésped'} pide que lo recojan aquí${mapsUrl ? `; ubicación: ${mapsUrl}` : '; revisa el chat.'}`,
    zh: `🚕 ${name ?? '客人'}请求在此处接载${mapsUrl ? `——位置：${mapsUrl}` : '——请在聊天中确认。'}`,
  }),
  dropoff_change: ({ name, mapsUrl, note }) => ({
    en: `📍 ${name ?? 'A guest'} requests a different drop-off point${note ? `: ${note}` : ''}.${mapsUrl ? ` Location: ${mapsUrl}` : ''}`,
    ko: `📍 ${name ?? '손님'}이 드랍 지점 변경을 요청했어요${note ? `: ${note}` : ''}.${mapsUrl ? ` 위치: ${mapsUrl}` : ''}`,
    ja: `📍 ${name ?? 'ゲスト'}が降車地点の変更を希望しています${note ? `：${note}` : ''}。${mapsUrl ? ` 位置: ${mapsUrl}` : ''}`,
    es: `📍 ${name ?? 'Un huésped'} solicita otro punto de bajada${note ? `: ${note}` : ''}.${mapsUrl ? ` Ubicación: ${mapsUrl}` : ''}`,
    zh: `📍 ${name ?? '客人'}请求更改下车地点${note ? `：${note}` : ''}。${mapsUrl ? ` 位置：${mapsUrl}` : ''}`,
  }),
  rally_overdue: () => ({
    en: '⏰ Meeting time has passed — part of the party hasn’t returned yet. The guide is checking.',
    ko: '⏰ 집합 시간이 지났어요 — 아직 복귀하지 않은 일행이 있어요. 가이드가 확인 중이에요.',
    ja: '⏰ 集合時間を過ぎました — まだ戻っていない方がいます。ガイドが確認しています。',
    es: '⏰ Pasó la hora de reunión y parte del grupo no ha vuelto. El guía lo está verificando.',
    zh: '⏰ 已过集合时间——还有同行者未返回。导游正在确认。',
  }),
};

export function renderGuestSignal(
  type: GuestSignalType,
  args: SignalArgs = {},
  /** T2-2 — per-locale translated note (verbatim fallback when absent). */
  noteByLocale?: Record<string, string> | null,
): Bundle {
  let translations = TEMPLATES[type](args);
  if (noteByLocale) {
    translations = Object.fromEntries(
      Object.keys(translations).map((locale) => [
        locale,
        TEMPLATES[type]({ ...args, note: noteByLocale[locale] ?? args.note })[locale as keyof typeof translations] as string,
      ]),
    ) as Record<string, string>;
  }
  return { source_locale: 'en', source_text: translations.en, translations };
}
