import type { ParsedQueryV2 } from "@/lib/tour-match-v2/types";
import type { LatLng } from "@/lib/itinerary-builder/distance";

export type BuilderPoiKind = "attraction" | "logistics" | "hidden";

export type PoiCategoryGroup =
  | "beach"
  | "cafe"
  | "coastal"
  | "food_market"
  | "heritage"
  | "indoor_culture"
  | "landmark"
  | "nature"
  | "temple"
  | "theme_park"
  | "village"
  | "waterfall"
  | "other";

export interface BuilderPoiMeta {
  kind: BuilderPoiKind;
  subRegions: string[];
  categoryGroup: PoiCategoryGroup;
  rationaleTags: string[];
}

export interface BuilderPoiMetaSource {
  poi_key: string;
  poi_meta?: Record<string, unknown> | null;
}

export const BUILDER_POI_META: Record<string, BuilderPoiMeta> = {
  aewol_cafe_street: m("attraction", ["jeju_west", "jeju_northwest"], "cafe", ["cafes", "ocean views", "relaxed pace"]),
  ahopsan_bamboo_forest: m("attraction", ["busan_core"], "nature", ["nature", "easy walking", "photos"]),
  amethyst_cave_themepark: m("attraction", ["ulsan"], "theme_park", ["family", "indoor option", "novelty stop"]),
  biff_square: m("attraction", ["busan_core"], "food_market", ["street food", "city energy", "shopping"]),
  bomun_lake: m("attraction", ["gyeongju"], "nature", ["lake views", "relaxed pace", "family"]),
  bulguksa_temple: m("attraction", ["gyeongju"], "temple", ["UNESCO", "history", "temple"]),
  camellia_hill: m("attraction", ["jeju_southwest", "jeju_west"], "nature", ["gardens", "seasonal flowers", "photos"]),
  cheomseongdae: m("attraction", ["gyeongju"], "heritage", ["history", "iconic landmark", "easy walking"]),
  cheongsapo_blue_line_park: m("attraction", ["busan_core"], "coastal", ["ocean views", "easy walking", "photos"]),
  cheonjeyeon_falls: m("attraction", ["jeju_southern"], "waterfall", ["waterfall", "nature", "photos"]),
  daepo_jusangjeolli_cliff: m("attraction", ["jeju_southern"], "coastal", ["coastal cliffs", "UNESCO geology", "photos"]),
  gamcheon_culture_village: m("attraction", ["busan_core"], "village", ["colorful village", "photos", "first-time highlight"]),
  gukje_market: m("attraction", ["busan_core"], "food_market", ["market", "street food", "local eats"]),
  gyeongju_national_museum: m("attraction", ["gyeongju"], "indoor_culture", ["museum", "history", "rain option"]),
  gyochon_hanok_village: m("attraction", ["gyeongju"], "heritage", ["hanok village", "history", "easy walking"]),
  haedong_yonggungsa: m("attraction", ["busan_core"], "temple", ["coastal temple", "iconic landmark", "photos"]),
  hallasan_1100_wetland: m("attraction", ["jeju_southern", "jeju_central"], "nature", ["easy nature", "mountain scenery", "boardwalk"]),
  hallasan_eorimok_trail: m("attraction", ["jeju_central"], "nature", ["hiking", "mountain scenery", "active route"]),
  hallasan_eoseungsaengak: m("attraction", ["jeju_central"], "nature", ["short hike", "mountain views", "active route"]),
  hallim_park: m("attraction", ["jeju_west"], "nature", ["gardens", "family", "cave option"]),
  hamdeok_seoubong_beach: m("attraction", ["jeju_north", "jeju_east"], "beach", ["beach", "ocean views", "easy walking"]),
  hueree_natural_park: m("attraction", ["jeju_southern"], "nature", ["family", "seasonal flowers", "nature"]),
  hyeopjae_beach: m("attraction", ["jeju_west"], "beach", ["beach", "ocean views", "first-time highlight"]),
  ilchulland_micheon_cave: m("attraction", ["jeju_east"], "nature", ["cave", "rain option", "family"]),
  ilchulland_themed_gardens: m("attraction", ["jeju_east"], "nature", ["gardens", "family", "easy walking"]),
  jagalchi_market: m("attraction", ["busan_core"], "food_market", ["seafood market", "local eats", "first-time highlight"]),
  jeju_cruise_port: m("logistics", ["jeju_north"], "other", ["cruise pickup", "port logistics"]),
  gangjeong_cruise_port: m("logistics", ["jeju_southern"], "other", ["cruise pickup", "port logistics"]),
  jeju_haenyeo_museum: m("attraction", ["jeju_east"], "indoor_culture", ["haenyeo culture", "museum", "rain option"]),
  jeju_stone_park: m("attraction", ["jeju_north", "jeju_central"], "indoor_culture", ["volcanic culture", "museum", "nature"]),
  jeju_tangerine_picking_experience: m("attraction", ["jeju_southern", "jeju_west"], "nature", ["family", "seasonal fruit", "hands-on"]),
  jeongbang_falls: m("attraction", ["jeju_southern"], "waterfall", ["waterfall", "coastal views", "iconic landmark"]),
  jeonnong_ro_cherry_blossom_street: m("attraction", ["jeju_north"], "landmark", ["cherry blossoms", "seasonal", "easy walking"]),
  noksan_ro_gasiri_blossom_road: m("attraction", ["jeju_east"], "nature", ["cherry blossoms", "canola flowers", "scenic drive"]),
  osulloc_tea_museum: m("attraction", ["jeju_west", "jeju_southwest"], "cafe", ["tea culture", "cafe", "rain option"]),
  seongeup_folk_village: m("attraction", ["jeju_east"], "village", ["folk village", "history", "culture"]),
  seongsan_ilchulbong: m("attraction", ["jeju_east"], "coastal", ["UNESCO", "ocean views", "iconic landmark"]),
  seopjikoji: m("attraction", ["jeju_east"], "coastal", ["coastal walk", "ocean views", "photos"]),
  songaksan: m("attraction", ["jeju_southwest"], "coastal", ["coastal views", "easy walk option", "photos"]),
  songdo_beach: m("attraction", ["busan_core"], "beach", ["beach", "cable car", "first-time highlight"]),
  taejongdae: m("attraction", ["busan_core"], "coastal", ["coastal cliffs", "views", "active walking"]),
  tongdosa_temple: m("attraction", ["yangsan"], "temple", ["temple", "UNESCO", "history"]),
  un_memorial_cemetery: m("attraction", ["busan_core"], "heritage", ["history", "memorial", "quiet stop"]),
  woljeonggyo_bridge: m("attraction", ["gyeongju"], "heritage", ["night view", "history", "photos"]),
  yeongnam_alps_ice_valley_cable_car: m("attraction", ["ulsan", "miryang"], "nature", ["mountain views", "cable car", "active route"]),
  yongdusan_park: m("attraction", ["busan_core"], "landmark", ["city views", "first-time highlight", "easy stop"]),
};

export const BUILDER_ORIGINS: Record<string, LatLng> = {
  busan_center: { lat: 35.18, lng: 129.07 },
  busan_cruise_port: { lat: 35.101, lng: 129.04 },
  jeju_center: { lat: 33.4, lng: 126.55 },
  jeju_cruise_port: { lat: 33.516, lng: 126.532 },
  gangjeong_cruise_port: { lat: 33.227, lng: 126.489 },
};

function m(
  kind: BuilderPoiKind,
  subRegions: string[],
  categoryGroup: PoiCategoryGroup,
  rationaleTags: string[]
): BuilderPoiMeta {
  return { kind, subRegions, categoryGroup, rationaleTags };
}

export function getBuilderPoiMeta(poiKey: string): BuilderPoiMeta {
  return BUILDER_POI_META[poiKey] ?? m("attraction", [], "other", []);
}

export function resolveBuilderPoiMeta(source: string | BuilderPoiMetaSource): BuilderPoiMeta {
  if (typeof source === "string") return getBuilderPoiMeta(source);
  const builder = readBuilderMeta(source.poi_meta);
  return builder ?? getBuilderPoiMeta(source.poi_key);
}

export function isBuilderAttraction(poiKey: string): boolean {
  return getBuilderPoiMeta(poiKey).kind === "attraction";
}

/**
 * Whether a POI has a displayable photo for the builder catalogue. Mirrors the
 * card render fallback (`default_image_url || images[0]`). Photoless POIs are
 * hidden from the builder for now (Phase A) until real photos are wired.
 */
export function hasBuilderPhoto(poi: {
  default_image_url?: string | null;
  images?: unknown;
}): boolean {
  if (typeof poi.default_image_url === "string" && poi.default_image_url.trim() !== "") {
    return true;
  }
  const first = Array.isArray(poi.images) ? poi.images[0] : undefined;
  return typeof first === "string" && first.trim() !== "";
}

export function resolveBuilderOrigin(
  region: "busan" | "jeju" | "seoul",
  track?: string | null,
  originKey?: string | null
): LatLng | undefined {
  if (originKey && BUILDER_ORIGINS[originKey]) return BUILDER_ORIGINS[originKey];
  if (track !== "cruise") return undefined;
  // Seoul is not a cruise-port region; fall back to undefined (no port anchor).
  if (region === "jeju") return BUILDER_ORIGINS.jeju_cruise_port;
  if (region === "busan") return BUILDER_ORIGINS.busan_cruise_port;
  return undefined;
}

export function metadataScoreAdjustment(
  source: string | BuilderPoiMetaSource,
  parsed: ParsedQueryV2
): number {
  const wantedSubRegions = parsed.sub_regions ?? [];
  if (wantedSubRegions.length === 0) return 0;
  const meta = resolveBuilderPoiMeta(source);
  if (meta.subRegions.length === 0) return 0;
  const matches = meta.subRegions.some((s) => wantedSubRegions.includes(s));
  return matches ? 3.0 : -2.5;
}

export function buildPoiRationale(
  source: string | BuilderPoiMetaSource,
  components: Record<string, number>,
  parsed: Pick<ParsedQueryV2, "themes" | "personas" | "sub_regions" | "negative_signals">
): string[] {
  const meta = resolveBuilderPoiMeta(source);
  const labels: string[] = [];
  if ((components.anchor_poi_mentioned ?? 0) > 0) labels.push("named by user");
  if ((components.season_lock ?? 0) > 0) labels.push("seasonal match");
  if ((components.first_time_fit ?? 0) > 0 || (components.iconic_landmark_baseline ?? 0) > 0) {
    labels.push("first-time highlight");
  }
  if ((components.easy_walking_match ?? 0) > 0) labels.push("easy walking");
  if ((components.theme_overlap ?? 0) > 0) labels.push(...themeLabels(parsed.themes));
  if ((components.persona_align ?? 0) > 0) labels.push(...personaLabels(parsed.personas));
  if ((components.sub_region_match ?? 0) > 0) labels.push("right area");
  labels.push(...meta.rationaleTags);
  if ((components.negative_penalty ?? 0) < 0) labels.push("some walking trade-off");
  return [...new Set(labels)].slice(0, 4);
}

function readBuilderMeta(poiMeta?: Record<string, unknown> | null): BuilderPoiMeta | null {
  const raw = poiMeta?.builder;
  if (!raw || typeof raw !== "object") return null;
  const builder = raw as Record<string, unknown>;
  const kind = readKind(builder.kind);
  const categoryGroup = readCategoryGroup(builder.category_group);
  const subRegions = readStringArray(builder.sub_regions);
  const rationaleTags = readStringArray(builder.rationale_tags);
  if (!kind && !categoryGroup && subRegions.length === 0 && rationaleTags.length === 0) {
    return null;
  }
  return {
    kind: kind ?? "attraction",
    subRegions,
    categoryGroup: categoryGroup ?? "other",
    rationaleTags,
  };
}

function readKind(value: unknown): BuilderPoiKind | null {
  return value === "attraction" || value === "logistics" || value === "hidden" ? value : null;
}

function readCategoryGroup(value: unknown): PoiCategoryGroup | null {
  const allowed: PoiCategoryGroup[] = [
    "beach",
    "cafe",
    "coastal",
    "food_market",
    "heritage",
    "indoor_culture",
    "landmark",
    "nature",
    "temple",
    "theme_park",
    "village",
    "waterfall",
    "other",
  ];
  return typeof value === "string" && allowed.includes(value as PoiCategoryGroup)
    ? (value as PoiCategoryGroup)
    : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

function themeLabels(themes: string[]): string[] {
  const out: string[] = [];
  for (const theme of themes) {
    if (theme === "beach") out.push("beach");
    else if (theme === "cafe") out.push("cafes");
    else if (theme === "food_market") out.push("local eats");
    else if (theme === "unesco_world_heritage") out.push("UNESCO");
    else if (theme === "first_time_highlights") out.push("first-time highlight");
    else out.push(theme.replace(/_/g, " "));
  }
  return out;
}

function personaLabels(personas: string[]): string[] {
  const out: string[] = [];
  for (const persona of personas) {
    if (persona === "family_with_young_kids" || persona === "families") out.push("family");
    else if (persona === "history_lovers" || persona === "culture_lovers") out.push("culture");
    else if (persona === "senior_couples") out.push("gentler pace");
  }
  return out;
}
