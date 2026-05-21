/**
 * v3 Phase E.1 scroll-reveal helper.
 *
 * Shared framer-motion variants + viewport config + reduced-motion handling for
 * the 5 home-v2 sections that should fade in as the user scrolls past them
 * (Destinations / Featured / Style / Why / Process). Values pulled from the
 * v3 master plan §8 motion spec — keep them in sync if §8 changes.
 *
 * Replaces the legacy mount-trigger CSS pattern (`scroll-animate` class +
 * `useEffect → classList.add("visible")`) which animated everything once on
 * page load instead of when each section actually entered the viewport.
 *
 * Hydration note (§C 2026-05-21): `initial` is ALWAYS "hidden" so the SSR'd
 * inline style is deterministic. The previous `initial: reduceMotion ?
 * "visible" : "hidden"` rendered "hidden" on the server (`useReducedMotion()`
 * is null with no DOM) and "visible" on the reduce-motion client, producing a
 * hydration mismatch across all 5 sections. Reduced motion is now expressed via
 * the container's `visible` TRANSITION (timing — never serialized to the style
 * attribute, so it may branch on reduceMotion safely) which propagates down to
 * the children: reduce-motion users get an instant (duration 0) reveal — no
 * perceptible movement, no mismatch. Item geometry stays a constant.
 */
import { useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";

/** Per-item GEOMETRY only — opacity/y are constant so the SSR'd inline style is
 *  deterministic regardless of prefers-reduced-motion. The reveal TIMING lives
 *  on the container's `visible` transition (see useRevealContainerProps) and
 *  propagates to these children. Applied to each child for staggered reveals. */
export const REVEAL_ITEM_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

/** Trigger once at 15% visibility per §8. */
export const REVEAL_VIEWPORT = { amount: 0.15, once: true } as const;

/**
 * Reveal props for a section/container. Spread onto `<motion.section>` or
 * `<motion.div>`. See the file header for the hydration / reduced-motion
 * rationale. The container holds the reveal timing (which cascades to its
 * `REVEAL_ITEM_VARIANTS` children); the item variants hold only geometry.
 */
export function useRevealContainerProps() {
  const reduceMotion = useReducedMotion();
  const variants: Variants = {
    hidden: {},
    visible: {
      transition: reduceMotion
        ? { duration: 0 }
        : { staggerChildren: 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
    },
  };
  return {
    initial: "hidden" as const,
    whileInView: "visible" as const,
    viewport: REVEAL_VIEWPORT,
    variants,
  } as const;
}
