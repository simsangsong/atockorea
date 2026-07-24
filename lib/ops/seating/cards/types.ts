/**
 * Shared shapes for the C-16 start-briefing card stack (plan §5.4).
 *
 * Pure and client-safe: the card components import the COPY constants and the
 * metadata types from the same modules the server composes with, so the
 * metadata contract cannot drift between sender and renderer (the arrivalBundle
 * pattern).
 *
 * 🔴 Nothing under lib/ops/seating/cards/ may import a server module
 * (node:*, sharp, supabase). These files ship inside the client bundle.
 */

import { ROOM_LOCALES, type RoomLocale } from '@/lib/tour-room/snapshot';

/** Exactly what a `tour_room_messages` insert needs, plus its metadata. */
export interface ComposedBriefingCard {
  source_locale: string;
  source_text: string;
  translations: Record<string, string>;
  metadata: Record<string, unknown>;
}

/** A 5-locale line block folded into one string per locale. */
export function joinLocaleLines(
  lines: ReadonlyArray<Record<RoomLocale, string>>,
): Record<RoomLocale, string> {
  const out = {} as Record<RoomLocale, string>;
  for (const locale of ROOM_LOCALES) {
    out[locale] = lines.map((line) => line[locale]).join('\n');
  }
  return out;
}

/** `translations` → the capsule envelope every briefing card ships with. */
export function capsuleFrom(
  translations: Record<RoomLocale, string>,
  metadata: Record<string, unknown>,
): ComposedBriefingCard {
  return {
    source_locale: 'en',
    source_text: translations.en,
    translations: { ...translations },
    metadata,
  };
}
