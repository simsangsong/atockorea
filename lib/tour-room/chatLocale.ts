/**
 * Language-agnostic chat bridge helpers (사용자 확정 2026-07-18).
 *
 * The room UI stays on the 5 room locales, but the LIVE CHAT plane is
 * language-agnostic: whatever language a guest writes in is detected by the
 * translation router, remembered per participant (chat_locale), unioned into
 * every fan-out's translation targets, and preferred when rendering incoming
 * bubbles for that guest. POI/tour content capsules (spot arrivals, notices,
 * signals, LEDGER) keep their fixed room-locale bundles — those never carry
 * arbitrary-language variants, so the display preference falls through to the
 * folded room locale for them.
 */

import type { RoomMessage } from '@/hooks/useTourRoomChannel';

/** Hard cap on fan-out translation targets (cost guard for polyglot rooms). */
export const MAX_TRANSLATION_TARGETS = 8;

/**
 * 'fr-FR' → 'fr'; rejects 'und', empty, and non-alpha junk. Base codes only —
 * the translation router treats them as language names, not region variants.
 */
export function normalizeChatLocale(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const base = raw.trim().toLowerCase().split(/[-_]/)[0];
  if (!/^[a-z]{2,3}$/.test(base) || base === 'und') return null;
  return base;
}

/**
 * Union of the room-locale targets and the raw detected chat locales,
 * capped. Room locales come first so a cap never drops the UI languages.
 */
export function mergeTranslationTargets(
  roomLocales: string[],
  chatLocales: Array<string | null | undefined>,
): string[] {
  const merged = new Set<string>(roomLocales.filter(Boolean));
  for (const raw of chatLocales) {
    const normalized = normalizeChatLocale(raw);
    if (normalized) merged.add(normalized);
  }
  return [...merged].slice(0, MAX_TRANSLATION_TARGETS);
}

/**
 * The viewer's live chat language, derived from the message stream: the
 * newest PLAIN chat message a customer sent (presets/system capsules carry
 * fixed-locale text and say nothing about what the party actually speaks).
 * Falls back to the participant row's remembered chat_locale.
 */
export function deriveChatLocale(
  messages: RoomMessage[],
  participantChatLocale?: unknown,
): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.sender_role !== 'customer') continue;
    if (message._local) continue; // optimistic rows have no detection yet
    if ((message.metadata as { kind?: string } | null | undefined)?.kind) continue;
    const normalized = normalizeChatLocale((message as { source_locale?: unknown }).source_locale);
    if (normalized) return normalized;
  }
  return normalizeChatLocale(participantChatLocale);
}
