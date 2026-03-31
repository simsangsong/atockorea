# Itinerary route feasibility (coordinate-based)

## Distance and time assumptions

- **Coordinates**: POI fields `mapx` = longitude (°E), `mapy` = latitude (°N), WGS84.
- **Straight-line distance**: Haversine formula on the sphere (`lib/geo/haversine.ts`).
- **Driving time from distance**: `minutes = (km / JEJU_TOURISM_AVG_KMH) * 60`, then clamped to a per-leg min/max (`lib/geo/jeju-routing-constants.ts`). This is a **conservative tourism average** for Jeju mixed roads (not real-time traffic).
- **Missing coordinates**: Falls back to region heuristics (same `region_group` = short hop; different / unknown = longer default), so the pipeline still runs when TourAPI coords are absent.

Central constants live in `lib/geo/jeju-routing-constants.ts` (speed, clamps, feasibility thresholds).

## Thresholds (summary)

| Concept | Constant | Typical value |
|--------|----------|----------------|
| Jeju avg speed | `JEJU_TOURISM_AVG_KMH` | 35 km/h |
| Per-leg travel time clamp | `MIN_TRAVEL_LEG_MIN` … `MAX_TRAVEL_LEG_MIN_ESTIMATE` | 5–95 min |
| Excessive single leg (line distance) | `ROUTE_SINGLE_LEG_MAX_KM` | 38 km |
| Max share of trip budget for driving | `ROUTE_MAX_TRAVEL_FRACTION_OF_BUDGET` | 42% of total `budgetMin` |
| Max total driving per day (cap) | `ROUTE_MAX_TOTAL_TRAVEL_MIN_PER_DAY` | 220 min × number of days |
| Long “jump” leg (warning) | `LONG_JUMP_THRESHOLD_MIN` | 48+ min travel estimate |
| Too many long jumps | `ROUTE_EXCESSIVE_LONG_JUMP_COUNT` | ≥ 3 legs |
| Too many cross-region legs | `ROUTE_EXCESSIVE_REGION_JUMP_LEGS` | ≥ 5 legs |

`budgetMin` = `durationDays × availableHoursPerDay × 60` (minutes).

## Repair strategy (lightweight, not TSP)

1. **Evaluate** legs with Haversine + travel estimates; compute totals (travel, visit, day).
2. If thresholds fail:
   - **Adjacent swaps**: repeatedly swap neighboring stops if total estimated travel time drops (bounded passes).
   - If still bad: **remove weakest stop** by `stopStrength` (same scoring as duration budget), then reorder again; repeat up to `ROUTE_MAX_FEASIBILITY_TRIMS`.
3. If still over thresholds: emit **`route_feasibility_warned`** repairs (no further automatic fallback unless the rest of the pipeline already triggers rule-based recovery).

Later stages: region ping-pong repair, duration budget trim/compress (unchanged).

## API / logging

- Response includes **`routeMetrics`** (travel / visit / day minutes, coordinate leg count, summed line distance when coords exist).
- `itinerary_generation_logs.pipeline_events` `validated` event adds compact numeric metadata: `routeTravelMin`, `routeVisitMin`, `routeDayMin`, `routeCoordLegs`, `routeLegs`, `routeKmDec` (km × 10), plus repair counts.
