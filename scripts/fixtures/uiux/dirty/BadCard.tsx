/**
 * POSITIVE CONTROL — must BE flagged by qa-uiux-consistency, on both counts.
 *
 * A hardcoded hex and a raw Tailwind palette class where a token belongs, and a
 * loading string with no skeleton or spinner anywhere near it. If the detector
 * stops flagging this file it has silently stopped measuring, which is the
 * failure UX-000 catalogues six times over.
 */
export function BadCard({ loading }: { loading: boolean }) {
  if (loading) {
    // no skeleton, no spinner — a bare string standing in for a state
    return <p className="text-slate-500">불러오는 중…</p>;
  }
  return (
    <div className="p-3" style={{ background: '#eef1ee', color: '#2e5e4e' }}>
      <button type="button" className="bg-emerald-600 text-white">
        확인
      </button>
    </div>
  );
}
