/**
 * Single travel-style taxonomy for homepage hero quick-tags and travel-style refinement.
 * Labels live under `home.premium.comparison.*` (e.g. styleFirstTime).
 */
export const HOME_STYLE_OPTIONS = [
  { id: "first_time", labelKey: "styleFirstTime" as const },
  { id: "scenic", labelKey: "styleScenic" as const },
  { id: "nature_cafe", labelKey: "styleNatureCafe" as const },
  { id: "family", labelKey: "styleFamily" as const },
  { id: "rain_safer", labelKey: "styleRainSafer" as const },
  { id: "with_parents", labelKey: "styleWithParents" as const },
  { id: "less_walking", labelKey: "styleLessWalking" as const },
  { id: "private_flex", labelKey: "stylePrivateFlex" as const },
] as const;

export type HomeStyleLabelKey = (typeof HOME_STYLE_OPTIONS)[number]["labelKey"];

/** Premium tactile chips — styles from `app/home-premium.css` (`.home-chip`). */
export function styleChipButtonClass(selected: boolean): string {
  return selected ? "home-chip home-chip--active" : "home-chip";
}
