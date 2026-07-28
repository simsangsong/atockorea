'use client';

/**
 * 게스트 카드 (가이드용) — AtoC 통합 플랜 §5.4b 양방향 내비게이션.
 * 좌석 스트립 칩/명단 행 탭 시 열리는 상세: 이름·인원·픽업·채널·특이사항 전체
 * + 좌석번호·상태 + wa.me/전화 버튼. 가이드 뷰라 한국어 우선.
 */

import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { IconNote } from '@/components/tour-mode/icons';
import {
  IconAccessible,
  IconArrived,
  IconClose,
  IconDiet,
  IconInfant,
  IconPhone,
  IconTabChat,
  IconWarn,
  TR_ICON,
} from '../icons';
import { GUEST_NOTE_MAX, noteAttribution, type GuestNote } from '@/lib/ops/seating/guestNotes';
import { normalizeWaDigits } from '@/lib/ops/whatsapp/wa-deep-link';
import type { RosterRow, RosterRowStatus } from '@/lib/ops/seating/dashboard';

/** U-D3 (§N) — needs badges carry a lucide glyph, not an emoji, in chrome. */
const HIGHLIGHT_META: Record<string, { Icon: LucideIcon; label: string }> = {
  allergy: { Icon: IconWarn, label: '알레르기' },
  dietary: { Icon: IconDiet, label: '식단' },
  mobility: { Icon: IconAccessible, label: '이동보조' },
  infant: { Icon: IconInfant, label: '유아 동반' },
};

const CHANNEL_LABEL: Record<string, string> = {
  gyg: 'GetYourGuide',
  getyourguide: 'GetYourGuide',
  klook: 'Klook',
  viator: 'Viator',
  kkday: 'KKday',
  atoc: 'AtoC',
  atockorea: 'AtoC',
};

export function channelLabel(source: string | null | undefined): string | null {
  if (!source) return null;
  return CHANNEL_LABEL[source.toLowerCase()] ?? source;
}

const STATUS_META: Record<RosterRowStatus, { label: string; cls: string }> = {
  checked_in: { label: '체크인', cls: 'bg-[var(--tr-safe-soft)] text-[var(--tr-safe)]' },
  partial: { label: '일부 체크인', cls: 'bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)]' },
  seated: { label: '좌석 지정', cls: 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]' },
  unseated: { label: '좌석 미지정', cls: 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-3)]' },
  absent: { label: '노쇼', cls: 'bg-[var(--tr-danger-soft)] text-[var(--tr-danger)]' },
};

export function statusMeta(status: RosterRowStatus) {
  return STATUS_META[status];
}

export default function GuideGuestCard({
  row,
  onClose,
  onMessage,
  note,
  onSaveNote,
  onNoShow,
}: {
  row: RosterRow;
  onClose: () => void;
  /** §K B4 — 이 손님의 운영자 메모(없으면 undefined). */
  note?: GuestNote | null;
  /**
   * 저장 핸들러. 빈 문자열이면 삭제 의도다(guestNotes.normalizeNote 계약).
   * 주어지지 않으면 메모 블록이 읽기 전용으로만 뜬다.
   */
  onSaveNote?: (bookingId: string, note: string) => Promise<void> | void;
  /**
   * §K B3-D2 — [메시지] 진입점. 가이드는 이미 여기서 손님을 지목하고 있으므로,
   * 세 번째 선택 화면을 만들지 않고 이 카드에 붙인다. 주어지지 않으면
   * 버튼이 나오지 않는다(기존 호출부 무변경).
   */
  onMessage?: (bookingId: string) => void;
  /**
   * N1 (owner report 2026-07-27) — mark this guest a no-show.
   *
   * The evidence flow existed but hung off a SEAT, and ops has never assigned
   * one, so on a join tour it could not be reached at all. The morning surface
   * is this roster card, where the identity is the person.
   *
   * Absent → the button offers to mark. Already absent → it offers to undo.
   * Undo is frictionless on purpose (§5.4b D12 asymmetric friction): only the
   * marking needs proof.
   */
  onNoShow?: (bookingId: string, action: 'mark' | 'clear') => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note?.note ?? '');
  const [saving, setSaving] = useState(false);
  const waDigits = normalizeWaDigits(row.whatsapp) ?? normalizeWaDigits(row.contactPhone);
  const meta = STATUS_META[row.status];
  const channel = channelLabel(row.channel);
  return (
    <div className="rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] p-4" data-testid="guest-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="tr-title truncate font-bold text-[var(--tr-ink)]">{row.name}</p>
          <p className="tr-meta mt-0.5 text-[var(--tr-ink-3)]">
            {row.partySize}명{row.preferredLanguage ? ` · ${row.preferredLanguage}` : ''}
            {channel ? ` · ${channel}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--tr-ink-3)] active:bg-[var(--tr-surface-2)]"
        >
          <IconClose size={TR_ICON.chip} aria-hidden />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={`tr-meta text-cjk-safe rounded-full px-2 py-0.5 font-bold ${meta.cls}`}>{meta.label}</span>
        {row.seatNumbers.length > 0 && (
          <span className="tr-meta text-cjk-safe rounded-full bg-[var(--tr-surface-2)] px-2 py-0.5 font-semibold text-[var(--tr-ink-2)] tabular-nums">
            좌석 {row.seatNumbers.join(', ')}
          </span>
        )}
        {row.highlights.map((h) => {
          const hl = HIGHLIGHT_META[h];
          const HlIcon = hl?.Icon;
          return (
            <span
              key={h}
              className="tr-meta text-cjk-safe inline-flex items-center gap-1 rounded-full bg-[var(--tr-danger-soft)] px-2 py-0.5 font-semibold text-[var(--tr-danger)]"
            >
              {HlIcon ? <HlIcon size={TR_ICON.meta} className="shrink-0" aria-hidden /> : null}
              {hl?.label ?? h}
            </span>
          );
        })}
      </div>

      {row.pickupName && (
        <p className="tr-meta mt-2 flex items-center gap-1.5 text-[var(--tr-ink-2)]">
          <IconArrived size={TR_ICON.meta} className="shrink-0" aria-hidden />
          <span className="truncate">
            {row.pickupTime ? `${row.pickupTime} · ` : ''}
            {row.pickupName}
          </span>
        </p>
      )}

      {row.specialRequests && (
        <p className="tr-card-text mt-2 rounded-lg bg-[var(--tr-surface-2)] px-3 py-2 leading-relaxed text-[var(--tr-ink-2)]">
          {row.specialRequests}
        </p>
      )}

      {/* §K B4 — 운영자 메모. 🔴 B4-D1: 손님이 선언한 needs(위 하이라이트)와
          시각적으로도 분리해 둔다. 섞여 보이면 알레르기 표시가 누구 말인지
          모호해지고, 그 표시를 믿을 수 없게 된다. */}
      <div className="mt-3 rounded-xl border border-dashed border-[var(--tr-hairline)] p-2.5" data-testid="guest-note">
        <p className="tr-meta flex items-center gap-1.5 font-semibold text-[var(--tr-ink-3)]">
          <IconNote size={TR_ICON.meta} aria-hidden />
          운영 메모 <span className="font-normal">(손님에게 보이지 않음)</span>
        </p>
        {editing && onSaveNote ? (
          <div className="mt-1.5">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={GUEST_NOTE_MAX}
              rows={3}
              autoFocus
              placeholder="예: 무릎이 안 좋으셔서 계단 코스는 피해주세요"
              className="tr-card-text w-full rounded-lg border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2.5 py-2 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:border-[var(--tr-accent)] focus:outline-none"
              data-testid="guest-note-input"
            />
            <div className="mt-1.5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraft(note?.note ?? '');
                  setEditing(false);
                }}
                className="text-cjk-safe tr-label min-h-[44px] rounded-lg px-3 font-medium text-[var(--tr-ink-2)]"
              >
                취소
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    // 비우면 삭제된다 — 지우기 버튼을 따로 두지 않는다(B4-D2).
                    await onSaveNote(row.bookingId, draft);
                    setEditing(false);
                  } finally {
                    setSaving(false);
                  }
                }}
                className="text-cjk-safe tr-label min-h-[44px] rounded-lg bg-[var(--tr-accent)] px-3 font-bold text-[var(--tr-bubble-me-ink)] disabled:opacity-40"
                data-testid="guest-note-save"
              >
                저장
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (!onSaveNote) return;
              setDraft(note?.note ?? '');
              setEditing(true);
            }}
            disabled={!onSaveNote}
            className="text-cjk-safe tr-card-text mt-1 w-full text-left leading-relaxed text-[var(--tr-ink-2)] disabled:cursor-default"
            data-testid="guest-note-view"
          >
            {note?.note ? (
              <>
                <span className="whitespace-pre-wrap">{note.note}</span>
                {/* 출처를 지우지 않는다 — 메모는 사실이 아니라 누군가의 관찰이다. */}
                <span className="tr-meta mt-1 block text-[var(--tr-ink-3)]">{noteAttribution(note)}</span>
              </>
            ) : (
              <span className="text-[var(--tr-ink-3)]">{onSaveNote ? '탭해서 메모 추가' : '메모 없음'}</span>
            )}
          </button>
        )}
      </div>

      {onMessage && (
        <button
          type="button"
          onClick={() => onMessage(row.bookingId)}
          className="tr-label text-cjk-safe mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--tr-accent)] px-3 py-2.5 font-bold text-[var(--tr-bubble-me-ink)] active:scale-[0.99]"
          data-testid="guest-message"
        >
          <IconTabChat size={TR_ICON.meta} aria-hidden />
          이 손님에게만 메시지
        </button>
      )}

      {onNoShow && (
        <button
          type="button"
          onClick={() => onNoShow(row.bookingId, row.status === 'absent' ? 'clear' : 'mark')}
          className={`tr-label text-cjk-safe mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 font-bold active:scale-[0.99] ${
            row.status === 'absent'
              ? 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]'
              : 'bg-[var(--tr-danger-soft)] text-[var(--tr-danger)]'
          }`}
          data-testid="guest-no-show"
        >
          <IconWarn size={TR_ICON.meta} aria-hidden />
          {row.status === 'absent' ? '노쇼 취소' : '노쇼 처리 (증거 남기기)'}
        </button>
      )}

      {(waDigits || row.contactPhone) && (
        <div className="mt-3 flex gap-2">
          {waDigits && (
            <a
              href={`https://wa.me/${waDigits}`}
              target="_blank"
              rel="noopener noreferrer"
              className="tr-label flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--tr-safe)] px-3 py-2.5 font-bold text-white active:scale-[0.99]"
              data-testid="guest-wa"
            >
              <IconTabChat size={TR_ICON.meta} aria-hidden />
              WhatsApp
            </a>
          )}
          {row.contactPhone && (
            <a
              href={`tel:${row.contactPhone}`}
              className="text-cjk-safe tr-label flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--tr-surface-2)] px-3 py-2.5 font-bold text-[var(--tr-ink)] active:scale-[0.99]"
              data-testid="guest-tel"
            >
              <IconPhone size={TR_ICON.meta} aria-hidden />
              전화
            </a>
          )}
        </div>
      )}
    </div>
  );
}
