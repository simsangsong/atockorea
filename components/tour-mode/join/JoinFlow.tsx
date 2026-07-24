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

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import SeatMap from '@/components/ops/SeatMap';
import type { SeatState } from '@/lib/ops/seating/logic';
import type { VehicleLayoutJson } from '@/lib/ops/seating/layouts';
import { useSeatChannel } from '@/hooks/useSeatChannel';
import { joinCopy, detectJoinLocale, type JoinCopyKey } from '@/lib/ops/seating/joinCopy';
import {
  getOrCreateDeviceKey,
  storePersonalToken,
  readStoredPersonalTokens,
  findRecognizedToken,
} from '@/lib/ops/seating/personalTokens';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

interface RosterEntry {
  bookingId: string;
  name: string;
  partySize: number;
  claimed: boolean;
}

interface VehicleView {
  roomVehicleId: string;
  model: string | null;
  plateNumber: string | null;
  totalSeats: number | null;
  layout: VehicleLayoutJson | null;
  seatStates: Record<number, SeatState>;
  seats: Array<{
    seatNumber: number;
    bookingId: string;
    guestLabel: string | null;
    checkedInAt: string | null;
    absentAt: string | null;
    locked: boolean;
  }>;
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
      <div className="tr-root min-h-dvh bg-[var(--tr-canvas)] px-4 pb-10" data-locale={locale} lang={locale}>
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
  const [dark, setDark] = useState(false);
  const [phase, setPhase] = useState<Phase>({ k: 'loading' });
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [myBookingId, setMyBookingId] = useState<string | null>(null);
  const [partySize, setPartySize] = useState(1);
  const [displayName, setDisplayName] = useState('');
  const [vehicles, setVehicles] = useState<VehicleView[]>([]);
  const [channelTopic, setChannelTopic] = useState<string | null>(null);
  const [activeVehicleId, setActiveVehicleId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [answerEmail, setAnswerEmail] = useState('');
  const [answerParty, setAnswerParty] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const t = useCallback(
    (key: JoinCopyKey, vars?: Record<string, string | number>) => joinCopy(locale, key, vars),
    [locale],
  );

  useEffect(() => {
    setLocale(detectJoinLocale());
    try {
      setDark(window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
    } catch {
      /* noop */
    }
  }, []);

  // ── seats loader (shared by initial load + realtime + 409 refresh) ────────
  const loadSeats = useCallback(
    async (personalToken: string): Promise<VehicleView[]> => {
      const res = await fetch(`/api/ops/rooms/${roomId}/seats`, {
        headers: { 'x-tour-room-token': personalToken },
        cache: 'no-store',
      });
      if (!res.ok) return [];
      const data = await res.json().catch(() => ({ vehicles: [] }));
      const vs = (data.vehicles ?? []) as VehicleView[];
      setVehicles(vs);
      return vs;
    },
    [roomId],
  );

  const refetchSeats = useCallback(() => {
    if (token) void loadSeats(token);
  }, [token, loadSeats]);

  useSeatChannel(channelTopic, refetchSeats);

  // ── enter the seat step for a recognized/claimed booking ─────────────────
  const enterSeats = useCallback(
    async (personalToken: string, bookingId: string, party: number, name: string) => {
      setToken(personalToken);
      setMyBookingId(bookingId);
      setPartySize(Math.max(1, party));
      setDisplayName(name);
      const vs = await loadSeats(personalToken);
      // pre-seed selection from my already-assigned seats; pick their vehicle.
      const mineVehicle = vs.find((v) => v.seats.some((s) => s.bookingId === bookingId));
      const active = mineVehicle?.roomVehicleId ?? vs[0]?.roomVehicleId ?? null;
      setActiveVehicleId(active);
      const mineSeats = (mineVehicle?.seats ?? []).filter((s) => s.bookingId === bookingId).map((s) => s.seatNumber);
      setSelected(new Set(mineSeats));
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
        /* realtime is best-effort; the slow poll below is the safety net */
      }
    },
    [loadSeats, locale],
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

  // ── slow poll fallback while selecting (realtime may be unavailable) ──────
  useEffect(() => {
    if (phase.k !== 'seats' || !token) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadSeats(token);
    }, 8000);
    return () => window.clearInterval(id);
  }, [phase.k, token, loadSeats]);

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

  // ── seat selection helpers ────────────────────────────────────────────────
  const activeVehicle = useMemo(
    () => vehicles.find((v) => v.roomVehicleId === activeVehicleId) ?? vehicles[0] ?? null,
    [vehicles, activeVehicleId],
  );
  const anyLocked = useMemo(
    () => vehicles.some((v) => v.seats.some((s) => s.locked)),
    [vehicles],
  );

  /** server 상태 + 내 로컬 선택 병합 (내 옛 좌석 미선택은 available로 되돌림). */
  const renderedStates = useMemo(() => {
    if (!activeVehicle) return {} as Record<number, SeatState>;
    const map: Record<number, SeatState> = {};
    for (const [n, st] of Object.entries(activeVehicle.seatStates)) {
      map[Number(n)] = st === 'mine' ? 'available' : st;
    }
    for (const n of selected) map[n] = 'mine';
    return map;
  }, [activeVehicle, selected]);

  const onSeatTap = useCallback(
    (n: number) => {
      if (!activeVehicle || anyLocked) return;
      const serverState = activeVehicle.seatStates[n];
      const mineSeat = activeVehicle.seats.find((s) => s.seatNumber === n && s.bookingId === myBookingId);
      const selectable = !serverState || serverState === 'available' || serverState === 'mine' || Boolean(mineSeat);
      if (!selectable) return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(n)) next.delete(n);
        else if (next.size < partySize) next.add(n);
        return next;
      });
    },
    [activeVehicle, anyLocked, myBookingId, partySize],
  );

  const confirmSeats = useCallback(async () => {
    if (!token || !activeVehicle || selected.size === 0) return;
    setNote(null);
    setPhase({ k: 'submitting' });
    try {
      const res = await fetch(`/api/ops/rooms/${roomId}/seats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-token': token },
        body: JSON.stringify({
          roomVehicleId: activeVehicle.roomVehicleId,
          seats: [...selected].map((seatNumber) => ({ seatNumber, guestLabel: displayName })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 201) {
        setVehicles((data.vehicles ?? []) as VehicleView[]);
        setPhase({ k: 'done', seatNumbers: [...selected].sort((a, b) => a - b) });
        return;
      }
      if (res.status === 409) {
        // C-10 — 후착: 최신 상태로 갱신 + 재선택 유도.
        setVehicles((data.vehicles ?? vehicles) as VehicleView[]);
        setNote(t('seatTaken'));
        setPhase({ k: 'seats' });
        return;
      }
      if (res.status === 400 && data.error === 'seat_change_locked') {
        setNote(t('seatLocked'));
        setPhase({ k: 'seats' });
        return;
      }
      setNote(t('error'));
      setPhase({ k: 'seats' });
    } catch {
      setNote(t('error'));
      setPhase({ k: 'seats' });
    }
  }, [token, activeVehicle, selected, roomId, displayName, vehicles, t]);

  // ── styling (tour-room tokens; dark via prefers-color-scheme) ─────────────
  const card =
    'mx-auto mt-6 w-full max-w-md rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] p-5 shadow-sm';
  const title = 'text-lg font-bold text-[var(--tr-ink)]';
  const sub = 'mt-1 text-sm text-[var(--tr-ink-2)]';
  const primaryBtn =
    'mt-4 w-full rounded-xl bg-[var(--tr-accent)] px-4 py-3 text-sm font-bold text-[var(--tr-bubble-me-ink)] active:scale-[0.99] disabled:opacity-40';
  const ghostBtn = 'mt-2 w-full rounded-xl px-4 py-2 text-xs font-medium text-[var(--tr-ink-3)] underline';
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
                    <span className="block truncate font-semibold text-[var(--tr-ink)]">{entry.name}</span>
                    <span className="text-xs text-[var(--tr-ink-3)]">{t('pax', { n: entry.partySize })}</span>
                  </span>
                  {entry.claimed ? (
                    <span className="shrink-0 rounded-full bg-[var(--tr-surface-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--tr-ink-3)]">
                      {t('claimed')}
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs font-bold text-[var(--tr-accent-deep)]">{t('pickName')} ›</span>
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
          <label className="mt-4 block text-xs font-semibold text-[var(--tr-ink-2)]">
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
          <label className="mt-3 block text-xs font-semibold text-[var(--tr-ink-2)]">
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
            <p className="mt-3 rounded-lg bg-[var(--tr-danger-soft)] px-3 py-2 text-xs font-medium text-[var(--tr-danger)]">
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
          <p className="text-3xl">🎫</p>
          <p className={title}>{t('done')}</p>
          <p className={sub}>
            {t('yourSeats')}: {phase.seatNumbers.join(', ')}
          </p>
          <p className="mt-3 text-xs text-[var(--tr-ink-3)]">{t('doneHint')}</p>
        </div>
      </JoinShell>
    );
  }

  // phase.k === 'seats'
  return (
    <JoinShell dark={dark} locale={locale}>
      <div className={card} data-testid="join-seats">
        <p className={title}>{t('seatTitle')}</p>
        {!activeVehicle ? (
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
                    onClick={() => {
                      setActiveVehicleId(v.roomVehicleId);
                      setSelected(new Set());
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
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
            <p className="mt-3 text-center text-sm font-semibold text-[var(--tr-ink-2)]" data-testid="seat-count">
              {t('selectedCount', { sel: selected.size, n: partySize })}
            </p>
            {note && (
              <p className="mt-2 rounded-lg bg-[var(--tr-danger-soft)] px-3 py-2 text-center text-xs font-medium text-[var(--tr-danger)]">
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
