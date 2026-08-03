'use client';

/**
 * 조인투어 게스트 claim + 좌석선택 — AtoC 통합 플랜 §5.2 (C-1~C-6) / §5.3.
 *
 * 흐름: 마스킹 명단 → 본인 이름 선택 → 확인 질문(C-2) → POST claim →
 *       개인 토큰 저장(§5.2 C-4, `ops_personal_tokens`) → 좌석선택
 *       (SeatMap 재사용, party 인원만큼) → 확정.
 *
 * 재접속 인식(C-4): 저장된 개인 토큰이 이 룸 명단에 있으면 명단을 건너뛰고
 * 바로 좌석선택으로. 좌석 동시성(C-10): 기존 broadcastToRoom 'seat_update'
 * 구독(useSeatChannel)으로 타인 선택 즉시 반영 + 서버 UNIQUE 409 재선택.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { IconTicket, TR_ICON } from '@/components/tour-mode/icons';
import SeatMap from '@/components/ops/SeatMap';
import { useSeatPicker } from '@/hooks/useSeatPicker';
import { joinCopy, detectJoinLocale, type JoinCopyKey } from '@/lib/ops/seating/joinCopy';
import {
  getOrCreateDeviceKey,
  storePersonalToken,
  readStoredPersonalTokens,
  findRecognizedToken,
} from '@/lib/ops/seating/personalTokens';
import type { RoomLocale } from '@/lib/tour-room/snapshot';
import { useResolvedTourTheme } from '@/hooks/useResolvedTourTheme';

interface RosterEntry {
  bookingId: string;
  name: string;
  partySize: number;
  claimed: boolean;
}

type Phase =
  | { k: 'loading' }
  | { k: 'roster' }
  | { k: 'verify'; entry: RosterEntry }
  | { k: 'claiming' }
  | { k: 'already'; entry: RosterEntry }
  | { k: 'seats' }
  | { k: 'submitting' }
  | { k: 'done'; seatNumbers: number[] }
  | { k: 'error' };

/** 안정 셸 — JoinFlow 내부에 정의하면 매 렌더 새 컴포넌트가 되어 입력 포커스를
 *  잃는다(A1과 동종 버그). 모듈 레벨로 승격해 재마운트를 막는다. */
function JoinShell({ dark, locale, children }: { dark: boolean; locale: RoomLocale; children: ReactNode }) {
  return (
    <div className={dark ? 'dark' : ''}>
      <div className="tr-safe-top tr-root min-h-dvh bg-[var(--tr-canvas)] px-4"
        // pb-10 composed with the inset rather than replaced: the home
        // indicator eats the last ~34px in standalone.
        style={{ paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom, 0px))' }}
        data-locale={locale}
        lang={locale}
      >
        {children}
      </div>
    </div>
  );
}

export default function JoinFlow({
  claimToken,
  roomId,
  tourDate,
}: {
  claimToken: string;
  roomId: string;
  tourDate: string;
}) {
  const [locale, setLocale] = useState<RoomLocale>('en');
  const dark = useResolvedTourTheme() === 'dark';
  const [phase, setPhase] = useState<Phase>({ k: 'loading' });
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [myBookingId, setMyBookingId] = useState<string | null>(null);
  const [partySize, setPartySize] = useState(1);
  const [displayName, setDisplayName] = useState('');
  const [channelTopic, setChannelTopic] = useState<string | null>(null);
  const [answerEmail, setAnswerEmail] = useState('');
  const [answerParty, setAnswerParty] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const t = useCallback(
    (key: JoinCopyKey, vars?: Record<string, string | number>) => joinCopy(locale, key, vars),
    [locale],
  );

  useEffect(() => {
    setLocale(detectJoinLocale());
  }, []);

  // ── the picker itself is shared with the in-room seat sheet ──────────────
  // Board loading, the selection rules, the 409 re-pick and the start-gate
  // lock all live in useSeatPicker so both entry points behave identically.
  const picker = useSeatPicker({
    roomId,
    token,
    bookingId: myBookingId,
    partySize,
    guestLabel: displayName,
    channelTopic,
    enabled: Boolean(token),
  });
  const { vehicles, activeVehicle, anyLocked, selected, renderedStates, onSeatTap } = picker;

  // ── enter the seat step for a recognized/claimed booking ─────────────────
  const enterSeats = useCallback(
    async (personalToken: string, bookingId: string, party: number, name: string) => {
      setToken(personalToken);
      setMyBookingId(bookingId);
      setPartySize(Math.max(1, party));
      setDisplayName(name);
      setPhase({ k: 'seats' });

      // Realtime topic via a best-effort room join (also refreshes last_seen).
      try {
        const joinRes = await fetch(`/api/tour-rooms/${bookingId}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: personalToken, deviceKey: getOrCreateDeviceKey(), locale }),
        });
        const joinData = await joinRes.json().catch(() => null);
        if (joinRes.ok && joinData?.channel?.topic) setChannelTopic(joinData.channel.topic as string);
      } catch {
        /* realtime is best-effort; the picker's slow poll is the safety net */
      }
    },
    [locale],
  );

  // ── initial roster load + C-4 device recognition ─────────────────────────
  const attempted = useRef(false);
  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    void (async () => {
      try {
        const res = await fetch(`/api/ops/rooms/${roomId}/claim?ct=${encodeURIComponent(claimToken)}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          setPhase({ k: 'error' });
          return;
        }
        const data = await res.json();
        const list = (data.bookings ?? []) as RosterEntry[];
        setRoster(list);
        const recognized = findRecognizedToken(list.map((b) => b.bookingId), readStoredPersonalTokens());
        if (recognized) {
          const entry = list.find((b) => b.bookingId === recognized.bookingId);
          await enterSeats(
            recognized.token,
            recognized.bookingId,
            entry?.partySize ?? 1,
            recognized.displayName || entry?.name || '',
          );
          return;
        }
        setPhase({ k: 'roster' });
      } catch {
        setPhase({ k: 'error' });
      }
    })();
  }, [roomId, claimToken, enterSeats]);

  // ── claim ────────────────────────────────────────────────────────────────
  const submitClaim = useCallback(
    async (entry: RosterEntry) => {
      setNote(null);
      setPhase({ k: 'claiming' });
      const answer: { emailTail?: string; partySize?: number } = {};
      if (answerEmail.trim()) answer.emailTail = answerEmail.trim();
      if (answerParty.trim()) answer.partySize = Number(answerParty.trim());
      try {
        const res = await fetch(`/api/ops/rooms/${roomId}/claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            claimToken,
            bookingId: entry.bookingId,
            deviceKey: getOrCreateDeviceKey(),
            answer,
            locale,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 201 && data.token) {
          storePersonalToken(data.token);
          await enterSeats(data.token, entry.bookingId, data.partySize ?? entry.partySize, data.displayName ?? entry.name);
          return;
        }
        if (res.status === 409) {
          setPhase({ k: 'already', entry });
          return;
        }
        if (res.status === 403 && data.error === 'verification_failed') {
          setNote(t('verifyFailed'));
          setPhase({ k: 'verify', entry });
          return;
        }
        setPhase({ k: 'error' });
      } catch {
        setPhase({ k: 'error' });
      }
    },
    [answerEmail, answerParty, claimToken, roomId, locale, enterSeats, t],
  );

  const confirmSeats = useCallback(async () => {
    setNote(null);
    setPhase({ k: 'submitting' });
    const result = await picker.confirm();
    if (result.ok) {
      setPhase({ k: 'done', seatNumbers: result.seatNumbers });
      return;
    }
    // C-10 후착 / C-11 잠금 / 그 외 — 셋 다 좌석 화면으로 되돌아가 다시 고른다.
    setNote(t(result.reason === 'taken' ? 'seatTaken' : result.reason === 'locked' ? 'seatLocked' : 'error'));
    setPhase({ k: 'seats' });
  }, [picker, t]);

  // ── styling (tour-room tokens; dark via prefers-color-scheme) ─────────────
  const card =
    'mx-auto mt-6 w-full max-w-md rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] p-5 shadow-sm';
  const title = 'tr-title font-bold text-[var(--tr-ink)]';
  const sub = 'mt-1 tr-card-text text-[var(--tr-ink-2)]';
  const primaryBtn =
    'mt-4 w-full rounded-xl bg-[var(--tr-accent)] px-4 py-3 tr-body font-bold text-[var(--tr-bubble-me-ink)] active:scale-[0.99] disabled:opacity-40';
  const ghostBtn = 'mt-2 w-full rounded-xl px-4 py-2 tr-label font-medium text-[var(--tr-ink-3)] underline';
  const inputCls =
    'mt-1 w-full rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-canvas)] px-3 py-2.5 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:border-[var(--tr-accent)] focus:outline-none';

  if (phase.k === 'loading' || phase.k === 'claiming' || phase.k === 'submitting') {
    return (
      <JoinShell dark={dark} locale={locale}>
        <div className={card} data-testid="join-loading">
          <p className={title}>{t('loading')}</p>
        </div>
      </JoinShell>
    );
  }

  if (phase.k === 'error') {
    return (
      <JoinShell dark={dark} locale={locale}>
        <div className={card} data-testid="join-error">
          <p className={title}>{t('error')}</p>
          <button type="button" className={primaryBtn} onClick={() => window.location.reload()}>
            {t('retry')}
          </button>
        </div>
      </JoinShell>
    );
  }

  if (phase.k === 'roster') {
    return (
      <JoinShell dark={dark} locale={locale}>
        <div className={card} data-testid="join-roster">
          <p className={title}>{t('rosterTitle')}</p>
          <p className={sub}>{t('rosterHint')}</p>
          <ul className="mt-4 space-y-2">
            {roster.map((entry) => (
              <li key={entry.bookingId}>
                <button
                  type="button"
                  disabled={entry.claimed}
                  onClick={() => {
                    setAnswerEmail('');
                    setAnswerParty('');
                    setNote(null);
                    setPhase({ k: 'verify', entry });
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-canvas)] px-3.5 py-3 text-left active:scale-[0.99] disabled:opacity-50"
                  data-testid="roster-entry"
                >
                  <span className="min-w-0">
                    <span className="tr-name block truncate text-[var(--tr-ink)]">{entry.name}</span>
                    <span className="tr-meta text-[var(--tr-ink-3)]">{t('pax', { n: entry.partySize })}</span>
                  </span>
                  {entry.claimed ? (
                    <span className="tr-meta text-cjk-safe shrink-0 rounded-full bg-[var(--tr-surface-2)] px-2 py-0.5 font-semibold text-[var(--tr-ink-3)]">
                      {t('claimed')}
                    </span>
                  ) : (
                    <span className="tr-label text-cjk-safe shrink-0 font-bold text-[var(--tr-accent-deep)]">{t('pickName')} ›</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </JoinShell>
    );
  }

  if (phase.k === 'verify') {
    const entry = phase.entry;
    return (
      <JoinShell dark={dark} locale={locale}>
        <div className={card} data-testid="join-verify">
          <p className={title}>{t('verifyTitle', { name: entry.name })}</p>
          <p className={sub}>{t('verifyHint')}</p>
          <label className="tr-label mt-4 block font-semibold text-[var(--tr-ink-2)]">
            {t('emailTailLabel')}
            <input
              value={answerEmail}
              onChange={(e) => setAnswerEmail(e.target.value)}
              placeholder="e.g. rossi"
              className={inputCls}
              data-testid="verify-email"
              autoComplete="off"
            />
          </label>
          <label className="tr-label mt-3 block font-semibold text-[var(--tr-ink-2)]">
            {t('partySizeLabel')}
            <input
              value={answerParty}
              onChange={(e) => setAnswerParty(e.target.value.replace(/[^0-9]/g, ''))}
              inputMode="numeric"
              placeholder="e.g. 2"
              className={inputCls}
              data-testid="verify-party"
            />
          </label>
          {note && (
            <p className="tr-label mt-3 rounded-lg bg-[var(--tr-danger-soft)] px-3 py-2 font-medium text-[var(--tr-danger)]">
              {note}
            </p>
          )}
          <button
            type="button"
            disabled={!answerEmail.trim() && !answerParty.trim()}
            className={primaryBtn}
            onClick={() => void submitClaim(entry)}
            data-testid="verify-confirm"
          >
            {t('confirm')}
          </button>
          <button type="button" className={ghostBtn} onClick={() => setPhase({ k: 'roster' })}>
            {t('back')}
          </button>
        </div>
      </JoinShell>
    );
  }

  if (phase.k === 'already') {
    return (
      <JoinShell dark={dark} locale={locale}>
        <div className={card} data-testid="join-already">
          <p className={title}>{t('alreadyClaimed')}</p>
          <p className={sub}>{t('alreadyClaimedHint')}</p>
          <button
            type="button"
            className={primaryBtn}
            onClick={() => void submitClaim(phase.entry)}
            data-testid="reclaim-request"
          >
            {t('reclaim')}
          </button>
          <button type="button" className={ghostBtn} onClick={() => setPhase({ k: 'roster' })}>
            {t('back')}
          </button>
        </div>
      </JoinShell>
    );
  }

  if (phase.k === 'done') {
    return (
      <JoinShell dark={dark} locale={locale}>
        <div className={card} data-testid="join-done">
          {/* W0.2 success-hero grammar — ticket roundel instead of emoji chrome. */}
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--tr-accent-soft)]">
            <IconTicket size={TR_ICON.tile} className="text-[var(--tr-accent)]" aria-hidden />
          </div>
          <p className={title}>{t('done')}</p>
          <p className={sub}>
            {t('yourSeats')}: {phase.seatNumbers.join(', ')}
          </p>
          <p className="tr-meta mt-3 text-[var(--tr-ink-3)]">{t('doneHint')}</p>
        </div>
      </JoinShell>
    );
  }

  // phase.k === 'seats'
  return (
    <JoinShell dark={dark} locale={locale}>
      <div className={card} data-testid="join-seats">
        <p className={title}>{t('seatTitle')}</p>
        {/* "차량 배정 대기"는 물어본 뒤에만 할 수 있는 말이다 — 첫 조회 전에
            띄우면 좌석이 있는 투어에서도 한 프레임 스친다. */}
        {!picker.loaded ? (
          <p className={sub}>{t('loading')}</p>
        ) : !activeVehicle ? (
          <p className={sub} data-testid="seat-soon">
            {t('seatSoon')}
          </p>
        ) : (
          <>
            <p className={sub}>{anyLocked ? t('seatLocked') : t('seatHint', { n: partySize })}</p>
            {vehicles.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-1.5" data-testid="vehicle-tabs">
                {vehicles.map((v) => (
                  <button
                    key={v.roomVehicleId}
                    type="button"
                    onClick={() => picker.setActiveVehicleId(v.roomVehicleId)}
                    className={`tr-label text-cjk-safe rounded-full px-3 py-1 font-semibold ${
                      v.roomVehicleId === activeVehicle.roomVehicleId
                        ? 'bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)]'
                        : 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]'
                    }`}
                  >
                    {v.plateNumber || v.model || v.roomVehicleId.slice(0, 4)}
                  </button>
                ))}
              </div>
            )}
            {activeVehicle.layout && (
              <div className="mt-4 overflow-x-auto">
                <SeatMap
                  layout={activeVehicle.layout}
                  seatStates={renderedStates}
                  onSeatTap={onSeatTap}
                  readOnly={anyLocked}
                  ariaLabel={t('seatTitle')}
                />
              </div>
            )}
            <p className="tr-card-text mt-3 text-center font-semibold text-[var(--tr-ink-2)]" data-testid="seat-count">
              {t('selectedCount', { sel: selected.size, n: partySize })}
            </p>
            {note && (
              <p className="tr-label mt-2 rounded-lg bg-[var(--tr-danger-soft)] px-3 py-2 text-center font-medium text-[var(--tr-danger)]">
                {note}
              </p>
            )}
            <button
              type="button"
              disabled={selected.size === 0 || anyLocked}
              className={primaryBtn}
              onClick={() => void confirmSeats()}
              data-testid="confirm-seats"
            >
              {t('confirmSeats')}
            </button>
          </>
        )}
      </div>
    </JoinShell>
  );
}
