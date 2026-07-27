'use client';

/**
 * U-D9 (2026-07-27) — the ops console no longer owns a theme store.
 *
 * It used to persist its own `tour_ops_theme`, which meant the same person
 * moving between the guide console and the 관제센터 got two different answers
 * about their own preference. Both now read the shared device store
 * (`useTourRoomSettings`), and all that survives here is the one-shot
 * migration of the retired keys.
 *
 * Migration rule: adopt the stored ops preference only when the shared store
 * is still on its default ('system'). Someone who explicitly chose light or
 * dark in the smart app has already said what they want — an ops key set
 * weeks ago must not overrule it.
 */

/** Retired. Kept only so the migration can find and clear it. */
export const OPS_THEME_KEY = 'tour_ops_theme';
/** Pre-unification key (the room manager shipped its own toggle first). */
const LEGACY_ROOM_KEY = 'tour_ops_room_theme';
const SETTINGS_KEY = 'tour_mode_settings';

/**
 * Returns the theme to adopt, or null when there is nothing to migrate.
 * Always clears the retired keys, so this is a no-op from the second call on.
 */
export function migrateLegacyOpsTheme(): 'light' | 'dark' | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored =
      window.localStorage.getItem(OPS_THEME_KEY) ?? window.localStorage.getItem(LEGACY_ROOM_KEY);
    window.localStorage.removeItem(OPS_THEME_KEY);
    window.localStorage.removeItem(LEGACY_ROOM_KEY);
    if (stored !== 'dark' && stored !== 'light') return null;

    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { theme?: string };
      if (parsed?.theme === 'light' || parsed?.theme === 'dark') return null;
    }
    return stored;
  } catch {
    return null;
  }
}
