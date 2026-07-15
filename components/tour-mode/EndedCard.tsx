'use client';

/**
 * T1.11 / §O-1 ⑥ — ended view: the room after tour day + grace. The feed
 * stays readable (composer is hidden by the page), and the one job a
 * traveller still has here — reporting a lost item — gets a single obvious
 * action. Static 5-locale constants, zero LLM calls.
 */

import { IconEnded, IconMail } from '@/components/tour-mode/icons';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const SUPPORT_EMAIL = 'support@atockorea.com';

const COPY: Record<
  RoomLocale,
  { title: string; body: string; lostTitle: string; lostAction: string }
> = {
  en: {
    title: 'This tour has ended',
    body: 'Thank you for travelling with us! The chat is now read-only.',
    lostTitle: 'Left something behind?',
    lostAction: 'Report a lost item',
  },
  ko: {
    title: '투어가 종료되었습니다',
    body: '함께해 주셔서 감사합니다! 채팅은 읽기 전용으로 전환되었어요.',
    lostTitle: '두고 내린 물건이 있나요?',
    lostAction: '분실물 신고하기',
  },
  ja: {
    title: 'ツアーは終了しました',
    body: 'ご参加ありがとうございました！チャットは閲覧のみ可能です。',
    lostTitle: 'お忘れ物はありませんか？',
    lostAction: '忘れ物を報告する',
  },
  es: {
    title: 'Este tour ha terminado',
    body: '¡Gracias por viajar con nosotros! El chat es ahora de solo lectura.',
    lostTitle: '¿Olvidaste algo?',
    lostAction: 'Reportar objeto perdido',
  },
  zh: {
    title: '本次旅行已结束',
    body: '感谢您的参与！聊天现已转为只读。',
    lostTitle: '有物品遗落吗？',
    lostAction: '申报失物',
  },
};

export default function EndedCard({
  locale,
  bookingReference,
}: {
  locale: RoomLocale;
  bookingReference?: string | null;
}) {
  const copy = COPY[locale];
  const subject = encodeURIComponent(
    `Lost item — ${bookingReference ? `booking ${bookingReference}` : 'tour room'}`,
  );

  return (
    <div data-testid="ended-card" className="tr-card mb-2 px-4 py-4 text-center">
      <p className="tr-title flex items-center justify-center gap-1.5 text-[var(--tr-ink)]">
        <IconEnded size={16} className="text-[var(--tr-ink-3)]" aria-hidden />
        {copy.title}
      </p>
      <p className="tr-card-text mt-1 text-[var(--tr-ink-2)]">{copy.body}</p>
      <div className="mt-3 rounded-xl bg-[var(--tr-surface-2)] px-3 py-3">
        <p className="tr-label font-medium text-[var(--tr-ink-2)]">{copy.lostTitle}</p>
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=${subject}`}
          className="tr-label mt-2 inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-[var(--tr-accent)] px-4 font-semibold text-[var(--tr-bubble-me-ink)]"
        >
          <IconMail size={14} aria-hidden />
          {copy.lostAction}
        </a>
      </div>
    </div>
  );
}
