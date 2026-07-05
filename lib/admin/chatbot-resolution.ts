// W6.5 — chatbot resolution rate.
//
// "Resolved" is defined conservatively from the negative signals we actually
// have: a user turn counts as resolved when it neither escalated to a human
// nor drew a thumbs-down. (We lack a positive "issue closed" signal, so this
// is an upper bound on frustration, not a satisfaction score — the dashboard
// labels it accordingly.)

export function computeResolutionRate(input: {
  userMessages: number;
  escalatedMessages: number;
  negativeFeedback: number;
}): number | null {
  const { userMessages, escalatedMessages, negativeFeedback } = input;
  if (!Number.isFinite(userMessages) || userMessages <= 0) return null;
  const unresolved = Math.max(0, escalatedMessages) + Math.max(0, negativeFeedback);
  return Math.max(0, userMessages - unresolved) / userMessages;
}
