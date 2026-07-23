// Phase 0-bis — Cost estimation per model + layer
// Master plan §6.3 (Sonnet→Haiku ≈12× cost ratio) + §21.1 (cost dashboard)
// Prices in USD per million tokens. Update when Anthropic publishes new rates.

export type Model = 'haiku-4-5' | 'sonnet-4-6'

interface ModelPrice {
  /** $/M input tokens (uncached). */
  input: number
  /** $/M input tokens served from prompt cache (~10% of input). */
  cached: number
  /** $/M output tokens. */
  output: number
}

const PRICING: Record<Model, ModelPrice> = {
  // Anthropic published rates as of 2026-05; verify quarterly.
  'haiku-4-5':  { input: 1.0,  cached: 0.10, output: 5.0 },
  'sonnet-4-6': { input: 3.0,  cached: 0.30, output: 15.0 },
}

export interface UsageTokens {
  input_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
  output_tokens: number
}

export function estimateCostUSD(model: Model, usage: UsageTokens): number {
  const p = PRICING[model]
  const cached = usage.cache_read_input_tokens ?? 0
  const fresh = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0)
  const out = usage.output_tokens ?? 0
  return (fresh * p.input + cached * p.cached + out * p.output) / 1_000_000
}

/** Aggregate usage across multiple LLM calls in one import. */
export function aggregateUsage(items: UsageTokens[]): UsageTokens {
  return items.reduce(
    (acc, u) => ({
      input_tokens: acc.input_tokens + (u.input_tokens ?? 0),
      cache_read_input_tokens: acc.cache_read_input_tokens + (u.cache_read_input_tokens ?? 0),
      cache_creation_input_tokens:
        acc.cache_creation_input_tokens + (u.cache_creation_input_tokens ?? 0),
      output_tokens: acc.output_tokens + (u.output_tokens ?? 0),
    }),
    { input_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 0 },
  )
}
