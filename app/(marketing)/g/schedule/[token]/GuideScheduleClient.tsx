'use client';

/**
 * 가이드 셀프 스케줄 화면 (§11.F).
 *
 * 가이드가 링크 하나로 여는 화면. 로그인 없음, 앱 설치 없음, 볼 수 있는 것은
 * 자기 이름과 자기 휴무 달력뿐이다 — 남의 일정도, 자기 단가나 개인정보도 여기
 * 없다(라우트가 아예 내려주지 않는다).
 *
 * 지난 날짜는 잠겨 있다: 이미 지나간 날의 휴무를 소급해 바꾸면 정산 근거가
 * 흔들린다. 정정이 필요하면 담당자에게 말하는 게 맞다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarCheck2, Loader2 } from 'lucide-react';
import GuideRestCalendar, { type RestDay } from '@/components/ops/GuideRestCalendar';

interface ScheduleResponse {
  guide: { name: string };
  year: number;
  month: number;
  today: string;
  dates: RestDay[];
}

export default function GuideScheduleClient({ token, guideName }: { token: string; guideName: string }) {
  const [data, setData] = useState<ScheduleResponse | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const base = useMemo(() => `/api/guide-schedule/${encodeURIComponent(token)}`, [token]);

  const load = useCallback(
    async (y?: number, m?: number) => {
      setLoading(true);
      setError(null);
      try {
        const qs = y && m ? `?year=${y}&month=${m}` : '';
        const res = await fetch(`${base}${qs}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || '불러오지 못했습니다');
        setData(json as ScheduleResponse);
        setYear(json.year as number);
        setMonth(json.month as number);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [base],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (date: string, isRest: boolean) => {
    setBusyDate(date);
    setError(null);
    try {
      const res = await fetch(isRest ? `${base}?date=${date}` : base, {
        method: isRest ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: isRest ? undefined : JSON.stringify({ date }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || '변경하지 못했습니다');
      await load(year ?? undefined, month ?? undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyDate(null);
    }
  };

  const restCount = data?.dates.length ?? 0;

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <header className="mb-5">
        <p className="text-[12px] font-semibold text-slate-500">내 휴무 등록</p>
        <h1 className="mt-0.5 text-[22px] font-bold text-slate-900">{guideName}님</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
          쉬는 날을 눌러서 표시해 주세요. 배정할 때 참고합니다.
        </p>
      </header>

      {error && (
        <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-700">{error}</p>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        {loading && !data ? (
          <p className="py-16 text-center text-[13px] text-slate-500">
            <Loader2 className="mx-auto mb-2 size-5 animate-spin text-slate-400" />
            불러오는 중…
          </p>
        ) : data && year && month ? (
          <GuideRestCalendar
            year={year}
            month={month}
            restDays={data.dates}
            today={data.today}
            busyDate={busyDate}
            readOnlyPast
            onMonthChange={({ year: y, month: m }) => {
              setYear(y);
              setMonth(m);
              void load(y, m);
            }}
            onToggle={(date, isRest) => void toggle(date, isRest)}
          />
        ) : null}
      </div>

      {data && (
        <p className="mt-3 flex items-center gap-1.5 text-[13px] text-slate-600">
          <CalendarCheck2 className="size-4 text-slate-400" />
          {month}월 휴무 <strong className="font-bold text-slate-900">{restCount}일</strong>
        </p>
      )}

      <p className="mt-6 text-[12px] leading-relaxed text-slate-400">
        지난 날짜는 바꿀 수 없어요. 수정이 필요하면 담당자에게 알려주세요.
      </p>
    </main>
  );
}
