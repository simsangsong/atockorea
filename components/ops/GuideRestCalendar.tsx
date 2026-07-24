'use client';

/**
 * 휴무 달력 — 관리자 가이드 상세와 가이드 셀프 스케줄이 공유하는 한 벌.
 *
 * 두 화면이 같은 달력을 봐야 "내가 등록한 날"과 "관제가 보는 날"이 어긋나지
 * 않는다. 그래서 그리기 로직은 여기 하나뿐이고, 권한 차이는 props로만 표현한다
 * (readOnlyPast: 가이드는 지난 날짜를 못 만지고, 관리자는 정정할 수 있다).
 *
 * 날짜 산술은 전부 lib/ops/guides/availability의 순수 함수 — UTC date-only라
 * 시간대에 흔들리지 않는다. 스태프 전용 화면이므로 한국어 단일 로케일.
 */

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { WEEKDAY_LABELS, kstToday, monthCells, shiftMonth } from '@/lib/ops/guides/availability';

export interface RestDay {
  date: string;
  reason?: string | null;
  source?: string;
}

export default function GuideRestCalendar({
  year,
  month,
  restDays,
  today = kstToday(),
  busyDate = null,
  readOnlyPast = false,
  onMonthChange,
  onToggle,
}: {
  year: number;
  month: number;
  restDays: RestDay[];
  today?: string;
  /** 진행 중인 날짜 (버튼 잠금 + 스피너 표시). */
  busyDate?: string | null;
  /** true면 지난 날짜는 누를 수 없다 (가이드 셀프 뷰). */
  readOnlyPast?: boolean;
  onMonthChange: (next: { year: number; month: number }) => void;
  onToggle: (date: string, isRest: boolean) => void;
}) {
  const { cells, leadingBlanks } = useMemo(() => monthCells(year, month, today), [year, month, today]);
  const restMap = useMemo(() => {
    const map = new Map<string, RestDay>();
    for (const d of restDays) map.set(d.date, d);
    return map;
  }, [restDays]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonthChange(shiftMonth(year, month, -1))}
          aria-label="이전 달"
          className="flex size-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 active:bg-slate-200"
        >
          <ChevronLeft className="size-5" />
        </button>
        <p className="text-[15px] font-bold text-slate-900">
          {year}년 {month}월
        </p>
        <button
          type="button"
          onClick={() => onMonthChange(shiftMonth(year, month, 1))}
          aria-label="다음 달"
          className="flex size-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 active:bg-slate-200"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={`pb-1 text-center text-[11px] font-semibold ${
              i === 0 ? 'text-rose-500' : i === 6 ? 'text-blue-500' : 'text-slate-400'
            }`}
          >
            {label}
          </div>
        ))}

        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}

        {cells.map((cell) => {
          const rest = restMap.get(cell.date);
          const isRest = Boolean(rest);
          const locked = readOnlyPast && cell.isPast;
          const busy = busyDate === cell.date;
          return (
            <button
              key={cell.date}
              type="button"
              disabled={locked || busy}
              onClick={() => onToggle(cell.date, isRest)}
              title={rest?.reason ? `휴무 — ${rest.reason}` : isRest ? '휴무' : undefined}
              aria-pressed={isRest}
              aria-label={`${cell.day}일${isRest ? ' 휴무' : ''}`}
              className={[
                'relative flex h-11 flex-col items-center justify-center rounded-xl text-[13px] font-semibold transition',
                isRest
                  ? 'bg-rose-500 text-white shadow-sm'
                  : locked
                    ? 'text-slate-300'
                    : 'text-slate-700 hover:bg-slate-100 active:bg-slate-200',
                cell.isToday && !isRest ? 'ring-2 ring-slate-900 ring-offset-1' : '',
                busy ? 'opacity-50' : '',
              ].join(' ')}
            >
              {cell.day}
              {rest?.source === 'self' && (
                <span
                  className="absolute bottom-1 size-1 rounded-full bg-white/80"
                  title="가이드 본인이 등록"
                />
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-full bg-rose-500" /> 휴무
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-full ring-2 ring-slate-900" /> 오늘
        </span>
        <span>날짜를 누르면 휴무 등록/해제</span>
      </p>
    </div>
  );
}
