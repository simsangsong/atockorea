'use client';

/**
 * Admin match_pois editor — list + editor, mirroring /admin/products/v2.
 *
 * Reads/edits the `public.match_pois` POI catalog behind the admin gate.
 * Saving goes through the auto-upsert PATCH /api/admin/match-pois/[poi_key]
 * (new poi_key INSERTs, existing UPDATEs). Promotes planner §E "/admin/pois
 * browse + edit UI" — see docs/itinerary-builder-plan.md §F Phase 8 (D10).
 */

import { useEffect, useState } from 'react';
import { MapPin, AlertTriangle, RotateCw } from 'lucide-react';
import { PoiListPane } from './_components/PoiListPane';
import { PoiEditorPane } from './_components/PoiEditorPane';
import { usePoiList } from './_hooks/usePoiList';
import { usePoiRow } from './_hooks/usePoiRow';
import type { PoiRow } from './_hooks/types';

export default function MatchPoisPage() {
  const list = usePoiList();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const row = usePoiRow(selectedKey);

  // Auto-select the first POI once the list loads.
  useEffect(() => {
    if (!selectedKey && list.items.length > 0) setSelectedKey(list.items[0].poi_key);
  }, [list.items, selectedKey]);

  const onSaved = (_row: PoiRow, _created: boolean) => {
    void list.refresh();
  };

  return (
    <div className="-m-6 h-[calc(100vh-3.5rem)] flex bg-slate-50">
      <PoiListPane
        items={list.items}
        loading={list.loading}
        error={list.error}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
        onRefresh={list.refresh}
        onCreateNew={setSelectedKey}
      />

      {!selectedKey ? (
        <EmptyEditor />
      ) : row.loading ? (
        <EditorSkeleton />
      ) : row.error ? (
        <EditorError message={row.error} onRetry={row.refresh} />
      ) : (
        <PoiEditorPane
          key={selectedKey}
          poiKey={selectedKey}
          initialRow={row.data}
          isNew={row.notFound}
          onSaved={onSaved}
          onBackToList={() => setSelectedKey(null)}
        />
      )}
    </div>
  );
}

function EmptyEditor() {
  return (
    <section className="flex-1 flex flex-col items-center justify-center bg-slate-50 px-6">
      <div className="w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-sky-600 flex items-center justify-center shadow-lg">
        <MapPin className="size-8 text-white" />
      </div>
      <h2 className="text-lg font-semibold text-slate-900 mb-1">매칭 POI 관리</h2>
      <p className="text-sm text-slate-500 max-w-md text-center">
        왼쪽에서 POI를 선택하면 편집기가 열립니다. 상단 <strong>+</strong> 버튼으로 새 POI를 만들 수 있습니다.
      </p>
    </section>
  );
}

function EditorSkeleton() {
  return (
    <section className="flex-1 bg-slate-50 px-5 py-5">
      <div className="space-y-3 max-w-3xl">
        <div className="h-32 bg-white border border-slate-200 rounded-xl animate-pulse" />
        <div className="h-48 bg-white border border-slate-200 rounded-xl animate-pulse" />
        <div className="h-48 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    </section>
  );
}

function EditorError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="flex-1 flex flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <div className="w-12 h-12 mb-3 rounded-xl bg-rose-100 flex items-center justify-center">
        <AlertTriangle className="size-6 text-rose-600" />
      </div>
      <h2 className="text-base font-semibold text-slate-900 mb-1">로드 실패</h2>
      <p className="text-sm text-slate-500 mb-4 max-w-md">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-900 text-white hover:bg-slate-800"
      >
        <RotateCw className="size-3.5" /> 다시 시도
      </button>
    </section>
  );
}
