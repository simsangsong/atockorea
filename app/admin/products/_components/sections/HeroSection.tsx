'use client';

import { useState } from 'react';
import { Plus, X, Sparkles } from 'lucide-react';

export type HeroState = {
  tagline: string;
  imagePosition: string;
  pills: string[];
  meta: {
    duration: string;
    region: string;
    stops: string;
    rating: number | null;
    ratingStars: number | null;
  };
};

type Props = {
  state: HeroState;
  onChange: (next: HeroState) => void;
};

/**
 * Hero text editor — tagline, badge pills, meta (duration/region/stops/rating).
 * The hero image lives in the MediaSection above; this section is purely the
 * text/data shown alongside the hero image on the live page.
 */
export function HeroSection({ state, onChange }: Props) {
  const [draftPill, setDraftPill] = useState('');

  const addPill = () => {
    const v = draftPill.trim();
    if (!v) return;
    onChange({ ...state, pills: [...state.pills, v] });
    setDraftPill('');
  };

  const removePill = (idx: number) => {
    onChange({ ...state, pills: state.pills.filter((_, i) => i !== idx) });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Sparkles className="size-4 text-blue-600" />
          히어로 (페이지 상단)
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          이미지는 위 미디어 매니저에서 · 여기는 그 위에 얹는 텍스트
        </p>
      </div>

      <div className="p-4 space-y-3">
        <FieldLabel label="태그라인 (히어로 아래 한 문장)" hint={`${state.tagline?.length || 0}자`}>
          <textarea
            rows={2}
            value={state.tagline}
            onChange={(e) => onChange({ ...state, tagline: e.target.value })}
            placeholder="예: 산속 호수, 지중해풍 허브 정원, 그리고 채석장 아트파크—..."
            className="w-full px-2.5 py-1.5 text-sm rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none resize-y"
          />
        </FieldLabel>

        <FieldLabel label="배지 (Pills) — 히어로 아래 칩 형태로 표시">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {state.pills.map((p, idx) => (
              <span
                key={`${p}-${idx}`}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full"
              >
                {p}
                <button
                  type="button"
                  onClick={() => removePill(idx)}
                  className="text-blue-400 hover:text-rose-600"
                  title="삭제"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={draftPill}
              onChange={(e) => setDraftPill(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addPill();
                }
              }}
              placeholder="새 배지 추가 (Enter)"
              className="flex-1 h-8 px-2 text-sm rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
            />
            <button
              type="button"
              onClick={addPill}
              disabled={!draftPill.trim()}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 disabled:opacity-50"
            >
              <Plus className="size-3" />
              추가
            </button>
          </div>
        </FieldLabel>

        <div className="grid grid-cols-2 gap-3">
          <FieldLabel label="히어로 이미지 포커스 (CSS object-position)">
            <select
              value={state.imagePosition || 'center 50%'}
              onChange={(e) => onChange({ ...state, imagePosition: e.target.value })}
              className="w-full h-9 px-2.5 text-sm rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none bg-white"
            >
              <option value="center 25%">상단 (center 25%)</option>
              <option value="center 35%">상중 (center 35%)</option>
              <option value="center 50%">중앙 (center 50%)</option>
              <option value="center 65%">중하 (center 65%)</option>
              <option value="center 75%">하단 (center 75%)</option>
            </select>
          </FieldLabel>
          <FieldLabel label="별점 만점 (ratingStars)">
            <input
              type="number"
              min={3}
              max={5}
              value={state.meta.ratingStars ?? 5}
              onChange={(e) =>
                onChange({
                  ...state,
                  meta: { ...state.meta, ratingStars: Number(e.target.value) || 5 },
                })
              }
              className="w-full h-9 px-2.5 text-sm rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
            />
          </FieldLabel>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldLabel label="시간 (duration)">
            <input
              type="text"
              value={state.meta.duration}
              onChange={(e) =>
                onChange({ ...state, meta: { ...state.meta, duration: e.target.value } })
              }
              placeholder="10시간"
              className="w-full h-9 px-2.5 text-sm rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
            />
          </FieldLabel>
          <FieldLabel label="지역 (region)">
            <input
              type="text"
              value={state.meta.region}
              onChange={(e) =>
                onChange({ ...state, meta: { ...state.meta, region: e.target.value } })
              }
              placeholder="포천"
              className="w-full h-9 px-2.5 text-sm rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
            />
          </FieldLabel>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldLabel label="코스 수 (stops)">
            <input
              type="text"
              value={state.meta.stops}
              onChange={(e) =>
                onChange({ ...state, meta: { ...state.meta, stops: e.target.value } })
              }
              placeholder="3개 코스"
              className="w-full h-9 px-2.5 text-sm rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
            />
          </FieldLabel>
          <FieldLabel label="평점 (rating, 0–5)">
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={state.meta.rating ?? 0}
              onChange={(e) =>
                onChange({
                  ...state,
                  meta: { ...state.meta, rating: Number(e.target.value) || 0 },
                })
              }
              className="w-full h-9 px-2.5 text-sm rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
            />
          </FieldLabel>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-medium text-slate-700">{label}</span>
        {hint && <span className="text-[10px] text-slate-400">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
