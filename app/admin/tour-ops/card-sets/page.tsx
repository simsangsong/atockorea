'use client';

/**
 * 투어 상품별 기본 카드 세트 — AtoC 통합 플랜 §5.4 C-17.
 *
 * "기본값 = 투어 상품별 기본 세트, 룸 단위 오버라이드" 중 앞쪽 절반. 룸 단위는
 * 관제 룸 드로어의 [카드] 세그먼트가 담당하고, 이 화면은 그 룸들이 상속할
 * 상품 기본값을 정한다.
 *
 * 상품에 설정이 없으면 코드 기본값(출고 5장, 출고 순서)이 그대로 쓰인다 —
 * 이 화면을 한 번도 안 열어도 브리핑은 정상 발송된다. 여기서 하는 일은
 * "이 상품만 다르게" 뿐이다.
 */

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, TriangleAlert } from 'lucide-react';
import { getAdminAccessToken } from '@/app/admin/match-pois/_hooks/usePoiRow';
import CardSetEditor, {
  type CardSetInheritedPayload,
  type CardSetResolvedPayload,
  type CardSetSavePayload,
} from '@/components/tour-ops/CardSetEditor';
import { BRIEFING_CARD_DESCRIPTORS } from '@/lib/ops/seating/cards/cardSet';

interface TourRow {
  id: string;
  title: string | null;
  city: string | null;
  tour_kind: 'join' | 'private';
  lunch_included: boolean;
  card_ids: string[] | null;
  has_options: boolean;
  updated_at: string | null;
}

interface TourDetail {
  tour: { id: string; title: string | null; city: string | null; tour_kind: 'join' | 'private' };
  level: { card_ids: string[] | null } | null;
  resolved: CardSetResolvedPayload;
  inherited: CardSetInheritedPayload;
  migration_pending: boolean;
}

async function authedFetch(url: string, init: RequestInit = {}) {
  const token = await getAdminAccessToken();
  return fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    credentials: 'include',
    cache: 'no-store',
  });
}

const cardLabel = (id: string) => BRIEFING_CARD_DESCRIPTORS.find((card) => card.id === id)?.label ?? id;

function CardSetsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get('tour_id');

  const [tours, setTours] = useState<TourRow[]>([]);
  const [detail, setDetail] = useState<TourDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [migrationPending, setMigrationPending] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const res = await authedFetch('/api/admin/tour-ops/card-sets');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || '상품 목록을 불러오지 못했어요.');
      setTours(json.tours as TourRow[]);
      setMigrationPending(Boolean(json.migration_pending));
    } catch (e) {
      setError(e instanceof Error ? e.message : '상품 목록을 불러오지 못했어요.');
    }
  }, []);

  const loadDetail = useCallback(async (tourId: string) => {
    try {
      const res = await authedFetch(`/api/admin/tour-ops/card-sets?tour_id=${encodeURIComponent(tourId)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || '상품 설정을 불러오지 못했어요.');
      setDetail(json as TourDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : '상품 설정을 불러오지 못했어요.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      await loadList();
      if (selectedId) await loadDetail(selectedId);
      else setDetail(null);
      if (!cancelled) setLoading(false);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [selectedId, loadList, loadDetail]);

  const save = useCallback(
    async (payload: CardSetSavePayload) => {
      if (!selectedId) return;
      setBusy(true);
      setError(null);
      try {
        const res = await authedFetch('/api/admin/tour-ops/card-sets', {
          method: 'PUT',
          body: JSON.stringify({ tour_id: selectedId, ...payload }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || json?.error || '저장 실패');
        await Promise.all([loadList(), loadDetail(selectedId)]);
      } catch (e) {
        setError(e instanceof Error ? e.message : '저장 실패');
      } finally {
        setBusy(false);
      }
    },
    [selectedId, loadList, loadDetail],
  );

  const clear = useCallback(async () => {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/tour-ops/card-sets?tour_id=${encodeURIComponent(selectedId)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || '되돌리기 실패');
      await Promise.all([loadList(), loadDetail(selectedId)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '되돌리기 실패');
    } finally {
      setBusy(false);
    }
  }, [selectedId, loadList, loadDetail]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-5">
      <header className="mb-4">
        <h1 className="text-[18px] font-bold text-[var(--tr-ink)]">시작 브리핑 카드 세트</h1>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--tr-ink-2)]">
          [투어 시작]을 누를 때 손님에게 나가는 카드의 <b>구성·순서·포함 여부</b>를 상품별로 정합니다. 설정하지
          않은 상품은 기본 5장이 그대로 나가고, 특정 룸만 다르게 하려면 관제 룸 상세의 [카드] 탭을 쓰세요.
        </p>
      </header>

      {migrationPending && (
        <p className="mb-3 flex items-start gap-1.5 rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          카드 세트 테이블이 아직 없어요(마이그레이션 미적용). 지금은 모든 투어가 코드 기본 5장을 받고, 저장은
          되지 않습니다.
        </p>
      )}

      {error && (
        <p className="mb-3 rounded-xl border border-rose-300 bg-rose-50 p-2.5 text-[12px] text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </p>
      )}

      {loading && (
        <p className="flex items-center justify-center gap-1.5 py-8 text-[12px] text-[var(--tr-ink-3)]">
          <Loader2 className="size-3.5 animate-spin" /> 불러오는 중…
        </p>
      )}

      {!loading && !selectedId && (
        <ul className="space-y-2">
          {tours.map((tour) => (
            <li key={tour.id}>
              <button
                type="button"
                onClick={() => router.push(`/admin/tour-ops/card-sets?tour_id=${encodeURIComponent(tour.id)}`)}
                className="w-full rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] p-3 text-left"
              >
                <p className="text-[13px] font-bold text-[var(--tr-ink)]">{tour.title ?? tour.id}</p>
                <p className="mt-0.5 text-[11px] text-[var(--tr-ink-2)]">
                  {tour.city ?? '—'} · {tour.tour_kind === 'private' ? '프라이빗' : '조인'}
                  {' · '}
                  {tour.card_ids
                    ? `${tour.card_ids.length}장 (${tour.card_ids.map(cardLabel).join(' → ')})`
                    : '기본 5장'}
                  {tour.has_options ? ' · 옵션 지정됨' : ''}
                </p>
              </button>
            </li>
          ))}
          {tours.length === 0 && (
            <li className="rounded-xl border border-dashed border-[var(--tr-hairline)] p-4 text-center text-[12px] text-[var(--tr-ink-3)]">
              투어 상품이 없어요.
            </li>
          )}
        </ul>
      )}

      {!loading && selectedId && detail && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => router.push('/admin/tour-ops/card-sets')}
            className="flex h-9 items-center gap-1.5 text-[12px] font-semibold text-[var(--tr-ink-2)]"
          >
            <ArrowLeft className="size-3.5" /> 상품 목록
          </button>
          <div className="rounded-xl border border-[var(--tr-hairline)] p-3">
            <p className="text-[14px] font-bold text-[var(--tr-ink)]">{detail.tour.title ?? detail.tour.id}</p>
            <p className="mt-0.5 text-[11px] text-[var(--tr-ink-2)]">
              {detail.tour.city ?? '—'} · {detail.tour.tour_kind === 'private' ? '프라이빗 차터' : '조인투어'} —
              카드 ①②④ 문구는 이 구분을 따라 자동으로 달라집니다.
            </p>
          </div>

          <CardSetEditor
            resolved={detail.resolved}
            inherited={detail.inherited}
            inheritLabel="기본 세트"
            busy={busy}
            canClear={Boolean(detail.level)}
            onSave={save}
            onClear={clear}
          />
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CardSetsPage />
    </Suspense>
  );
}
