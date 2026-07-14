'use client';

/**
 * T4.2 — admin editor for Tour Mode geofence spots (tour_guide_spots).
 *
 * Pick a tour → edit each spot's coordinates / radii / poi_key / per-locale
 * content jsonb → save through PUT /api/admin/tours/[id]/tour-mode. Saves are
 * live: the next room join's snapshot carries the change (AC). "Import
 * extraction JSON" pastes a data/tour-stop-content bundle stop straight into
 * the content field.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import poiKnowledgeBase from '@/data/poi_kb/poi_knowledge_base_v1.29.json';

interface SpotRow {
  id?: string;
  title: string;
  description: string | null;
  audio_url: string | null;
  latitude: number | string;
  longitude: number | string;
  trigger_radius_m: number | string;
  exit_radius_m: number | string | null;
  sort_order: number;
  poi_key: string | null;
  content: Record<string, unknown>;
}

interface TourOption {
  id: string;
  title: string;
}

const POI_KEYS = Object.keys(poiKnowledgeBase).filter((key) => key !== '_metadata').sort();

async function getToken(): Promise<string> {
  const sess = await supabase?.auth.getSession();
  const token = sess?.data.session?.access_token;
  if (!token) throw new Error('세션이 만료되었습니다. 다시 로그인하세요.');
  return token;
}

function ContentEditor({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setText(JSON.stringify(value, null, 2));
    setInvalid(false);
  }, [value]);
  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            const parsed = JSON.parse(e.target.value);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              setInvalid(false);
              onChange(parsed as Record<string, unknown>);
            } else setInvalid(true);
          } catch {
            setInvalid(true);
          }
        }}
        rows={6}
        spellCheck={false}
        className={`w-full rounded-lg border p-2 font-mono text-[11px] ${invalid ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
      />
      {invalid && <p className="text-[11px] text-red-600">JSON이 유효하지 않습니다 — 저장 시 마지막 유효 상태가 사용됩니다.</p>}
    </div>
  );
}

export default function TourModeSpotsAdminPage() {
  const [tours, setTours] = useState<TourOption[]>([]);
  const [tourId, setTourId] = useState('');
  const [spots, setSpots] = useState<SpotRow[]>([]);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const token = await getToken();
        const res = await fetch('/api/admin/tours?limit=200', {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
          cache: 'no-store',
        });
        const json = await res.json();
        const list = (json.tours ?? json.data ?? []) as Array<{ id: string; title: string }>;
        setTours(list.map((t) => ({ id: t.id, title: t.title })));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '투어 목록을 불러오지 못했습니다');
      }
    })();
  }, []);

  const load = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setDeleteIds([]);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/tours/${id}/tour-mode`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '불러오기 실패');
      setSpots(json.tour_guide_spots as SpotRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tourId) void load(tourId);
  }, [tourId, load]);

  const update = (index: number, patch: Partial<SpotRow>) => {
    setSpots((prev) => prev.map((spot, i) => (i === index ? { ...spot, ...patch } : spot)));
  };

  const addSpot = () => {
    setSpots((prev) => [
      ...prev,
      {
        title: '',
        description: null,
        audio_url: null,
        latitude: '',
        longitude: '',
        trigger_radius_m: 150,
        exit_radius_m: null,
        sort_order: prev.length + 1,
        poi_key: null,
        content: {},
      },
    ]);
  };

  const removeSpot = (index: number) => {
    const spot = spots[index];
    if (spot.id) setDeleteIds((prev) => [...prev, spot.id!]);
    setSpots((prev) => prev.filter((_, i) => i !== index));
  };

  const save = async () => {
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/tours/${tourId}/tour-mode`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ spots, deleteIds }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '저장 실패');
      setSpots(json.tour_guide_spots as SpotRow[]);
      setDeleteIds([]);
      toast.success('저장됨 — 다음 룸 입장 스냅샷부터 반영됩니다');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const tourOptions = useMemo(
    () => [...tours].sort((a, b) => a.title.localeCompare(b.title)),
    [tours],
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900">투어모드 지오펜스 스팟</h1>
      <p className="mt-1 text-sm text-gray-500">
        도착 반경·콘텐츠(로케일별 jsonb)·poi_key 폴백을 편집합니다. 저장 즉시 다음 룸 입장에 반영됩니다.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <select
          value={tourId}
          onChange={(e) => setTourId(e.target.value)}
          className="w-full max-w-md rounded-lg border border-gray-200 px-3 py-2 text-sm"
        >
          <option value="">투어 선택…</option>
          {tourOptions.map((tour) => (
            <option key={tour.id} value={tour.id}>
              {tour.title}
            </option>
          ))}
        </select>
        {tourId && (
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || loading}
            className="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        )}
      </div>

      {loading && <p className="mt-6 text-sm text-gray-400">불러오는 중…</p>}

      {!loading && tourId && (
        <div className="mt-4 space-y-4">
          {spots.map((spot, index) => (
            <div key={spot.id ?? `new-${index}`} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <input
                  value={spot.title}
                  onChange={(e) => update(index, { title: e.target.value })}
                  placeholder="스팟 이름"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold"
                />
                <button
                  type="button"
                  onClick={() => removeSpot(index)}
                  className="shrink-0 rounded-lg px-3 py-2 text-sm text-red-600"
                >
                  삭제
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                <label className="text-xs text-gray-500">
                  위도
                  <input
                    value={String(spot.latitude ?? '')}
                    onChange={(e) => update(index, { latitude: e.target.value })}
                    className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs text-gray-500">
                  경도
                  <input
                    value={String(spot.longitude ?? '')}
                    onChange={(e) => update(index, { longitude: e.target.value })}
                    className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs text-gray-500">
                  진입 반경(m)
                  <input
                    value={String(spot.trigger_radius_m ?? '')}
                    onChange={(e) => update(index, { trigger_radius_m: e.target.value })}
                    className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs text-gray-500">
                  이탈 반경(m, 빈값=1.5×)
                  <input
                    value={spot.exit_radius_m === null ? '' : String(spot.exit_radius_m)}
                    onChange={(e) => update(index, { exit_radius_m: e.target.value === '' ? null : e.target.value })}
                    className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs text-gray-500">
                  poi_key 폴백
                  <select
                    value={spot.poi_key ?? ''}
                    onChange={(e) => update(index, { poi_key: e.target.value || null })}
                    className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                  >
                    <option value="">(없음)</option>
                    {POI_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-gray-500">
                  콘텐츠 jsonb (로케일 키 → 스톱 객체 — 추출 JSON의 stops[n].content를 그대로 붙여넣기)
                </summary>
                <div className="mt-1.5">
                  <ContentEditor value={spot.content ?? {}} onChange={(content) => update(index, { content })} />
                </div>
              </details>
            </div>
          ))}
          <button
            type="button"
            onClick={addSpot}
            className="w-full rounded-xl border border-dashed border-gray-300 py-3 text-sm font-medium text-gray-500"
          >
            + 스팟 추가
          </button>
        </div>
      )}
    </div>
  );
}
