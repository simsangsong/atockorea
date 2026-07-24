'use client';

/**
 * 다이닝 캐시 관제 (§5.7 R-9).
 *
 * 화장실·포토 핀과 달리 식당 캐시에는 전수 사람 검수 게이트가 없다(사양 K6 —
 * 식당은 사업자 원천 데이터이고 정량 품질 필터가 이미 걸려 있어서, 수백 건을
 * 한 줄씩 검수하면 자동화가 무의미해진다). 대신 사람은 **예외만** 본다:
 * 게스트가 "정보가 틀려요"를 누른 곳, 만료가 임박한 셀, 오늘 태운 쿼터.
 * 그래서 기본 화면이 셀 목록이 아니라 신고 큐다.
 *
 * 레이아웃·인증·토큰은 /admin/facility-pins와 동일 계열이다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  Grid3x3,
  ListChecks,
  RefreshCw,
  RotateCcw,
  Star,
  Utensils,
  XCircle,
} from 'lucide-react';
import { getAdminAccessToken } from '@/app/admin/match-pois/_hooks/usePoiRow';

type Mode = 'reports' | 'cells';

interface Stats {
  total_cells: number;
  total_places: number;
  rated_places: number;
  rated_pct: number;
  blocked_places: number;
  expiring_soon: number;
  expiring_soon_days: number;
  reported_places: number;
  impressions: number;
  taps: number;
  visits: number;
  tap_rate_pct: number;
  kakao_calls_today: number;
  kakao_cap: number;
  kakao_ratio: number;
  google_calls_today: number;
  google_cap: number;
  google_ratio: number;
  quota_alert: boolean;
  /** false → no durable counter; the call counts are this instance only. */
  quota_durable?: boolean;
}

interface ReportRow {
  place_key: string;
  cell: string;
  name: string;
  category_name: string | null;
  cuisine: string | null;
  rating: number | null;
  review_count: number | null;
  price_band: number | null;
  road_address: string | null;
  address: string | null;
  place_url: string;
  reported_wrong_count: number;
  is_blocked: boolean;
  is_closed: boolean;
  updated_at: string | null;
  reported_by: Array<{ booking_id: string; feedback: string | null; shown_at: string | null }>;
}

interface CellRow {
  cell: string;
  center_lat: number | null;
  center_lng: number | null;
  radius_m: number | null;
  place_count: number | null;
  kakao_calls: number | null;
  google_calls: number | null;
  fetched_at: string | null;
  expires_at: string | null;
  nearest_poi: { poi_key: string; name: string; distance_m: number } | null;
}

interface PlaceRow {
  place_key: string;
  name: string;
  category_name: string | null;
  cuisine: string | null;
  rating: number | null;
  review_count: number | null;
  price_band: number | null;
  tags: string[] | null;
  signature_menus: Array<{ name?: string }> | null;
  distance_m: number | null;
  place_url: string;
  expires_at: string | null;
  is_blocked: boolean;
  is_closed: boolean;
  reported_wrong_count: number;
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

function day(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : '—';
}

function daysLeft(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Number.isFinite(ms) ? Math.round(ms / (24 * 60 * 60 * 1000)) : null;
}

function priceLabel(band: number | null | undefined): string {
  return band && band >= 1 && band <= 4 ? '₩'.repeat(band) : '—';
}

export default function DiningCachePage() {
  const [mode, setMode] = useState<Mode>('reports');
  const [stats, setStats] = useState<Stats | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [cells, setCells] = useState<CellRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openCell, setOpenCell] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch('/api/admin/dining-cache');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `캐시 로드 실패 (${res.status})`);
      setStats(json.stats as Stats);
      setReports((json.reports ?? []) as ReportRow[]);
      setCells((json.cells ?? []) as CellRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const placeAction = useCallback(
    async (placeKey: string, action: 'block' | 'unblock' | 'resolve-report', reopen = false) => {
      setBusy(true);
      setError(null);
      try {
        const res = await authedFetch(`/api/admin/dining-cache/places/${encodeURIComponent(placeKey)}`, {
          method: 'PATCH',
          body: JSON.stringify({ action, ...(reopen ? { reopen: true } : {}) }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || '작업 실패');
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const cellAction = useCallback(
    async (cell: string, action: 'invalidate' | 'recollect') => {
      if (action === 'recollect') {
        const ok = window.confirm(
          `[${cell}] 셀을 지금 재수집할까요?\n\n카카오·구글 API를 실제로 호출해 오늘 쿼터를 소모합니다.`,
        );
        if (!ok) return;
      }
      setBusy(true);
      setError(null);
      try {
        const res = await authedFetch(`/api/admin/dining-cache/cells/${encodeURIComponent(cell)}`, {
          method: 'POST',
          body: JSON.stringify({ action, ...(action === 'recollect' ? { confirm: true } : {}) }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || '작업 실패');
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  return (
    <div className="-m-6 flex min-h-[calc(100vh-3.5rem)] flex-col bg-admin-bg">
      <div className="flex items-center gap-2 border-b border-admin-border bg-admin-surface px-4 py-2">
        <Utensils className="size-4 text-amber-600" />
        <h1 className="text-sm font-semibold text-slate-900">다이닝 캐시</h1>
        <div className="ml-auto flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <ModeBtn
            label="신고 큐"
            icon={ListChecks}
            badge={stats?.reported_places || 0}
            active={mode === 'reports'}
            onClick={() => setMode('reports')}
          />
          <ModeBtn label="셀 목록" icon={Grid3x3} active={mode === 'cells'} onClick={() => setMode('cells')} />
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || busy}
          aria-label="새로고침"
          className="flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error ? (
        <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">{error}</div>
      ) : null}

      <div className="flex-1 space-y-4 p-4">
        <StatsStrip stats={stats} loading={loading} />

        {loading ? (
          <p className="py-10 text-center text-sm text-slate-500">불러오는 중…</p>
        ) : mode === 'reports' ? (
          <ReportQueue rows={reports} busy={busy} onAction={placeAction} onOpenCell={setOpenCell} />
        ) : (
          <CellList rows={cells} busy={busy} onAction={cellAction} onOpenCell={setOpenCell} />
        )}
      </div>

      {openCell ? (
        <CellDetail
          cell={openCell}
          busy={busy}
          onClose={() => setOpenCell(null)}
          onPlaceAction={placeAction}
          onCellAction={cellAction}
        />
      ) : null}
    </div>
  );
}

function ModeBtn({
  label,
  icon: Icon,
  badge,
  active,
  onClick,
}: {
  label: string;
  icon: typeof ListChecks;
  badge?: number;
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
      {badge ? (
        <span className="rounded-full bg-rose-100 px-1.5 text-[10px] font-bold text-rose-700">{badge}</span>
      ) : null}
    </button>
  );
}

/** 셀·장소·쿼터·전환을 한 줄로. 쿼터 70%는 §R-3 알림 임계값이라 색이 바뀐다. */
function StatsStrip({ stats, loading }: { stats: Stats | null; loading: boolean }) {
  if (loading && !stats) {
    return <div className="h-20 animate-pulse rounded-lg border border-admin-border bg-admin-surface" />;
  }
  if (!stats) return null;

  const kakaoPct = Math.round(stats.kakao_ratio * 100);
  const googlePct = Math.round(stats.google_ratio * 100);
  // No durable counter → the number is this instance only, not today's total.
  const quotaSuffix = stats.quota_durable === false ? ' · 이 인스턴스 기준' : '';

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <StatCard label="수집 셀" value={String(stats.total_cells)} hint={`만료임박 ${stats.expiring_soon}`} />
      <StatCard
        label="캐시 장소"
        value={String(stats.total_places)}
        hint={`평점보유 ${stats.rated_pct}% · 차단 ${stats.blocked_places}`}
      />
      <StatCard
        label="신고 대기"
        value={String(stats.reported_places)}
        tone={stats.reported_places > 0 ? 'warn' : 'plain'}
        hint="3회 누적 시 자동 숨김"
      />
      <StatCard
        label="노출 / 탭 / 방문"
        value={`${stats.impressions} · ${stats.taps} · ${stats.visits}`}
        hint={`탭률 ${stats.tap_rate_pct}%`}
      />
      <StatCard
        label="오늘 카카오"
        value={`${stats.kakao_calls_today}`}
        tone={stats.kakao_ratio >= 0.7 ? 'warn' : 'plain'}
        hint={`/${stats.kakao_cap} (${kakaoPct}%)${quotaSuffix}`}
      />
      <StatCard
        label="오늘 구글"
        value={`${stats.google_calls_today}`}
        tone={stats.google_ratio >= 0.7 ? 'warn' : 'plain'}
        hint={`/${stats.google_cap} (${googlePct}%)${quotaSuffix}`}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = 'plain',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'plain' | 'warn';
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        tone === 'warn' ? 'border-amber-300 bg-amber-50' : 'border-admin-border bg-admin-surface'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 truncate text-lg font-bold ${tone === 'warn' ? 'text-amber-800' : 'text-slate-900'}`}>
        {value}
      </p>
      {hint ? <p className="truncate text-[10px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

function ReportQueue({
  rows,
  busy,
  onAction,
  onOpenCell,
}: {
  rows: ReportRow[];
  busy: boolean;
  onAction: (placeKey: string, action: 'block' | 'unblock' | 'resolve-report', reopen?: boolean) => void;
  onOpenCell: (cell: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center">
        <CheckCircle2 className="mx-auto mb-2 size-8 text-emerald-500" />
        <p className="text-sm text-slate-500">신고된 장소가 없어요. 캐시가 건강합니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const hidden = row.reported_wrong_count >= 3 || row.is_closed || row.is_blocked;
        return (
          <div key={row.place_key} className="rounded-lg border border-admin-border bg-admin-surface p-3">
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-sm font-semibold text-slate-900">{row.name}</p>
                  {row.is_closed ? (
                    <span className="flex items-center gap-0.5 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                      <XCircle className="size-2.5" /> 폐업
                    </span>
                  ) : null}
                  {row.is_blocked ? (
                    <span className="flex items-center gap-0.5 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      <Ban className="size-2.5" /> 차단됨
                    </span>
                  ) : null}
                  <span
                    className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      row.reported_wrong_count >= 3 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    <AlertTriangle className="size-2.5" /> 신고 {row.reported_wrong_count}회
                  </span>
                  {hidden ? (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                      서빙 제외 중
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {row.category_name || row.cuisine || '—'} · {row.road_address || row.address || '주소 없음'}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <button
                    type="button"
                    onClick={() => onOpenCell(row.cell)}
                    className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-semibold text-slate-600 hover:bg-slate-200"
                  >
                    {row.cell}
                  </button>
                  {typeof row.rating === 'number' ? (
                    <span className="flex items-center gap-0.5 text-amber-600">
                      <Star className="size-3 fill-current" /> {row.rating.toFixed(1)}
                      {row.review_count ? <span className="text-slate-400">·{row.review_count}</span> : null}
                    </span>
                  ) : (
                    <span className="text-slate-400">평점 없음</span>
                  )}
                  <span>{priceLabel(row.price_band)}</span>
                  <a
                    href={row.place_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-0.5 text-emerald-700 hover:underline"
                  >
                    카카오맵 <ExternalLink className="size-2.5" />
                  </a>
                </div>
                {row.reported_by.length > 0 ? (
                  <p className="mt-1 truncate text-[10px] text-slate-400">
                    신고 예약 {row.reported_by.length}건:{' '}
                    {row.reported_by.map((entry) => entry.booking_id.slice(0, 8)).join(', ')}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-1">
                <ActionBtn
                  label="신고 해소"
                  icon={RotateCcw}
                  busy={busy}
                  onClick={() => onAction(row.place_key, 'resolve-report', row.is_closed)}
                />
                {row.is_blocked ? (
                  <ActionBtn
                    label="차단 해제"
                    icon={CheckCircle2}
                    tone="ok"
                    busy={busy}
                    onClick={() => onAction(row.place_key, 'unblock')}
                  />
                ) : (
                  <ActionBtn
                    label="장소 차단"
                    icon={Ban}
                    tone="danger"
                    busy={busy}
                    onClick={() => onAction(row.place_key, 'block')}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CellList({
  rows,
  busy,
  onAction,
  onOpenCell,
}: {
  rows: CellRow[];
  busy: boolean;
  onAction: (cell: string, action: 'invalidate' | 'recollect') => void;
  onOpenCell: (cell: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center">
        <Grid3x3 className="mx-auto mb-2 size-8 text-slate-300" />
        <p className="text-sm text-slate-500">수집된 셀이 없어요.</p>
        <p className="mt-1 text-xs text-slate-400">
          <code className="rounded bg-slate-100 px-1 py-0.5">npm run dining:seed -- --apply</code> 로 선행 시딩하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const left = daysLeft(row.expires_at);
        const expiring = left !== null && left <= 14;
        return (
          <div key={row.cell} className="rounded-lg border border-admin-border bg-admin-surface p-3">
            <div className="flex flex-wrap items-start gap-2">
              <button type="button" onClick={() => onOpenCell(row.cell)} className="min-w-0 flex-1 text-left">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700">
                    {row.cell}
                  </span>
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {row.nearest_poi ? row.nearest_poi.name : '인근 POI 없음'}
                  </p>
                  {row.nearest_poi ? (
                    <span className="text-[10px] text-slate-400">{row.nearest_poi.distance_m}m</span>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {row.center_lat?.toFixed(5) ?? '—'}, {row.center_lng?.toFixed(5) ?? '—'} · 반경 {row.radius_m ?? '—'}m ·
                  장소 {row.place_count ?? 0}곳 · 호출 K{row.kakao_calls ?? 0}/G{row.google_calls ?? 0}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                  <Clock className="size-3" /> 수집 {day(row.fetched_at)} · 만료 {day(row.expires_at)}
                  {left !== null ? (
                    <span className={expiring ? 'font-semibold text-amber-700' : 'text-slate-400'}>
                      ({left <= 0 ? '만료됨' : `${left}일 남음`})
                    </span>
                  ) : null}
                </p>
              </button>
              <div className="flex shrink-0 flex-wrap items-center gap-1">
                <ActionBtn label="셀 무효화" icon={RotateCcw} busy={busy} onClick={() => onAction(row.cell, 'invalidate')} />
                <ActionBtn
                  label="재수집"
                  icon={Flame}
                  tone="danger"
                  busy={busy}
                  onClick={() => onAction(row.cell, 'recollect')}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CellDetail({
  cell,
  busy,
  onClose,
  onPlaceAction,
  onCellAction,
}: {
  cell: string;
  busy: boolean;
  onClose: () => void;
  onPlaceAction: (placeKey: string, action: 'block' | 'unblock' | 'resolve-report', reopen?: boolean) => void;
  onCellAction: (cell: string, action: 'invalidate' | 'recollect') => void;
}) {
  const [places, setPlaces] = useState<PlaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await authedFetch(`/api/admin/dining-cache/cells/${encodeURIComponent(cell)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || `셀 로드 실패 (${res.status})`);
        if (alive) setPlaces((json.places ?? []) as PlaceRow[]);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [cell, busy]);

  const sorted = useMemo(() => [...places].sort((a, b) => (a.distance_m ?? 1e9) - (b.distance_m ?? 1e9)), [places]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
      <div className="flex h-full w-full max-w-2xl flex-col bg-admin-bg shadow-xl">
        <div className="flex items-center gap-2 border-b border-admin-border bg-admin-surface px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="-ml-1 flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-mono text-sm font-semibold text-slate-900">{cell}</h2>
            <p className="text-xs text-slate-500">캐시된 장소 {places.length}곳</p>
          </div>
          <ActionBtn label="셀 무효화" icon={RotateCcw} busy={busy} onClick={() => onCellAction(cell, 'invalidate')} />
          <ActionBtn label="재수집" icon={Flame} tone="danger" busy={busy} onClick={() => onCellAction(cell, 'recollect')} />
        </div>

        {error ? <div className="bg-rose-50 px-4 py-2 text-xs text-rose-700">{error}</div> : null}

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">불러오는 중…</p>
          ) : sorted.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              이 셀에서 수집된 장소가 없어요. (수집은 했지만 품질 필터를 통과한 곳이 없을 수 있어요.)
            </p>
          ) : (
            sorted.map((place) => (
              <div key={place.place_key} className="rounded-lg border border-admin-border bg-admin-surface p-3">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-slate-900">{place.name}</p>
                      {place.is_blocked ? (
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-white">차단</span>
                      ) : null}
                      {place.is_closed ? (
                        <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">폐업</span>
                      ) : null}
                      {place.reported_wrong_count > 0 ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          신고 {place.reported_wrong_count}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{place.category_name || place.cuisine || '—'}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      {typeof place.rating === 'number' ? (
                        <span className="flex items-center gap-0.5 text-amber-600">
                          <Star className="size-3 fill-current" /> {place.rating.toFixed(1)}
                          {place.review_count ? <span className="text-slate-400">·{place.review_count}</span> : null}
                        </span>
                      ) : (
                        <span className="text-slate-400">평점 없음</span>
                      )}
                      <span>{priceLabel(place.price_band)}</span>
                      {place.distance_m !== null ? <span>{place.distance_m}m</span> : null}
                      <span className="text-slate-400">만료 {day(place.expires_at)}</span>
                      <a
                        href={place.place_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-0.5 text-emerald-700 hover:underline"
                      >
                        카카오맵 <ExternalLink className="size-2.5" />
                      </a>
                    </div>
                    {(place.tags ?? []).length > 0 || (place.signature_menus ?? []).length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(place.tags ?? []).map((tag) => (
                          <span key={tag} className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">
                            {tag}
                          </span>
                        ))}
                        {(place.signature_menus ?? [])
                          .map((menu) => menu?.name)
                          .filter((name): name is string => Boolean(name))
                          .slice(0, 3)
                          .map((name) => (
                            <span key={name} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                              {name}
                            </span>
                          ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {place.is_blocked ? (
                      <ActionBtn
                        label="차단 해제"
                        icon={CheckCircle2}
                        tone="ok"
                        busy={busy}
                        onClick={() => onPlaceAction(place.place_key, 'unblock')}
                      />
                    ) : (
                      <ActionBtn
                        label="장소 차단"
                        icon={Ban}
                        tone="danger"
                        busy={busy}
                        onClick={() => onPlaceAction(place.place_key, 'block')}
                      />
                    )}
                    {place.reported_wrong_count > 0 ? (
                      <ActionBtn
                        label="신고 해소"
                        icon={RotateCcw}
                        busy={busy}
                        onClick={() => onPlaceAction(place.place_key, 'resolve-report', place.is_closed)}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  label,
  icon: Icon,
  busy,
  onClick,
  tone = 'plain',
}: {
  label: string;
  icon: typeof Ban;
  busy: boolean;
  onClick: () => void;
  tone?: 'plain' | 'ok' | 'danger';
}) {
  const toneClass =
    tone === 'danger'
      ? 'text-rose-600 hover:bg-rose-50'
      : tone === 'ok'
        ? 'text-emerald-700 hover:bg-emerald-50'
        : 'text-slate-600 hover:bg-slate-100';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`flex items-center gap-1 rounded-md border border-admin-border px-2 py-1.5 text-[11px] font-semibold disabled:opacity-50 ${toneClass}`}
    >
      <Icon className="size-3" /> {label}
    </button>
  );
}
