import { HERO_MATCH_LOAD_DELAYS_MS } from "@/lib/home/services/hero-match-load-delays";

export function clearHomepageMatchTimeouts(ref: { current: ReturnType<typeof setTimeout>[] }): void {
  ref.current.forEach((id) => clearTimeout(id));
  ref.current = [];
}

/**
 * Staggered loading steps then result — identical timing to legacy mobile `HeroPremium` /
 * `useHeroMobileMatchFlow`.
 */
export function startHomepageMatchSimulation(
  timeoutsRef: { current: ReturnType<typeof setTimeout>[] },
  callbacks: {
    onLoadingStep: (step: 0 | 1 | 2) => void;
    onResult: () => void;
  },
): void {
  clearHomepageMatchTimeouts(timeoutsRef);
  callbacks.onLoadingStep(0);
  let acc = 0;
  const push = (delay: number, fn: () => void) => {
    acc += delay;
    const id = setTimeout(fn, acc);
    timeoutsRef.current.push(id);
  };
  push(HERO_MATCH_LOAD_DELAYS_MS[0], () => callbacks.onLoadingStep(1));
  push(HERO_MATCH_LOAD_DELAYS_MS[1], () => callbacks.onLoadingStep(2));
  push(HERO_MATCH_LOAD_DELAYS_MS[2], callbacks.onResult);
}
