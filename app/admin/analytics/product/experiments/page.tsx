export default function ExperimentsPlaceholder() {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center">
      <h2 className="text-lg font-semibold text-slate-800">A/B 실험</h2>
      <p className="mt-2 text-sm text-slate-600">Phase 6 (A/B Experiments)에서 활성화됩니다.</p>
      <p className="mt-1 text-xs text-slate-400">
        variant별 primary metric 비교 + 간이 카이제곱 유의성. v3 landing Phase D unblock 시점.
      </p>
    </div>
  );
}
