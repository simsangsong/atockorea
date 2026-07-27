'use client';

/**
 * V1 — 대면 통역 진입. 룸에서 이미 만들어진 세션을 그대로 쓴다.
 *
 * 이 화면은 손님이 **식당·약국·상점 앞에 서서** 여는 것이다. 새 토큰 흐름을
 * 하나 더 만들 이유가 없다 — 룸에 들어와 있는 기기라면 `readStoredRoomSession`
 * 에 세션이 있고, 없다면 룸으로 돌려보내는 게 맞다(여기서 조인 UI 를 또
 * 만들면 입장 경로가 둘로 갈린다).
 */

import { useCallback, useSyncExternalStore } from 'react';

import { readStoredRoomSession } from '@/hooks/useTourRoomSession';
import InterpretClient from '@/components/tour-mode/interpret/InterpretClient';
import { INTERPRET_COPY, interpretCopyFor } from '@/lib/tour-room/interpretCopy';

interface Props {
  bookingId: string;
  /** 서버가 아는 손님 로케일. 저장된 게 없으면 이걸 쓴다. */
  fallbackLocale: string;
}

/** localStorage 는 외부 저장소다 — 구독은 없지만 스냅샷 계약은 지켜야 한다. */
const NO_SUBSCRIBE = () => () => undefined;

function readLocale(fallback: string): string {
  try {
    return window.localStorage.getItem('tour_mode_locale') || fallback;
  } catch {
    return fallback; // 저장소가 막힌 브라우저
  }
}

export default function InterpretEntry({ bookingId, fallbackLocale }: Props) {
  /**
   * 🔴 `useEffect` + `setState` 로 읽으면 안 된다. 서버에는 localStorage 가 없어
   * 첫 렌더가 반드시 어긋나고, 이 레포는 그 사고를 이미 한 번 겪었다(전역
   * navigator 가 SSR 에 로케일을 누수시켜 기기 로케일이 다른 손님 전체에서
   * hydration 이 깨진 건). `useSyncExternalStore` 는 서버 스냅샷을 따로 받아
   * 그 불일치를 구조적으로 막는다.
   */
  const session = useSyncExternalStore(
    NO_SUBSCRIBE,
    useCallback(() => readStoredRoomSession(bookingId), [bookingId]),
    () => undefined, // 서버: 아직 모른다
  );
  const locale = useSyncExternalStore(
    NO_SUBSCRIBE,
    useCallback(() => readLocale(fallbackLocale), [fallbackLocale]),
    useCallback(() => fallbackLocale, [fallbackLocale]),
  );

  const copy = interpretCopyFor(locale);

  if (session === undefined) {
    return <p className="tr-root p-6 tr-body text-[var(--tr-ink-2)]">{copy.working}</p>;
  }

  if (!session) {
    return (
      <div className="tr-root flex h-[100dvh] flex-col items-center justify-center gap-4 bg-[var(--tr-canvas)] px-6 text-center">
        <p className="text-cjk-body tr-body text-[var(--tr-ink-2)]">{copy.needRoom}</p>
        <a
          href={`/tour-mode/room/${encodeURIComponent(bookingId)}`}
          className="text-cjk-safe tr-btn rounded-full bg-[var(--tr-accent)] px-6 py-3 font-semibold text-[var(--tr-bubble-me-ink)]"
        >
          {copy.openRoom}
        </a>
      </div>
    );
  }

  return (
    <InterpretClient
      bookingId={bookingId}
      roomSession={session}
      guestLocale={locale}
      copy={copy}
    />
  );
}

export { INTERPRET_COPY };
