'use client';

/**
 * QR 체크인 랜딩 — AtoC 통합 플랜 §5.4c (D16 원탭 플로우).
 *
 * 상호작용 총량 = 스캔 1 + 탭 1:
 *   스캔 → 이 페이지 → localStorage의 개인 토큰 자동 로드 (§5.2 C-4 계약:
 *   `ops_personal_tokens` JSON 배열) → POST /api/ops/checkin/context →
 *   "OO님, 체크인할까요?" + 좌석번호 + [체크인 확인] → POST checkin
 *   (method='guest_qr', actor 기록) → 좌석 그린.
 *
 * 상태머신: loading → ready | already | no_seats | not_open | no_token |
 *           wrong_room | unregistered | error → (ready에서) submitting →
 *           done | nonce_expired(재스캔 힌트) | error.
 * party(좌석>1): 기본 [전원 체크인 N명] + "지금 있는 인원만 선택" 토글로
 * 좌석 개별 선택 (§5.4c 3).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { checkinCopy, detectCheckinLocale } from '@/lib/ops/seating/checkinCopy';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const TOKENS_STORAGE_KEY = 'ops_personal_tokens';
const DEVICE_KEY_STORAGE = 'tour_mode_device_key';

export function readStoredPersonalTokens(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(TOKENS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((t): t is string => typeof t === 'string').slice(0, 10);
    if (typeof parsed === 'string') return [parsed];
    return [];
  } catch {
    return [];
  }
}

interface SeatInfo {
  seatNumber: number;
  guestLabel: string | null;
  checkedIn: boolean;
  absent: boolean;
}

type LandingState =
  | { phase: 'loading' }
  | { phase: 'ready'; roomId: string; token: string; displayName: string; seats: SeatInfo[]; partySize: number }
  | { phase: 'already'; displayName?: string; seats?: SeatInfo[] }
  | { phase: 'no_seats'; displayName?: string }
  | { phase: 'not_open'; tourDate: string | null }
  | { phase: 'no_token' }
  | { phase: 'wrong_room' }
  | { phase: 'unregistered' }
  | { phase: 'submitting' }
  | { phase: 'done'; seatNumbers: number[] }
  | { phase: 'nonce_expired' }
  | { phase: 'error' };

export default function CheckinLanding({
  checkinToken,
  nonce,
}: {
  checkinToken: string;
  nonce: string | null;
}) {
  const [state, setState] = useState<LandingState>({ phase: 'loading' });
  const [locale, setLocale] = useState<RoomLocale>('en');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const signalFired = useRef(false);
  const t = useCallback(
    (key: Parameters<typeof checkinCopy>[1], vars?: Record<string, string | number>) =>
      checkinCopy(locale, key, vars),
    [locale],
  );

  const resolve = useCallback(async () => {
    setState({ phase: 'loading' });
    const tokens = readStoredPersonalTokens();
    try {
      const res = await fetch('/api/ops/checkin/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkinToken, nonce: nonce || undefined, tokens }),
      });
      if (!res.ok) {
        setState({ phase: 'error' });
        return;
      }
      const data = await res.json();
      switch (data.state) {
        case 'ready':
          setState({
            phase: 'ready',
            roomId: data.roomId,
            token: tokens[data.matchedTokenIndex],
            displayName: data.displayName ?? '',
            seats: data.seats ?? [],
            partySize: data.partySize ?? 1,
          });
          setSelected(
            new Set(
              (data.seats ?? [])
                .filter((s: SeatInfo) => !s.checkedIn && !s.absent)
                .map((s: SeatInfo) => s.seatNumber),
            ),
          );
          return;
        case 'already':
          setState({ phase: 'already', displayName: data.displayName, seats: data.seats });
          return;
        case 'no_seats':
          setState({ phase: 'no_seats', displayName: data.displayName });
          return;
        case 'not_open':
          setState({ phase: 'not_open', tourDate: data.tourDate ?? null });
          return;
        case 'wrong_room':
          setState({ phase: 'wrong_room' });
          return;
        case 'unregistered':
          setState({ phase: 'unregistered' });
          // Q-4 — 가이드에게 미등록 스캔 시그널 (1회).
          if (!signalFired.current) {
            signalFired.current = true;
            const deviceKey =
              typeof window !== 'undefined' ? window.localStorage.getItem(DEVICE_KEY_STORAGE) : null;
            void fetch('/api/ops/checkin/signal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ checkinToken, deviceKey: deviceKey || undefined }),
            }).catch(() => undefined);
          }
          return;
        case 'no_token':
        default:
          setState({ phase: 'no_token' });
      }
    } catch {
      setState({ phase: 'error' });
    }
  }, [checkinToken, nonce]);

  useEffect(() => {
    setLocale(detectCheckinLocale());
    void resolve();
  }, [resolve]);

  const submit = useCallback(async () => {
    if (state.phase !== 'ready') return;
    const { roomId, token, seats } = state;
    const pendingAll = seats.filter((s) => !s.checkedIn && !s.absent).map((s) => s.seatNumber);
    const seatNumbers = selecting ? [...selected] : pendingAll;
    if (seatNumbers.length === 0) return;
    setState({ phase: 'submitting' });
    try {
      const res = await fetch(`/api/ops/rooms/${roomId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-token': token },
        body: JSON.stringify({
          method: 'guest_qr',
          checkinToken,
          nonce: nonce || undefined,
          ...(seatNumbers.length < pendingAll.length ? { seatNumbers } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setState({ phase: 'done', seatNumbers: data.seatNumbers ?? seatNumbers });
        return;
      }
      if (res.status === 403 && data.error === 'nonce_expired') {
        setState({ phase: 'nonce_expired' });
        return;
      }
      if (res.status === 403 && data.error === 'checkin_not_open') {
        setState({ phase: 'not_open', tourDate: data.tourDate ?? null });
        return;
      }
      setState({ phase: 'error' });
    } catch {
      setState({ phase: 'error' });
    }
  }, [state, selecting, selected, checkinToken, nonce]);

  const card = 'mx-auto mt-16 w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm dark:border-neutral-700 dark:bg-neutral-900';
  const title = 'text-lg font-semibold text-neutral-900 dark:text-neutral-100';
  const sub = 'mt-2 text-sm text-neutral-500 dark:text-neutral-400';
  const primaryBtn =
    'mt-5 w-full rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white active:opacity-80 dark:bg-neutral-100 dark:text-neutral-900';
  const ghostBtn = 'mt-3 w-full rounded-xl px-4 py-2 text-xs text-neutral-500 underline dark:text-neutral-400';

  if (state.phase === 'loading' || state.phase === 'submitting') {
    return (
      <div className={card} data-testid="checkin-loading">
        <p className={title}>{t('recognizing')}</p>
      </div>
    );
  }

  if (state.phase === 'done') {
    return (
      <div className={card} data-testid="checkin-done">
        <p className="text-3xl">✅</p>
        <p className={title}>{t('success')}</p>
        <p className={sub}>
          {t('yourSeats')}: {state.seatNumbers.join(', ')}
        </p>
      </div>
    );
  }

  if (state.phase === 'already') {
    return (
      <div className={card} data-testid="checkin-already">
        <p className="text-3xl">✅</p>
        <p className={title}>{t('already')}</p>
        {state.seats && state.seats.length > 0 && (
          <p className={sub}>
            {t('yourSeats')}: {state.seats.map((s) => s.seatNumber).join(', ')}
          </p>
        )}
      </div>
    );
  }

  if (state.phase === 'ready') {
    const pending = state.seats.filter((s) => !s.checkedIn && !s.absent);
    return (
      <div className={card} data-testid="checkin-ready">
        <p className={title}>{t('greeting', { name: state.displayName || 'Guest' })}</p>
        <p className={sub}>
          {t('yourSeats')}: {state.seats.map((s) => s.seatNumber).join(', ')}
        </p>
        {pending.length > 1 && !selecting && <p className={sub}>{t('partyPrompt', { n: pending.length })}</p>}
        {selecting && (
          <div className="mt-4 space-y-2 text-left" data-testid="checkin-seat-picker">
            {pending.map((s) => (
              <label key={s.seatNumber} className="flex items-center gap-2 text-sm text-neutral-800 dark:text-neutral-200">
                <input
                  type="checkbox"
                  checked={selected.has(s.seatNumber)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(s.seatNumber);
                    else next.delete(s.seatNumber);
                    setSelected(next);
                  }}
                />
                <span>
                  #{s.seatNumber}
                  {s.guestLabel ? ` — ${s.guestLabel}` : ''}
                </span>
              </label>
            ))}
          </div>
        )}
        <button type="button" className={primaryBtn} onClick={() => void submit()} data-testid="checkin-confirm">
          {pending.length > 1 && !selecting ? t('confirmAll', { n: pending.length }) : t('confirmOne')}
        </button>
        {pending.length > 1 && !selecting && (
          <button type="button" className={ghostBtn} onClick={() => setSelecting(true)}>
            {t('selectSome')}
          </button>
        )}
      </div>
    );
  }

  const message: Record<string, { main: string; hint?: string }> = {
    no_seats: { main: t('noSeats') },
    not_open: {
      main: t('notOpen', { date: state.phase === 'not_open' ? state.tourDate ?? '-' : '-' }),
    },
    no_token: { main: t('noToken'), hint: t('noTokenHint') },
    wrong_room: { main: t('wrongRoom') },
    unregistered: { main: t('unregistered'), hint: t('unregisteredHint') },
    nonce_expired: { main: t('nonceExpired') },
    error: { main: t('error') },
  };
  const m = message[state.phase] ?? message.error;

  return (
    <div className={card} data-testid={`checkin-${state.phase}`}>
      <p className={title}>{m.main}</p>
      {m.hint && <p className={sub}>{m.hint}</p>}
      {(state.phase === 'error' || state.phase === 'nonce_expired') && (
        <button type="button" className={primaryBtn} onClick={() => void resolve()}>
          {t('retry')}
        </button>
      )}
    </div>
  );
}
