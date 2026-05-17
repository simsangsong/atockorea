// Stable-hash variant assignment shared by the client SDK and the server.
// Identical inputs → identical variant on both sides, so SSR and CSR never
// disagree.
//
// Hash: cyrb53 (xorshift-based, 53 bits effective). Fast, deterministic,
// no crypto dependency. NOT cryptographically secure — we only need
// uniform bucketing.

export type ExperimentVariant = {
  key: string;
  /** Integer in [0, 100]. Sum across variants should equal 100. */
  weight: number;
  label?: string;
};

function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Deterministic variant assignment.
 *
 * - Stable: same (anonymousId, experimentKey) always returns the same variant.
 * - Even: hash mod 100 is uniform, so weights are honored across users.
 * - Edge cases:
 *   - empty variants array → returns null
 *   - weights summing < 100 → last bucket wins for the remainder
 *   - weights summing > 100 → still returns first matching bucket
 */
export function assignVariant(
  anonymousId: string,
  experimentKey: string,
  variants: readonly ExperimentVariant[],
): string | null {
  if (!anonymousId || variants.length === 0) return null;
  const bucket = cyrb53(`${anonymousId}:${experimentKey}`) % 100;
  let cumulative = 0;
  for (const v of variants) {
    cumulative += v.weight;
    if (bucket < cumulative) return v.key;
  }
  return variants[variants.length - 1].key;
}

/**
 * Approximate p-value for a 2x2 chi-square test of independence.
 * Returned p is one of the standard cutoffs: 0.001, 0.01, 0.05, 0.10, 0.20.
 * Returns `null` when any expected cell is < 5 (chi-square unreliable).
 */
export function chiSquare2x2PValue(
  a: number, // variant A: converted
  b: number, // variant A: not converted
  c: number, // variant B: converted
  d: number, // variant B: not converted
): { chi2: number; p: number | null } {
  const n = a + b + c + d;
  if (n === 0) return { chi2: 0, p: null };
  const r1 = a + b;
  const r2 = c + d;
  const c1 = a + c;
  const c2 = b + d;
  if (r1 === 0 || r2 === 0 || c1 === 0 || c2 === 0) return { chi2: 0, p: null };

  // Expected counts under null hypothesis
  const ea = (r1 * c1) / n;
  const eb = (r1 * c2) / n;
  const ec = (r2 * c1) / n;
  const ed = (r2 * c2) / n;
  if (ea < 5 || eb < 5 || ec < 5 || ed < 5) {
    // Reliability gate — chi-square assumption violated
    return { chi2: 0, p: null };
  }

  // Simplified 2x2 chi-square formula
  const num = a * d - b * c;
  const chi2 = (n * num * num) / (r1 * r2 * c1 * c2);

  // Lookup against chi-square critical values at df=1
  let p: number;
  if (chi2 >= 10.83) p = 0.001;
  else if (chi2 >= 6.63) p = 0.01;
  else if (chi2 >= 3.84) p = 0.05;
  else if (chi2 >= 2.71) p = 0.1;
  else p = 0.2;

  return { chi2, p };
}
