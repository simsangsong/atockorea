/**
 * Normalized route-planning context: departure time + optional start/end endpoints (Step 8).
 * Keeps deterministic assembly backward-compatible when fields are absent.
 */
export type RouteEndpointKind = 'hotel' | 'airport' | 'custom' | 'unknown';

export type RouteEndpoint = {
  label?: string | null;
  lat?: number | null;
  lng?: number | null;
  regionGroup?: string | null;
  kind?: RouteEndpointKind;
};

export type RoutePlanningContext = {
  departureAt: string | null;
  startLocation: RouteEndpoint | null;
  endLocation: RouteEndpoint | null;
  includeReturnToEndLocation: boolean;
};

export type DayPlanningContext = {
  dayIndex: number;
  dayStartAt: string | null;
  startLocation: RouteEndpoint | null;
  endLocation: RouteEndpoint | null;
  includeReturnToEndLocation: boolean;
};

export type RoutePlanningInput = {
  departureAt?: string | null;
  startLocation?: RouteEndpoint | null;
  endLocation?: RouteEndpoint | null;
  includeReturnToEndLocation?: boolean | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  pickupRegion?: string | null;
  pickupLabel?: string | null;
  pickupKind?: string | null;
  hotelLat?: number | null;
  hotelLng?: number | null;
  hotelRegion?: string | null;
  hotelName?: string | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  dropoffRegion?: string | null;
  dropoffLabel?: string | null;
  dropoffKind?: string | null;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeDepartureAt(value?: string | null): string | null {
  if (value == null || String(value).trim() === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function normalizeEndpointKind(value: unknown): RouteEndpointKind {
  const v = String(value ?? '').toLowerCase();
  if (v === 'hotel' || v === 'airport' || v === 'custom') return v;
  return 'unknown';
}

export function normalizeEndpoint(endpoint?: RouteEndpoint | null): RouteEndpoint | null {
  if (!endpoint) return null;
  return {
    label: endpoint.label ?? null,
    lat: isFiniteNumber(endpoint.lat) ? Number(endpoint.lat) : null,
    lng: isFiniteNumber(endpoint.lng) ? Number(endpoint.lng) : null,
    regionGroup:
      endpoint.regionGroup != null && String(endpoint.regionGroup).trim() !== ''
        ? String(endpoint.regionGroup).trim()
        : null,
    kind: endpoint.kind != null ? normalizeEndpointKind(endpoint.kind) : 'unknown',
  };
}

export function normalizeRoutePlanningContext(input: RoutePlanningInput): RoutePlanningContext {
  const merged = mergeEndpointsFromAliases(input);
  return {
    departureAt: normalizeDepartureAt(input.departureAt),
    startLocation: merged.start,
    endLocation: merged.end,
    includeReturnToEndLocation: Boolean(input.includeReturnToEndLocation),
  };
}

function mergeEndpointsFromAliases(input: RoutePlanningInput): {
  start: RouteEndpoint | null;
  end: RouteEndpoint | null;
} {
  const explicitStart = normalizeEndpoint(input.startLocation ?? null);
  const lat =
    explicitStart?.lat ??
    (isFiniteNumber(input.pickupLat) ? input.pickupLat : isFiniteNumber(input.hotelLat) ? input.hotelLat : null);
  const lng =
    explicitStart?.lng ??
    (isFiniteNumber(input.pickupLng) ? input.pickupLng : isFiniteNumber(input.hotelLng) ? input.hotelLng : null);
  const regionGroup =
    explicitStart?.regionGroup ??
    (input.pickupRegion != null && String(input.pickupRegion).trim() !== ''
      ? String(input.pickupRegion).trim()
      : input.hotelRegion != null && String(input.hotelRegion).trim() !== ''
        ? String(input.hotelRegion).trim()
        : null);
  const label =
    explicitStart?.label ??
    (input.pickupLabel != null && String(input.pickupLabel).trim() !== ''
      ? String(input.pickupLabel).trim()
      : input.hotelName != null && String(input.hotelName).trim() !== ''
        ? String(input.hotelName).trim()
        : null);
  let kind: RouteEndpointKind =
    explicitStart?.kind && explicitStart.kind !== 'unknown'
      ? explicitStart.kind
      : normalizeEndpointKind(input.pickupKind);
  if (kind === 'unknown' && (lat != null || lng != null)) {
    kind = 'hotel';
  }

  const hasStart = explicitStart != null || lat != null || lng != null || regionGroup != null || label != null;
  const start: RouteEndpoint | null = hasStart
    ? normalizeEndpoint({
        label,
        lat,
        lng,
        regionGroup,
        kind,
      })
    : null;

  const explicitEnd = normalizeEndpoint(input.endLocation ?? null);
  const elat =
    explicitEnd?.lat ?? (isFiniteNumber(input.dropoffLat) ? input.dropoffLat : null);
  const elng =
    explicitEnd?.lng ?? (isFiniteNumber(input.dropoffLng) ? input.dropoffLng : null);
  const eregion =
    explicitEnd?.regionGroup ??
    (input.dropoffRegion != null && String(input.dropoffRegion).trim() !== ''
      ? String(input.dropoffRegion).trim()
      : null);
  const elabel =
    explicitEnd?.label ??
    (input.dropoffLabel != null && String(input.dropoffLabel).trim() !== ''
      ? String(input.dropoffLabel).trim()
      : null);
  let ekind: RouteEndpointKind =
    explicitEnd?.kind && explicitEnd.kind !== 'unknown'
      ? explicitEnd.kind
      : normalizeEndpointKind(input.dropoffKind);

  const hasEnd =
    explicitEnd != null || elat != null || elng != null || eregion != null || elabel != null;
  const end: RouteEndpoint | null = hasEnd
    ? normalizeEndpoint({
        label: elabel,
        lat: elat,
        lng: elng,
        regionGroup: eregion,
        kind: ekind,
      })
    : null;

  return { start, end };
}

export function createDayPlanningContext(args: {
  planning: RoutePlanningContext;
  dayIndex: number;
}): DayPlanningContext {
  const { planning, dayIndex } = args;
  return {
    dayIndex,
    dayStartAt: shiftDepartureByDays(planning.departureAt, dayIndex),
    startLocation: planning.startLocation,
    endLocation: planning.endLocation,
    includeReturnToEndLocation: planning.includeReturnToEndLocation,
  };
}

export function estimateLegDepartureAt(args: {
  dayStartAt: string | null;
  elapsedMinutes: number;
}): string | null {
  const { dayStartAt, elapsedMinutes } = args;
  if (!dayStartAt) return null;
  const base = new Date(dayStartAt);
  if (Number.isNaN(base.getTime())) return null;
  return new Date(base.getTime() + elapsedMinutes * 60_000).toISOString();
}

function shiftDepartureByDays(iso: string | null, dayIndex: number): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + dayIndex * 86_400_000).toISOString();
}
