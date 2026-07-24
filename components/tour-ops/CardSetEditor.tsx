'use client';

/**
 * 시작 브리핑 카드 세트 에디터 — AtoC 통합 플랜 §5.4 C-17.
 *
 * 두 곳이 같은 화면을 쓴다: 룸 드로어의 [카드] 세그먼트(룸 오버라이드)와
 * /admin/tour-ops/card-sets(투어 상품 기본값). 편집 대상만 다르고 규칙은 같다.
 *
 * 상속 판정에 별도 토글을 만들지 않는다 — 서버가 "이 레벨을 뺐을 때 적용될 값"
 * (`inherited`)을 함께 주고, 저장 시 그 값과 같은 항목은 아예 보내지 않는다.
 * 그래서 상속으로 되돌리는 방법이 "원래 값으로 되돌려 놓는 것"과 같아진다.
 *
 * 🔴 문구는 이 화면에서 편집할 수 없다. 카드 본문은 5로케일 사전 번역 상수라
 * (LLM 0) 자유 텍스트 입력을 열면 번역되지 않은 한국어 운영자 문장이 영어·일본어·
 * 스페인어·중국어 손님에게 그대로 나간다. 커스텀 문구가 필요하면 그건 이 설정이
 * 아니라 별개 기능이다 — 지금은 관제 공지(broadcast)로 보내야 한다.
 */

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Info, Loader2, RotateCcw } from 'lucide-react';
import {
  BRIEFING_CARD_DESCRIPTORS,
  type BriefingCardOptions,
  type CardSetSource,
} from '@/lib/ops/seating/cards/cardSet';
import type { BriefingCardId } from '@/lib/ops/seating/cards/stack';

export interface CardSetResolvedPayload {
  card_ids: BriefingCardId[];
  card_ids_source: CardSetSource;
  options: BriefingCardOptions;
  option_sources: Record<'safety' | 'lunch', CardSetSource>;
}

export interface CardSetInheritedPayload {
  card_ids: BriefingCardId[];
  options: BriefingCardOptions;
}

export interface CardSetSavePayload {
  card_ids: BriefingCardId[] | null;
  options: Record<string, unknown>;
}

const SOURCE_LABEL: Record<CardSetSource, string> = {
  explicit: '호출자 지정',
  room: '이 룸 오버라이드',
  tour: '상품 기본값',
  default: '코드 기본값',
};

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

export default function CardSetEditor({
  resolved,
  inherited,
  inheritLabel,
  busy,
  canClear,
  onSave,
  onClear,
}: {
  resolved: CardSetResolvedPayload;
  /** 이 레벨을 뺐을 때 적용될 값 — 저장 시 "무엇이 오버라이드인지" 판정 기준. */
  inherited: CardSetInheritedPayload;
  /** '상품 기본값' | '코드 기본값' — 되돌렸을 때 무엇을 따르는지 설명용. */
  inheritLabel: string;
  busy: boolean;
  /** 이 레벨에 저장된 행이 실제로 있을 때만 [되돌리기]가 의미 있다. */
  canClear: boolean;
  onSave: (payload: CardSetSavePayload) => void;
  onClear: () => void;
}) {
  const [cardIds, setCardIds] = useState<BriefingCardId[]>(resolved.card_ids);
  const [options, setOptions] = useState<BriefingCardOptions>(resolved.options);

  useEffect(() => {
    setCardIds(resolved.card_ids);
    setOptions(resolved.options);
  }, [resolved]);

  const dirty = useMemo(
    () =>
      !sameIds(cardIds, resolved.card_ids) ||
      options.safety.skipRepeatBoarding !== resolved.options.safety.skipRepeatBoarding ||
      options.lunch.lunchIncluded !== resolved.options.lunch.lunchIncluded,
    [cardIds, options, resolved],
  );

  const excluded = BRIEFING_CARD_DESCRIPTORS.filter((card) => !cardIds.includes(card.id));
  const noStartCard = !cardIds.includes('start');

  const save = () => {
    // 상속값과 같은 항목은 보내지 않는다 = 그 항목은 이 레벨에서 오버라이드하지
    // 않는다는 뜻. (서버 normalizeCardOptions가 없는 키를 상속으로 읽는다.)
    const payloadOptions: Record<string, unknown> = {};
    if (options.safety.skipRepeatBoarding !== inherited.options.safety.skipRepeatBoarding) {
      payloadOptions.safety = { skip_repeat_boarding: options.safety.skipRepeatBoarding };
    }
    if (options.lunch.lunchIncluded !== inherited.options.lunch.lunchIncluded) {
      payloadOptions.lunch = { lunch_included: options.lunch.lunchIncluded };
    }
    onSave({
      card_ids: sameIds(cardIds, inherited.card_ids) ? null : cardIds,
      options: payloadOptions,
    });
  };

  const move = (id: BriefingCardId, delta: -1 | 1) =>
    setCardIds((current) => {
      const index = current.indexOf(id);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const remove = (id: BriefingCardId) => setCardIds((current) => current.filter((value) => value !== id));

  const add = (id: BriefingCardId) =>
    setCardIds((current) => {
      const order = BRIEFING_CARD_DESCRIPTORS.map((card) => card.id);
      return [...current, id].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-[var(--tr-surface-2)] px-2.5 py-1 text-[11px] font-semibold text-[var(--tr-ink-2)]">
          현재 적용: {SOURCE_LABEL[resolved.card_ids_source]}
        </span>
        <span className="text-[11px] text-[var(--tr-ink-3)]">{cardIds.length}장 · 위에서부터 순서대로 발송</span>
      </div>

      <ol className="space-y-2">
        {cardIds.map((id, index) => {
          const card = BRIEFING_CARD_DESCRIPTORS.find((row) => row.id === id);
          if (!card) return null;
          return (
            <li key={id} className="rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] p-3">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--tr-accent-soft)] text-[10px] font-bold text-[var(--tr-accent-deep)]">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-[var(--tr-ink)]">
                    {card.label}
                    {card.pushes && (
                      <span className="ml-1.5 rounded bg-[var(--tr-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--tr-ink-2)]">
                        푸시
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--tr-ink-2)]">{card.summary}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => move(id, -1)}
                    disabled={busy || index === 0}
                    aria-label={`${card.label} 위로`}
                    className="flex size-8 items-center justify-center rounded-lg border border-[var(--tr-hairline)] text-[var(--tr-ink-2)] disabled:opacity-30"
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(id, 1)}
                    disabled={busy || index === cardIds.length - 1}
                    aria-label={`${card.label} 아래로`}
                    className="flex size-8 items-center justify-center rounded-lg border border-[var(--tr-hairline)] text-[var(--tr-ink-2)] disabled:opacity-30"
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(id)}
                    disabled={busy || cardIds.length <= 1}
                    className="h-8 rounded-lg border border-[var(--tr-hairline)] px-2 text-[11px] font-semibold text-[var(--tr-ink-2)] disabled:opacity-30"
                  >
                    제외
                  </button>
                </div>
              </div>

              {card.option?.group === 'safety' && (
                <label className="mt-2 flex items-start gap-2 rounded-lg bg-[var(--tr-surface)] p-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0"
                    checked={options.safety.skipRepeatBoarding}
                    disabled={busy}
                    onChange={(event) =>
                      setOptions((current) => ({
                        ...current,
                        safety: { skipRepeatBoarding: event.target.checked },
                      }))
                    }
                  />
                  <span className="min-w-0">
                    <span className="block text-[12px] font-semibold text-[var(--tr-ink)]">
                      {card.option.label}
                    </span>
                    <span className="block text-[11px] leading-relaxed text-[var(--tr-ink-3)]">
                      {card.option.help}
                    </span>
                  </span>
                </label>
              )}

              {card.option?.group === 'lunch' && (
                <label className="mt-2 block rounded-lg bg-[var(--tr-surface)] p-2">
                  <span className="block text-[12px] font-semibold text-[var(--tr-ink)]">{card.option.label}</span>
                  <span className="mb-1.5 block text-[11px] leading-relaxed text-[var(--tr-ink-3)]">
                    {card.option.help}
                  </span>
                  <select
                    value={
                      options.lunch.lunchIncluded === null ? 'inherit' : options.lunch.lunchIncluded ? 'yes' : 'no'
                    }
                    disabled={busy}
                    onChange={(event) =>
                      setOptions((current) => ({
                        ...current,
                        lunch: {
                          lunchIncluded:
                            event.target.value === 'inherit' ? null : event.target.value === 'yes',
                        },
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] px-2 text-[13px] text-[var(--tr-ink)]"
                  >
                    <option value="inherit">투어 상품 설정 그대로</option>
                    <option value="yes">점심 포함으로 안내</option>
                    <option value="no">점심 불포함으로 안내</option>
                  </select>
                </label>
              )}
            </li>
          );
        })}
      </ol>

      {excluded.length > 0 && (
        <div className="rounded-xl border border-dashed border-[var(--tr-hairline)] p-3">
          <p className="mb-1.5 text-[11px] font-semibold text-[var(--tr-ink-2)]">제외된 카드</p>
          <div className="flex flex-wrap gap-1.5">
            {excluded.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => add(card.id)}
                disabled={busy}
                className="h-8 rounded-full border border-[var(--tr-hairline)] px-3 text-[11px] font-medium text-[var(--tr-ink-2)] disabled:opacity-40"
              >
                + {card.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {noStartCard && (
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
          <Info className="mt-0.5 size-3 shrink-0" />
          시작 브리핑을 빼면 이 투어는 <b>푸시 알림이 한 건도 나가지 않아요</b>. 나머지 카드는 앱을 열어야 보입니다.
        </p>
      )}

      <p className="flex items-start gap-1.5 rounded-lg bg-[var(--tr-surface-2)] p-2 text-[11px] leading-relaxed text-[var(--tr-ink-3)]">
        <Info className="mt-0.5 size-3 shrink-0" />
        카드 <b>문구</b>는 여기서 바꿀 수 없어요. 5개 언어로 미리 번역된 고정 문구라서 자유 입력을 열면 번역되지
        않은 한국어가 손님에게 그대로 나갑니다. 특정 룸에만 하고 싶은 말이 있으면 관제 공지로 보내주세요.
      </p>

      <div className="flex gap-2">
        {canClear && (
          <button
            type="button"
            onClick={onClear}
            disabled={busy}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--tr-hairline)] text-[12px] font-semibold text-[var(--tr-ink-2)] disabled:opacity-40"
          >
            <RotateCcw className="size-3.5" /> {inheritLabel}으로 되돌리기
          </button>
        )}
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--tr-accent)] text-[12px] font-semibold text-[var(--tr-bubble-me-ink)] disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : null} 저장
        </button>
      </div>
    </div>
  );
}
