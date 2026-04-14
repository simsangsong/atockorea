const DEFAULT_CUSTOM_JOIN_PATH = "/custom-join-tour";

export type BuildCustomJoinTourHrefParams = {
  /** Defaults to `/custom-join-tour`. */
  basePath?: string;
  /** Legacy behavior: only `jeju` adds `destination=jeju`. */
  destination?: "jeju" | "seoul" | "busan";
  intent?: string;
};

/**
 * Builds the same query string legacy `HeroPremium` used for the primary CTA
 * (`destination` when Jeju + optional `intent`).
 */
export function buildCustomJoinTourHref(params: BuildCustomJoinTourHrefParams): string {
  const base = params.basePath ?? DEFAULT_CUSTOM_JOIN_PATH;
  const search = new URLSearchParams();
  if (params.destination === "jeju") search.set("destination", "jeju");
  const q = (params.intent ?? "").trim();
  if (q) search.set("intent", q);
  const s = search.toString();
  return s ? `${base}?${s}` : base;
}
