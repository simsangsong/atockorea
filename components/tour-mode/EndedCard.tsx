'use client';

/**
 * T1.11 / §O-1 ⑥ — ended view: the room after tour day + grace. The feed
 * stays readable (composer is hidden by the page), and the one job a
 * traveller still has here — reporting a lost item — gets a single obvious
 * action. Static 5-locale constants, zero LLM calls.
 */

import { useState } from 'react';
import { IconEnded, IconMail } from '@/components/tour-mode/icons';
import { useConfirmSheet } from '@/components/tour-mode/ConfirmSheet';
import { inPostTourWindow } from '@/lib/tour-room/time';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const SUPPORT_EMAIL = 'support@atockorea.com';

const COPY: Record<
  RoomLocale,
  {
    title: string;
    body: string;
    lostTitle: string;
    lostAction: string;
    lostSent: string;
    lostFailed: string;
    lostPrompt: string;
  }
> = {
  en: {
    title: 'This tour has ended',
    body: 'Thank you for travelling with us! The chat is now read-only.',
    lostTitle: 'Left something behind?',
    lostAction: 'Report a lost item',
    lostSent: 'Reported — the driver and guide will check the vehicle. ✓',
    lostFailed: "Couldn't send the report — please email us instead.",
    lostPrompt: 'What did you leave, and where? (e.g. black wallet, seat 12)',
  },
  ko: {
    title: '투어가 종료되었습니다',
    body: '함께해 주셔서 감사합니다! 채팅은 읽기 전용으로 전환되었어요.',
    lostTitle: '두고 내린 물건이 있나요?',
    lostAction: '분실물 신고하기',
    lostSent: '신고됐어요 — 기사님·가이드가 차량을 확인할 거예요. ✓',
    lostFailed: '신고를 보내지 못했어요 — 이메일로 알려주세요.',
    lostPrompt: '무엇을, 어디에 두고 내리셨나요? (예: 검은 지갑, 12번 좌석)',
  },
  ja: {
    title: 'ツアーは終了しました',
    body: 'ご参加ありがとうございました！チャットは閲覧のみ可能です。',
    lostTitle: 'お忘れ物はありませんか？',
    lostAction: '忘れ物を報告する',
    lostSent: '報告しました — ドライバーとガイドが車内を確認します。✓',
    lostFailed: '報告を送信できませんでした — メールでお知らせください。',
    lostPrompt: '何を、どこに忘れましたか？（例：黒い財布、12番座席）',
  },
  es: {
    title: 'Este tour ha terminado',
    body: '¡Gracias por viajar con nosotros! El chat es ahora de solo lectura.',
    lostTitle: '¿Olvidaste algo?',
    lostAction: 'Reportar objeto perdido',
    lostSent: 'Reportado: el conductor y el guía revisarán el vehículo. ✓',
    lostFailed: 'No se pudo enviar el reporte — escríbenos por correo.',
    lostPrompt: '¿Qué olvidaste y dónde? (ej.: cartera negra, asiento 12)',
  },
  zh: {
    title: '本次旅行已结束',
    body: '感谢您的参与！聊天现已转为只读。',
    lostTitle: '有物品遗落吗？',
    lostAction: '申报失物',
    lostSent: '已申报——司机和导游会检查车辆。✓',
    lostFailed: '申报未能发送 — 请通过邮件告知我们。',
    lostPrompt: '您遗落了什么？在哪里？（例：黑色钱包，12号座位）',
  },
};

export default function EndedCard({
  locale,
  bookingReference,
  bookingId,
  roomSession,
  tourDate,
}: {
  locale: RoomLocale;
  bookingReference?: string | null;
  /** W5.2/I3 — with a session inside the post_tour window (P-D12), the
   *  report is a one-tap in-room signal; otherwise the mailto fallback. */
  bookingId?: string;
  roomSession?: string | null;
  tourDate?: string | null;
}) {
  const copy = COPY[locale];
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'failed'>('idle');
  // M1 — in-app prompt (native dialogs banned on tour surfaces, M-D6).
  const SEND: Record<RoomLocale, string> = { en: 'Send', ko: '보내기', ja: '送信', es: 'Enviar', zh: '发送' };
  const CANCEL: Record<RoomLocale, string> = { en: 'Cancel', ko: '취소', ja: 'キャンセル', es: 'Cancelar', zh: '取消' };
  const { prompt, sheet } = useConfirmSheet({ confirm: SEND[locale], cancel: CANCEL[locale] });
  const subject = encodeURIComponent(
    `Lost item — ${bookingReference ? `booking ${bookingReference}` : 'tour room'}`,
  );
  const canSignal = Boolean(bookingId && roomSession && tourDate && inPostTourWindow(tourDate));

  const report = async () => {
    if (!bookingId || !roomSession) return;
    // B2 — what & where ("black wallet, seat 12"): translated server-side so
    // the Korean crew searches for the right thing. Cancel = abort, empty = generic.
    const note = await prompt({ message: copy.lostPrompt, allowEmpty: true });
    if (note === null) return;
    setState('busy');
    try {
      const res = await fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/signals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': roomSession },
        body: JSON.stringify({ type: 'lost_item', ...(note.trim() ? { note: note.trim() } : {}) }),
      });
      // 🔴 A1.6 — 'idle' put the button back untouched, so a report that never
      // arrived looked exactly like one not yet sent. The email path below is a
      // real fallback; failure routes to it instead of hiding.
      setState(res.ok ? 'sent' : 'failed');
    } catch {
      setState('failed');
    }
  };

  return (
    <div data-testid="ended-card" className="tr-card mb-2 px-4 py-4 text-center">
      <p className="tr-title flex items-center justify-center gap-1.5 text-[var(--tr-ink)]">
        <IconEnded size={16} className="text-[var(--tr-ink-3)]" aria-hidden />
        {copy.title}
      </p>
      <p className="tr-card-text mt-1 text-[var(--tr-ink-2)]">{copy.body}</p>
      <div className="mt-3 rounded-xl bg-[var(--tr-surface-2)] px-3 py-3">
        <p className="tr-label font-medium text-[var(--tr-ink-2)]">{copy.lostTitle}</p>
        {state === 'sent' ? (
          <p className="tr-label mt-2 font-semibold text-[var(--tr-safe)]" data-testid="lost-item-sent">
            {copy.lostSent}
          </p>
        ) : canSignal && state !== 'failed' ? (
          <button
            type="button"
            disabled={state === 'busy'}
            onClick={() => void report()}
            className="tr-label mt-2 inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-[var(--tr-accent)] px-4 font-semibold text-[var(--tr-bubble-me-ink)] disabled:opacity-50"
            data-testid="lost-item-signal"
          >
            🧳 {copy.lostAction}
          </button>
        ) : (
          <>
            {state === 'failed' && (
              <p
                className="tr-label mt-2 font-medium text-[var(--tr-danger)]"
                data-testid="lost-item-failed"
              >
                {copy.lostFailed}
              </p>
            )}
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${subject}`}
              className="tr-label mt-2 inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-[var(--tr-accent)] px-4 font-semibold text-[var(--tr-bubble-me-ink)]"
            >
              <IconMail size={14} aria-hidden />
              {copy.lostAction}
            </a>
          </>
        )}
      </div>
      {sheet}
    </div>
  );
}
