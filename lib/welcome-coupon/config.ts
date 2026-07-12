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
 *
 * Suppression model (user decision 2026-07-12): the popup re-arms on EVERY
 * full page load unless the visitor ticks "don't show again today" before
 * closing — that stores today's local date under `WELCOME_HIDE_TODAY_KEY`
 * and quiets the popup until midnight. The earlier once-per-browser-session
 * key (`atoc_welcome_shown`) and 7-day dismissal snooze
 * (`atoc_welcome_dismissed_at`) were dropped; stale values of those keys are
 * simply ignored.
 */
export const WELCOME_POPUP_ENABLED = true;

/** localStorage — local date (YYYY-M-D) the visitor opted out for ("오늘 하루 보지 않기"). */
export const WELCOME_HIDE_TODAY_KEY = 'atoc_welcome_hide_today';
/** localStorage — set once the visitor completed the OTP and got the grant. */
export const WELCOME_CLAIMED_KEY = 'atoc_welcome_claimed';

/** Trigger tuning (§6.3): first of 5s delay OR 30% scroll; desktop adds exit-intent. */
export const WELCOME_TRIGGER_DELAY_MS = 5000;
export const WELCOME_TRIGGER_SCROLL_RATIO = 0.3;
