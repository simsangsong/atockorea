'use client';

/**
 * §K B1.3/B1.4 — 전 채널 예약 통합 통계: 주간 카드 + 월간 달력.
 *
 * 🔴 B1-D1 — 세 티어를 **하나의 숫자로 합치지 않는다.** 이 화면의 가치는
 * 총합이 아니라 **틈**이다: 자동으로 예약이 되지 못한 수요가 얼마나 되는가.
 *
 * 🔴 B1-D6 — 티어 ②③이 0일 때 "실패 없음"과 "인박스 미연결"을 **구분해 말한다.**
 * 라이브에서 인박스는 아직 안 켜져 있다(`RESEND_WEBHOOK_SECRET` 미설정 →
 * 라우트가 501 fail-closed). 그 상태를 "0건"으로 그리면 오너는 파이프라인이
 * 도는 줄 알고 OTA 메일을 놓친다.
 *
 * ⚠ 라이브 `bookings`는 3행이다. **빈 상태·소량 상태가 기본 상태**라는 전제로
 * 설계했다 — 데이터가 많을 것을 가정한 레이아웃은 실제로는 항상 비어 보인다.
 *
 * 🔴 B1-D5 — 목록은 이름을 마스킹한다. 이 화면은 상시 열려 있다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Download, LayoutGrid, PlugZap } from 'lucide-react';
import { datesIn, leadingBlanks, monthRangeOf } from '@/lib/ops/bookings/ranges';
import {
  groupByDate,
  tierEmptyLabel,
  type BookingTier,
  type PipelineState,
  type UnifiedRecord,
  type UnifiedSummary,
} from '@/lib/ops/bookings/unified';

interface OverviewPayload {
  view: 'week' | 'month';
  axis: 'tour_date' | 'created_at';
  records: UnifiedRecord[];
  summary: UnifiedSummary;
  inbox: PipelineState;
  range: { from: string; to: string };
}

const TIER_LABEL: Record<BookingTier, string> = {
  confirmed: '확정 예약',
  pending_review: '확인 대기',
  unparsed: '예약 실패',
};

const GAP_LABEL: Record<'no_room' | 'no_participant' | 'no_seat', string> = {
  no_room: '투어룸 없음',
  no_participant: '아무도 입장 안 함',
  no_seat: '좌석 미배정',
};

/** §5.2 C-1 패턴 — 상시 열려 있는 화면에서 이름을 통째로 보여주지 않는다. */
export function maskName(name: string | null | undefined): string {
  const raw = (name ?? '').trim();
  if (!raw) return '이름 없음';
  if (raw.length <= 2) return `${raw[0]}*`;
  return `${raw[0]}${'*'.repeat(Math.min(raw.length - 2, 4))}${raw[raw.length - 1]}`;
}

export default function OpsBookingsOverview({ getToken }: { getToken?: () => Promise<string | null> }) {
  const [view, setView] = useState<'week' | 'month'>('week');
  const [axis, setAxis] = useState<'tour_date' | 'created_at'>('tour_date');
  const [month, setMonth] = useState<string | null>(null);
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ view, axis });
      if (view === 'month' && month) params.set('month', month);
      const token = getToken ? await getToken() : null;
      const res = await fetch(`/api/admin/tour-ops/bookings-overview?${params}`, {
        cache: 'no-store',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '불러오지 못했습니다');
      setData(json as OverviewPayload);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }, [view, axis, month, getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const byDate = useMemo(
    () => (data ? groupByDate(data.records, data.axis) : new Map<string, UnifiedRecord[]>()),
    [data],
  );

  const shiftMonth = (delta: number) => {
    const base = month ?? (data?.range.from ?? '').slice(0, 7);
    const m = /^(\d{4})-(\d{2})$/.exec(base);
    if (!m) return;
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + delta, 1));
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <div className="space-y-3 p-3" data-testid="ops-bookings-overview">
      {/* 뷰 전환 */}
      <div className="flex items-center gap-2">
        {(['week', 'month'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setView(k)}
            aria-pressed={view === k}
            className={
              'flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-xs font-bold ' +
              (view === k
                ? 'bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)]'
                : 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]')
            }
          >
            {k === 'week' ? <LayoutGrid size={13} aria-hidden /> : <CalendarDays size={13} aria-hidden />}
            {k === 'week' ? '주간' : '월간'}
          </button>
        ))}

        {/* B1-D4 — "이번 주에 뭐가 나가나"와 "이번 주에 얼마나 들어왔나"는
            다른 질문이고 둘 다 필요하다. */}
        <button
          type="button"
          onClick={() => setAxis((a) => (a === 'tour_date' ? 'created_at' : 'tour_date'))}
          className="ml-auto min-h-[36px] rounded-full bg-[var(--tr-surface-2)] px-3 text-xs font-medium text-[var(--tr-ink-2)]"
          data-testid="axis-toggle"
        >
          {axis === 'tour_date' ? '투어일 기준' : '예약 유입일 기준'}
        </button>

        {/* §K B1.6 — 화면과 **같은 리졸버**가 만든 CSV다(내보내기가 자기 쿼리를
            가지면 화면과 파일의 숫자가 어긋난다). 🔴 파일에는 이름이 마스킹 없이
            들어간다 — 내보내기는 명시적 행동이고, 마스킹된 CSV는 대조라는 목적을
            잃는다. */}
        <a
          href={`/api/admin/tour-ops/bookings-overview?${new URLSearchParams({
            view,
            axis,
            format: 'csv',
            ...(view === 'month' && month ? { month } : {}),
          })}`}
          className="flex min-h-[36px] items-center gap-1 rounded-full bg-[var(--tr-surface-2)] px-3 text-xs font-medium text-[var(--tr-ink-2)]"
          data-testid="csv-export"
        >
          <Download size={13} aria-hidden />
          CSV
        </a>
      </div>

      {loading && <p className="py-8 text-center text-xs text-[var(--tr-ink-3)]">불러오는 중…</p>}
      {error && <p className="rounded-xl bg-[var(--tr-danger-soft)] px-3 py-2 text-xs text-[var(--tr-danger)]">{error}</p>}

      {data && !loading && (
        <>
          {/* 🔴 B1-D1 — 티어별 카드. 합계 카드를 두지 않는다. */}
          <div className="grid grid-cols-3 gap-2">
            {(['confirmed', 'pending_review', 'unparsed'] as const).map((tier) => {
              const count = data.summary.counts[tier];
              const empty = count === 0 && tier !== 'confirmed';
              const notConnected = empty && data.inbox === 'never_ran';
              return (
                <div
                  key={tier}
                  className="rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] p-2.5"
                  data-testid={`tier-${tier}`}
                >
                  <p className="text-[10px] font-semibold text-[var(--tr-ink-3)]">{TIER_LABEL[tier]}</p>
                  {notConnected ? (
                    // B1-D6 — 숫자를 크게 쓰지 않는다. 0은 여기서 사실이 아니다.
                    <p
                      className="mt-1 flex items-center gap-1 text-[11px] font-bold text-[var(--tr-warn,#b45309)]"
                      data-testid={`tier-${tier}-disconnected`}
                    >
                      <PlugZap size={12} aria-hidden />
                      {tierEmptyLabel(tier, 'never_ran')}
                    </p>
                  ) : (
                    <>
                      <p className="mt-0.5 text-2xl font-bold tabular-nums text-[var(--tr-ink)]">{count}</p>
                      {tier === 'confirmed' && (
                        <p className="text-[10px] text-[var(--tr-ink-3)]">{data.summary.confirmedGuests}명</p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* 🔴 B1-D2 — 요주의를 상단 고정. 세 실패를 따로 센다: 원인이 다르면
              조치도 다르고, 합쳐 놓으면 무엇을 해야 하는지가 사라진다. */}
          {(['no_room', 'no_participant', 'no_seat'] as const).some((k) => data.summary.roomGaps[k] > 0) && (
            <div className="rounded-xl bg-[var(--tr-danger-soft)] p-2.5" data-testid="room-gaps">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--tr-danger)]">
                <AlertTriangle size={12} aria-hidden />
                투어룸에 포함되지 않은 손님
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(['no_room', 'no_participant', 'no_seat'] as const)
                  .filter((k) => data.summary.roomGaps[k] > 0)
                  .map((k) => (
                    <span
                      key={k}
                      className="rounded-full bg-[var(--tr-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--tr-ink-2)]"
                      data-testid={`gap-${k}`}
                    >
                      {GAP_LABEL[k]} {data.summary.roomGaps[k]}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {view === 'week' ? (
            <WeekCards byDate={byDate} range={data.range} />
          ) : (
            <MonthCalendar byDate={byDate} range={data.range} onShift={shiftMonth} />
          )}

          {data.records.length === 0 && (
            <p className="py-6 text-center text-xs text-[var(--tr-ink-3)]" data-testid="overview-empty">
              이 기간에는 예약이 없습니다.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function WeekCards({ byDate, range }: { byDate: Map<string, UnifiedRecord[]>; range: { from: string; to: string } }) {
  const days = datesIn(range);
  return (
    <div className="space-y-2" data-testid="week-cards">
      {days.map((day) => {
        const rows = byDate.get(day) ?? [];
        return (
          <div key={day} className="rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] p-2.5">
            <p className="text-[11px] font-bold text-[var(--tr-ink-2)]">
              {day} <span className="font-normal text-[var(--tr-ink-3)]">· {rows.length}건</span>
            </p>
            {rows.length === 0 ? (
              <p className="mt-1 text-[11px] text-[var(--tr-ink-3)]">—</p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {rows.map((r) => (
                  <li key={`${r.tier}-${r.id}`} className="flex items-center gap-1.5 text-[11px]">
                    <span className="rounded-full bg-[var(--tr-surface-2)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--tr-ink-3)]">
                      {r.channel}
                    </span>
                    <span className="truncate text-[var(--tr-ink)]">{maskName(r.guestName)}</span>
                    {r.partySize > 0 && <span className="text-[var(--tr-ink-3)]">{r.partySize}명</span>}
                    {r.reason && (
                      <span className="ml-auto truncate text-[10px] text-[var(--tr-ink-3)]" title={r.reason}>
                        {r.reason}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MonthCalendar({
  byDate,
  range,
  onShift,
}: {
  byDate: Map<string, UnifiedRecord[]>;
  range: { from: string; to: string };
  onShift: (delta: number) => void;
}) {
  const days = datesIn(range);
  const blanks = leadingBlanks(range.from);
  const monthLabel = range.from.slice(0, 7);
  const valid = monthRangeOf(monthLabel);

  return (
    <div data-testid="month-calendar">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => onShift(-1)} aria-label="이전 달" className="min-h-[36px] min-w-[36px] rounded-full text-[var(--tr-ink-2)]">
          <ChevronLeft size={16} aria-hidden />
        </button>
        <p className="text-xs font-bold text-[var(--tr-ink)]">{monthLabel}</p>
        <button type="button" onClick={() => onShift(1)} aria-label="다음 달" className="min-h-[36px] min-w-[36px] rounded-full text-[var(--tr-ink-2)]">
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>

      {/* 375px에서 7열이 무너지지 않게: 고정 그리드 + 셀 안에서만 줄바꿈. */}
      <div className="grid grid-cols-7 gap-[3px] text-center">
        {['월', '화', '수', '목', '금', '토', '일'].map((d) => (
          <span key={d} className="text-[9px] font-semibold text-[var(--tr-ink-3)]">
            {d}
          </span>
        ))}
        {valid &&
          Array.from({ length: blanks }, (_, i) => <span key={`blank-${i}`} aria-hidden />)}
        {days.map((day) => {
          const rows = byDate.get(day) ?? [];
          const guests = rows.reduce((sum, r) => sum + r.partySize, 0);
          const gaps = rows.filter((r) => r.roomGap).length;
          return (
            <button
              key={day}
              type="button"
              className="min-h-[46px] rounded-lg bg-[var(--tr-surface-2)] p-1 text-left"
              data-testid="calendar-cell"
              data-date={day}
            >
              <span className="block text-[9px] text-[var(--tr-ink-3)] tabular-nums">{Number(day.slice(8))}</span>
              {rows.length > 0 && (
                <span className="block text-[10px] font-bold tabular-nums text-[var(--tr-ink)]">
                  {rows.length}·{guests}명
                </span>
              )}
              {gaps > 0 && (
                <span className="mt-0.5 block h-1 w-1 rounded-full bg-[var(--tr-danger)]" data-testid="calendar-gap-dot" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
