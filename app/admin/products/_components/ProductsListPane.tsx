'use client';

import { useMemo, useState } from 'react';
import { Search, RefreshCw, Star, MapPin, AlertCircle, Users, User, Bus } from 'lucide-react';
import type { TourListItem, ProductType } from '../_hooks/types';

type Props = {
  items: TourListItem[];
  loading: boolean;
  error: string | null;
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  onRefresh: () => void;
};

const CITY_COLORS: Record<string, string> = {
  Seoul: 'bg-rose-50 text-rose-700 border-rose-200',
  Busan: 'bg-sky-50 text-sky-700 border-sky-200',
  Jeju: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

type ProductTypeBadge = {
  label: string;
  icon: React.ReactNode;
  className: string;
};

/**
 * Map `match_tours.matching_profile.product_type` → visible badge. Slug-level
 * overrides (e.g. the jeju cruise BUS variant) keep the family-level
 * type (`small_group_fixed_itinerary`) but show a more accurate label.
 */
function getProductTypeBadge(
  type: ProductType | null,
  slug: string,
): ProductTypeBadge | null {
  if (slug === 'jeju-cruise-shore-excursion-bus-tour') {
    return {
      label: '버스',
      icon: <Bus className="size-2.5" />,
      className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    };
  }
  if (!type) return null;
  switch (type) {
    case 'private':
      return {
        label: '프라이빗',
        icon: <User className="size-2.5" />,
        className: 'bg-purple-50 text-purple-700 border-purple-200',
      };
    case 'small_group':
    case 'small_group_fixed_itinerary':
      return {
        label: '소그룹',
        icon: <Users className="size-2.5" />,
        className: 'bg-blue-50 text-blue-700 border-blue-200',
      };
    case 'bus':
      return {
        label: '버스',
        icon: <Bus className="size-2.5" />,
        className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      };
    default:
      return null;
  }
}

export function ProductsListPane({
  items,
  loading,
  error,
  selectedSlug,
  onSelect,
  onRefresh,
}: Props) {
  const [query, setQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<'all' | 'Seoul' | 'Busan' | 'Jeju'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((t) => {
      if (cityFilter !== 'all' && t.city !== cityFilter) return false;
      if (statusFilter === 'active' && !t.is_active) return false;
      if (statusFilter === 'inactive' && t.is_active) return false;
      if (!q) return true;
      return t.title.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q);
    });
  }, [items, query, cityFilter, statusFilter]);

  return (
    <aside
      className={`w-full flex-shrink-0 flex-col border-r border-slate-200 bg-white lg:flex lg:w-80 ${
        selectedSlug ? 'hidden' : 'flex'
      }`}
    >
      {/* Header — count + refresh */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-900">
            상품 <span className="text-slate-500 font-medium">({filtered.length}/{items.length})</span>
          </h2>
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

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목 또는 slug 검색"
            className="w-full h-9 pl-8 pr-2 text-sm rounded-md border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
          />
        </div>

        {/* City filter chips */}
        <div className="flex flex-wrap gap-1 mb-1.5">
          {(['all', 'Seoul', 'Busan', 'Jeju'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCityFilter(c)}
              className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                cityFilter === c
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {c === 'all' ? '전체' : c}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {(['all', 'active', 'inactive'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                statusFilter === s
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {s === 'all' ? '모든 상태' : s === 'active' ? '활성' : '비활성'}
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
          <div className="p-6 text-center text-sm text-slate-500">
            일치하는 상품이 없습니다.
          </div>
        )}

        <ul className="py-1.5">
          {filtered.map((t) => {
            const active = t.slug === selectedSlug;
            return (
              <li key={t.slug}>
                <button
                  type="button"
                  onClick={() => onSelect(t.slug)}
                  className={`w-full text-left px-3 py-2.5 flex gap-3 items-start transition-colors ${
                    active
                      ? 'bg-blue-50 border-l-2 border-blue-600'
                      : 'border-l-2 border-transparent hover:bg-slate-50'
                  }`}
                >
                  <div className="relative w-12 h-12 flex-shrink-0 rounded-md overflow-hidden bg-slate-200">
                    {t.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.image_url}
                        alt={t.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-[10px]">
                        no img
                      </div>
                    )}
                    {!t.is_active && (
                      <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center text-[9px] font-bold text-white">
                        OFF
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm leading-snug line-clamp-2 ${
                        active ? 'font-semibold text-slate-900' : 'text-slate-800'
                      }`}
                    >
                      {t.title || t.slug}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-0.5 px-1.5 py-px text-[10px] font-medium border rounded ${
                          CITY_COLORS[t.city] || 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        <MapPin className="size-2.5" />
                        {t.city}
                      </span>
                      {(() => {
                        const b = getProductTypeBadge(t.product_type, t.slug);
                        if (!b) return null;
                        return (
                          <span
                            className={`inline-flex items-center gap-0.5 px-1.5 py-px text-[10px] font-medium border rounded ${b.className}`}
                            title={`상품 유형: ${b.label}`}
                          >
                            {b.icon}
                            {b.label}
                          </span>
                        );
                      })()}
                      {t.is_featured && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-px text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded">
                          <Star className="size-2.5 fill-amber-500 stroke-amber-500" />
                          추천
                        </span>
                      )}
                      {t.rating ? (
                        <span className="text-[10px] text-slate-500">
                          ★ {Number(t.rating).toFixed(1)}
                          {t.review_count ? ` (${t.review_count})` : ''}
                        </span>
                      ) : null}
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
