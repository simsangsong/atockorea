'use client';

/**
 * T1.11 / §O-1 ⑥ — ended view: the room after tour day + grace. The feed
 * stays readable (composer is hidden by the page), and the one job a
 * traveller still has here — reporting a lost item — gets a single obvious
 * action. Static 5-locale constants, zero LLM calls.
 */

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
    <div
      data-testid="ended-card"
      className="mb-2 rounded-2xl bg-white px-4 py-4 text-center shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800"
    >
      <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-50">🏁 {copy.title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">{copy.body}</p>
      <div className="mt-3 rounded-xl bg-amber-50 px-3 py-3 dark:bg-amber-950">
        <p className="text-[12px] font-medium text-amber-900 dark:text-amber-200">{copy.lostTitle}</p>
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=${subject}`}
          className="mt-2 inline-block rounded-xl bg-amber-500 px-4 py-2 text-[13px] font-semibold text-white"
        >
          ✉️ {copy.lostAction}
        </a>
      </div>
    </div>
  );
}
