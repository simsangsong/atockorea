'use client';

/**
 * SG-6 — the say queue's face (발화 대기열). X15's arrival prompt
 * generalized, with its two disciplines kept intact: an OFFER, never a
 * send, and TRANSIENT presence — the collapsed state is a one-line pill
 * (an always-open stack would squat on the driving surface and sit under
 * the toast, 2차 감사 #15). Every tap routes to a send path that already
 * exists; dismiss is one tap and remembered per subject.
 */
import { useState } from 'react';
import type { SayItem } from '@/lib/tour-room/sayQueue';

const KIND_LABEL: Record<SayItem['kind'], string> = {
  arrival_bundle: '도착 안내',
  return_time: '복귀 시간',
  briefing: '아침 브리핑',
  preset: '',
};

const PRESET_LABEL: Record<string, string> = {
  departing_soon: '곧 출발 안내',
  seatbelt_check: '안전벨트 안내',
  check_belongings: '소지품 확인 안내',
  rest_stop: '휴게 정차 제안',
};

export function sayItemLabel(item: SayItem): string {
  const base = item.kind === 'preset' ? (PRESET_LABEL[item.presetKey ?? ''] ?? '한마디') : KIND_LABEL[item.kind];
  return item.spotTitle ? `${base} · ${item.spotTitle}` : base;
}

export default function SayQueueCard({
  items,
  onFire,
  onDismiss,
}: {
  items: SayItem[];
  onFire: (item: SayItem) => void;
  onDismiss: (item: SayItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  const top = items[0];

  if (!expanded) {
    return (
      <div className="absolute inset-x-0 top-16 z-30 px-4" data-testid="say-queue-pill">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className={`tr-btn-physical text-cjk-safe flex min-h-[44px] w-full items-center justify-between rounded-full border px-4 tr-label font-bold ${
            top.urgency === 'required'
              ? 'border-[var(--tr-warn)] bg-[var(--tr-warn-soft)] text-[var(--tr-ink)]'
              : 'border-[var(--tr-hairline)] bg-[var(--tr-surface)] text-[var(--tr-ink)]'
          }`}
        >
          <span className="truncate">💬 {sayItemLabel(top)}</span>
          {items.length > 1 && <span className="tr-meta tr-num shrink-0">+{items.length - 1}</span>}
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="say-queue-panel"
      className="text-cjk-body absolute inset-x-0 top-16 z-30 mx-4 rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] p-3 shadow-lg"
    >
      <div className="text-cjk-safe mb-2 flex items-center justify-between">
        <p className="tr-label font-bold text-[var(--tr-ink-2)]">지금 할 수 있는 말</p>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="tr-meta text-cjk-safe font-bold text-[var(--tr-ink-3)]"
          aria-label="접기"
        >
          접기
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <div
            key={item.subject}
            className={`text-cjk-safe flex items-center gap-2 rounded-xl border px-3 py-2 ${
              item.urgency === 'required'
                ? 'border-[var(--tr-warn)] bg-[var(--tr-warn-soft)]'
                : 'border-[var(--tr-hairline)] bg-[var(--tr-surface-2)]'
            }`}
          >
            <button
              type="button"
              data-testid={`say-fire-${item.kind}`}
              onClick={() => {
                setExpanded(false);
                onFire(item);
              }}
              className="tr-card-text text-cjk-safe min-w-0 flex-1 truncate text-left font-semibold text-[var(--tr-ink)]"
            >
              {sayItemLabel(item)}
            </button>
            {item.urgency === 'required' && (
              <span className="tr-meta shrink-0 font-bold text-[var(--tr-warn)]">필수</span>
            )}
            <button
              type="button"
              aria-label="치우기"
              onClick={() => onDismiss(item)}
              className="tr-meta shrink-0 px-1 font-bold text-[var(--tr-ink-3)]"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <p className="tr-meta text-cjk-body mt-2 text-[var(--tr-ink-3)]">
        자동으로 나가는 건 없어요 — 누르신 것만 손님 언어로 전달됩니다.
      </p>
    </div>
  );
}
