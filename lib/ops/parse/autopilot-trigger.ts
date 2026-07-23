// Parser Autopilot — IMMEDIATE event-driven trigger (vs the daily cron sweep).
//
// Business reality: a NEW tenant whose first sheet is an unseen structure can
// fall through both the deterministic layers AND (if the LLM errors/escalates
// poorly) the LLM — and a 0-parsed first impression churns them on the spot.
// Waiting for a once-a-day patrol is unacceptable. So the moment a run hits a
// NOVEL format (no matched template) that still leaves signal-present leftover,
// we fire the GitHub repository_dispatch right then — latency = minutes, not a
// day — so the autopilot starts hardening that shape immediately.
//
// This is NOT "an agent on every sheet": shouldTriggerAutopilot() gates on
// novel-format + signal-present-leftover ≥ floor, so a known/working format (the
// common case, incl. anything the LLM already parses) never triggers. The agent
// loop hardens FUTURE imports of that shape; the live screen is still served by
// the LLM fallback + graceful review UI (this trigger does not block or alter
// the import response — it is fire-and-forget).
//
// Privacy: forwards ONLY masked excerpts (maskLine() output) + counts. No raw
// PII, no per-tenant identity beyond a coarse fingerprint.

/** Decide whether a finished run is the "unseen structure failed badly" case
 *  worth an immediate autopilot dispatch. Pure + unit-testable. */
export function shouldTriggerAutopilot(input: {
  /** A known format template matched this paste (then it is not novel). */
  matchedTemplate: boolean
  /** Count of final-leftover failures whose source carried a signal (#18). */
  signalPresentLeftovers: number
  /** Floor so a single stray line doesn't spin up the agent. */
  floor?: number
}): boolean {
  const floor = input.floor ?? 3
  if (input.matchedTemplate) return false
  return input.signalPresentLeftovers >= floor
}

export interface AutopilotDispatchInput {
  /** Coarse, non-PII shape fingerprint of the paste. */
  formatFingerprint: string
  shape: string
  signalPresentLeftovers: number
  /** Already-masked excerpts (maskLine output) — capped by the caller. */
  maskedSamples: string[]
}

/**
 * Fire repository_dispatch(parser-autopilot) so the cloud agent wakes NOW.
 * Best-effort + fire-and-forget: never throws, never blocks the import. No-op
 * (false) unless GITHUB_AUTOPILOT_TOKEN + GITHUB_REPO are configured.
 */
export async function dispatchAutopilot(input: AutopilotDispatchInput): Promise<boolean> {
  const token = process.env.GITHUB_AUTOPILOT_TOKEN
  const repo = process.env.GITHUB_REPO // "owner/name"
  if (!token || !repo) return false

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'parser-autopilot',
        client_payload: {
          reason: 'novel_format_failure',
          format_fingerprint: input.formatFingerprint.slice(0, 32),
          shape: input.shape,
          signal_present_leftovers: input.signalPresentLeftovers,
          samples: input.maskedSamples.slice(0, 20).map(s => s.slice(0, 240)),
        },
      }),
    })
    return res.ok
  } catch {
    return false
  }
}
