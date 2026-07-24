'use client';

/**
 * 재claim 승인 큐 — AtoC 통합 플랜 §5.2 C-5.
 *
 * "이미 등록된 예약"에 다른 기기가 재등록을 시도하면 서버는 409를 주고
 * `reclaim_requested` 이벤트 + ops 푸시를 남긴다. 그 다음이 없었다 —
 * 사람이 푸시를 보고 SQL로 처리해야 했다. 이 화면이 그 판정면이다.
 *
 * 이 화면의 안전 규칙(=탈취 방지 설계):
 *   · 자동 승인 없음. 목록은 기본이 "대기 중"이고 아무것도 미리 선택되지 않는다.
 *   · 승인/거절은 2단계 — [승인] → 결과 설명 + 체크박스 → [최종 승인].
 *   · 승인 결과로 나오는 링크는 **운영자에게만** 표시된다. 요청 기기에 자동
 *     전달하지 않는다(아직 신원이 확인되지 않은 기기다). 전달 경로는 사람이 쥔다.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  XCircle,
} from 'lucide-react';
import { getAdminAccessToken } from '@/app/admin/match-pois/_hooks/usePoiRow';

interface ReclaimRow {
  subject_key: string;
  room_id: string;
  booking_id: string;
  device_key: string;
  device_key_masked: string;
  requested_at: string;
  status: 'pending' | 'approved' | 'rejected';
  decided_at: string | null;
  decision_payload: Record<string, unknown> | null;
  guest_name: string;
  party_size: number;
  tour_date: string | null;
  tour_title: string | null;
  current_device_masked: string | null;
  current_device_is_requester: boolean;
  current_device_last_seen: string | null;
}

interface ApprovalResult {
  url: string;
  expires_at: string;
  qr_data_url: string | null;
  revoked_token_count: number;
  previous_device_masked: string;
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

function kst(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Seoul',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

export default function ReclaimQueuePage() {
  const [rows, setRows] = useState<ReclaimRow[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 2단계 액션 — 어떤 요청의 어떤 판정이 "확인 대기" 상태인지.
  const [staged, setStaged] = useState<{ key: string; decision: 'approve' | 'reject' } | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [result, setResult] = useState<{ key: string; data: ApprovalResult } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/tour-ops/reclaims?status=${showAll ? 'all' : 'pending'}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `큐 로드 실패 (${res.status})`);
      setRows(json.data as ReclaimRow[]);
      setPendingCount(Number(json.pending_count ?? 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [showAll]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = useCallback(
    async (row: ReclaimRow, decision: 'approve' | 'reject') => {
      setBusyKey(row.subject_key);
      setError(null);
      try {
        const res = await authedFetch('/api/admin/tour-ops/reclaims/decision', {
          method: 'POST',
          body: JSON.stringify({
            room_id: row.room_id,
            booking_id: row.booking_id,
            device_key: row.device_key,
            decision,
            confirm: true,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || json?.error || '처리 실패');
        if (decision === 'approve') {
          setResult({ key: row.subject_key, data: json as ApprovalResult });
        }
        setStaged(null);
        setAcknowledged(false);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyKey(null);
      }
    },
    [load],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck className="size-5 text-slate-700" />
        <h1 className="text-lg font-bold text-slate-900">재등록 승인 큐</h1>
        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
          대기 {pendingCount}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            처리된 요청도 보기
          </label>
          <button
            type="button"
            onClick={() => void load()}
            className="flex h-9 items-center gap-1.5 rounded-md border border-admin-border px-3 text-xs font-semibold text-slate-600"
          >
            <RefreshCw className="size-3.5" /> 새로고침
          </button>
        </div>
      </div>

      <p className="rounded-lg border border-admin-border bg-admin-surface p-3 text-xs leading-relaxed text-slate-600">
        이미 등록된 예약에 <b>다른 기기</b>가 재등록을 시도하면 여기에 쌓여요. 자동 승인은 없어요 — 손님 본인
        확인이 끝난 뒤에만 승인하세요. <b>승인하면 기존 기기의 토큰이 즉시 폐기</b>되고, 새 접속 링크가
        발급돼요. 그 링크는 손님에게 직접 전달해야 해요.
      </p>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <p className="p-6 text-center text-sm text-slate-500">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-admin-border p-8 text-center">
          <CheckCircle2 className="mx-auto mb-2 size-8 text-emerald-500" />
          <p className="text-sm text-slate-600">대기 중인 재등록 요청이 없어요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const isStaged = staged?.key === row.subject_key;
            const busy = busyKey === row.subject_key;
            return (
              <div
                key={row.subject_key}
                className="rounded-lg border border-admin-border bg-admin-surface p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{row.guest_name}</p>
                  <span className="text-xs text-slate-500">{row.party_size}명</span>
                  {row.status === 'pending' ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                      대기
                    </span>
                  ) : row.status === 'approved' ? (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                      승인됨
                    </span>
                  ) : (
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                      거절됨
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-500">
                    <Clock className="size-3" /> {kst(row.requested_at)}
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  {row.tour_date || '날짜 미상'} · {row.tour_title || '투어 미상'}
                </p>

                <div className="mt-2 grid gap-1.5 rounded-md bg-slate-50 p-2.5 text-[11px] text-slate-600 sm:grid-cols-2">
                  <p className="flex items-center gap-1.5">
                    <Smartphone className="size-3" /> 요청 기기{' '}
                    <code className="font-mono text-slate-800">{row.device_key_masked}</code>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Smartphone className="size-3" /> 현재 기기{' '}
                    <code className="font-mono text-slate-800">{row.current_device_masked ?? '—'}</code>
                    {row.current_device_last_seen ? ` · 최근 ${kst(row.current_device_last_seen)}` : ''}
                  </p>
                </div>

                {row.status === 'pending' && (
                  <>
                    {!isStaged ? (
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setStaged({ key: row.subject_key, decision: 'approve' });
                            setAcknowledged(false);
                          }}
                          className="h-9 flex-1 rounded-md bg-slate-900 text-xs font-semibold text-white"
                        >
                          승인 (기존 기기 폐기)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setStaged({ key: row.subject_key, decision: 'reject' });
                            setAcknowledged(false);
                          }}
                          className="h-9 flex-1 rounded-md border border-slate-300 text-xs font-semibold text-slate-600"
                        >
                          거절
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-md border border-slate-300 bg-white p-3">
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-900">
                          {staged.decision === 'approve' ? (
                            <>
                              <ShieldCheck className="size-3.5" /> 승인 확인
                            </>
                          ) : (
                            <>
                              <XCircle className="size-3.5" /> 거절 확인
                            </>
                          )}
                        </p>
                        <p className="mb-2 text-[11px] leading-relaxed text-slate-600">
                          {staged.decision === 'approve' ? (
                            <>
                              현재 기기(<code className="font-mono">{row.current_device_masked ?? '—'}</code>)의
                              접속 토큰을 전부 폐기하고, 요청 기기(
                              <code className="font-mono">{row.device_key_masked}</code>)로 이 예약을 이전해요.
                              기존 기기는 즉시 로그아웃돼요.
                            </>
                          ) : (
                            <>
                              요청을 거절해요. 현재 기기는 그대로 유효하고, 요청 기기는 접근 권한을 얻지 못해요.
                            </>
                          )}
                        </p>
                        <label className="mb-3 flex items-start gap-2 text-[11px] leading-relaxed text-slate-700">
                          <input
                            type="checkbox"
                            checked={acknowledged}
                            onChange={(e) => setAcknowledged(e.target.checked)}
                            className="mt-0.5"
                          />
                          <span>
                            {staged.decision === 'approve'
                              ? '손님 본인임을 직접 확인했고, 기존 기기 토큰을 폐기하는 데 동의합니다.'
                              : '이 요청을 거절하는 데 동의합니다.'}
                          </span>
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setStaged(null);
                              setAcknowledged(false);
                            }}
                            className="h-9 flex-1 rounded-md border border-slate-300 text-xs font-semibold text-slate-600"
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            disabled={!acknowledged || busy}
                            onClick={() => void decide(row, staged.decision)}
                            className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-semibold text-white disabled:opacity-40 ${
                              staged.decision === 'approve' ? 'bg-emerald-600' : 'bg-rose-600'
                            }`}
                          >
                            {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                            {staged.decision === 'approve' ? '최종 승인' : '최종 거절'}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {result?.key === row.subject_key && <ApprovalPanel data={result.data} />}

                {row.status !== 'pending' && row.decided_at && (
                  <p className="mt-2 text-[11px] text-slate-500">
                    {kst(row.decided_at)} 처리
                    {typeof row.decision_payload?.revoked_token_count === 'number'
                      ? ` · 토큰 ${row.decision_payload.revoked_token_count}건 폐기`
                      : ''}
                    {typeof row.decision_payload?.decided_by_email === 'string'
                      ? ` · ${row.decision_payload.decided_by_email}`
                      : ''}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** 승인 직후 1회만 보이는 새 접속 링크 — 손님에게 직접 전달한다. */
function ApprovalPanel({ data }: { data: ApprovalResult }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-emerald-800">
        <CheckCircle2 className="size-3.5" /> 승인 완료 — 기존 토큰 {data.revoked_token_count}건 폐기
      </p>
      <p className="mb-2 text-[11px] leading-relaxed text-emerald-700">
        아래 링크를 손님 기기에서 열면 재접속돼요. 이 링크는 다시 표시되지 않으니 지금 전달하세요.
      </p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1.5 font-mono text-[11px] text-slate-700">
          {data.url}
        </code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(data.url);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
          className="flex h-8 shrink-0 items-center gap-1 rounded bg-emerald-600 px-2.5 text-[11px] font-semibold text-white"
        >
          <Copy className="size-3" /> {copied ? '복사됨' : '복사'}
        </button>
      </div>
      {data.qr_data_url && (
        // eslint-disable-next-line @next/next/no-img-element -- data: URI QR, 최적화 대상 아님
        <img src={data.qr_data_url} alt="접속 QR" className="mt-2 size-40 rounded bg-white p-1" />
      )}
    </div>
  );
}
