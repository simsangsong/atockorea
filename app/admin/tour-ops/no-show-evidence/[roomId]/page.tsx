'use client';

/**
 * 노쇼 증거 시트 (§5.4b D12) — OTA 분쟁 제출용 인쇄 뷰.
 *
 * PDF 자동생성은 하지 않는다(신규 npm 의존성 금지 — 코디네이터 확정 2번).
 * 대신 이 페이지를 브라우저 인쇄(⌘P/Ctrl+P → PDF로 저장)하면 A4 한 장에
 * 증거 1건이 깔끔히 떨어지도록 @media print를 짰다: 화면 크롬(버튼·설명)은
 * 인쇄에서 사라지고, 항목마다 page-break-inside: avoid가 걸린다.
 *
 * 데이터는 GET /api/ops/rooms/[roomId]/no-show-evidence (스태프/admin 전용).
 * 사진은 private 버킷의 10분 서명 URL이라 인쇄는 페이지를 연 직후에 해야 한다
 * (만료되면 새로고침 = 재발급).
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Printer, RefreshCw } from 'lucide-react';
import { getAdminAccessToken } from '@/app/admin/match-pois/_hooks/usePoiRow';
import { formatKstStamp } from '@/lib/ops/seating/evidence';

interface EvidenceItem {
  id: string;
  seatNumber: number;
  bookingId: string;
  guestLabel: string | null;
  capturedAt: string;
  recordedAt: string;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  gpsUnavailableReason: string | null;
  actorRole: string | null;
  deviceUserAgent: string | null;
  note: string | null;
  photoUrl: string | null;
  watermarkedUrl: string | null;
}

const ROLE_LABEL: Record<string, string> = { guide: '가이드', driver: '기사', admin: '관리자' };

/**
 * 인쇄 전용 CSS. 이 페이지는 admin 레이아웃(사이드바 aside + 상단 header +
 * 모바일 하단 nav) 안에 들어가므로, 인쇄에서는 그 크롬 전체를 걷어내고 시트만
 * 남긴다. 내 시트의 제목 줄은 <header>가 아니라 .nse-head div라서 살아남는다.
 */
const PRINT_CSS = `
@media print {
  aside, nav, header { display: none !important; }
  main { overflow: visible !important; padding: 0 !important; }
  .nse-noprint { display: none !important; }
  .nse-page { padding: 0 !important; background: #fff !important; }
  .nse-item { page-break-inside: avoid; break-inside: avoid; page-break-after: always; break-after: page; }
  .nse-item:last-child { page-break-after: auto; break-after: auto; }
  .nse-photo { max-height: 120mm; }
}
@page { size: A4; margin: 14mm; }
`;

export default function NoShowEvidenceSheetPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = typeof params?.roomId === 'string' ? params.roomId : '';
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [tourDate, setTourDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getAdminAccessToken();
      const res = await fetch(`/api/ops/rooms/${roomId}/no-show-evidence`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || '증거를 불러오지 못했습니다.');
        return;
      }
      setItems(Array.isArray(json.evidence) ? json.evidence : []);
      setTourDate(json.room?.tourDate ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '증거를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="nse-page min-h-screen bg-white p-6 text-neutral-900" data-testid="no-show-evidence-sheet-page">
      <style>{PRINT_CSS}</style>

      <div className="nse-head mb-4 flex flex-wrap items-center gap-3 border-b border-neutral-200 pb-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold">노쇼 증거 시트</h1>
          <p className="mt-0.5 text-xs text-neutral-500 tabular-nums">
            투어일 {tourDate ?? '-'} · room {roomId.slice(0, 8)} · 총 {items.length}건
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="nse-noprint flex h-11 items-center gap-1.5 rounded-xl bg-neutral-100 px-3 text-sm font-semibold text-neutral-700"
          data-testid="evidence-sheet-refresh"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden />
          새로고침
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="nse-noprint flex h-11 items-center gap-1.5 rounded-xl bg-neutral-900 px-4 text-sm font-bold text-white"
          data-testid="evidence-sheet-print"
        >
          <Printer size={14} aria-hidden />
          인쇄 / PDF 저장
        </button>
      </div>

      <p className="nse-noprint mb-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
        사진 링크는 10분 서명 URL입니다. 만료되면 [새로고침] 후 다시 인쇄하세요.
      </p>

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700" data-testid="evidence-sheet-error">
          {error}
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <p className="rounded-xl border border-neutral-200 px-3 py-8 text-center text-sm text-neutral-500" data-testid="evidence-sheet-empty">
          이 룸에 기록된 노쇼 증거가 없습니다.
        </p>
      )}

      <div className="space-y-6">
        {items.map((item) => (
          <article key={item.id} className="nse-item rounded-xl border border-neutral-300 p-4" data-testid="evidence-item">
            <h2 className="text-base font-bold">
              {item.seatNumber}번 좌석 · {item.guestLabel || 'Guest'}
            </h2>

            <table className="mt-3 w-full border-collapse text-sm">
              <tbody>
                <Row label="촬영 시각 (기기 신고)" value={formatKstStamp(item.capturedAt)} />
                <Row label="서버 수신 시각 (권위)" value={formatKstStamp(item.recordedAt)} />
                <Row
                  label="GPS 좌표"
                  value={
                    item.latitude !== null && item.longitude !== null
                      ? `${item.latitude.toFixed(6)}, ${item.longitude.toFixed(6)}${
                          item.accuracyM !== null ? ` (정확도 ±${item.accuracyM}m)` : ''
                        }`
                      : `없음 — ${item.gpsUnavailableReason || '사유 미기재'}`
                  }
                />
                <Row label="기록자" value={ROLE_LABEL[item.actorRole ?? ''] ?? item.actorRole ?? '-'} />
                <Row label="예약 ID" value={item.bookingId} />
                <Row label="기록 기기" value={item.deviceUserAgent || '-'} />
                {item.note && <Row label="현장 메모" value={item.note} />}
              </tbody>
            </table>

            {item.watermarkedUrl || item.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.watermarkedUrl ?? item.photoUrl ?? ''}
                alt={`${item.seatNumber}번 좌석 노쇼 현장 사진`}
                className="nse-photo mt-3 w-full rounded-lg border border-neutral-200 object-contain"
                data-testid="evidence-photo"
              />
            ) : (
              <p className="mt-3 rounded-lg bg-neutral-100 px-3 py-6 text-center text-xs text-neutral-500">
                사진 링크가 만료되었습니다. [새로고침]을 눌러주세요.
              </p>
            )}
            {item.watermarkedUrl && item.photoUrl && (
              <p className="nse-noprint mt-2 text-xs text-neutral-500">
                <a href={item.photoUrl} target="_blank" rel="noopener noreferrer" className="underline">
                  워터마크 없는 원본 열기
                </a>{' '}
                (무결성 확인용)
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-neutral-200 last:border-b-0">
      <th scope="row" className="w-44 py-1.5 pr-3 text-left align-top text-xs font-semibold text-neutral-500">
        {label}
      </th>
      <td className="py-1.5 align-top text-sm text-neutral-900 break-all tabular-nums">{value}</td>
    </tr>
  );
}
