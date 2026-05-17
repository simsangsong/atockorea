export default function SessionsPlaceholder() {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center">
      <h2 className="text-lg font-semibold text-slate-800">세션 Timeline</h2>
      <p className="mt-2 text-sm text-slate-600">Phase 5 (Session Timeline)에서 활성화됩니다.</p>
      <p className="mt-1 text-xs text-slate-400">
        세션별 이벤트 시퀀스 chronological view. DOM 녹화 X — 이벤트 + payload + 시간만.
      </p>
    </div>
  );
}
