'use client';

/**
 * 배정 탭 — 이 가이드가 어떤 날 어떤 투어에 들어갔는가 (§6.9).
 *
 * 이 원장이 월 정산의 유일한 입력이다. tour_rooms에는 guide_id가 없어서 "누가
 * 이 달에 무엇을 했는가"가 시스템 어디에도 없었고, 그래서 정산 배치를 만들 수
 * 없었다.
 *
 * 화면이 지키는 규칙 하나: **[일했음]을 눌러야 돈이 된다.** 배정은 예정(planned)
 * 으로 만들어지고, 사람이 실제 수행을 확인해 worked로 바꾼 것만 정산이 집계한다.
 * 취소는 삭제가 아니라 cancelled다 — 근거를 지우면 나중에 설명할 수 없다.
 *
 * 단가는 비워두면 정산 시 단가표에서 해석한다. 단가표와 다른 금액으로 합의한
 * 건만 직접 적으면 되고, 그 값은 나중에 단가표가 바뀌어도 흔들리지 않는다.
 */

import { useState } from 'react';
import { CalendarDays, Check, Loader2, Plus, Trash2, Undo2 } from 'lucide-react';
import type { AssignmentListRow } from '../_types';

const TOUR_TYPE_PRESETS = ['private', 'bus', 'cruise', 'walking'];

const inputCls =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none';

const STATUS_LABEL: Record<string, string> = { planned: '예정', worked: '일했음', cancelled: '취소' };
const STATUS_TONE: Record<string, string> = {
  planned: 'bg-slate-100 text-slate-600',
  worked: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-slate-100 text-slate-400 line-through',
};

function krw(n: number | null): string {
  return n === null || n === undefined ? '단가표' : `${n.toLocaleString('ko-KR')}원`;
}

export default function GuideAssignmentsPanel({
  month,
  rows,
  busyId,
  busy,
  onMonthChange,
  onAdd,
  onPatch,
  onDelete,
}: {
  /** 'YYYY-MM'. */
  month: string;
  rows: AssignmentListRow[];
  busyId: string | null;
  busy: boolean;
  onMonthChange: (month: string) => void;
  onAdd: (input: { tourDate: string; tourType: string; role: string; amountKrw: number | null; note: string }) => void;
  onPatch: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}) {
  const [tourDate, setTourDate] = useState(`${month}-01`);
  const [tourType, setTourType] = useState('private');
  const [role, setRole] = useState('guide');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const submit = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tourDate) || !tourType.trim()) return;
    const digits = amount.replace(/[^0-9]/g, '');
    onAdd({
      tourDate,
      tourType: tourType.trim(),
      role,
      amountKrw: digits ? Number(digits) : null,
      note,
    });
    setAmount('');
    setNote('');
  };

  const workedCount = rows.filter((r) => r.status === 'worked').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-500">
          대상 월
          <input
            type="month"
            value={month}
            onChange={(e) => onMonthChange(e.target.value)}
            className="h-11 rounded-xl border border-slate-200 px-3 text-[14px] text-slate-900"
            data-testid="assignment-month"
          />
        </label>
        <p className="pb-1 text-[12px] text-slate-500">
          {rows.length}건 중 <span className="font-bold text-emerald-700">{workedCount}건</span> 정산 대상
        </p>
      </div>

      <section>
        <h4 className="mb-2 text-[13px] font-bold text-slate-800">배정 목록</h4>
        {rows.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-[13px] text-slate-500">
            이 달의 배정이 없습니다. 아래에서 추가하세요.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-2 bg-white px-3 py-2.5" data-testid="assignment-row">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-[14px] font-semibold text-slate-900">
                    <CalendarDays className="size-3.5 flex-shrink-0 text-slate-400" />
                    <span className="tabular-nums">{r.tour_date}</span>
                    <span className="text-slate-400">·</span>
                    <span className="truncate font-medium">{r.tour_type}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {r.role === 'driver' ? '기사' : r.role === 'both' ? '겸업' : '가이드'} · {krw(r.amount_krw)}
                    {r.note ? ` · ${r.note}` : ''}
                  </p>
                </div>
                <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[r.status]}`}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
                <div className="flex flex-shrink-0 gap-1">
                  {r.status !== 'worked' ? (
                    <button
                      type="button"
                      onClick={() => onPatch(r.id, { status: 'worked' })}
                      disabled={busyId === r.id}
                      className="flex h-9 items-center gap-1 rounded-lg bg-slate-900 px-2 text-[11px] font-bold text-white disabled:opacity-50"
                      title="정산 대상이 됩니다"
                    >
                      <Check className="size-3.5" /> 일했음
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onPatch(r.id, { status: 'planned' })}
                      disabled={busyId === r.id}
                      className="flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-2 text-[11px] font-semibold text-slate-600 disabled:opacity-50"
                      title="정산 대상에서 뺍니다"
                    >
                      <Undo2 className="size-3.5" /> 되돌리기
                    </button>
                  )}
                  {r.status !== 'cancelled' ? (
                    <button
                      type="button"
                      onClick={() => onPatch(r.id, { status: 'cancelled' })}
                      disabled={busyId === r.id}
                      className="flex h-9 items-center rounded-lg border border-slate-200 px-2 text-[11px] font-semibold text-slate-500 disabled:opacity-50"
                    >
                      취소
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onDelete(r.id)}
                      disabled={busyId === r.id}
                      className="flex h-9 items-center rounded-lg border border-slate-200 px-2 text-[11px] font-semibold text-rose-600 disabled:opacity-50"
                      title="기록을 완전히 지웁니다"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="mb-2 text-[13px] font-bold text-slate-800">배정 추가</h4>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-500">
            투어일
            <input
              type="date"
              value={tourDate}
              onChange={(e) => setTourDate(e.target.value)}
              className={inputCls}
              data-testid="assignment-date"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-500">
            투어 유형 (단가표와 같은 값)
            <input
              list="assignment-tour-types"
              value={tourType}
              onChange={(e) => setTourType(e.target.value)}
              className={inputCls}
              data-testid="assignment-tour-type"
            />
            <datalist id="assignment-tour-types">
              {TOUR_TYPE_PRESETS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-500">
            역할
            <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
              <option value="guide">가이드</option>
              <option value="driver">기사</option>
              <option value="both">겸업</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-500">
            금액 (비우면 단가표)
            <input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="예: 200000"
              className={inputCls}
            />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-[11px] font-medium text-slate-500">
            메모
            <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
          </label>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 text-[14px] font-bold text-white disabled:opacity-50"
          data-testid="assignment-add"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          배정 추가 (예정)
        </button>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          추가된 배정은 <b>예정</b> 상태입니다. 실제로 수행한 뒤 [일했음]을 눌러야 월 정산에
          집계됩니다.
        </p>
      </section>
    </div>
  );
}
