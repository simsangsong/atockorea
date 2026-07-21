'use client';

/**
 * Facility-pins admin editor (W1.2, F-D10 manual CRUD).
 *
 * Left: attraction (match_pois) search/select. Right: an interactive map of the
 * selected POI's restroom/photo pins with click-to-add, plus a pin list for
 * inline edit (name / kind), soft-delete + restore, and hard-delete. Correcting
 * an auto-collected restroom promotes it to verified (server-side).
 *
 * Plan: docs/tour-room-facility-pins-master-plan-2026-07-19.md
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Search, Trash2, RotateCcw, Camera, Toilet, Utensils, Star, Check, Plus, ArrowLeft, ListChecks, Pencil, Ticket } from 'lucide-react';
import { getAdminAccessToken } from '@/app/admin/match-pois/_hooks/usePoiRow';
import type { EditorPin } from './_components/PinMap';
import ReviewQueue, { type ReviewPoiMeta } from './_components/ReviewQueue';

const PinMap = dynamic(() => import('./_components/PinMap'), { ssr: false });

/** Only restroom / photo can be added by map-click; restaurants are auto-collected. */
type AddKind = 'restroom' | 'photo' | 'ticket_booth';
type EditorMode = 'edit' | 'review';

interface PoiItem {
  poi_key: string;
  name_en: string | null;
  name_ko: string | null;
  region: string | null;
  is_attraction: boolean | null;
  lat: number | null;
  lng: number | null;
}

interface PinRow extends EditorPin {
  poi_key: string;
  name: string | null;
  source: 'places_auto' | 'curated';
  is_verified: boolean;
  rating?: number | null;
  review_count?: number | null;
}

async function authedFetch(url: string, init: RequestInit = {}) {
  const token = await getAdminAccessToken();
  return fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    credentials: 'include',
    cache: 'no-store',
  });
}

function poiName(p: PoiItem): string {
  return p.name_ko || p.name_en || p.poi_key;
}

export default function FacilityPinsPage() {
  const [pois, setPois] = useState<PoiItem[]>([]);
  const [poiLoading, setPoiLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<PoiItem | null>(null);

  const [pins, setPins] = useState<PinRow[]>([]);
  const [pinsLoading, setPinsLoading] = useState(false);
  const [addKind, setAddKind] = useState<AddKind>('restroom');
  const [mode, setMode] = useState<EditorMode>('edit');
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Load the attraction catalog (only POIs with coordinates are pinnable).
  useEffect(() => {
    (async () => {
      setPoiLoading(true);
      try {
        const res = await authedFetch('/api/admin/match-pois');
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || `POI 로드 실패 (${res.status})`);
        const rows = (json.data as PoiItem[]).filter((p) => p.lat != null && p.lng != null);
        setPois(rows);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setPoiLoading(false);
      }
    })();
  }, []);

  const loadPins = useCallback(async (poiKey: string) => {
    setPinsLoading(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/facility-pins?poi_key=${encodeURIComponent(poiKey)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `핀 로드 실패 (${res.status})`);
      setPins(json.data as PinRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPins([]);
    } finally {
      setPinsLoading(false);
    }
  }, []);

  const selectPoi = (p: PoiItem) => {
    setSelected(p);
    setSelectedPinId(null);
    void loadPins(p.poi_key);
  };

  const addPin = async (lat: number, lng: number) => {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authedFetch('/api/admin/facility-pins', {
        method: 'POST',
        body: JSON.stringify({ poi_key: selected.poi_key, kind: addKind, lat, lng }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || '핀 추가 실패');
      await loadPins(selected.poi_key);
      if (json.data?.id) setSelectedPinId(json.data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const patchPin = async (id: string, patch: Record<string, unknown>) => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/facility-pins/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || '수정 실패');
      await loadPins(selected.poi_key);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const deletePin = async (id: string, hard: boolean) => {
    if (!selected) return;
    if (hard && !window.confirm('이 핀을 완전히 삭제할까요? 복구할 수 없어요.')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/facility-pins/${id}${hard ? '?hard=1' : ''}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || '삭제 실패');
      await loadPins(selected.poi_key);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const filteredPois = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = q
      ? pois.filter(
          (p) =>
            poiName(p).toLowerCase().includes(q) ||
            p.poi_key.toLowerCase().includes(q) ||
            (p.region ?? '').toLowerCase().includes(q),
        )
      : pois;
    return rows.slice(0, 200);
  }, [pois, search]);

  const activeCount = pins.filter((p) => p.is_active).length;

  // poi_key → display name / region, for the review queue to group by POI.
  const poiIndex = useMemo(() => {
    const m = new Map<string, ReviewPoiMeta>();
    for (const p of pois) m.set(p.poi_key, { name: poiName(p), region: p.region });
    return m;
  }, [pois]);

  // "지도편집" from the review queue → open that POI in the editor to relocate.
  const handleEditPoi = useCallback(
    (poiKey: string) => {
      const p = pois.find((x) => x.poi_key === poiKey);
      if (!p) return;
      setSelected(p);
      setSelectedPinId(null);
      void loadPins(p.poi_key);
      setMode('edit');
    },
    [pois, loadPins],
  );

  return (
    <div className="-m-6 flex h-[calc(100vh-3.5rem)] flex-col bg-admin-bg">
      {/* top bar — page title + edit/review mode toggle */}
      <div className="flex items-center gap-2 border-b border-admin-border bg-admin-surface px-4 py-2">
        <MapPin className="size-4 text-emerald-600" />
        <h1 className="text-sm font-semibold text-slate-900">편의시설 핀</h1>
        <div className="ml-auto flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <ModeBtn label="편집" icon={Pencil} active={mode === 'edit'} onClick={() => setMode('edit')} />
          <ModeBtn label="검수 큐" icon={ListChecks} active={mode === 'review'} onClick={() => setMode('review')} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {mode === 'review' ? (
          <ReviewQueue authedFetch={authedFetch} poiIndex={poiIndex} onEditPoi={handleEditPoi} />
        ) : (
          <EditView
            poiLoading={poiLoading}
            filteredPois={filteredPois}
            search={search}
            setSearch={setSearch}
            selected={selected}
            setSelected={setSelected}
            selectPoi={selectPoi}
            pins={pins}
            pinsLoading={pinsLoading}
            addKind={addKind}
            setAddKind={setAddKind}
            selectedPinId={selectedPinId}
            setSelectedPinId={setSelectedPinId}
            error={error}
            busy={busy}
            activeCount={activeCount}
            addPin={addPin}
            patchPin={patchPin}
            deletePin={deletePin}
          />
        )}
      </div>
    </div>
  );
}

/** Small segmented-control button for the edit/review mode toggle. */
function ModeBtn({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: typeof Pencil;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
        active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      <Icon className="size-3.5" /> {label}
    </button>
  );
}

/** The original two-pane editor (POI list + per-POI map/list), extracted so the
 *  page can swap it for the review queue. */
function EditView({
  poiLoading,
  filteredPois,
  search,
  setSearch,
  selected,
  setSelected,
  selectPoi,
  pins,
  pinsLoading,
  addKind,
  setAddKind,
  selectedPinId,
  setSelectedPinId,
  error,
  busy,
  activeCount,
  addPin,
  patchPin,
  deletePin,
}: {
  poiLoading: boolean;
  filteredPois: PoiItem[];
  search: string;
  setSearch: (v: string) => void;
  selected: PoiItem | null;
  setSelected: (p: PoiItem | null) => void;
  selectPoi: (p: PoiItem) => void;
  pins: PinRow[];
  pinsLoading: boolean;
  addKind: AddKind;
  setAddKind: (k: AddKind) => void;
  selectedPinId: string | null;
  setSelectedPinId: (id: string | null) => void;
  error: string | null;
  busy: boolean;
  activeCount: number;
  addPin: (lat: number, lng: number) => void;
  patchPin: (id: string, patch: Record<string, unknown>) => void;
  deletePin: (id: string, hard: boolean) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1">
      {/* POI list — single-pane on mobile (hidden once a POI is picked), always
          shown on lg+. */}
      <aside
        className={`w-full flex-col border-r border-admin-border bg-admin-surface lg:flex lg:w-80 ${
          selected ? 'hidden' : 'flex'
        }`}
      >
        <div className="border-b border-admin-border p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">관광지 선택</p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="관광지 검색 (이름·지역)"
              className="w-full rounded-md border border-slate-300 py-2 pl-8 pr-3 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {poiLoading ? (
            <p className="p-4 text-sm text-slate-500">불러오는 중…</p>
          ) : filteredPois.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">일치하는 관광지가 없어요.</p>
          ) : (
            filteredPois.map((p) => (
              <button
                key={p.poi_key}
                type="button"
                onClick={() => selectPoi(p)}
                className={`flex w-full items-center gap-2 border-b border-admin-border px-3 py-2.5 text-left hover:bg-slate-50 ${
                  selected?.poi_key === p.poi_key ? 'bg-emerald-50' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{poiName(p)}</p>
                  <p className="truncate text-xs text-slate-500">
                    {p.region || '—'} · {p.poi_key}
                  </p>
                </div>
                {p.is_attraction ? (
                  <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                    관광지
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Editor — shown on mobile only once a POI is selected. */}
      <main className={`min-w-0 flex-1 flex-col lg:flex ${selected ? 'flex' : 'hidden lg:flex'}`}>
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <MapPin className="mb-3 size-10 text-slate-300" />
            <p className="text-sm text-slate-500">왼쪽에서 관광지를 선택하면 핀 편집기가 열려요.</p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* header + add-kind toggle */}
            <div className="flex items-center justify-between gap-3 border-b border-admin-border bg-admin-surface px-4 py-3">
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="목록으로"
                className="-ml-1 flex size-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 lg:hidden"
              >
                <ArrowLeft className="size-5" />
              </button>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold text-slate-900">{poiName(selected)}</h2>
                <p className="text-xs text-slate-500">
                  활성 핀 {activeCount}개 · 중심 {Number(selected.lat).toFixed(4)}, {Number(selected.lng).toFixed(4)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-100 p-1">
                <KindToggle kind="restroom" active={addKind === 'restroom'} onClick={() => setAddKind('restroom')} />
                <KindToggle kind="photo" active={addKind === 'photo'} onClick={() => setAddKind('photo')} />
                <KindToggle kind="ticket_booth" active={addKind === 'ticket_booth'} onClick={() => setAddKind('ticket_booth')} />
              </div>
            </div>

            {error ? (
              <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">{error}</div>
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <Plus className="size-3.5" /> 지도를 클릭하면 <b className="mx-0.5">{addKind === 'restroom' ? '화장실' : '포토스팟'}</b> 핀이 추가돼요.
              </p>
              <div className="h-[360px] shrink-0">
                <PinMap
                  center={{ lat: Number(selected.lat), lng: Number(selected.lng) }}
                  pins={pins}
                  selectedId={selectedPinId}
                  onSelectPin={setSelectedPinId}
                  onAddPin={addPin}
                />
              </div>

              {/* pin list */}
              <div className="space-y-2">
                {pinsLoading ? (
                  <p className="text-sm text-slate-500">핀 불러오는 중…</p>
                ) : pins.length === 0 ? (
                  <p className="rounded-md border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
                    아직 핀이 없어요. 지도를 클릭해 추가하세요.
                  </p>
                ) : (
                  pins
                    .map((p, i) => ({ p, activeIndex: p.is_active ? pins.filter((x, j) => x.is_active && j <= i).length : 0 }))
                    .map(({ p, activeIndex }) => (
                      <PinListRow
                        key={p.id}
                        pin={p}
                        index={activeIndex}
                        selected={selectedPinId === p.id}
                        busy={busy}
                        onSelect={() => setSelectedPinId(p.id)}
                        onRename={(name) => patchPin(p.id, { name })}
                        onToggleKind={() => patchPin(p.id, { kind: p.kind === 'restroom' ? 'photo' : 'restroom' })}
                        onSoftDelete={() => deletePin(p.id, false)}
                        onRestore={() => patchPin(p.id, { is_active: true })}
                        onHardDelete={() => deletePin(p.id, true)}
                      />
                    ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function KindToggle({ kind, active, onClick }: { kind: AddKind; active: boolean; onClick: () => void }) {
  const Icon = kind === 'restroom' ? Toilet : kind === 'ticket_booth' ? Ticket : Camera;
  const color = kind === 'restroom' ? '#2563eb' : kind === 'ticket_booth' ? '#16a34a' : '#db2777';
  const label = kind === 'restroom' ? '화장실' : kind === 'ticket_booth' ? '매표소' : '포토스팟';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
        active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      <Icon className="size-3.5" style={{ color: active ? color : undefined }} />
      {label}
    </button>
  );
}

function PinListRow({
  pin,
  index,
  selected,
  busy,
  onSelect,
  onRename,
  onToggleKind,
  onSoftDelete,
  onRestore,
  onHardDelete,
}: {
  pin: PinRow;
  index: number;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onToggleKind: () => void;
  onSoftDelete: () => void;
  onRestore: () => void;
  onHardDelete: () => void;
}) {
  const [name, setName] = useState(pin.name ?? '');
  useEffect(() => setName(pin.name ?? ''), [pin.name]);
  const dirty = (pin.name ?? '') !== name;
  const isRestroom = pin.kind === 'restroom';
  const isRestaurant = pin.kind === 'restaurant';
  const kindColor = isRestroom ? '#2563eb' : isRestaurant ? '#f59e0b' : '#db2777';
  const KindIcon = isRestroom ? Toilet : isRestaurant ? Utensils : Camera;
  const kindPlaceholder = isRestroom ? '화장실 이름 (선택)' : isRestaurant ? '식당 이름' : '포토스팟 이름 (선택)';

  return (
    <div
      onClick={onSelect}
      className={`rounded-lg border p-2.5 ${
        selected ? 'border-slate-900 bg-white' : 'border-admin-border bg-admin-surface'
      } ${pin.is_active ? '' : 'opacity-60'}`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            // Restaurants are auto-collected — no restroom/photo toggle for them.
            if (!isRestaurant) onToggleKind();
          }}
          disabled={busy || isRestaurant}
          title={isRestaurant ? '맛집 핀 (자동수집)' : '종류 전환 (화장실↔포토)'}
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-white disabled:cursor-default"
          style={{ background: kindColor }}
        >
          {pin.is_active ? <span className="text-[11px] font-bold">{index}</span> : <KindIcon className="size-3.5" />}
        </button>
        <input
          value={name}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => dirty && onRename(name.trim())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          placeholder={kindPlaceholder}
          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1.5 py-1 text-sm text-slate-900 hover:border-slate-200 focus:border-emerald-500 focus:outline-none"
        />
        {dirty ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRename(name.trim());
            }}
            disabled={busy}
            className="shrink-0 rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white"
          >
            저장
          </button>
        ) : null}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 pl-9 text-[10px]">
        <span
          className={`rounded px-1.5 py-0.5 font-semibold ${
            pin.source === 'curated' ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {pin.source === 'curated' ? '직접 입력' : '자동수집'}
        </span>
        {pin.is_verified ? (
          <span className="flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-700">
            <Check className="size-2.5" /> 검수됨
          </span>
        ) : (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-500">미검수</span>
        )}
        {isRestaurant && typeof pin.rating === 'number' ? (
          <span className="flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-700">
            <Star className="size-2.5 fill-current" /> {pin.rating.toFixed(1)}
            {typeof pin.review_count === 'number' && pin.review_count > 0 ? (
              <span className="font-normal text-amber-600">·{pin.review_count}</span>
            ) : null}
          </span>
        ) : null}
        <span className="text-slate-400">
          {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
        </span>
        <span className="ml-auto flex items-center gap-1">
          {pin.is_active ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSoftDelete();
              }}
              disabled={busy}
              className="flex items-center gap-0.5 rounded px-1.5 py-0.5 font-semibold text-slate-500 hover:bg-slate-100 hover:text-rose-600"
            >
              <Trash2 className="size-3" /> 비활성
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRestore();
                }}
                disabled={busy}
                className="flex items-center gap-0.5 rounded px-1.5 py-0.5 font-semibold text-emerald-600 hover:bg-emerald-50"
              >
                <RotateCcw className="size-3" /> 복원
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onHardDelete();
                }}
                disabled={busy}
                className="rounded px-1.5 py-0.5 font-semibold text-rose-600 hover:bg-rose-50"
              >
                완전삭제
              </button>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
