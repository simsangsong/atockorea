/**
 * Welcome-coupon popup visibility + client-side suppression keys.
 *
 * Follows the `lib/itinerary-builder/builder-visibility.ts` single-flag
 * pattern: flip `WELCOME_POPUP_ENABLED` to hide/show the signup popup
 * everywhere without touching the component tree.
 *
 * NOTE the popup flag is independent of the coupon itself — grants/discounts
 * are controlled by `promo_codes.is_active` (WELCOME10) in the DB. Popup off +
 * code active still auto-applies for already-granted users.
 */
export const WELCOME_POPUP_ENABLED = true;

/** Days to stay quiet after the visitor dismisses the popup (§6.3). */
export const WELCOME_DISMISS_SNOOZE_DAYS = 7;

/** localStorage — epoch ms of the last dismissal. */
export const WELCOME_DISMISSED_AT_KEY = 'atoc_welcome_dismissed_at';
/** localStorage — set once the visitor completed the OTP and got the grant. */
export const WELCOME_CLAIMED_KEY = 'atoc_welcome_claimed';
/** sessionStorage — the popup already showed this browser session (max 1/session). */
export const WELCOME_SESSION_SHOWN_KEY = 'atoc_welcome_shown';

/** Trigger tuning (§6.3): first of 5s delay OR 30% scroll; desktop adds exit-intent. */
export const WELCOME_TRIGGER_DELAY_MS = 5000;
export const WELCOME_TRIGGER_SCROLL_RATIO = 0.3;
