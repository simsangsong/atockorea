'use client';

/**
 * UX-003 / UX-D6 — a wait has a shape; a sentence is not a state.
 *
 * The census that opened the UI/UX audit found three loading idioms living
 * side by side (skeleton 13 files · spinner 15 · bare string 21), and the
 * bare string was the most common one. UX-D6 settles it: skeleton when the
 * incoming content has a known shape, spinner for short unknown-shape waits,
 * and a string only ever RIDES ALONG with one of those — never alone.
 *
 * These two are the shared vocabulary for that rule, in the exact idioms the
 * app already uses (GuideConsole's spinner ring and UX-001's pulse bars), so
 * adopting them changes no visual language — it just removes the naked
 * sentences. Both trees import from here; tour-ops already leans on
 * tour-mode primitives (ChatListRow, roomHue).
 */

/** Spinner + caption, centred. For waits whose shape we do not know. */
export function LoadingHint({ label, className = '' }: { label: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 ${className}`} role="status" data-testid="loading-hint">
      <span
        className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--tr-accent)] border-t-transparent"
        aria-hidden
      />
      <span className="tr-label text-[var(--tr-ink-3)]">{label}</span>
    </div>
  );
}

/** Pulsing list-row bars. For waits that will resolve into a list. */
export function SkeletonRows({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-2.5 ${className}`} aria-hidden data-testid="skeleton-rows">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-1.5 rounded-xl bg-[var(--tr-surface)] px-3 py-2.5">
          <div className="h-3.5 w-1/2 animate-pulse rounded bg-[var(--tr-surface-2)]" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--tr-surface-2)]" />
        </div>
      ))}
    </div>
  );
}
