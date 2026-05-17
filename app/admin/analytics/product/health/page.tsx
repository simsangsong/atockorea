export default function HealthPlaceholder() {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center">
      <h2 className="text-lg font-semibold text-slate-800">수집 헬스</h2>
      <p className="mt-2 text-sm text-slate-600">Phase 7 (운영 / 헬스)에서 활성화됩니다.</p>
      <p className="mt-1 text-xs text-slate-400">
        ingestion 성공률, 이상치 detect, PII audit, 90일 익명화 cron 상태.
      </p>
    </div>
  );
}
