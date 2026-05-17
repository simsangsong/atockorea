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
 */
import { useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";

/** Container fires the staggered reveal of its children. */
export const REVEAL_CONTAINER_VARIANTS: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

/** Per-item variant — applied to the container itself for solo reveals and to
 *  each child for staggered reveals. */
export const REVEAL_ITEM_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

/** Trigger once at 15% visibility per §8. */
export const REVEAL_VIEWPORT = { amount: 0.15, once: true } as const;

/**
 * Reveal props for a section/container. Spread onto `<motion.section>` or
 * `<motion.div>`. Reduced-motion users skip the hidden → visible animation
 * by starting at `visible`.
 */
export function useRevealContainerProps() {
  const reduceMotion = useReducedMotion();
  return {
    initial: reduceMotion ? "visible" : "hidden",
    whileInView: "visible" as const,
    viewport: REVEAL_VIEWPORT,
    variants: REVEAL_CONTAINER_VARIANTS,
  } as const;
}
