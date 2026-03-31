/** Deep merge plain objects; later keys win. Arrays replaced entirely from `source`. */
export function deepMerge(
  target: Record<string, unknown>,
  ...sources: Array<Record<string, unknown> | undefined | null>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...target };
  for (const src of sources) {
    if (!src || typeof src !== "object") continue;
    for (const key of Object.keys(src)) {
      const sv = src[key];
      const tv = out[key];
      if (
        sv !== null &&
        typeof sv === "object" &&
        !Array.isArray(sv) &&
        tv !== null &&
        typeof tv === "object" &&
        !Array.isArray(tv)
      ) {
        out[key] = deepMerge({ ...(tv as Record<string, unknown>) }, sv as Record<string, unknown>);
      } else if (sv !== undefined) {
        out[key] = sv;
      }
    }
  }
  return out;
}

/**
 * Build a partial override tree: values in `edited` that differ from `baseline`.
 * Arrays compared via JSON (replace whole array if different).
 */
export function computeDiffFromBaseline(baseline: unknown, edited: unknown): unknown {
  if (edited === undefined) return undefined;
  if (baseline === edited) return undefined;

  if (Array.isArray(baseline) || Array.isArray(edited)) {
    if (JSON.stringify(baseline) === JSON.stringify(edited)) return undefined;
    return edited;
  }

  if (
    baseline !== null &&
    edited !== null &&
    typeof baseline === "object" &&
    typeof edited === "object" &&
    !Array.isArray(baseline) &&
    !Array.isArray(edited)
  ) {
    const b = baseline as Record<string, unknown>;
    const e = edited as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const keys = new Set([...Object.keys(b), ...Object.keys(e)]);
    for (const k of keys) {
      const d = computeDiffFromBaseline(b[k], e[k]);
      if (
        d !== undefined &&
        d !== null &&
        !(typeof d === "object" && !Array.isArray(d) && Object.keys(d as object).length === 0)
      ) {
        out[k] = d as unknown;
      }
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }

  return edited;
}
