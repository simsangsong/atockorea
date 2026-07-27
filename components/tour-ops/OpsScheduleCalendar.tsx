'use client';

/**
 * 가이드 근무 · 차량 배차 월 달력 — 관제 W4.
 *
 * **한 컴포넌트, 두 축.** 축 토글만 바꾸면 행이 가이드에서 차량으로 바뀐다.
 * 두 화면으로 만들면 셀 판정과 달 이동을 두 번 유지보수하게 되고, 두 벌은
 * 반드시 갈라진다(설계안 §1-3).
 *
 * 읽기 전용이다 — 드래그 배정은 v2. 모바일에서 드래그는 오조작이 쉽고, 배정은
 * 충돌 판정을 거쳐야 하는 쓰기다(W2).
 *
 * 가로 스크롤 표라 `min-w`를 반드시 준다. `w-full`만 두면 31개 열이 짜부라지고
 * 한글 헤더가 글자 단위로 무너진다(CLAUDE.md 불변 규칙 3).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Download, RefreshCw, X } from 'lucide-react';
import { getOpsToken } from '@/components/tour-ops/opsShared';
import { shiftMonth, WEEKDAY_LABELS, type DayCell } from '@/lib/ops/guides/availability';
import { ISSUE_LABEL, type CellIssue, type ScheduleAxis } from '@/lib/ops/schedule/matrix';

interface WireCell {
  date: string;
  items: Array<{ id: string; label: string; startTime?: string | null; endTime?: string | null; status?: string | null }>;
  unavailable: boolean;
  issues: CellIssue[];
}
interface WireRow {
  subject: { id: string; label: string; sublabel?: string | null; active?: boolean };
  total: number;
  issueCount: number;
  cells: Record<string, WireCell>;
}
interface WireMatrix {
  period: string;
  axis: ScheduleAxis;
  days: DayCell[];
  dayTotals: Record<string, { count: number; issues: number }>;
  rows: WireRow[];
  truncated: boolean;
  undatedCount: number;
}

const AXES: Array<{ key: ScheduleAxis; label: string }> = [
  { key: 'guide', label: '가이드 근무' },
  { key: 'vehicle', label: '차량 배차' },
];

/** 문제의 심각도 순서 — 가장 확실한 문제가 셀 색을 결정한다. */
function worstIssue(issues: CellIssue[]): CellIssue | null {
  for (const code of ['overlap', 'problem', 'on_rest_day', 'double'] as CellIssue[]) {
    if (issues.includes(code)) return code;
  }
  return null;
}

const ISSUE_TONE: Record<CellIssue, string> = {
  overlap: 'bg-[var(--tr-danger)] text-white',
  problem: 'bg-[var(--tr-danger)] text-white',
  on_rest_day: 'bg-[var(--tr-warn)] text-white',
  double: 'bg-[var(--tr-warn-soft)] text-[var(--tr-warn)]  ',
};

export default function OpsScheduleCalendar({
  initialPeriod,
  onClose,
}: {
  initialPeriod: string;
  onClose: () => void;
}) {
  const [period, setPeriod] = useState(initialPeriod);
  const [axis, setAxis] = useState<ScheduleAxis>('guide');
  const [data, setData] = useState<WireMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [openCell, setOpenCell] = useState<{ row: WireRow; cell: WireCell } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getOpsToken();
      const res = await fetch(`/api/admin/tour-ops/schedule?period=${period}&axis=${axis}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '불러오기 실패');
      setData(json as WireMatrix);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [period, axis]);

  useEffect(() => {
    void load();
  }, [load]);

  const step = (delta: number) => {
    const [y, m] = period.split('-').map(Number);
    const next = shiftMonth(y, m, delta);
    setPeriod(`${next.year}-${String(next.month).padStart(2, '0')}`);
  };

  const issueTotal = useMemo(
    () => (data ? data.rows.reduce((sum, r) => sum + r.issueCount, 0) : 0),
    [data],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[var(--tr-canvas)] text-[var(--tr-ink)]"
      data-testid="ops-schedule-calendar"
    >
      <header
        className="border-b border-[var(--tr-hairline)] px-4 pb-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
      >
        <div className="flex min-h-[40px] items-center justify-between gap-2">
          <h2 className="text-cjk-safe tr-body font-bold">근무 · 배차 달력</h2>
          <div className="flex items-center gap-1">
            <a
              href={`/api/admin/tour-ops/schedule?period=${period}&axis=${axis}&format=xlsx`}
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

          <div className="ml-auto flex items-center gap-1 rounded-lg bg-[var(--tr-surface-2)] p-0.5">
            {AXES.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => setAxis(a.key)}
                aria-pressed={axis === a.key}
                className={`text-cjk-safe rounded-md px-2.5 py-1.5 tr-label font-semibold transition-colors ${
                  axis === a.key
                    ? 'bg-[var(--tr-surface)] text-[var(--tr-ink)] shadow-sm'
                    : 'text-[var(--tr-ink-3)]'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {issueTotal > 0 && (
          <p className="text-cjk-body mt-1.5 tr-meta font-semibold text-[var(--tr-danger)]">
            확인이 필요한 칸 {issueTotal}개
          </p>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
        {data?.truncated && (
          <p className="text-cjk-body mb-2 rounded-lg bg-[var(--tr-warn-soft)] px-3 py-2 tr-meta leading-relaxed text-[var(--tr-warn)]  ">
            조회 상한에 닿았습니다. 아래 표는 <b>최소값</b>입니다.
          </p>
        )}
        {!!data?.undatedCount && (
          <p className="text-cjk-body mb-2 rounded-lg bg-[var(--tr-warn-soft)] px-3 py-2 tr-meta leading-relaxed text-[var(--tr-warn)]  ">
            날짜를 확인할 수 없는 배차 {data.undatedCount}건은 표에 없습니다. (룸·그룹에 투어일이
            없는 배차)
          </p>
        )}

        {loading && !data ? (
          <p className="py-12 text-center tr-card-text text-[var(--tr-ink-3)]">불러오는 중…</p>
        ) : !data || data.rows.length === 0 ? (
          <p className="text-cjk-body py-12 text-center tr-card-text text-[var(--tr-ink-3)]">
            {axis === 'guide'
              ? '등록된 가이드가 없습니다.'
              : '등록된 차량이 없습니다. 차량 관리에서 번호판을 먼저 등록해 주세요.'}
          </p>
        ) : (
          /* P1-5 — min-w 없이는 31개 열이 짜부라져 한글 헤더가 세로로 무너진다. */
          <div className="overflow-x-auto rounded-xl border border-[var(--tr-hairline)]">
            <table className="w-full min-w-[900px] border-collapse tr-label">
              <thead>
                <tr className="bg-[var(--tr-surface-2)]">
                  <th className="text-cjk-safe sticky left-0 z-10 min-w-[112px] bg-[var(--tr-surface-2)] px-2 py-1.5 text-left font-semibold">
                    {axis === 'guide' ? '가이드' : '차량'}
                  </th>
                  {data.days.map((d) => (
                    <th
                      key={d.date}
                      className={`w-[26px] px-0 py-1.5 text-center font-semibold tabular-nums ${
                        d.isToday
                          ? 'text-[var(--tr-accent)]'
                          : d.weekday === 0
                            ? 'text-[var(--tr-danger)]'
                            : d.weekday === 6
                              ? 'text-[var(--tr-accent)]'
                              : 'text-[var(--tr-ink-3)]'
                      }`}
                    >
                      <span className="block tr-meta leading-none">{WEEKDAY_LABELS[d.weekday]}</span>
                      <span className="block leading-tight">{d.day}</span>
                    </th>
                  ))}
                  <th className="text-cjk-safe w-[40px] px-1 py-1.5 text-center font-semibold">계</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.subject.id} className="border-t border-[var(--tr-hairline)]">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 min-w-[112px] bg-[var(--tr-surface)] px-2 py-1.5 text-left font-medium"
                    >
                      <span className="text-cjk-safe block max-w-[104px]">{row.subject.label}</span>
                      {row.subject.sublabel ? (
                        <span className="text-cjk-safe block max-w-[104px] tr-meta text-[var(--tr-ink-3)]">
                          {row.subject.sublabel}
                        </span>
                      ) : null}
                    </th>
                    {data.days.map((d) => {
                      const cell = row.cells[d.date];
                      const live = cell ? cell.items.filter((i) => i.status !== 'cancelled').length : 0;
                      const issue = cell ? worstIssue(cell.issues) : null;
                      const resting = cell?.unavailable && live === 0;
                      return (
                        <td key={d.date} className="p-0 text-center align-middle">
                          {cell ? (
                            <button
                              type="button"
                              onClick={() => setOpenCell({ row, cell })}
                              title={
                                cell.issues.length > 0
                                  ? cell.issues.map((i) => ISSUE_LABEL[i]).join(' · ')
                                  : undefined
                              }
                              className={`m-0.5 flex size-[22px] items-center justify-center rounded tr-meta font-bold tabular-nums ${
                                issue
                                  ? ISSUE_TONE[issue]
                                  : resting
                                    ? 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-3)]'
                                    : 'bg-[var(--tr-safe-soft)] text-[var(--tr-safe)]  '
                              }`}
                            >
                              {resting ? '휴' : live}
                            </button>
                          ) : (
                            <span className="block size-[22px]" />
                          )}
                        </td>
                      );
                    })}
                    <td className="px-1 text-center tr-meta font-bold tabular-nums">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 tr-meta text-[var(--tr-ink-3)]">
          <li className="flex items-center gap-1">
            <span className="size-2.5 rounded-sm bg-[var(--tr-safe)]" /> 정상
          </li>
          <li className="flex items-center gap-1">
            <span className="size-2.5 rounded-sm bg-[var(--tr-warn)]" /> 하루 2건 이상
          </li>
          <li className="flex items-center gap-1">
            <span className="size-2.5 rounded-sm bg-[var(--tr-warn)]" /> 휴무일 배정
          </li>
          <li className="flex items-center gap-1">
            <span className="size-2.5 rounded-sm bg-[var(--tr-danger)]" /> 시간 겹침 · 정원 초과
          </li>
          <li className="flex items-center gap-1">
            <span className="size-2.5 rounded-sm bg-[var(--tr-surface-2)]" /> 휴무
          </li>
        </ul>
      </div>

      {openCell && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-[var(--tr-hairline)] sm:items-center"
          onClick={() => setOpenCell(null)}
        >
          <div
            className="max-h-[70dvh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-[var(--tr-surface)] p-4 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-cjk-safe tr-body font-bold">
              {openCell.row.subject.label} · {openCell.cell.date}
            </p>
            {openCell.cell.issues.length > 0 && (
              <p className="text-cjk-body mt-1 tr-label font-semibold text-[var(--tr-danger)]">
                {openCell.cell.issues.map((i) => ISSUE_LABEL[i]).join(' · ')}
              </p>
            )}
            {openCell.cell.unavailable && (
              <p className="text-cjk-body mt-1 tr-label text-[var(--tr-warn)]">휴무로 등록된 날입니다.</p>
            )}
            <ul className="mt-2 space-y-1.5">
              {openCell.cell.items.length === 0 ? (
                <li className="tr-label text-[var(--tr-ink-3)]">배정 없음</li>
              ) : (
                openCell.cell.items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg border border-[var(--tr-hairline)] px-2.5 py-1.5 tr-label"
                  >
                    <span className={item.status === 'cancelled' ? 'line-through opacity-60' : ''}>{item.label}</span>
                    {item.startTime ? (
                      <span className="ml-1.5 text-[var(--tr-ink-3)] tabular-nums">
                        {item.startTime.slice(0, 5)}
                        {item.endTime ? `–${item.endTime.slice(0, 5)}` : ''}
                      </span>
                    ) : (
                      <span className="ml-1.5 text-[var(--tr-ink-3)]">시각 미상</span>
                    )}
                  </li>
                ))
              )}
            </ul>
            <button
              type="button"
              onClick={() => setOpenCell(null)}
              className="mt-3 h-11 w-full rounded-xl bg-[var(--tr-surface-2)] tr-card-text font-semibold"
            >
              <span className="text-cjk-safe">닫기</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
