'use client';

import { useMemo, useState } from 'react';
import { Search, RefreshCw, MapPin, AlertCircle, Pin, Plus, X } from 'lucide-react';
import { REGION_CLUSTER } from '@/lib/itinerary-builder/regions';
import type { PoiListItem } from '../_hooks/types';

type RegionFilter = 'all' | 'busan' | 'jeju' | 'other';
type AttractionFilter = 'all' | 'attraction' | 'non';

type Props = {
  items: PoiListItem[];
  loading: boolean;
  error: string | null;
  selectedKey: string | null;
  onSelect: (poiKey: string) => void;
  onRefresh: () => void;
  onCreateNew: (poiKey: string) => void;
};

const BUSAN_SET = new Set<string>(REGION_CLUSTER.busan);
const JEJU_SET = new Set<string>(REGION_CLUSTER.jeju);

const REGION_BADGE: Record<string, string> = {
  busan: 'bg-sky-50 text-sky-700 border-sky-200',
  jeju: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function regionBadgeClass(region: string | null): string {
  if (!region) return 'bg-slate-50 text-slate-600 border-slate-200';
  if (BUSAN_SET.has(region)) return REGION_BADGE.busan;
  if (JEJU_SET.has(region)) return REGION_BADGE.jeju;
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

const SLUG_RE = /^[A-Za-z][A-Za-z0-9_-]*$/;

export function PoiListPane({
  items,
  loading,
  error,
  selectedKey,
  onSelect,
  onRefresh,
  onCreateNew,
}: Props) {
  const [query, setQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all');
  const [attractionFilter, setAttractionFilter] = useState<AttractionFilter>('all');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((p) => {
      if (regionFilter === 'busan' && !(p.region && BUSAN_SET.has(p.region))) return false;
      if (regionFilter === 'jeju' && !(p.region && JEJU_SET.has(p.region))) return false;
      if (
        regionFilter === 'other' &&
        p.region &&
        (BUSAN_SET.has(p.region) || JEJU_SET.has(p.region))
      )
        return false;
      if (attractionFilter === 'attraction' && p.is_attraction !== true) return false;
      if (attractionFilter === 'non' && p.is_attraction === true) return false;
      if (!q) return true;
      return (
        p.poi_key.toLowerCase().includes(q) ||
        (p.name_en || '').toLowerCase().includes(q) ||
        (p.name_ko || '').toLowerCase().includes(q)
      );
    });
  }, [items, query, regionFilter, attractionFilter]);

  const newKeyValid = SLUG_RE.test(newKey.trim());
  const newKeyExists = items.some((p) => p.poi_key === newKey.trim());

  const submitNew = () => {
    const key = newKey.trim();
    if (!newKeyValid || newKeyExists) return;
    onCreateNew(key);
    setCreating(false);
    setNewKey('');
  };

  return (
    <aside className="flex flex-col w-80 flex-shrink-0 bg-white border-r border-slate-200">
      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-900">
            매칭 POI <span className="text-slate-500 font-medium">({filtered.length}/{items.length})</span>
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCreating((v) => !v)}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              title="새 POI 만들기"
            >
              {creating ? <X className="size-4" /> : <Plus className="size-4" />}
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-50"
              title="새로고침"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* New POI inline creator */}
        {creating && (
          <div className="mb-2 p-2 rounded-md border border-blue-200 bg-blue-50/60">
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              새 POI key (slug)
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newKey}
                autoFocus
                onChange={(e) => setNewKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitNew();
                  if (e.key === 'Escape') {
                    setCreating(false);
                    setNewKey('');
                  }
                }}
                placeholder="예: haeundae_beach"
                className="flex-1 h-8 px-2 text-sm rounded-md border border-slate-200 bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none font-mono"
              />
              <button
                type="button"
                onClick={submitNew}
                disabled={!newKeyValid || newKeyExists}
                className="px-2.5 h-8 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
              >
                만들기
              </button>
            </div>
            {newKey && !newKeyValid && (
              <p className="mt-1 text-[10px] text-rose-600">
                영문 시작 · 영숫자/_/- 만 허용
              </p>
            )}
            {newKey && newKeyValid && newKeyExists && (
              <p className="mt-1 text-[10px] text-amber-600">이미 존재하는 key 입니다</p>
            )}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="poi_key / 이름 검색"
            className="w-full h-9 pl-8 pr-2 text-sm rounded-md border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
          />
        </div>

        {/* Region cluster filter */}
        <div className="flex flex-wrap gap-1 mb-1.5">
          {(
            [
              ['all', '전체'],
              ['busan', '부산권'],
              ['jeju', '제주'],
              ['other', '기타'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setRegionFilter(v)}
              className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                regionFilter === v
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* is_attraction filter */}
        <div className="flex flex-wrap gap-1">
          {(
            [
              ['all', '전체'],
              ['attraction', '명소'],
              ['non', '비명소'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setAttractionFilter(v)}
              className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                attractionFilter === v
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="m-3 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-800">
            <AlertCircle className="size-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">로드 실패</p>
              <p className="mt-0.5 text-rose-700">{error}</p>
            </div>
          </div>
        )}

        {loading && items.length === 0 && (
          <div className="p-3 space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-lg" />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && !error && (
          <div className="p-6 text-center text-sm text-slate-500">일치하는 POI가 없습니다.</div>
        )}

        <ul className="py-1.5">
          {filtered.map((p) => {
            const active = p.poi_key === selectedKey;
            return (
              <li key={p.poi_key}>
                <button
                  type="button"
                  onClick={() => onSelect(p.poi_key)}
                  className={`w-full text-left px-3 py-2.5 flex gap-3 items-start transition-colors ${
                    active
                      ? 'bg-blue-50 border-l-2 border-blue-600'
                      : 'border-l-2 border-transparent hover:bg-slate-50'
                  }`}
                >
                  <div className="relative w-12 h-12 flex-shrink-0 rounded-md overflow-hidden bg-slate-200">
                    {p.default_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.default_image_url}
                        alt={p.name_en || p.poi_key}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-[10px]">
                        no img
                      </div>
                    )}
                    {p.override_pinned && (
                      <div
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center"
                        title="이미지 override-pinned (재시드 우선)"
                      >
                        <Pin className="size-2.5 text-white" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm leading-snug line-clamp-1 ${
                        active ? 'font-semibold text-slate-900' : 'text-slate-800'
                      }`}
                    >
                      {p.name_en || p.poi_key}
                    </p>
                    {p.name_ko && (
                      <p className="text-xs text-slate-500 line-clamp-1">{p.name_ko}</p>
                    )}
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[10px] text-slate-400 truncate max-w-[140px]">
                        {p.poi_key}
                      </span>
                      {p.region && (
                        <span
                          className={`inline-flex items-center gap-0.5 px-1.5 py-px text-[10px] font-medium border rounded ${regionBadgeClass(
                            p.region,
                          )}`}
                        >
                          <MapPin className="size-2.5" />
                          {p.region}
                        </span>
                      )}
                      {p.is_attraction !== true && (
                        <span className="px-1.5 py-px text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200 rounded">
                          비명소
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
