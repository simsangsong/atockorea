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
import { AlertTriangle, CalendarDays, Check, Clock, Loader2, Plus, ShieldAlert, Trash2, Undo2, X } from 'lucide-react';
import type { AssignmentDraft, AssignmentListRow, ConflictItem, PendingOverride } from '../_types';

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
  pendingOverride,
  warnings,
  onConfirmOverride,
  onDismissOverride,
  onDismissWarnings,
}: {
  /** 'YYYY-MM'. */
  month: string;
  rows: AssignmentListRow[];
  busyId: string | null;
  busy: boolean;
  onMonthChange: (month: string) => void;
  onAdd: (input: AssignmentDraft) => void;
  onPatch: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  /** W2 — 409로 막힌 시도. 사유를 받으면 같은 입력으로 재시도한다. */
  pendingOverride: PendingOverride | null;
  /** 저장은 됐지만 사람이 봐야 하는 사실(단가 미설정 등). */
  warnings: ConflictItem[];
  onConfirmOverride: (reason: string) => void;
  onDismissOverride: () => void;
  onDismissWarnings: () => void;
}) {
  const [tourDate, setTourDate] = useState(`${month}-01`);
  const [tourType, setTourType] = useState('private');
  const [role, setRole] = useState('guide');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  const submit = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tourDate) || !tourType.trim()) return;
    const digits = amount.replace(/[^0-9]/g, '');
    onAdd({
      tourDate,
      tourType: tourType.trim(),
      role,
      amountKrw: digits ? Number(digits) : null,
      note,
      startTime: startTime || null,
      endTime: endTime || null,
    });
    setAmount('');
    setNote('');
  };

  const workedCount = rows.filter((r) => r.status === 'worked').length;

  return (
    <div className="space-y-5">
      {/* W2 — 막힌 시도: 사유를 적으면 통과시킬 수 있는 것들만 여기까지 온다.
          막지 않으면 실수를 못 잡고, 사유 없이 막으면 현장이 못 돈다. */}
      {pendingOverride && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3" data-testid="assignment-override">
          <p className="flex items-start gap-1.5 text-[13px] font-bold text-amber-900">
            <ShieldAlert className="mt-0.5 size-4 flex-shrink-0" />
            <span className="text-cjk-body">이대로는 배정할 수 없어요</span>
          </p>
          <ul className="mt-1.5 space-y-1 pl-6">
            {pendingOverride.blocked.map((b) => (
              <li key={b.code} className="text-cjk-body list-disc text-[12px] leading-relaxed text-amber-900">
                {b.message}
              </li>
            ))}
          </ul>
          <label className="mt-2.5 block text-[11px] font-semibold text-amber-900">
            그래도 배정하는 이유 (기록에 남습니다)
            <input
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="예: 본인이 나오겠다고 함"
              className="mt-1 h-11 w-full rounded-xl border border-amber-300 bg-white px-3 text-[14px] text-slate-900 focus:border-amber-500 focus:outline-none"
              data-testid="assignment-override-reason"
            />
          </label>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                onDismissOverride();
                setOverrideReason('');
              }}
              className="h-10 flex-1 rounded-xl border border-amber-300 bg-white text-[13px] font-semibold text-amber-900"
            >
              <span className="text-cjk-safe">취소</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const reason = overrideReason.trim();
                if (!reason) return;
                onConfirmOverride(reason);
                setOverrideReason('');
              }}
              disabled={busy || !overrideReason.trim()}
              className="h-10 flex-1 rounded-xl bg-amber-600 text-[13px] font-bold text-white disabled:opacity-50"
              data-testid="assignment-override-confirm"
            >
              <span className="text-cjk-safe">사유와 함께 배정</span>
            </button>
          </div>
        </div>
      )}

      {/* 저장은 됐지만 사람이 봐야 하는 것. 특히 단가 미설정 — 이걸 지금 넘기면
          한 달 뒤 정산에서 0원으로 나타난다. */}
      {warnings.length > 0 && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3" data-testid="assignment-warnings">
          <div className="flex items-start justify-between gap-2">
            <p className="flex items-start gap-1.5 text-[13px] font-bold text-sky-900">
              <AlertTriangle className="mt-0.5 size-4 flex-shrink-0" />
              <span className="text-cjk-body">배정은 됐지만 확인해 주세요</span>
            </p>
            <button
              type="button"
              onClick={onDismissWarnings}
              className="flex size-7 flex-shrink-0 items-center justify-center rounded-lg text-sky-700 hover:bg-sky-100"
              aria-label="닫기"
            >
              <X className="size-4" />
            </button>
          </div>
          <ul className="mt-1.5 space-y-1 pl-6">
            {warnings.map((w) => (
              <li key={w.code} className="text-cjk-body list-disc text-[12px] leading-relaxed text-sky-900">
                {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}
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
                    {r.start_time ? ` · ${r.start_time.slice(0, 5)}${r.end_time ? `–${r.end_time.slice(0, 5)}` : ''}` : ''}
                    {r.note ? ` · ${r.note}` : ''}
                  </p>
                  {r.conflict_override && r.conflict_override_reason ? (
                    <p className="text-cjk-body mt-0.5 text-[11px] text-amber-700">
                      충돌 무시: {r.conflict_override_reason}
                    </p>
                  ) : null}
                </div>
                <span className={`text-cjk-safe flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[r.status]}`}>
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
          <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="size-3" /> 시작 시각
            </span>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-500">
            종료 시각 (비우면 +8시간)
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-[11px] font-medium text-slate-500">
            메모
            <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
          </label>
        </div>
        <p className="mt-1.5 text-cjk-body text-[11px] leading-relaxed text-slate-400">
          시각을 넣으면 같은 가이드의 시간 겹침을 정확히 막아줍니다. 비워두면 하루 두 건은
          경고까지만 뜹니다 — 모르는 시각을 &ldquo;종일&rdquo;로 간주하면 정당한 두 번째 배정이 막히기 때문입니다.
        </p>
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
