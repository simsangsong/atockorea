'use client';

/**
 * T1.4 — Tour Mode entry (§B D-2 track 2 + track 3 UI).
 *
 * Track 1 (invite links) never lands here — links open the room directly.
 * This screen serves: logged-in customers (their upcoming confirmed
 * bookings) and guests (booking ID + email lookup). Guest credentials are
 * stashed in sessionStorage — never in the URL — and consumed once by the
 * room page.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ENTRY_COPY } from '@/components/tour-mode/entryCopy';
import { useEntryLocale } from '@/components/tour-mode/useEntryLocale';
import { IconChevronRight, IconTabMap, TR_ICON } from '@/components/tour-mode/icons';
import { isStandaloneDisplayMode } from '@/hooks/useStandaloneDisplayMode';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

interface TourModeBooking {
  id: string;
  booking_reference: string | null;
  tour_date: string | null;
  tour_time: string | null;
  number_of_guests: number | null;
  tours: { title?: string | null; city?: string | null; image_url?: string | null } | null;
}

/** 코드 판정 성공 응답 (POST /api/tour-mode/entry). */
interface EntryCodeResult {
  kind: 'customer' | 'guide' | 'driver';
  url: string;
  tourTitle: string | null;
  tourDate: string | null;
  guestName: string | null;
}

export const GUEST_CREDS_STORAGE_PREFIX = 'tour_mode_guest_creds:';

export default function TourModeEntry({
  initialLocale = 'en',
  initialCode = null,
  initialTo = null,
}: {
  initialLocale?: RoomLocale;
  /** /r/{code}·/room?code= 리다이렉트가 실어 온 입장 코드 — 있으면 자동 입장. */
  initialCode?: string | null;
  initialTo?: 'plan' | null;
}) {
  const router = useRouter();
  // 🔴 N6 — this was `detectEntryLocale()` during render. The server said 'en'
  // and the browser's hydration pass said the device locale, so every guest who
  // is not English threw away the server render of the app's public entry
  // screen and rebuilt it — on the slowest page in the funnel. The server now
  // resolves the same locale from the request, and this only re-checks in an
  // effect, after hydration has nothing left to disagree with.
  const copy = ENTRY_COPY[useEntryLocale(initialLocale)];

  const [bookings, setBookings] = useState<TourModeBooking[] | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  /** Distinct from `signedIn === false`: we could not ask, so we do not know. */
  const [loadFailed, setLoadFailed] = useState(false);
  // 코드 문(entry-code plan §C-2) — 예전 "예약 ID(UUID)+이메일" 폼의 후임.
  const [codeInput, setCodeInput] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeResult, setCodeResult] = useState<EntryCodeResult | null>(null);
  /** 링크로 들어온 자동 입장이 진행되는 동안엔 전체 화면을 "여는 중"으로 덮는다. */
  const [autoOpening, setAutoOpening] = useState(Boolean(initialCode));

  // W5.1 — the installed PWA's start_url is /tour-mode; jump straight back
  // into the last room (its stored room session makes rejoin seamless, and
  // the room's own error state links back here if it no longer opens).
  useEffect(() => {
    const jump = () => {
      if (!isStandaloneDisplayMode()) return;
      try {
        // The room's error page sends the user back here with ?nojump=1 after a
        // dead/expired room — honoring it prevents an infinite redirect loop
        // (entry → dead room → error → entry → …) that would lock the installed
        // app out of the booking list.
        const params = new URLSearchParams(window.location.search);
        if (params.get('nojump') === '1') {
          window.localStorage.removeItem('tour_mode_last_room');
          return;
        }
        const lastRoom = window.localStorage.getItem('tour_mode_last_room');
        if (lastRoom) router.replace(`/tour-mode/room/${encodeURIComponent(lastRoom)}`);
      } catch {
        /* stay on the entry list */
      }
    };
    jump();
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/tour-mode/bookings');
        if (cancelled) return;
        if (res.status === 401) {
          setSignedIn(false);
          return;
        }
        // 🔴 A1.6 — a failed load is not an empty account. Treating any
        // response as data told a guest with a confirmed tour "no upcoming
        // confirmed tours on this account" the night before their tour, which
        // reads as "your booking is gone" and sends them to support.
        if (!res.ok) {
          setLoadFailed(true);
          return;
        }
        const json = (await res.json().catch(() => ({}))) as { bookings?: TourModeBooking[] };
        setSignedIn(true);
        setBookings(json.bookings ?? []);
      } catch {
        // Same reasoning: a network failure is not a signed-out session.
        if (!cancelled) setLoadFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * 코드 → 방 열쇠 교환. 수동 입력은 확인 카드를 한 번 보여주고(오타 방어),
   * 링크(/r/{code})로 들어온 자동 흐름은 성공 즉시 방으로 간다 — 링크의 코드는
   * 우리가 조립한 것이라 확인 카드가 마찰만 더한다.
   */
  const resolveCode = async (raw: string, opts?: { auto?: boolean }) => {
    const code = raw.trim();
    if (!code) return;
    setCodeBusy(true);
    setCodeError(null);
    setCodeResult(null);
    try {
      const res = await fetch('/api/tour-mode/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, ...(initialTo === 'plan' ? { to: 'plan' } : {}) }),
      });
      const json = (await res.json().catch(() => ({}))) as Partial<EntryCodeResult> & { error?: string };
      if (res.ok && typeof json.url === 'string') {
        const result: EntryCodeResult = {
          kind: json.kind === 'guide' || json.kind === 'driver' ? json.kind : 'customer',
          url: json.url,
          tourTitle: json.tourTitle ?? null,
          tourDate: json.tourDate ?? null,
          guestName: json.guestName ?? null,
        };
        if (opts?.auto) {
          router.replace(result.url);
          return; // busy 유지 — 전환 중 폼이 다시 번쩍이지 않게
        }
        setCodeResult(result);
        return;
      }
      if (res.status === 429) setCodeError(copy.errorRateLimited);
      else if (json.error === 'expired') setCodeError(copy.errorCodeExpired);
      else if (json.error === 'revoked') setCodeError(copy.errorCodeRevoked);
      else if (res.status === 404) setCodeError(copy.errorNotFound);
      else setCodeError(copy.errorGeneric);
    } catch {
      setCodeError(copy.errorGeneric);
    } finally {
      setCodeBusy(false);
      if (opts?.auto) setAutoOpening(false);
    }
  };

  // /r/{code}·/room?code= — 링크가 실어 온 코드는 손대지 않고 그대로 교환한다.
  useEffect(() => {
    if (!initialCode) return;
    setCodeInput(initialCode);
    void resolveCode(initialCode, { auto: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  // U6.4 — entry list on the room token system (light theme; the room itself
  // resolves dark mode after join).
  const inputClass =
    'tr-body mt-1 w-full rounded-[var(--tr-radius-input)] bg-[var(--tr-surface)] px-4 py-2.5 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:outline-none focus:ring-2 focus:ring-[var(--tr-accent)]';

  // /r/{code} 자동 입장 중 — 목록·폼 대신 "여는 중" 한 장. 실패하면 아래 폼으로
  // 떨어지고 코드가 미리 채워져 있다.
  if (autoOpening) {
    return (
      <div className="tr-atmos tr-safe-top tr-safe-bottom tr-root flex min-h-dvh items-center justify-center bg-[var(--tr-canvas)]">
        <div className="px-6 text-center" data-testid="entry-auto-opening">
          <p className="tr-title text-[var(--tr-ink)]">{copy.codeOpening}</p>
          <p className="tr-label mt-2 font-mono tracking-wide text-[var(--tr-ink-3)]">{codeInput}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tr-atmos tr-safe-top tr-safe-bottom tr-root min-h-dvh bg-[var(--tr-canvas)]">
      <div className="mx-auto w-full max-w-md px-4 pb-16 pt-10">
        <h1 className="tr-display font-semibold leading-snug text-[var(--tr-ink)]">{copy.title}</h1>
        <p className="tr-body mt-2 text-[var(--tr-ink-2)]">{copy.subtitle}</p>
        <p className="tr-label mt-3 rounded-xl bg-[var(--tr-accent-soft)] px-3 py-2 leading-relaxed text-[var(--tr-accent-deep)]">
          {copy.linkHint}
        </p>

        <section className="mt-8">
          <h2 className="tr-title text-[var(--tr-ink)]">{copy.myBookings}</h2>
          {loadFailed && (
            <p
              className="tr-card-text mt-2 leading-relaxed text-[var(--tr-danger)]"
              data-testid="entry-load-failed"
            >
              {copy.loadFailed}
            </p>
          )}
          {!loadFailed && signedIn === null && (
            <p className="tr-card-text mt-2 text-[var(--tr-ink-3)]">{copy.loading}</p>
          )}
          {signedIn === false && <p className="tr-card-text mt-2 text-[var(--tr-ink-2)]">{copy.signInHint}</p>}
          {signedIn === true && bookings !== null && bookings.length === 0 && (
            <p className="tr-card-text mt-2 text-[var(--tr-ink-2)]">{copy.noBookings}</p>
          )}
          {signedIn === true && bookings !== null && bookings.length > 0 && (
            <ul className="mt-3 space-y-2">
              {bookings.map((booking) => (
                <li key={booking.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/tour-mode/room/${encodeURIComponent(booking.id)}`)}
                    className="tr-card flex w-full items-center gap-3 p-3 text-left tr-press"
                  >
                    {booking.tours?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={booking.tours.image_url}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-xl object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--tr-surface-2)] text-[var(--tr-ink-3)]">
                        <IconTabMap size={TR_ICON.action} aria-hidden />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="tr-card-text block truncate font-medium text-[var(--tr-ink)]">
                        {booking.tours?.title ?? booking.booking_reference ?? booking.id}
                      </span>
                      <span className="tr-label mt-0.5 block truncate text-[var(--tr-ink-2)]">
                        {[booking.tour_date, booking.tour_time, booking.tours?.city].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <IconChevronRight size={TR_ICON.action} className="shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="tr-title text-[var(--tr-ink)]">{copy.guestTitle}</h2>
          <p className="tr-label mt-1 text-[var(--tr-ink-2)]">{copy.guestHint}</p>
          <form
            className="mt-3 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void resolveCode(codeInput);
            }}
          >
            <label className="block">
              <span className="tr-label font-medium text-[var(--tr-ink-2)]">{copy.codeLabel}</span>
              <input
                value={codeInput}
                onChange={(e) => {
                  setCodeInput(e.target.value);
                  setCodeResult(null);
                  setCodeError(null);
                }}
                required
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                data-testid="entry-code-input"
                className={`${inputClass} font-mono tracking-wide uppercase`}
              />
            </label>
            {codeError && (
              <p className="tr-label text-[var(--tr-danger)]" data-testid="entry-code-error">
                {codeError}
              </p>
            )}
            {codeResult ? (
              <div className="tr-card p-4" data-testid="entry-code-confirm">
                <p className="tr-card-text font-medium text-[var(--tr-ink)]">
                  {codeResult.tourTitle ?? copy.title}
                </p>
                <p className="tr-label mt-0.5 text-[var(--tr-ink-2)]">
                  {[codeResult.tourDate, codeResult.guestName].filter(Boolean).join(' · ')}
                </p>
                <button
                  type="button"
                  onClick={() => router.push(codeResult.url)}
                  className="tr-body mt-3 flex min-h-[48px] w-full items-center justify-center rounded-full bg-[var(--tr-accent)] font-semibold text-[var(--tr-bubble-me-ink)] transition"
                >
                  {copy.enterRoom}
                </button>
              </div>
            ) : (
              <button
                type="submit"
                disabled={codeBusy || !codeInput.trim()}
                className="tr-body flex min-h-[48px] w-full items-center justify-center rounded-full bg-[var(--tr-accent)] font-semibold text-[var(--tr-bubble-me-ink)] transition disabled:opacity-40"
              >
                {codeBusy ? copy.loading : copy.codeContinue}
              </button>
            )}
          </form>
        </section>
      </div>
    </div>
  );
}
