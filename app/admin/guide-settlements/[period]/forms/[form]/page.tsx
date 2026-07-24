'use client';

/**
 * 세무 서식 인쇄 뷰 (§6.9).
 *
 *   /admin/guide-settlements/2026-08/forms/simplified
 *
 * 경로 세그먼트로 받는다(쿼리스트링이 아니라): 정적 경로에서 useSearchParams를
 * 쓰면 Next가 Suspense 경계를 요구해 빌드가 깨지고, API 경로와 모양을 맞추는 편이
 * 링크도 읽기 쉽다 — finance 슬라이스의 periods/[period]/statement와 같은 형태.
 *
 * 문서 크롬(DRAFT 워터마크 · A4 @media print · [인쇄/PDF 저장])은 앞 슬라이스의
 * `components/admin/ops-finance/DocumentChrome`을 그대로 재사용한다.
 *
 * 왜 표를 서버가 만든 HTML 조각으로 받아 꽂는가:
 *   주민번호 평문은 **서식 렌더 결과에만** 존재해야 한다. 표를 클라이언트에서
 *   조립하려면 평문이 JSON API 응답을 타고 와야 하고, 그 순간 목록·미리보기·
 *   브라우저 캐시 어디로든 샐 수 있는 표면이 하나 늘어난다. 그래서 서버가
 *   ①마스크만 담은 JSON(문서 제목·DRAFT 여부·경고)과 ②평문이 든 HTML 조각을
 *   나눠 내고, 이 페이지는 조각을 그대로 렌더한다. 조각의 모든 셀은 서버에서
 *   이스케이프된다(`renderFormHtml`).
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download } from 'lucide-react';
import { getAdminAccessToken } from '@/app/admin/match-pois/_hooks/usePoiRow';
import { DocumentShell, VatNoticeLine } from '@/components/admin/ops-finance/DocumentChrome';
import { TAX_FORM_LABELS, TAX_FORM_CSS, isTaxFormKey, type TaxFormKey } from '@/lib/ops/tax/forms';

interface FormMeta {
  ok: boolean;
  title: string;
  period: string;
  draft: boolean;
  guideCount: number;
  warnings: string[];
}

async function authedFetch(url: string) {
  const token = await getAdminAccessToken();
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
    cache: 'no-store',
  });
}

export default function TaxFormPrintPage() {
  const params = useParams<{ period: string; form: string }>();
  const periodParam = typeof params?.period === 'string' ? decodeURIComponent(params.period) : '';
  const formParam = typeof params?.form === 'string' ? params.form : '';
  const form: TaxFormKey | null = isTaxFormKey(formParam) ? formParam : null;

  const [meta, setMeta] = useState<FormMeta | null>(null);
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!form || !periodParam) {
      setError('알 수 없는 서식 경로입니다. 정산 화면에서 다시 열어 주세요.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const base = `/api/admin/guide-settlements/${encodeURIComponent(periodParam)}/forms/${form}`;
      const metaRes = await authedFetch(base);
      const metaJson = await metaRes.json().catch(() => ({}));
      if (!metaRes.ok) throw new Error(metaJson?.message || '서식을 불러오지 못했습니다.');
      setMeta(metaJson as FormMeta);

      // 평문이 든 조각은 이 요청에서만 온다(그리고 서버가 감사로그를 남긴다).
      const htmlRes = await authedFetch(`${base}?format=html`);
      if (!htmlRes.ok) {
        const json = await htmlRes.json().catch(() => ({}));
        throw new Error(json?.message || '서식을 렌더하지 못했습니다.');
      }
      setHtml(await htmlRes.text());
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }, [form, periodParam]);

  useEffect(() => {
    void load();
  }, [load]);

  const downloadCsv = useCallback(async () => {
    if (!form) return;
    const res = await authedFetch(
      `/api/admin/guide-settlements/${encodeURIComponent(periodParam)}/forms/${form}?format=csv`,
    );
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atockorea-${form}-${periodParam}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [form, periodParam]);

  if (loading) {
    return <p className="p-8 text-center text-sm text-neutral-400">불러오는 중…</p>;
  }

  if (error || !meta || !form) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-rose-700">{error || '서식을 만들 수 없습니다.'}</p>
        <Link
          href="/admin/guide-settlements"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="size-3.5" />
          가이드 월 정산으로
        </Link>
      </div>
    );
  }

  return (
    <DocumentShell
      draft={meta.draft}
      title={TAX_FORM_LABELS[form]}
      subtitle={`${meta.period} · 소득자 ${meta.guideCount}명`}
      testId="tax-form-doc"
    >
      <style>{TAX_FORM_CSS}</style>

      <div className="fdoc-noprint mb-4 flex flex-wrap items-center gap-2">
        <Link
          href="/admin/guide-settlements"
          className="inline-flex h-11 items-center gap-1 rounded-xl border border-neutral-200 px-3 text-xs font-semibold text-neutral-600"
        >
          <ArrowLeft className="size-3.5" />
          정산으로
        </Link>
        <button
          type="button"
          onClick={() => void downloadCsv()}
          className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-neutral-200 px-3 text-xs font-semibold text-neutral-600"
        >
          <Download className="size-3.5" />
          CSV 내려받기
        </button>
      </div>

      {meta.warnings?.length ? (
        <ul className="fdoc-noprint mb-4 space-y-1 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {meta.warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      ) : null}

      {/* 서버가 조립·이스케이프한 서식 조각. 평문 주민번호는 여기에만 존재한다. */}
      <div dangerouslySetInnerHTML={{ __html: html }} />

      <VatNoticeLine notice="이 서식은 제출되지 않습니다. 홈택스·위택스 신고는 사람이 직접 합니다." />
    </DocumentShell>
  );
}
