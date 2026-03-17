/** Easing for Framer Motion. Use as transition.ease to satisfy strict typing. */
export const motionEasing = ["easeOut"] as const;
export type MotionEasing = (typeof motionEasing)[number];

export const motion = {
  duration: {
    fast: 150,
    base: 200,
    slow: 220,
  },
  easing: {
    standard: "ease-out" as const,
  },
  /** Framer Motion transition object (duration + ease). */
  transition: {
    fast: { duration: 0.15, ease: "easeOut" as const },
    base: { duration: 0.2, ease: "easeOut" as const },
    slow: { duration: 0.22, ease: "easeOut" as const },
  },
  scale: {
    press: 0.98,
    hover: 1.01,
  },
} as const;
