'use client';

/**
 * 단가 탭 — 지금 적용되는 단가표 + 이력 + 새 단가 추가 (§6.9).
 *
 * "지금 적용되는 값"과 "왜 그 값인지"(가이드 오버라이드인지 기본단가인지, 언제부터
 * 유효한지)를 한 화면에 같이 둔다. 정산 때 금액을 놓고 다투는 자리가 여기라서,
 * 숫자만 보이고 근거가 안 보이면 결국 스프레드시트로 돌아간다.
 */

import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import type { RateRow, ResolvedRateRow } from '../_types';

const TOUR_TYPE_PRESETS = ['private', 'bus', 'cruise', 'walking'];

const inputCls =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none';

function krw(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

export default function GuideRatesPanel({
  rates,
  resolved,
  isDefaultScope,
  busy,
  onAdd,
}: {
  rates: RateRow[];
  resolved: ResolvedRateRow[];
  /** 테넌트 기본단가 화면인가 (가이드별이 아니라). */
  isDefaultScope: boolean;
  busy: boolean;
  onAdd: (input: { tourType: string; amountKrw: number; effectiveFrom: string; note: string }) => void;
}) {
  const [tourType, setTourType] = useState('private');
  const [amount, setAmount] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [note, setNote] = useState('');

  const submit = () => {
    const value = Number(amount.replace(/[^0-9]/g, ''));
    if (!tourType.trim() || !Number.isFinite(value) || value < 0) return;
    onAdd({ tourType: tourType.trim(), amountKrw: value, effectiveFrom, note });
    setAmount('');
    setNote('');
  };

  return (
    <div className="space-y-5">
      <section>
        <h4 className="mb-2 text-[13px] font-bold text-slate-800">현재 적용 단가</h4>
        {resolved.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-[13px] text-slate-500">
            등록된 단가가 없습니다. 아래에서 추가하세요.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
            {resolved.map((r) => (
              <li key={r.tourType} className="flex items-center justify-between gap-2 bg-white px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-slate-900">{r.tourType}</p>
                  <p className="text-[11px] text-slate-500">
                    {r.effectiveFrom}부터
                    {!isDefaultScope && (
                      <span
                        className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          r.scope === 'guide'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {r.scope === 'guide' ? '개인 단가' : '기본 단가'}
                      </span>
                    )}
                  </p>
                </div>
                <p className="shrink-0 text-[15px] font-bold text-slate-900">{krw(r.amountKrw)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="mb-2 text-[13px] font-bold text-slate-800">단가 추가 · 변경</h4>
        <p className="mb-2 text-[12px] leading-relaxed text-slate-500">
          기존 값을 고치는 게 아니라 시행일과 함께 새로 쌓습니다. 지난 달 정산을 다시 계산해도
          그때의 단가가 그대로 나옵니다.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <input
              className={inputCls}
              list="tour-type-presets"
              value={tourType}
              onChange={(e) => setTourType(e.target.value)}
              placeholder="투어 타입 (private, bus…)"
            />
            <datalist id="tour-type-presets">
              {TOUR_TYPE_PRESETS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          <input
            className={inputCls}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="단가 (원)"
            inputMode="numeric"
          />
          <input
            className={inputCls}
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            aria-label="시행일 (비우면 오늘)"
          />
          <input
            className={inputCls}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="메모 (선택)"
          />
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !amount.trim()}
          className="mt-2 flex h-11 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-[13px] font-bold text-white disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} 단가 저장
        </button>
      </section>

      {rates.length > 0 && (
        <section>
          <h4 className="mb-2 text-[13px] font-bold text-slate-800">이력</h4>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
            {rates.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 bg-white px-3 py-2 text-[13px]">
                <span className="min-w-0 truncate text-slate-600">
                  {r.effective_from} · {r.tour_type}
                  {r.guide_id === null && (
                    <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                      기본
                    </span>
                  )}
                  {r.note && <span className="ml-1.5 text-slate-400">— {r.note}</span>}
                </span>
                <span className="shrink-0 font-semibold text-slate-900">{krw(r.amount_krw)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
