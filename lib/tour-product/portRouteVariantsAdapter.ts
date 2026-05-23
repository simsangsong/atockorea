/**
 * Backward adapter: authoring JSON's `itinerary_variants` shape →
 * renderer's `routeVariants` shape (`PortRouteVariant[]`).
 *
 * Why this exists: the two Jeju cruise shore-excursion products
 * (`jeju-cruise-shore-excursion-bus-tour`,
 * `jeju-cruise-shore-excursion-small-group-tour`) author their port-switched
 * 4-stop itineraries under `itinerary_variants` (rich snake_case shape with
 * port matchmaking metadata + per-variant theme/weather levels), while the
 * `PortSelectorTimeline` renderer reads `routeVariants` (compact
 * camelCase shape focused on what the UI actually renders).
 *
 * The adapter is plugged into both pipelines that build the detail-page view
 * model:
 *   - `buildTourProductViewModelFromFullPageJson` (static-JSON path)
 *   - `loadTourProductPage` (Supabase-backed path)
 *
 * When the JSON already supplies `routeVariants` (the canonical shape), the
 * adapter is bypassed. When only `itinerary_variants` is present, this
 * adapter rebuilds the renderer's shape. Empty arrays are treated as absent.
 */

import type {
  PortRouteVariant,
  PortVariantStop,
} from "@/components/product-tour-static/_shared/route-variants/routeVariantTypes";

type Rec = Record<string, unknown>;

function isRec(v: unknown): v is Rec {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function takeString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v : undefined;
}

function takeStringArray(v: unknown): readonly string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((item): item is string => typeof item === "string");
}

function takeVisitBasics(v: unknown): PortVariantStop["visitBasics"] {
  if (!isRec(v)) return undefined;
  const hours = takeString(v.hours);
  const closed = takeString(v.closed);
  const admission = takeString(v.admission);
  const walking = takeString(v.walking);
  if (!hours && !closed && !admission && !walking) return undefined;
  return { hours, closed, admission, walking };
}

function mapStop(raw: unknown, fallbackIndex: number): PortVariantStop | null {
  if (!isRec(raw)) return null;
  const name = takeString(raw.name);
  if (!name) return null;
  return {
    number: typeof raw.number === "number" && raw.number > 0 ? raw.number : fallbackIndex + 1,
    name,
    category: takeString(raw.category) ?? "",
    duration: takeString(raw.duration) ?? "",
    description: takeString(raw.description) ?? "",
    highlights: takeStringArray(raw.highlights),
    time: takeString(raw.time),
    whyOnRoute: takeString(raw.whyOnRoute),
    visitBasics: takeVisitBasics(raw.visitBasics),
  };
}

function mapVariant(raw: unknown): PortRouteVariant | null {
  if (!isRec(raw)) return null;
  const portId = takeString(raw.port_id);
  if (!portId) return null;
  const portLabel = takeString(raw.port_label) ?? portId;
  const portLabelShort = takeString(raw.port_label_short) ?? portLabel;
  const stopsRaw = Array.isArray(raw.stops) ? raw.stops : [];
  const stops: PortVariantStop[] = [];
  stopsRaw.forEach((s, i) => {
    const mapped = mapStop(s, i);
    if (mapped) stops.push(mapped);
  });
  if (stops.length === 0) return null;
  return {
    variant_id: portId,
    title: portLabelShort,
    dockingPort: { name: portLabel },
    summary: takeString(raw.route_focus),
    stops,
  };
}

/** Returns `null` when input is missing, empty, or unparseable — caller treats
 *  that as "no route variants for this product". */
export function mapItineraryVariantsToRouteVariants(
  raw: unknown,
): readonly PortRouteVariant[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const mapped: PortRouteVariant[] = [];
  for (const v of raw) {
    const m = mapVariant(v);
    if (m) mapped.push(m);
  }
  return mapped.length > 0 ? mapped : null;
}
