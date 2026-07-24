'use client';

/**
 * [동행자 초대] — AtoC 통합 플랜 §5.2 C-6, lead 전용 룸 액션.
 *
 * lead가 링크를 만들고 자기 메신저로 공유한다. 이 컴포넌트는 아무것도
 * 발송하지 않는다 (D10) — 링크를 만들어 복사/공유 시트에 넘길 뿐이다.
 *
 * 자리 수는 서버가 판정한다: bookings.number_of_guests 대비 등록된 고객
 * 디바이스 수. 정원이 차면 링크 발급 자체가 409로 막히고, 여기서는 그
 * 사실을 문장으로 보여준다 (500 없이 우아하게).
 *
 * 렌더 조건은 서버 응답(is_lead)이다 — 동행자 기기에서는 카드 자체가
 * 나타나지 않고, 눌러도 라우트가 403 lead_guest_only로 막는다.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link2, Share2 } from 'lucide-react';
import { companionCopy, type CompanionCopyKey } from '@/lib/tour-room/companionCopy';
import type { CompanionSlots } from '@/lib/tour-room/companion';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

export default function CompanionInviteCard({
  bookingId,
  roomSession,
  locale,
}: {
  bookingId: string;
  roomSession: string;
  locale: RoomLocale;
}) {
  const [isLead, setIsLead] = useState(false);
  const [slots, setSlots] = useState<CompanionSlots | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const t = useCallback(
    (key: CompanionCopyKey, vars?: Record<string, string | number>) => companionCopy(locale, key, vars),
    [locale],
  );

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/companion-invite`, {
          headers: { 'x-tour-room-auth': roomSession },
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        setIsLead(Boolean(data.is_lead));
        setSlots((data.slots as CompanionSlots) ?? null);
      } catch {
        /* the card simply stays hidden */
      }
    })();
    return () => {
      alive = false;
    };
  }, [bookingId, roomSession]);

  const createLink = useCallback(async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/companion-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': roomSession },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 201 && data.url) {
        setUrl(data.url as string);
        if (data.slots) setSlots(data.slots as CompanionSlots);
        return;
      }
      if (res.status === 409 && data.error === 'party_full') {
        if (data.slots) setSlots(data.slots as CompanionSlots);
        setNote(t('inviteFull'));
        return;
      }
      setNote(t('error'));
    } catch {
      setNote(t('error'));
    } finally {
      setBusy(false);
    }
  }, [bookingId, roomSession, t]);

  const copy = useCallback(async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setNote(url); // 클립보드가 막힌 브라우저 — 링크를 그대로 보여준다.
    }
  }, [url]);

  const share = useCallback(async () => {
    if (!url) return;
    try {
      const nav = navigator as Navigator & { share?: (d: { title?: string; url: string }) => Promise<void> };
      if (nav.share) await nav.share({ title: t('inviteTitle'), url });
      else await copy();
    } catch {
      /* user dismissed the share sheet */
    }
  }, [url, copy, t]);

  if (!isLead) return null;

  const full = Boolean(slots?.full);

  return (
    <section className="tr-card p-4" data-testid="companion-invite-card">
      <h3 className="tr-card-text flex items-center gap-1.5 font-semibold text-[var(--tr-ink)]">
        <Link2 size={15} className="text-[var(--tr-ink-3)]" aria-hidden />
        {t('inviteTitle')}
      </h3>
      <p className="tr-meta mt-0.5 leading-snug text-[var(--tr-ink-3)]">{t('inviteHint')}</p>
      {slots && (
        <p className="tr-meta mt-1 text-[var(--tr-ink-2)] tabular-nums" data-testid="companion-slots">
          {full
            ? t('inviteFull')
            : t('inviteSlots', { remaining: slots.remaining, capacity: slots.capacity })}
        </p>
      )}

      {!url ? (
        <button
          type="button"
          disabled={busy || full}
          onClick={() => void createLink()}
          className="tr-card-text tr-press mt-3 min-h-[44px] w-full rounded-xl bg-[var(--tr-accent)] px-4 font-bold text-[var(--tr-bubble-me-ink)] disabled:opacity-40"
          data-testid="companion-create-link"
        >
          {t('inviteCta')}
        </button>
      ) : (
        <>
          <p
            className="tr-meta mt-3 break-all rounded-xl bg-[var(--tr-surface-2)] px-3 py-2 text-[var(--tr-ink-2)]"
            data-testid="companion-invite-url"
          >
            {url}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => void copy()}
              className="tr-card-text tr-press min-h-[44px] flex-1 rounded-xl bg-[var(--tr-surface-2)] px-3 font-semibold text-[var(--tr-ink)]"
              data-testid="companion-copy-link"
            >
              {copied ? t('copied') : t('copy')}
            </button>
            <button
              type="button"
              onClick={() => void share()}
              className="tr-card-text tr-press flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--tr-accent)] px-3 font-bold text-[var(--tr-bubble-me-ink)]"
              data-testid="companion-share-link"
            >
              <Share2 size={14} aria-hidden />
              {t('share')}
            </button>
          </div>
          <p className="tr-meta mt-1.5 text-[var(--tr-ink-3)]">{t('inviteExpiry')}</p>
        </>
      )}

      {note && (
        <p className="tr-meta mt-2 rounded-xl bg-[var(--tr-danger-soft)] px-3 py-2 text-[var(--tr-danger)]" data-testid="companion-invite-note">
          {note}
        </p>
      )}
    </section>
  );
}
