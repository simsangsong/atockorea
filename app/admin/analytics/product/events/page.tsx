export default function EventsPlaceholder() {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center">
      <h2 className="text-lg font-semibold text-slate-800">이벤트 Explorer</h2>
      <p className="mt-2 text-sm text-slate-600">
        Phase 2 (Events Explorer)에서 활성화됩니다.
      </p>
      <p className="mt-1 text-xs text-slate-400">
        이벤트별 시계열 차트 + payload 분포 + 필터(locale/device/viewport/UTM).
      </p>
    </div>
  );
}
