/**
 * Three canonical button class strings for the home v2 page.
 *
 * Before this file there were ~7 inline button variants on the homepage:
 * different paddings (py-2.5/3/4/5/6/7), text sizes (text-[13px]/sm/base),
 * and three backgrounds (slate-900 / white / outline). This collapses them
 * to a single visual language with three named roles.
 *
 * Usage: combine with the existing V0ShadcnButton wrapper, e.g.
 *   <V0ShadcnButton size="lg" className={homeBtnPrimary}>...</V0ShadcnButton>
 *
 * Each constant assumes the consumer applies `h-auto w-full` (or chooses
 * an explicit width) and `rounded-full` is included so the consumer
 * doesn't have to remember.
 */

/**
 * Primary call-to-action used across hero matcher, best-match result,
 * choose-style private/bus, final-cta primary. Slate-900 on white surface,
 * white text, rounded-full, py-4 / text-sm. Single defining variant for
 * "the user should take this action now."
 */
export const homeBtnPrimary =
  "h-auto w-full rounded-full bg-slate-900 py-4 text-sm font-semibold text-white transition-colors duration-300 hover:bg-slate-800 disabled:opacity-70";

/**
 * Inverse primary used inside dark cards / sticky CTAs where the surface
 * is already slate-900. White button, slate-900 text. Same rhythm as
 * homeBtnPrimary.
 */
export const homeBtnInverse =
  "h-auto w-full rounded-full bg-white py-4 text-sm font-semibold text-slate-900 transition-colors duration-300 hover:bg-white/95";

/**
 * Secondary outline used for "Browse all tours", "See other tours",
 * "Back to matcher", final-cta secondary. Same height as primary so
 * stacked CTAs share a baseline; visual weight steps down via border
 * + white surface + slate-800 text.
 */
export const homeBtnSecondary =
  "h-auto w-full rounded-full border border-slate-200/75 bg-white py-4 text-sm font-semibold text-slate-800 transition-colors duration-300 hover:border-slate-300/90 hover:bg-slate-50";
