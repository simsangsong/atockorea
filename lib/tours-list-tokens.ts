/**
 * Design tokens for the `/tours/list` (tour catalogue) page.
 *
 * The catalogue page is being re-positioned from "admin-style search form" to
 * "magazine directory" — these tokens encode the ivory + amber + upright-serif
 * family rules promised by `docs/tours-list-uiux-master-plan-2026-05-20.md`
 * (§5 디자인 토큰). NOTE: italic was banned across the catalogue per user
 * direction 2026-05-20 — see §B reversal row.
 *
 * Phase 0.2 of the list UI/UX upgrade. Adding/removing a token here requires a
 * §B reversal row in the master plan — these are binding decisions, not free
 * parameters.
 *
 * # Why TS constants instead of CSS variables
 *
 * - Tailwind utility composition stays first-class (the `border-amber-200/70`
 *   form is still authored as a Tailwind class; only the *role* is exported
 *   here so component code references `LIST_FIELD_CLS` instead of repeating
 *   the same long class string in 6 places).
 * - The values double as a contract: when Phase 2 swaps `h-8 text-[12px]`
 *   for `h-11 text-[13.5px]`, the change happens in ONE place, not in every
 *   `<select>` and `<input>` across the page.
 * - Anti-downgrade guard: a single grep against this file shows the current
 *   token surface. A `slate-200` regression in any consumer component is
 *   provable from this baseline.
 */

// ─── Surface (page + rail backgrounds) ──────────────────────────────────────

/** Page base. Replaces the current `bg-white`. Matches hub `/tours` ivory. */
export const LIST_PAGE_BG = '#faf8f3';

/** Sticky filter rail vertical gradient (warm ivory → slightly deeper ivory). */
export const LIST_RAIL_BG =
  'bg-[linear-gradient(180deg,#fdfcf8_0%,#faf9f4_100%)] backdrop-blur-md';

/** Rail bottom hairline. Replaces slate-200/55 — amber-100 keeps the warm family. */
export const LIST_RAIL_BORDER = 'border-b border-amber-100/70';

/** Warm drop shadow for rail / inserts / cards on rail surfaces. */
export const LIST_SHADOW_WARM =
  'shadow-[0_12px_32px_-20px_rgba(120,90,40,0.22)]';

// ─── Eyebrow / display typography (matches hub hero + tour-collection strip) ─

/**
 * Eyebrow class used everywhere a small uppercase amber label appears
 * (hero masthead, contextual band, results meta, editorial insert,
 * empty state intro, footer strip).
 */
export const LIST_EYEBROW_CLS =
  'text-[10.5px] font-bold uppercase tracking-[0.22em] text-amber-700/90';

/**
 * Upright-serif curator signature (with the short amber rule prefix).
 *
 * NOTE: italic is BANNED across the catalogue per user direction
 * 2026-05-20 — see §B reversal of the original italic-serif decision.
 * Premium tone now comes from upright serif + tracking restraint
 * (Kinfolk/Vogue-cover discipline rather than fashion-editorial italic).
 */
export const LIST_CURATOR_CLS =
  'inline-flex items-center gap-2 font-serif text-[11.5px] tracking-[0.02em] text-amber-700/80';

/** Short amber rule placed before curator signatures. */
export const LIST_CURATOR_RULE_CLS =
  'inline-block h-px w-6 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500';

/** Hero / insert display headline base (sans). Italic serif accent layered on top. */
export const LIST_DISPLAY_CLS =
  'font-bold leading-[1.04] tracking-[-0.03em]';

/**
 * Upright-serif accent inside the display headline (e.g., "hand-picked.").
 *
 * NOTE: italic banned per user direction 2026-05-20. Light upright serif
 * with tight tracking is the premium replacement (Vogue cover discipline).
 */
export const LIST_DISPLAY_ACCENT_CLS =
  'font-serif font-light tracking-[-0.005em]';

/** Gold-line eyebrow accent (gradient amber rule used before eyebrow text). */
export const LIST_ACCENT_LINE_CLS =
  'bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500';

// ─── Filter rail fields (Phase 2 replaces h-8/text-[12px]/slate-200 form-tool) ─

/**
 * Filter input / search class. h-11 (Phase 2 — currently h-8 across the page).
 *
 * Anti-downgrade gate (§10 rollback): if any consumer in components/tours-list/
 * uses `h-8` for a filter field, that's a B4 violation. The grep is:
 *   grep -E "h-8.*(border|bg-white|rounded)" components/tours-list/
 */
export const LIST_FIELD_CLS =
  'h-11 rounded-2xl border border-amber-200/70 bg-white/92 px-4 ' +
  'text-[13.5px] text-slate-900 outline-none transition ' +
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.96)] ' +
  'focus:border-amber-500/70 focus-visible:ring-2 focus-visible:ring-amber-500/30';

/** Pill-style select (destination chooser). */
export const LIST_SELECT_CLS =
  'h-11 cursor-pointer rounded-2xl border border-amber-200/70 bg-white/92 px-4 ' +
  'text-[13.5px] text-slate-900 outline-none transition ' +
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.96)] ' +
  'focus:border-amber-500/70 focus-visible:ring-2 focus-visible:ring-amber-500/30';

// ─── Chip system (filter chips + active-filter strip + segmented control) ───

/**
 * Active chip class — used for type chip selection, sort segmented active,
 * "More" filter expanded indicator, etc.
 *
 * Critical: this is `amber-900/95` background NOT `slate-900` — the slate
 * form-tool tone is what we're escaping. AP3 / B1 / B16.
 */
export const LIST_CHIP_ACTIVE_CLS =
  'inline-flex items-center rounded-full bg-amber-900/95 px-3 ' +
  'text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-50 ' +
  'shadow-[inset_0_-1px_0_rgba(0,0,0,0.18)] transition ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf8f3]';

/** Inactive chip class — ivory neutral with amber hairline border. */
export const LIST_CHIP_INACTIVE_CLS =
  'inline-flex items-center rounded-full border border-amber-200/70 ' +
  'bg-white/92 px-3 text-[11px] font-medium uppercase tracking-[0.12em] ' +
  'text-slate-700 transition hover:border-amber-300/80 hover:bg-white ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf8f3]';

/**
 * Active-filter dismissible chip (Phase 2.8 — `ActiveFilterStrip` consumer).
 * Distinct from chip-active above: this represents an already-applied filter
 * that the user can dismiss, not a control state.
 */
export const LIST_ACTIVE_FILTER_CHIP_CLS =
  'inline-flex items-center gap-1.5 rounded-full border border-amber-200/70 ' +
  'bg-amber-50 px-3 py-1 text-[11.5px] font-medium text-amber-900 ' +
  'transition hover:border-amber-300/80 hover:bg-amber-100/80';

/** "Clear all" link inside active filter strip. */
export const LIST_CLEAR_ALL_CLS =
  'text-[11.5px] font-semibold uppercase tracking-[0.12em] text-amber-700/90 ' +
  'underline-offset-4 hover:text-amber-900 hover:underline ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40';

// ─── Field metrics (atomic — for places where the full *_CLS isn't reusable) ─

/** Height token (currently h-11). Lives separately so chip variants can match. */
export const LIST_FIELD_HEIGHT = 'h-11';

/** Text size token (currently text-[13.5px]). */
export const LIST_FIELD_TEXT = 'text-[13.5px]';

/** Border token (currently border-amber-200/70). */
export const LIST_FIELD_BORDER = 'border border-amber-200/70';

// ─── Centralized invariants (used by tests / lint helpers) ──────────────────

/**
 * Tokens that should NEVER appear in components/tours-list/. Used by the §10
 * rollback grep (B1 enforcement). Strings here are matched as literals.
 */
export const LIST_FORBIDDEN_TOKENS = [
  'slate-900', // Forbidden as background/active; allowed in `text-slate-900` for body text only — grep with context
  'border-slate-200',
  'border-slate-200/75',
  'bg-slate-900', // Especially forbidden for active chips
  'h-8', // Phase 2 raised filter fields to h-11
  'text-[12px]', // Phase 2 raised filter text to 13.5px
] as const;

/**
 * Tokens that MUST appear somewhere in components/tours-list/. Used by Phase
 * acceptance checks — confirms the family color promise is being honored.
 */
export const LIST_REQUIRED_TOKENS = [
  '#faf8f3', // Page base (or via Tailwind arbitrary value)
  'amber-200/70', // Field/chip border
  'amber-900/95', // Active chip background
  'amber-700', // Eyebrow
  'font-serif', // Upright serif accent + curator signature (italic banned 2026-05-20)
] as const;

/**
 * Tokens that are explicitly banned (user 2026-05-20 direction). The original
 * italic-serif decision (§9 family promise) was overruled — italic must NOT
 * appear in any catalogue surface. Grep gate:
 *   grep -rE "italic" components/tours-list/ lib/tours-list-tokens.ts
 *   → only comment mentions allowed, zero className usage.
 */
export const LIST_BANNED_TYPOGRAPHY = ['italic'] as const;
