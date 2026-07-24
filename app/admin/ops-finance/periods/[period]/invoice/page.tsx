'use client';

/**
 * 인터컴퍼니 인보이스 인쇄 뷰 (Phase 3 §6.4).
 * 발행된 인보이스가 없으면 문서를 만들어내지 않는다 — 발행은 상세 화면의 명시적
 * 행동이고, 이 페이지는 이미 존재하는 문서를 재렌더할 뿐이다.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getAdminAccessToken } from '@/app/admin/match-pois/_hooks/usePoiRow';
import { IntercompanyInvoiceDoc } from '@/components/admin/ops-finance/IntercompanyInvoiceDoc';
import type { InvoiceDoc } from '@/lib/ops/finance/documents';

export default function InvoicePrintPage() {
  const params = useParams<{ period: string }>();
  const period = typeof params?.period === 'string' ? params.period : '';
  const [doc, setDoc] = useState<InvoiceDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!period) return;
    setLoading(true);
    try {
      const token = await getAdminAccessToken();
      const res = await fetch(`/api/admin/ops-finance/periods/${encodeURIComponent(period)}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || '인보이스를 불러오지 못했습니다.');
      setDoc((json.invoiceDoc as InvoiceDoc) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="p-8 text-center text-sm text-neutral-400">불러오는 중…</p>;
  }
  if (error || !doc) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-rose-700">{error || '이 기간에는 아직 발행된 인보이스가 없습니다.'}</p>
        <Link
          href={`/admin/ops-finance/periods/${period}`}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="size-3.5" />
          기간 상세로
        </Link>
      </div>
    );
  }

  return <IntercompanyInvoiceDoc doc={doc} />;
}
