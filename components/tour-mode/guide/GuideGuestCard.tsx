'use client';

/**
 * 게스트 카드 (가이드용) — AtoC 통합 플랜 §5.4b 양방향 내비게이션.
 * 좌석 스트립 칩/명단 행 탭 시 열리는 상세: 이름·인원·픽업·채널·특이사항 전체
 * + 좌석번호·상태 + wa.me/전화 버튼. 가이드 뷰라 한국어 우선.
 */

import { MapPin, MessageCircle, Phone, X } from 'lucide-react';
import { normalizeWaDigits } from '@/lib/ops/whatsapp/wa-deep-link';
import type { RosterRow, RosterRowStatus } from '@/lib/ops/seating/dashboard';

const HIGHLIGHT_LABEL: Record<string, string> = {
  allergy: '⚠ 알레르기',
  dietary: '🥗 식단',
  mobility: '♿ 이동보조',
  infant: '👶 유아 동반',
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
}: {
  row: RosterRow;
  onClose: () => void;
  /**
   * §K B3-D2 — [메시지] 진입점. 가이드는 이미 여기서 손님을 지목하고 있으므로,
   * 세 번째 선택 화면을 만들지 않고 이 카드에 붙인다. 주어지지 않으면
   * 버튼이 나오지 않는다(기존 호출부 무변경).
   */
  onMessage?: (bookingId: string) => void;
}) {
  const waDigits = normalizeWaDigits(row.whatsapp) ?? normalizeWaDigits(row.contactPhone);
  const meta = STATUS_META[row.status];
  const channel = channelLabel(row.channel);
  return (
    <div className="rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] p-4" data-testid="guest-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-[var(--tr-ink)]">{row.name}</p>
          <p className="mt-0.5 text-xs text-[var(--tr-ink-3)]">
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
          <X size={16} aria-hidden />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${meta.cls}`}>{meta.label}</span>
        {row.seatNumbers.length > 0 && (
          <span className="rounded-full bg-[var(--tr-surface-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--tr-ink-2)] tabular-nums">
            좌석 {row.seatNumbers.join(', ')}
          </span>
        )}
        {row.highlights.map((h) => (
          <span
            key={h}
            className="rounded-full bg-[var(--tr-danger-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--tr-danger)]"
          >
            {HIGHLIGHT_LABEL[h] ?? h}
          </span>
        ))}
      </div>

      {row.pickupName && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--tr-ink-2)]">
          <MapPin size={13} className="shrink-0" aria-hidden />
          <span className="truncate">
            {row.pickupTime ? `${row.pickupTime} · ` : ''}
            {row.pickupName}
          </span>
        </p>
      )}

      {row.specialRequests && (
        <p className="mt-2 rounded-lg bg-[var(--tr-surface-2)] px-3 py-2 text-xs leading-relaxed text-[var(--tr-ink-2)]">
          {row.specialRequests}
        </p>
      )}

      {onMessage && (
        <button
          type="button"
          onClick={() => onMessage(row.bookingId)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--tr-accent)] px-3 py-2.5 text-xs font-bold text-[var(--tr-bubble-me-ink)] active:scale-[0.99]"
          data-testid="guest-message"
        >
          <MessageCircle size={14} aria-hidden />
          이 손님에게만 메시지
        </button>
      )}

      {(waDigits || row.contactPhone) && (
        <div className="mt-3 flex gap-2">
          {waDigits && (
            <a
              href={`https://wa.me/${waDigits}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--tr-safe)] px-3 py-2.5 text-xs font-bold text-white active:scale-[0.99]"
              data-testid="guest-wa"
            >
              <MessageCircle size={14} aria-hidden />
              WhatsApp
            </a>
          )}
          {row.contactPhone && (
            <a
              href={`tel:${row.contactPhone}`}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--tr-surface-2)] px-3 py-2.5 text-xs font-bold text-[var(--tr-ink)] active:scale-[0.99]"
              data-testid="guest-tel"
            >
              <Phone size={14} aria-hidden />
              전화
            </a>
          )}
        </div>
      )}
    </div>
  );
}
