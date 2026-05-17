export default function RetentionPlaceholder() {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center">
      <h2 className="text-lg font-semibold text-slate-800">리텐션 / 코호트</h2>
      <p className="mt-2 text-sm text-slate-600">Phase 4 (Retention)에서 활성화됩니다.</p>
      <p className="mt-1 text-xs text-slate-400">
        D+1 / D+7 / D+30 코호트 매트릭스 (heatmap).
      </p>
    </div>
  );
}
