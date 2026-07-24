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

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { checkinCopy, detectCheckinLocale } from '@/lib/ops/seating/checkinCopy';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const TOKENS_STORAGE_KEY = 'ops_personal_tokens';
const DEVICE_KEY_STORAGE = 'tour_mode_device_key';

import { decodeTokenBody } from '@/lib/ops/seating/personalTokens';

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
  | {
      phase: 'ready';
      roomId: string;
      token: string;
      displayName: string;
      seats: SeatInfo[];
      partySize: number;
      /** §K B5-D1 — nonce가 유효한 콘솔 QR인가. 서버가 단언한다. */
      autoEligible: boolean;
    }
  | { phase: 'already'; displayName?: string; seats?: SeatInfo[] }
  | { phase: 'no_seats'; displayName?: string }
  | { phase: 'not_open'; tourDate: string | null }
  | { phase: 'no_token' }
  | { phase: 'wrong_room' }
  | { phase: 'unregistered' }
  | { phase: 'submitting' }
  | {
      phase: 'done';
      seatNumbers: number[];
      /** 자동으로 들어온 경로인지 — 환영 화면과 [수정]은 여기서만 뜬다. */
      auto?: boolean;
      displayName?: string;
      roomId?: string;
      token?: string;
      bookingId?: string;
    }
  | { phase: 'undone' }
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
  const [dark, setDark] = useState(false);
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
            // 서버가 정한다(B5.1). 클라이언트가 nonceValid로 재유도하면
            // 판정이 두 곳에 살고, 한쪽만 바뀌는 날이 온다.
            autoEligible: data.autoEligible === true,
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
    try {
      setDark(window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
    } catch {
      /* noop — stays light */
    }
    void resolve();
  }, [resolve]);

  const submit = useCallback(async (opts: { auto?: boolean } = {}) => {
    if (state.phase !== 'ready') return;
    const { roomId, token, seats, displayName } = state;
    const pendingAll = seats.filter((s) => !s.checkedIn && !s.absent).map((s) => s.seatNumber);
    const seatNumbers = opts.auto ? pendingAll : selecting ? [...selected] : pendingAll;
    if (seatNumbers.length === 0) return;
    setState({ phase: 'submitting' });
    try {
      const res = await fetch(`/api/ops/rooms/${roomId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-token': token },
        body: JSON.stringify({
          // §K B5-D5 — 자동과 수동을 actor로 구분 기록한다. 나중에 "자동이
          // 오작동했나"를 데이터로 판정할 수 있어야 한다.
          method: opts.auto ? 'guest_qr_auto' : 'guest_qr',
          checkinToken,
          nonce: nonce || undefined,
          ...(seatNumbers.length < pendingAll.length ? { seatNumbers } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setState({
          phase: 'done',
          seatNumbers: data.seatNumbers ?? seatNumbers,
          auto: opts.auto === true,
          displayName,
          roomId,
          token,
          // 룸 링크에 필요한 bookingId는 토큰 안에 있다 — 서버가 이미 검증한
          // 토큰이므로 여기서 서명을 다시 볼 이유는 없다(디코드만).
          bookingId: decodeTokenBody(token)?.bookingId,
        });
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

  // §K B5.2 — 콘솔 QR(nonce 유효)이면 스캔 즉시 체크인한다. 탭 0.
  // 정적 QR은 여기 걸리지 않으므로 기존 "체크인할까요?" 동작 그대로다(B5-D1).
  const autoFired = useRef(false);
  useEffect(() => {
    if (state.phase !== 'ready' || !state.autoEligible || autoFired.current) return;
    autoFired.current = true;
    void submit({ auto: true });
  }, [state, submit]);

  // B5-D2 — 되돌리기. 모달로 막지 않는다: 일행 3명 중 1명이 아직 화장실인
  // 경우가 실제로 흔하고, 자동의 이득(탭 0)을 지키면서 정정 경로를 남긴다.
  const undoAuto = useCallback(async () => {
    if (state.phase !== 'done' || !state.roomId || !state.token) return;
    try {
      const res = await fetch(`/api/ops/rooms/${state.roomId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-token': state.token },
        body: JSON.stringify({ method: 'guest_qr_auto', action: 'undo' }),
      });
      if (res.ok) setState({ phase: 'undone' });
    } catch {
      /* 되돌리기 실패는 화면을 바꾸지 않는다 — 체크인은 유지된 상태다 */
    }
  }, [state]);

  // Tour-room brand tokens (ivory/antique-brass), theme via the `.dark` shell
  // below — the same pattern JoinFlow/CompanionJoin already use. `block` lets
  // primaryBtn size correctly when it renders as an <a> (welcome-open-room).
  const shell = (node: ReactNode) => (
    <div className={dark ? 'dark' : ''}>
      <div className="tr-root min-h-dvh bg-[var(--tr-canvas)] px-4" data-locale={locale} lang={locale}>
        {node}
      </div>
    </div>
  );
  const card =
    'mx-auto mt-16 w-full max-w-sm rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] p-6 text-center shadow-sm';
  const title = 'text-lg font-semibold text-[var(--tr-ink)]';
  const sub = 'mt-2 text-sm text-[var(--tr-ink-2)]';
  const primaryBtn =
    'mt-5 block w-full rounded-xl bg-[var(--tr-accent)] px-4 py-3 text-sm font-semibold text-[var(--tr-bubble-me-ink)] active:opacity-80';
  const ghostBtn = 'mt-3 w-full rounded-xl px-4 py-2 text-xs text-[var(--tr-ink-3)] underline';

  if (state.phase === 'loading' || state.phase === 'submitting') {
    return shell(
      <div className={card} data-testid="checkin-loading">
        <p className={title}>{t('recognizing')}</p>
      </div>
    );
  }

  if (state.phase === 'undone') {
    return shell(
      <div className={card} data-testid="checkin-undone">
        <p className={title}>{t('undone')}</p>
      </div>
    );
  }

  if (state.phase === 'done') {
    // §K B5-D3 — 자동으로 들어왔으면 화면은 **질문이 아니라 환영**이다.
    // "체크인할까요?"는 물어볼 것이 남아 있을 때의 문구이고, 자동이면 물을
    // 것이 없다. 손님이 아침에 처음 보는 화면이 환영이어야 한다.
    if (state.auto) {
      const seatText = state.seatNumbers.join(', ');
      return shell(
        <div className={card} data-testid="checkin-welcome">
          <p className={title}>{t('welcome', { name: state.displayName || '' })}</p>
          {state.seatNumbers.length > 0 && (
            <p className="mt-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100" data-testid="welcome-seat">
              {t('welcomeSeat', { seat: seatText })}
            </p>
          )}
          <p className={sub} data-testid="welcome-party">
            {t('welcomeParty', { n: String(state.seatNumbers.length) })}
          </p>

          {/* B5-D4 — 막다른 화면이 되면 안 된다. 스캔 직후가 손님이 앱을
              열어보는 유일한 순간일 수 있다. */}
          {state.roomId && state.token && (
            <a
              href={`/tour-mode/room/${state.bookingId ?? ''}?rt=${encodeURIComponent(state.token)}`}
              className={primaryBtn}
              data-testid="welcome-open-room"
            >
              {t('openRoom')}
            </a>
          )}

          {/* B5-D2 — 정정 경로. 모달이 아니라 같은 화면의 조용한 링크다. */}
          <button type="button" onClick={() => void undoAuto()} className={ghostBtn} data-testid="welcome-undo">
            {t('undo')}
          </button>
        </div>
      );
    }

    return shell(
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
    return shell(
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
    return shell(
      <div className={card} data-testid="checkin-ready">
        <p className={title}>{t('greeting', { name: state.displayName || 'Guest' })}</p>
        <p className={sub}>
          {t('yourSeats')}: {state.seats.map((s) => s.seatNumber).join(', ')}
        </p>
        {pending.length > 1 && !selecting && <p className={sub}>{t('partyPrompt', { n: pending.length })}</p>}
        {selecting && (
          <div className="mt-4 space-y-2 text-left" data-testid="checkin-seat-picker">
            {pending.map((s) => (
              <label key={s.seatNumber} className="flex items-center gap-2 text-sm text-[var(--tr-ink)]">
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

  return shell(
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
