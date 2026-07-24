'use client';

/**
 * 동행자 등록 랜딩 — AtoC 통합 플랜 §5.2 C-6.
 *
 * lead가 공유한 링크를 두 번째 기기에서 열면: 이름(선택) → redeem →
 * 개인 토큰 저장(§5.2 C-4 `ops_personal_tokens`, JoinFlow와 같은 키) →
 * `/tour-mode/room/{bookingId}?rt={token}` 로 이동. 그 뒤로 이 기기는
 * 룸의 온전한 구성원이다 (자기 채팅 신원 · 자기 체크인 · 자기 푸시).
 *
 * GET에는 부작용이 없다 — participant는 사용자가 버튼을 눌렀을 때만 생긴다
 * (§O-1 ⑦ 메일 스캐너 방어).
 */

import { useCallback, useEffect, useState } from 'react';
import { getOrCreateDeviceKey, storePersonalToken } from '@/lib/ops/seating/personalTokens';
import { companionCopy, detectCompanionLocale, type CompanionCopyKey } from '@/lib/tour-room/companionCopy';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

type Phase = 'form' | 'joining' | 'done' | 'full' | 'expired' | 'error';

export default function CompanionJoin({
  inviteToken,
  bookingId,
}: {
  inviteToken: string;
  bookingId: string;
}) {
  const [locale, setLocale] = useState<RoomLocale>('en');
  const [dark, setDark] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [name, setName] = useState('');
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  const t = useCallback(
    (key: CompanionCopyKey, vars?: Record<string, string | number>) => companionCopy(locale, key, vars),
    [locale],
  );

  // 기기 로케일/테마는 마운트 후에만 읽는다 (SSR 결정론 — iOS QA 스윕 회귀 방지).
  useEffect(() => {
    setLocale(detectCompanionLocale());
    try {
      setDark(window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
    } catch {
      /* noop */
    }
  }, []);

  const submit = useCallback(async () => {
    setPhase('joining');
    setServerMessage(null);
    try {
      const res = await fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/companion-invite/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteToken,
          deviceKey: getOrCreateDeviceKey(),
          displayName: name.trim() || undefined,
          locale,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 201 && data.token) {
        storePersonalToken(data.token as string);
        const url = `/tour-mode/room/${encodeURIComponent(bookingId)}?rt=${encodeURIComponent(data.token as string)}`;
        setRoomUrl(url);
        setPhase('done');
        window.location.replace(url);
        return;
      }
      if (res.status === 409 && data.error === 'party_full') {
        setServerMessage(typeof data.message === 'string' ? data.message : null);
        setPhase('full');
        return;
      }
      if (res.status === 403) {
        setPhase('expired');
        return;
      }
      setPhase('error');
    } catch {
      setPhase('error');
    }
  }, [bookingId, inviteToken, name, locale]);

  const card =
    'mx-auto mt-10 w-full max-w-md rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] p-5 shadow-sm';
  const title = 'text-lg font-bold text-[var(--tr-ink)]';
  const sub = 'mt-1 text-sm text-[var(--tr-ink-2)]';
  const primaryBtn =
    'mt-4 min-h-[48px] w-full rounded-xl bg-[var(--tr-accent)] px-4 py-3 text-sm font-bold text-[var(--tr-bubble-me-ink)] active:scale-[0.99] disabled:opacity-40';

  return (
    <div className={dark ? 'dark' : ''}>
      <div className="tr-root min-h-dvh bg-[var(--tr-canvas)] px-4 pb-10" data-locale={locale} lang={locale}>
        {phase === 'full' && (
          <div className={card} data-testid="companion-full">
            <p className={title}>{t('full')}</p>
            {serverMessage && <p className={sub}>{serverMessage}</p>}
          </div>
        )}
        {phase === 'expired' && (
          <div className={card} data-testid="companion-expired">
            <p className={title}>{t('expired')}</p>
          </div>
        )}
        {phase === 'error' && (
          <div className={card} data-testid="companion-error">
            <p className={title}>{t('error')}</p>
            <button type="button" className={primaryBtn} onClick={() => setPhase('form')}>
              {t('retry')}
            </button>
          </div>
        )}
        {phase === 'done' && (
          <div className={card} data-testid="companion-done">
            <p className="text-3xl">🎟️</p>
            <p className={title}>{t('joinedTitle')}</p>
            <p className={sub}>{t('joinedHint')}</p>
            {roomUrl && (
              <a href={roomUrl} className={`${primaryBtn} block text-center`} data-testid="companion-open-room">
                {t('openRoom')}
              </a>
            )}
          </div>
        )}
        {(phase === 'form' || phase === 'joining') && (
          <div className={card} data-testid="companion-form">
            <p className={title}>{t('joinTitle')}</p>
            <p className={sub}>{t('joinHint')}</p>
            <label className="mt-4 block text-xs font-semibold text-[var(--tr-ink-2)]">
              {t('nameLabel')}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('namePlaceholder')}
                maxLength={40}
                autoComplete="off"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-canvas)] px-3 py-2.5 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:border-[var(--tr-accent)] focus:outline-none"
                data-testid="companion-name"
              />
            </label>
            <button
              type="button"
              disabled={phase === 'joining'}
              className={primaryBtn}
              onClick={() => void submit()}
              data-testid="companion-join-btn"
            >
              {phase === 'joining' ? t('joining') : t('joinCta')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
