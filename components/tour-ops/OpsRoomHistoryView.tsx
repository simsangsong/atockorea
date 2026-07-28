'use client';

/**
 * 투어룸 생성 내역 — 월 범위 (관제 W3).
 *
 * 대시보드가 "오늘 돌아가는 것"이라면 이 화면은 **"이번 달에 우리가 연 방들이
 * 실제로 쓰였는가"**다. 방을 만드는 것은 자동이지만 손님이 들어오는 것은 아니고,
 * 안 들어온 방은 투어 당일 아침에야 발견된다 — 그때는 늦다.
 *
 * 그래서 기본 필터가 **미입장**이다. 전체 목록을 먼저 보여주면 정작 손을 써야 할
 * 방이 스크롤 아래로 숨는다.
 *
 * 탭이 아니라 전체화면 시트로 사는 이유: 하단 탭이 이미 6개라 `flex-1`이 좁다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Download, RefreshCw, X } from 'lucide-react';
import { getOpsToken } from '@/components/tour-ops/opsShared';
import { ROOM_HEALTH_LABEL, type RoomHealth, type RoomMonthResult, type RoomMonthRow } from '@/lib/ops/rooms/monthly';
import { shiftMonth } from '@/lib/ops/guides/availability';

type Filter = 'dead' | 'all' | 'active' | 'quiet' | 'closed';

const HEALTH_TONE: Record<RoomHealth, string> = {
  dead: 'bg-[var(--tr-danger-soft)] text-[var(--tr-danger)]  ',
  quiet: 'bg-[var(--tr-warn-soft)] text-[var(--tr-warn)]  ',
  active: 'bg-[var(--tr-safe-soft)] text-[var(--tr-safe)]  ',
  closed: 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-3)]  ',
};

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'dead', label: '미입장' },
  { key: 'quiet', label: '입장만' },
  { key: 'active', label: '대화 중' },
  { key: 'closed', label: '종료' },
  { key: 'all', label: '전체' },
];

export default function OpsRoomHistoryView({
  initialPeriod,
  onClose,
  onOpenRoom,
}: {
  initialPeriod: string;
  onClose: () => void;
  onOpenRoom?: (roomId: string) => void;
}) {
  // O5 — Escape closes this overlay. It covers the whole screen, and on the
  // desktop the board actually runs on, 닫기 was the only way out.
  useEscapeClose(onClose);
  const [period, setPeriod] = useState(initialPeriod);
  const [data, setData] = useState<RoomMonthResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('dead');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getOpsToken();
      const res = await fetch(`/api/admin/tour-ops/rooms/monthly?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '불러오기 실패');
      setData(json as RoomMonthResult);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  const step = (delta: number) => {
    const [y, m] = period.split('-').map(Number);
    const next = shiftMonth(y, m, delta);
    setPeriod(`${next.year}-${String(next.month).padStart(2, '0')}`);
  };

  const rows = useMemo(() => {
    if (!data) return [] as RoomMonthRow[];
    return filter === 'all' ? data.rows : data.rows.filter((r) => r.health === filter);
  }, [data, filter]);

  const summary = data?.summary;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[var(--tr-canvas)] text-[var(--tr-ink)]"
      data-testid="ops-room-history"
    >
      <header
        className="border-b border-[var(--tr-hairline)] px-4 pb-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
      >
        <div className="flex min-h-[40px] items-center justify-between gap-2">
          <h2 className="text-cjk-safe tr-body font-bold">투어룸 생성 내역</h2>
          <div className="flex items-center gap-1">
            <a
              href={`/api/admin/tour-ops/rooms/monthly/export?period=${period}&format=xlsx`}
              className="flex size-10 items-center justify-center rounded-lg text-[var(--tr-ink-2)] active:bg-[var(--tr-surface-2)]"
              aria-label="엑셀로 내려받기"
            >
              <Download className="size-4" />
            </a>
            <button
              type="button"
              onClick={() => void load()}
              aria-label="새로고침"
              className="flex size-10 items-center justify-center rounded-lg text-[var(--tr-ink-2)] active:bg-[var(--tr-surface-2)]"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="flex size-10 items-center justify-center rounded-lg text-[var(--tr-ink-2)] active:bg-[var(--tr-surface-2)]"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="이전 달"
            className="flex size-9 items-center justify-center rounded-lg text-[var(--tr-ink-2)] active:bg-[var(--tr-surface-2)]"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-[76px] text-center tr-body font-bold tabular-nums">{period}</span>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="다음 달"
            className="flex size-9 items-center justify-center rounded-lg text-[var(--tr-ink-2)] active:bg-[var(--tr-surface-2)]"
          >
            <ChevronRight className="size-4" />
          </button>
          {summary && (
            <p className="text-cjk-body ml-auto text-right tr-meta leading-tight text-[var(--tr-ink-3)]">
              방 {summary.roomCount} · 손님 {summary.guestTotal}명
              <br />
              메시지 {summary.messageTotal}
            </p>
          )}
        </div>

        <div className="-mx-1 mt-2 flex gap-1 overflow-x-auto pb-1">
          {FILTERS.map((f) => {
            const count =
              !summary
                ? 0
                : f.key === 'all'
                  ? summary.roomCount
                  : f.key === 'dead'
                    ? summary.deadCount
                    : f.key === 'quiet'
                      ? summary.quietCount
                      : f.key === 'active'
                        ? summary.activeCount
                        : summary.closedCount;
            const on = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={on}
                className={`text-cjk-safe shrink-0 rounded-full px-3 py-1.5 tr-label font-semibold transition-colors ${
                  on
                    ? 'bg-[var(--tr-ink)] text-[var(--tr-canvas)]'
                    : 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]'
                }`}
              >
                {f.label} {count}
              </button>
            );
          })}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {data?.truncated && (
          <p className="text-cjk-body mb-2 rounded-lg bg-[var(--tr-warn-soft)] px-3 py-2 tr-meta leading-relaxed text-[var(--tr-warn)]  ">
            이 달의 하위 데이터가 조회 상한에 닿았습니다. 아래 집계는 <b>최소값</b>이며 실제
            메시지·참가자 수는 더 많을 수 있습니다.
          </p>
        )}

        {loading && !data ? (
          <p className="py-12 text-center tr-card-text text-[var(--tr-ink-3)]">불러오는 중…</p>
        ) : rows.length === 0 ? (
          <p className="text-cjk-body py-12 text-center tr-card-text text-[var(--tr-ink-3)]">
            {filter === 'dead'
              ? '손님이 안 들어온 방이 없습니다 👍'
              : '이 조건에 해당하는 방이 없습니다.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onOpenRoom?.(r.id)}
                  className="text-cjk-safe w-full rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-2.5 text-left active:bg-[var(--tr-surface-2)]"
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 tr-body font-bold">
                        <span className="tabular-nums">{r.tourDate ?? '날짜 미상'}</span>
                        <span className="text-[var(--tr-ink-3)]">·</span>
                        <span className="truncate">{r.contactName ?? '이름 없음'}</span>
                      </p>
                      <p className="truncate tr-label text-[var(--tr-ink-2)]">
                        {r.tourTitle ?? '상품 미상'}
                        {r.city ? ` · ${r.city}` : ''}
                      </p>
                      <p className="mt-0.5 tr-meta text-[var(--tr-ink-3)] tabular-nums">
                        예약 {r.guests ?? '?'}명 · 입장 {r.guestCount}명 · 초대 {r.inviteCount}
                        {r.liveInviteCount !== r.inviteCount ? `(유효 ${r.liveInviteCount})` : ''} · 메시지{' '}
                        {r.guestMessageCount}/{r.messageCount}
                      </p>
                    </div>
                    <span
                      className={`text-cjk-safe shrink-0 rounded-full px-2 py-0.5 tr-meta font-bold ${HEALTH_TONE[r.health]}`}
                    >
                      {ROOM_HEALTH_LABEL[r.health]}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
