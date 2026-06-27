'use client';

/**
 * Admin editor for third-party platform review aggregates.
 *
 * Manages `public.tour_external_reviews` — one row per (tour_product_slug,
 * platform). Each row is the SAME tour's public review score on a global OTA
 * (TripAdvisor / Viator / GetYourGuide / Klook): average rating + review count
 * + source link. Aggregate-only by policy — no review prose, no competitor
 * price. Saves go through POST /api/admin/external-reviews (upsert).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Star, Trash2, RotateCw, Save, ExternalLink, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

const PLATFORMS = [
  { value: 'tripadvisor', label: 'TripAdvisor' },
  { value: 'viator', label: 'Viator' },
  { value: 'getyourguide', label: 'GetYourGuide' },
  { value: 'klook', label: 'Klook' },
] as const;

const PLATFORM_LABEL: Record<string, string> = Object.fromEntries(
  PLATFORMS.map((p) => [p.value, p.label]),
);

type Row = {
  id: string;
  tour_product_slug: string;
  platform: string;
  average_rating: number | string | null;
  review_count: number;
  source_url: string;
  external_id: string | null;
  is_visible: boolean;
  sort_order: number;
  last_checked_at: string | null;
  updated_at: string;
};

type FormState = {
  tour_product_slug: string;
  platform: string;
  average_rating: string;
  review_count: string;
  source_url: string;
  external_id: string;
  is_visible: boolean;
  sort_order: string;
  last_checked_at: string;
};

const EMPTY_FORM: FormState = {
  tour_product_slug: '',
  platform: 'tripadvisor',
  average_rating: '',
  review_count: '0',
  source_url: '',
  external_id: '',
  is_visible: true,
  sort_order: '0',
  last_checked_at: '',
};

async function getToken(): Promise<string> {
  const sess = await supabase?.auth.getSession();
  const token = sess?.data.session?.access_token;
  if (!token) throw new Error('세션이 만료되었습니다. 다시 로그인하세요.');
  return token;
}

export default function ExternalReviewsAdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/external-reviews', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '불러오기 실패');
      setRows(json.data as Row[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const arr = map.get(r.tour_product_slug) ?? [];
      arr.push(r);
      map.set(r.tour_product_slug, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const editRow = (r: Row) => {
    setForm({
      tour_product_slug: r.tour_product_slug,
      platform: r.platform,
      average_rating: r.average_rating == null ? '' : String(r.average_rating),
      review_count: String(r.review_count),
      source_url: r.source_url,
      external_id: r.external_id ?? '',
      is_visible: r.is_visible,
      sort_order: String(r.sort_order),
      last_checked_at: r.last_checked_at ?? '',
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async () => {
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/external-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({
          tour_product_slug: form.tour_product_slug.trim(),
          platform: form.platform,
          average_rating: form.average_rating === '' ? null : Number(form.average_rating),
          review_count: Number(form.review_count),
          source_url: form.source_url.trim(),
          external_id: form.external_id.trim() || null,
          is_visible: form.is_visible,
          sort_order: Number(form.sort_order),
          last_checked_at: form.last_checked_at || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '저장 실패');
      toast.success(`${PLATFORM_LABEL[form.platform]} 저장됨`);
      setForm((f) => ({ ...EMPTY_FORM, tour_product_slug: f.tour_product_slug }));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: Row) => {
    if (typeof window !== 'undefined' && !window.confirm(`${r.tour_product_slug} · ${PLATFORM_LABEL[r.platform]} 삭제할까요?`)) {
      return;
    }
    try {
      const token = await getToken();
      const res = await fetch(
        `/api/admin/external-reviews?slug=${encodeURIComponent(r.tour_product_slug)}&platform=${encodeURIComponent(r.platform)}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, credentials: 'include' },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '삭제 실패');
      toast.success('삭제됨');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '삭제 실패');
    }
  };

  const canSave =
    form.tour_product_slug.trim() !== '' && form.source_url.trim() !== '' && !saving;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-1.5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-emerald-600" />
          <h1 className="text-xl font-bold tracking-tight text-slate-950">외부 플랫폼 리뷰 집계</h1>
        </div>
        <p className="text-sm text-slate-500">
          같은 투어가 글로벌 OTA(TripAdvisor / Viator / GetYourGuide / Klook)에 올라간 경우, 그 플랫폼의
          <strong className="font-semibold text-slate-700"> 공개 평점·리뷰수</strong>를 출처표명과 함께 상세 페이지에 노출합니다.
          평점·리뷰수와 원문 링크만 입력하세요 — <strong className="font-semibold text-slate-700">리뷰 본문·가격은 입력하지 않습니다.</strong>
        </p>
      </header>

      {/* Editor form */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">집계 추가 / 수정</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="상품 slug" hint="tour-product 상세의 slug (예: busan-cruise-shore-excursion-bus-tour)">
            <input
              type="text"
              value={form.tour_product_slug}
              onChange={(e) => setForm((f) => ({ ...f, tour_product_slug: e.target.value }))}
              placeholder="tour-product-slug"
              className={inputCls}
            />
          </Field>
          <Field label="플랫폼">
            <select
              value={form.platform}
              onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
              className={inputCls}
            >
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="평균 평점 (0–5, 선택)" hint="비워두면 'Rating n/a'로 표시">
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={form.average_rating}
              onChange={(e) => setForm((f) => ({ ...f, average_rating: e.target.value }))}
              placeholder="4.8"
              className={inputCls}
            />
          </Field>
          <Field label="리뷰 수">
            <input
              type="number"
              min={0}
              step={1}
              value={form.review_count}
              onChange={(e) => setForm((f) => ({ ...f, review_count: e.target.value }))}
              placeholder="1240"
              className={inputCls}
            />
          </Field>
          <Field label="원문 URL" hint="해당 플랫폼의 이 투어 페이지 주소">
            <input
              type="url"
              value={form.source_url}
              onChange={(e) => setForm((f) => ({ ...f, source_url: e.target.value }))}
              placeholder="https://www.tripadvisor.com/..."
              className={inputCls}
            />
          </Field>
          <Field label="외부 리스팅 ID (선택)">
            <input
              type="text"
              value={form.external_id}
              onChange={(e) => setForm((f) => ({ ...f, external_id: e.target.value }))}
              placeholder="d12345678"
              className={inputCls}
            />
          </Field>
          <Field label="최종 확인일 (선택)" hint="수치를 확인한 날짜">
            <input
              type="date"
              value={form.last_checked_at}
              onChange={(e) => setForm((f) => ({ ...f, last_checked_at: e.target.value }))}
              className={inputCls}
            />
          </Field>
          <Field label="정렬 순서">
            <input
              type="number"
              step={1}
              value={form.sort_order}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
              className={inputCls}
            />
          </Field>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.is_visible}
            onChange={(e) => setForm((f) => ({ ...f, is_visible: e.target.checked }))}
            className="size-4 rounded border-slate-300"
          />
          페이지에 노출 (체크 해제 시 숨김)
        </label>

        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="size-4" />
            {saving ? '저장 중...' : '저장 (upsert)'}
          </button>
          <button
            type="button"
            onClick={() => setForm(EMPTY_FORM)}
            className="inline-flex h-9 items-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            초기화
          </button>
          <span className="ml-auto text-xs text-slate-400">
            같은 slug+플랫폼을 다시 저장하면 덮어씁니다.
          </span>
        </div>
      </section>

      {/* Existing rows */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">등록된 집계 ({rows.length})</h2>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <RotateCw className="size-3.5" />
            새로고침
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">불러오는 중...</p>
        ) : grouped.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 py-10 text-center text-sm text-slate-400">
            등록된 집계가 없습니다. 위에서 추가하세요.
          </p>
        ) : (
          grouped.map(([slug, slugRows]) => (
            <div key={slug} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
                <span className="truncate font-mono text-xs font-semibold text-slate-700">{slug}</span>
                <a
                  href={`/tour-product/${slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline"
                >
                  페이지 <ExternalLink className="size-3" />
                </a>
              </div>
              <ul className="divide-y divide-slate-100">
                {slugRows.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="w-28 flex-shrink-0 font-medium text-slate-800">
                      {PLATFORM_LABEL[r.platform] ?? r.platform}
                    </span>
                    <span className="flex w-16 flex-shrink-0 items-center gap-1 text-slate-700">
                      {r.average_rating != null ? (
                        <>
                          <Star className="size-3.5 fill-amber-400 text-amber-400" />
                          {Number(r.average_rating).toFixed(1)}
                        </>
                      ) : (
                        <span className="text-slate-400">n/a</span>
                      )}
                    </span>
                    <span className="w-24 flex-shrink-0 tabular-nums text-slate-500">
                      {r.review_count.toLocaleString('en-US')} 리뷰
                    </span>
                    {!r.is_visible ? (
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                        숨김
                      </span>
                    ) : null}
                    <a
                      href={r.source_url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-blue-600"
                      title={r.source_url}
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => editRow(r)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(r)}
                      className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="삭제"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

const inputCls =
  'h-9 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-slate-400">{hint}</span> : null}
    </label>
  );
}
