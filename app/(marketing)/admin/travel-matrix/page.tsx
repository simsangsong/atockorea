'use client';

/**
 * X18 — the learned travel matrix, made visible.
 *
 * `poi_travel_matrix` is what turns "we guessed the drive with a ×1.55 fudge on
 * straight-line distance" into "we have driven this leg N times and it takes M
 * minutes". It has been written by a weekly cron since W5 and read by the ETA
 * resolver — and nobody could look at it.
 *
 * 🔴 This screen will show an empty table for a while, and that is the honest
 * state, so it says WHY instead of looking broken. Measured 2026-07-31: matrix
 * 0 rows, and 0 arrival events of any kind, ever. The learner was never broken;
 * it had never been handed an arrival. X15 put the geofence on the staff device
 * and X18 taught the learner to read it, so the table now has a way to fill —
 * an empty state with an end date, which is a different thing from an empty
 * state.
 */
import { useEffect, useState } from 'react';

interface MatrixRow {
  from_key: string;
  to_key: string;
  daypart: string;
  minutes_p50: number;
  samples: number;
  updated_at: string | null;
}

interface Payload {
  rows: MatrixRow[];
  stats: { legs: number; samples: number; arrivals: { manual: number; geofence: number } };
}

const DAYPART_LABEL: Record<string, string> = {
  am: '오전',
  midday: '점심',
  pm: '오후',
  evening: '저녁',
};

export default function TravelMatrixPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/admin/travel-matrix');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as Payload;
        if (!cancelled) setData(body);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '불러오지 못했습니다');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = data?.rows ?? [];
  const arrivals = (data?.stats.arrivals.manual ?? 0) + (data?.stats.arrivals.geofence ?? 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6" data-testid="travel-matrix-page">
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">데이터 · 지도</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">이동시간 매트릭스</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          같은 구간을 실제로 몇 번 달렸고 몇 분 걸렸는지. 학습된 구간은 ETA에 그대로 쓰이고, 아직
          없는 구간은 직선거리 ×1.55 추정으로 넘어갑니다.
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-900">
          불러오지 못했습니다 — {error}
        </div>
      ) : !data ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-slate-500">
          불러오는 중…
        </div>
      ) : (
        <>
          <section className="mb-6 grid grid-cols-3 gap-3">
            {[
              { label: '학습된 구간', value: data.stats.legs },
              { label: '누적 표본', value: data.stats.samples },
              { label: '기록된 도착', value: arrivals },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold text-slate-500">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                  {stat.value.toLocaleString()}
                </p>
              </div>
            ))}
          </section>

          {rows.length === 0 ? (
            /**
             * The empty state carries the diagnosis, because "0 구간" alone has
             * two readings — broken writer, or no input — and they lead to
             * opposite next actions. The arrival count above separates them.
             */
            <div
              className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4"
              data-testid="travel-matrix-empty"
            >
              <p className="font-bold text-amber-900">아직 학습된 구간이 없습니다.</p>
              <p className="mt-2 text-sm leading-relaxed text-amber-900/90">
                {arrivals === 0 ? (
                  <>
                    도착 기록이 <b>0건</b>이라 배울 재료가 없는 상태입니다 — <b>고장이 아닙니다.</b>{' '}
                    기사 기기의 위치공유가 켜지면 스팟 도착이 자동으로 기록되고, 주간 크론이 연속된
                    두 도착을 한 구간으로 학습합니다. 첫 투어가 돌면 채워지기 시작합니다.
                  </>
                ) : (
                  <>
                    도착은 <b>{arrivals.toLocaleString()}건</b> 기록됐지만 아직 구간이 만들어지지
                    않았습니다. 한 방에서 <b>서로 다른 두 스팟</b>에 연속으로 도착해야 구간 하나가
                    되고, 이동시간이 5~240분 밖이면 잡음으로 버립니다.
                  </>
                )}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-slate-50 text-left text-xs font-bold text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-cjk-safe">출발</th>
                    <th className="px-4 py-3 text-cjk-safe">도착</th>
                    <th className="px-4 py-3 text-cjk-safe">시간대</th>
                    <th className="px-4 py-3 text-right text-cjk-safe">이동시간</th>
                    <th className="px-4 py-3 text-right text-cjk-safe">표본</th>
                    <th className="px-4 py-3 text-cjk-safe">최근 갱신</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={`${row.from_key}|${row.to_key}|${row.daypart}`}
                      className="border-t border-slate-100"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">{row.from_key}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{row.to_key}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {DAYPART_LABEL[row.daypart] ?? row.daypart}
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-900">
                        {row.minutes_p50}분
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                        {row.samples}
                        {/* One sample is a single drive, not a pattern — say so. */}
                        {row.samples === 1 ? (
                          <span className="ml-1 text-amber-600">·1회</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {row.updated_at ? row.updated_at.slice(0, 10) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
