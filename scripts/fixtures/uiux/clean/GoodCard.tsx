/**
 * NEGATIVE CONTROL — must NOT be flagged by qa-uiux-consistency.
 *
 * Everything here is the shape the C axis wants: colour comes from tokens, and
 * the loading string sits next to a skeleton rather than standing alone.
 * If the detector ever flags this file it has become too strict, and a gate
 * that blocks correct code gets switched off within a week.
 */
export function GoodCard({ loading }: { loading: boolean }) {
  if (loading) {
    return (
      <div className="tr-card p-3" data-testid="good-card-loading">
        <div className="h-4 w-32 animate-pulse rounded bg-[var(--tr-surface-2)]" />
        <p className="tr-meta mt-2 text-[var(--tr-ink-3)]">불러오는 중…</p>
      </div>
    );
  }
  return (
    <div className="tr-card p-3 text-[var(--tr-ink)]" style={{ background: 'var(--tr-surface)' }}>
      <button type="button" className="tr-cta-hero min-h-[44px] w-full">
        확인
      </button>
    </div>
  );
}
