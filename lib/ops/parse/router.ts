// Phase 0-bis — Model router + complexity scoring
// Master plan §6.3.1 — pickModel() decides Haiku vs Sonnet vs none per batch.

export type ModelChoice = 'none' | 'haiku-4-5' | 'sonnet-4-6'

export interface RouterInput {
  ambiguousLines: string[]
  /** Wizard "정확도 우선" toggle — always escalates to Sonnet. */
  forceAccuracy?: boolean
}

export function pickModel(input: RouterInput): ModelChoice {
  if (input.ambiguousLines.length === 0) return 'none'
  if (input.forceAccuracy) return 'sonnet-4-6'

  const complexity = scoreComplexity(input.ambiguousLines)
  if (input.ambiguousLines.length < 5 && complexity < 0.3) return 'haiku-4-5'
  if (complexity < 0.6) return 'haiku-4-5'
  return 'sonnet-4-6'
}

/** Complexity = weighted blend of three measurable signals (0..1). */
export function scoreComplexity(lines: string[]): number {
  if (lines.length === 0) return 0
  const multilingualRatio = lines.filter(hasMultipleScripts).length / lines.length
  const nonStandardCharRatio = avg(lines, l => (l.length === 0 ? 0 : countNonStandard(l) / l.length))
  const meanLen = Math.max(1, avg(lines, l => l.length))
  const lengthVariance = stdev(lines.map(l => l.length)) / meanLen

  return clamp01(
    0.5 * multilingualRatio +
    0.3 * nonStandardCharRatio +
    0.2 * Math.min(lengthVariance, 1),
  )
}

function hasMultipleScripts(s: string): boolean {
  let scripts = 0
  if (/[ㄱ-힝]/.test(s)) scripts++ // Korean Hangul (ㄱ-힝 covers ㄱ-힣)
  if (/[一-鿿]/.test(s)) scripts++ // CJK Unified
  if (/[぀-ヿ]/.test(s)) scripts++ // Hiragana + Katakana
  if (/[A-Za-z]/.test(s)) scripts++
  return scripts >= 2
}

function countNonStandard(s: string): number {
  let n = 0
  for (const c of s) {
    if (!/[\w\sㄱ-힝一-鿿぀-ヿ.,:/()@+\-]/.test(c)) n++
  }
  return n
}

function avg<T>(items: T[], f: (x: T) => number): number {
  if (items.length === 0) return 0
  let s = 0
  for (const x of items) s += f(x)
  return s / items.length
}

function stdev(nums: number[]): number {
  if (nums.length === 0) return 0
  const m = nums.reduce((a, b) => a + b, 0) / nums.length
  const v = nums.reduce((a, b) => a + (b - m) ** 2, 0) / nums.length
  return Math.sqrt(v)
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}
