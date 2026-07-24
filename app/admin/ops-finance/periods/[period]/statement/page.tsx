'use client';

/**
 * 월 정산서 인쇄 뷰 (Phase 3 §6.1 F-2).
 * 데이터는 GET /api/admin/ops-finance/periods/[period]가 만든 statement 하나뿐 —
 * 문서가 DB에서 결정론적으로 재렌더된다(설계 결정 3, PDF 라이브러리 없음).
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getAdminAccessToken } from '@/app/admin/match-pois/_hooks/usePoiRow';
import { SettlementStatementDoc } from '@/components/admin/ops-finance/SettlementStatementDoc';
import type { StatementDoc } from '@/lib/ops/finance/documents';

export default function StatementPrintPage() {
  const params = useParams<{ period: string }>();
  const period = typeof params?.period === 'string' ? params.period : '';
  const [doc, setDoc] = useState<StatementDoc | null>(null);
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
      if (!res.ok) throw new Error(json?.message || '정산서를 불러오지 못했습니다.');
      setDoc((json.statement as StatementDoc) ?? null);
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
        <p className="text-sm text-rose-700">{error || '이 기간은 아직 마감되지 않았습니다.'}</p>
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

  return <SettlementStatementDoc doc={doc} />;
}
