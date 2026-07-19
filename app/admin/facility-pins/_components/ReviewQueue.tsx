'use client';

/**
 * Facility-pins review queue (§H verification gate — "검수분만 노출").
 *
 * The per-POI editor is fine for one attraction, but 400+ auto-collected pins
 * (Kakao restrooms, Google restaurants) all land is_verified=false, and serving
 * now hides anything unverified. This surfaces the whole backlog at once: one
 * Static thumbnail per POI (numbers match the row list) so the operator can
 * eyeball placement, then approve / reject each pin — or bulk-approve a POI —
 * without hunting POI-by-POI. "교정" jumps to the map editor to relocate an
 * outlier (relocating auto-verifies it server-side).
 *
 * Verify = PATCH {is_verified:true}; reject = DELETE (soft) — both reuse the
 * existing per-id route. Plan: docs/tour-room-facility-pins-master-plan-2026-07-19.md
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Utensils, Toilet, Camera, Star, Check, X, Pencil, MapPin, RefreshCw } from 'lucide-react';
import { facilityStaticMapPath, pinDirectionsUrl, facilityPinFromRow } from '@/lib/tour-room/facilityPins';

type ReviewKind = 'restaurant' | 'restroom' | 'photo';

export interface ReviewPin {
  id: string;
  poi_key: string;
  kind: ReviewKind;
  lat: number;
  lng: number;
  name: string | null;
  name_i18n: Record<string, string> | null;
  source: 'places_auto' | 'curated';
  place_id: string | null;
  distance_m: number | null;
  rating: number | null;
  review_count: number | null;
  sort_order: number;
}

interface Counts {
  restaurant: number;
  restroom: number;
  photo: number;
  total: number;
}

export interface ReviewPoiMeta {
  name: string;
  region: string | null;
}

const KIND_META: Record<ReviewKind, { label: string; color: string; Icon: typeof Utensils }> = {
  restaurant: { label: '맛집', color: '#f59e0b', Icon: Utensils },
  restroom: { label: '화장실', color: '#2563eb', Icon: Toilet },
  photo: { label: '포토', color: '#db2777', Icon: Camera },
};

/** Restrooms/photos beyond this from the attraction centre are likely off-target. */
const FAR_THRESHOLD_M = 400;

function compactCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n);
}

export default function ReviewQueue({
  authedFetch,
  poiIndex,
  onEditPoi,
}: {
  authedFetch: (url: string, init?: RequestInit) => Promise<Response>;
  poiIndex: Map<string, ReviewPoiMeta>;
  onEditPoi: (poiKey: string) => void;
}) {
  const [pins, setPins] = useState<ReviewPin[]>([]);
  const [counts, setCounts] = useState<Counts>({ restaurant: 0, restroom: 0, photo: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());

  const [kindFilter, setKindFilter] = useState<'all' | ReviewKind>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [farFirst, setFarFirst] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch('/api/admin/facility-pins/review');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `검수 큐 로드 실패 (${res.status})`);
      setPins(json.data as ReviewPin[]);
      setCounts(json.counts as Counts);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPins([]);
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  // Drop verified/rejected pins locally so the queue shrinks as you work.
  const removePins = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setPins((prev) => {
      const next = prev.filter((p) => !idSet.has(p.id));
      const c: Counts = { restaurant: 0, restroom: 0, photo: 0, total: 0 };
      for (const p of next) {
        c.total += 1;
        c[p.kind] += 1;
      }
      setCounts(c);
      return next;
    });
  }, []);

  const mutate = useCallback(
    async (ids: string[], run: (id: string) => Promise<Response>) => {
      setPending((prev) => new Set([...prev, ...ids]));
      setError(null);
      try {
        const results = await Promise.all(ids.map(run));
        const failed = results.filter((r) => !r.ok);
        if (failed.length) throw new Error(`${failed.length}개 처리 실패`);
        removePins(ids);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setPending((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
      }
    },
    [removePins],
  );

  const verify = useCallback(
    (ids: string[]) =>
      mutate(ids, (id) =>
        authedFetch(`/api/admin/facility-pins/${id}`, { method: 'PATCH', body: JSON.stringify({ is_verified: true }) }),
      ),
    [mutate, authedFetch],
  );

  const reject = useCallback(
    (id: string) => mutate([id], (pid) => authedFetch(`/api/admin/facility-pins/${pid}`, { method: 'DELETE' })),
    [mutate, authedFetch],
  );

  // Regions present in the current queue (for the region filter).
  const regions = useMemo(() => {
    const set = new Set<string>();
    for (const p of pins) {
      const r = poiIndex.get(p.poi_key)?.region;
      if (r) set.add(r);
    }
    return Array.from(set).sort();
  }, [pins, poiIndex]);

  // Filter → sort → group by POI (first-seen order preserved).
  const groups = useMemo(() => {
    let rows = pins;
    if (kindFilter !== 'all') rows = rows.filter((p) => p.kind === kindFilter);
    if (regionFilter !== 'all') rows = rows.filter((p) => (poiIndex.get(p.poi_key)?.region ?? '') === regionFilter);
    if (farFirst) {
      rows = [...rows].sort((a, b) => (b.distance_m ?? -1) - (a.distance_m ?? -1));
    }
    const map = new Map<string, ReviewPin[]>();
    for (const p of rows) {
      const arr = map.get(p.poi_key);
      if (arr) arr.push(p);
      else map.set(p.poi_key, [p]);
    }
    return Array.from(map.entries());
  }, [pins, kindFilter, regionFilter, farFirst, poiIndex]);

  const shownCount = groups.reduce((n, [, arr]) => n + arr.length, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* filter bar */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-admin-border bg-admin-surface px-4 py-3">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <KindChip label={`전체 ${counts.total}`} active={kindFilter === 'all'} onClick={() => setKindFilter('all')} />
          <KindChip label={`맛집 ${counts.restaurant}`} active={kindFilter === 'restaurant'} color="#f59e0b" onClick={() => setKindFilter('restaurant')} />
          <KindChip label={`화장실 ${counts.restroom}`} active={kindFilter === 'restroom'} color="#2563eb" onClick={() => setKindFilter('restroom')} />
          <KindChip label={`포토 ${counts.photo}`} active={kindFilter === 'photo'} color="#db2777" onClick={() => setKindFilter('photo')} />
        </div>
        {regions.length > 0 ? (
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="rounded-md border border-slate-300 py-1.5 pl-2 pr-7 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none"
          >
            <option value="all">전체 지역</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="button"
          onClick={() => setFarFirst((v) => !v)}
          className={`rounded-md border px-2 py-1.5 text-xs font-semibold ${
            farFirst ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
          }`}
          title={`중심에서 ${FAR_THRESHOLD_M}m 넘는 핀은 오탐일 확률이 높아요`}
        >
          먼 핀 먼저
        </button>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="ml-auto flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> 새로고침
        </button>
      </div>

      {error ? <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">{error}</div> : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? (
          <p className="text-sm text-slate-500">검수 큐 불러오는 중…</p>
        ) : counts.total === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Check className="mb-3 size-10 text-emerald-400" />
            <p className="text-sm font-medium text-slate-700">미검수 핀이 없어요.</p>
            <p className="mt-1 text-xs text-slate-500">모든 핀이 검수됐거나, 자동수집을 아직 실행하지 않았어요.</p>
          </div>
        ) : shownCount === 0 ? (
          <p className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            이 필터에 해당하는 미검수 핀이 없어요.
          </p>
        ) : (
          <div className="mx-auto max-w-2xl space-y-4">
            <p className="text-xs text-slate-500">
              {shownCount}개 미검수 핀 · {groups.length}개 관광지 — 검수하면 손님 지도카드에 노출돼요.
            </p>
            {groups.map(([poiKey, groupPins]) => (
              <ReviewPoiCard
                key={poiKey}
                poiKey={poiKey}
                meta={poiIndex.get(poiKey)}
                pins={groupPins}
                pending={pending}
                onVerify={verify}
                onReject={reject}
                onEdit={() => onEditPoi(poiKey)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KindChip({ label, active, color, onClick }: { label: string; active: boolean; color?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
        active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {color ? <span className="size-2 rounded-full" style={{ background: color }} /> : null}
      {label}
    </button>
  );
}

function ReviewPoiCard({
  poiKey,
  meta,
  pins,
  pending,
  onVerify,
  onReject,
  onEdit,
}: {
  poiKey: string;
  meta: ReviewPoiMeta | undefined;
  pins: ReviewPin[];
  pending: Set<string>;
  onVerify: (ids: string[]) => void;
  onReject: (id: string) => void;
  onEdit: () => void;
}) {
  const [imgOk, setImgOk] = useState(true);
  const path = facilityStaticMapPath(pins.map((p) => facilityPinFromRow(p as unknown as Record<string, unknown>)), { width: 480, height: 200 });
  const allBusy = pins.every((p) => pending.has(p.id));

  return (
    <div className="overflow-hidden rounded-xl border border-admin-border bg-admin-surface">
      <div className="flex items-center justify-between gap-3 border-b border-admin-border px-4 py-2.5">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900">{meta?.name || poiKey}</h3>
          <p className="truncate text-xs text-slate-500">
            {meta?.region || '—'} · 미검수 {pins.length}개
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <Pencil className="size-3" /> 지도편집
          </button>
          <button
            type="button"
            onClick={() => onVerify(pins.map((p) => p.id))}
            disabled={allBusy}
            className="flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Check className="size-3.5" /> 전체 검수
          </button>
        </div>
      </div>

      {imgOk && path ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/maps/static${path}`}
          alt={`${meta?.name || poiKey} 핀 지도`}
          loading="lazy"
          onError={() => setImgOk(false)}
          className="h-44 w-full border-b border-admin-border object-cover"
        />
      ) : (
        <div className="flex h-16 w-full items-center justify-center border-b border-admin-border bg-slate-50 text-slate-400">
          <MapPin className="size-6" />
        </div>
      )}

      <ul className="divide-y divide-admin-border">
        {pins.map((pin, i) => (
          <ReviewPinRow
            key={pin.id}
            pin={pin}
            index={i + 1}
            busy={pending.has(pin.id)}
            onVerify={() => onVerify([pin.id])}
            onReject={() => onReject(pin.id)}
          />
        ))}
      </ul>
    </div>
  );
}

function ReviewPinRow({
  pin,
  index,
  busy,
  onVerify,
  onReject,
}: {
  pin: ReviewPin;
  index: number;
  busy: boolean;
  onVerify: () => void;
  onReject: () => void;
}) {
  const meta = KIND_META[pin.kind];
  const Icon = meta.Icon;
  const label = pin.name?.trim() || meta.label;

  return (
    <li className={`flex items-center gap-2.5 px-4 py-2.5 ${busy ? 'opacity-40' : ''}`}>
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
        style={{ background: meta.color }}
      >
        {index}
      </span>
      <Icon className="size-4 shrink-0" style={{ color: meta.color }} />
      <div className="min-w-0 flex-1">
        <a
          href={pinDirectionsUrl(facilityPinFromRow(pin as unknown as Record<string, unknown>))}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-sm text-slate-900 hover:underline"
          title="구글 지도에서 위치 확인"
        >
          {label}
        </a>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          {pin.kind === 'restaurant' && typeof pin.rating === 'number' ? (
            <span className="flex items-center gap-0.5 text-amber-600">
              <Star className="size-2.5 fill-current" /> {pin.rating.toFixed(1)}
              {typeof pin.review_count === 'number' && pin.review_count > 0 ? (
                <span className="text-slate-400">·{compactCount(pin.review_count)}</span>
              ) : null}
            </span>
          ) : null}
          {typeof pin.distance_m === 'number' ? (
            <span className={pin.distance_m > FAR_THRESHOLD_M ? 'font-semibold text-rose-600' : ''}>
              {Math.round(pin.distance_m)}m
            </span>
          ) : null}
          <span className={`rounded px-1 ${pin.source === 'curated' ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-700'}`}>
            {pin.source === 'curated' ? '직접' : '자동'}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onReject}
          disabled={busy}
          title="거절 (비활성)"
          className="flex size-8 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
        >
          <X className="size-4" />
        </button>
        <button
          type="button"
          onClick={onVerify}
          disabled={busy}
          title="검수 승인"
          className="flex size-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50"
        >
          <Check className="size-4" />
        </button>
      </div>
    </li>
  );
}
