'use client';

/**
 * T7.3 — the traveller SOS control, living inside the emergency card area.
 *
 * Tap → confirm sheet with an honest one-shot-location line (even a sharing-
 * OFF traveller sends this single fix, after this explicit consent) →
 * getCurrentPosition once (denial still sends, just without coordinates) →
 * POST /sos. Sent state shows reassurance, not silence.
 */

import { useState } from 'react';
import { IconDone, IconEmergency } from '@/components/tour-mode/icons';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const COPY: Record<
  RoomLocale,
  { button: string; confirmTitle: string; consent: string; note: string; send: string; cancel: string; sent: string; connected: string; failed: string }
> = {
  en: {
    button: 'SOS — I need urgent help',
    confirmTitle: 'Send SOS to your guide & our team?',
    consent: 'Your current location will be attached once (only for this SOS) so we can reach you.',
    note: 'What happened? (optional)',
    send: 'Send SOS',
    cancel: 'Cancel',
    sent: 'SOS sent — your guide and our team have been alerted. Stay where you are if safe.',
    connected: 'Connected to our ops team — replies from AtoC Korea are highlighted in the chat.',
    failed: 'Could not send — call 112/1330 above, or try again.',
  },
  ko: {
    button: 'SOS — 긴급 도움 요청',
    confirmTitle: '가이드와 운영팀에 SOS를 보낼까요?',
    consent: '이번 SOS 1회에 한해 현재 위치가 함께 전송돼요 — 저희가 찾아갈 수 있도록요.',
    note: '무슨 일인가요? (선택)',
    send: 'SOS 보내기',
    cancel: '취소',
    sent: 'SOS 전송 완료 — 가이드와 운영팀에 알렸어요. 안전하다면 그 자리에서 기다려 주세요.',
    connected: '관제팀과 연결됨 — AtoC Korea의 응답이 채팅에 강조 표시돼요.',
    failed: '전송하지 못했어요 — 위의 112/1330으로 전화하거나 다시 시도해 주세요.',
  },
  ja: {
    button: 'SOS — 緊急の助けが必要',
    confirmTitle: 'ガイドと運営チームにSOSを送りますか？',
    consent: 'このSOSに限り、現在地が1回だけ送信されます — お迎えに行けるように。',
    note: '何がありましたか？（任意）',
    send: 'SOSを送る',
    cancel: 'キャンセル',
    sent: 'SOS送信済み — ガイドと運営チームに通知しました。安全ならその場でお待ちください。',
    connected: '運営チームと接続中 — AtoC Koreaからの返信はチャットで強調表示されます。',
    failed: '送信できませんでした — 上の112/1330に電話するか、再試行してください。',
  },
  es: {
    button: 'SOS — Necesito ayuda urgente',
    confirmTitle: '¿Enviar SOS a tu guía y a nuestro equipo?',
    consent: 'Tu ubicación actual se adjuntará una sola vez (solo para este SOS) para poder encontrarte.',
    note: '¿Qué pasó? (opcional)',
    send: 'Enviar SOS',
    cancel: 'Cancelar',
    sent: 'SOS enviado — tu guía y nuestro equipo han sido alertados. Quédate donde estás si es seguro.',
    connected: 'Conectado con nuestro equipo — las respuestas de AtoC Korea se resaltan en el chat.',
    failed: 'No se pudo enviar — llama al 112/1330 de arriba o inténtalo de nuevo.',
  },
  zh: {
    button: 'SOS — 我需要紧急帮助',
    confirmTitle: '向导游和运营团队发送SOS？',
    consent: '仅此次SOS会附带一次您的当前位置，以便我们找到您。',
    note: '发生了什么？（可选）',
    send: '发送SOS',
    cancel: '取消',
    sent: 'SOS已发送 — 已通知导游和运营团队。如安全请原地等待。',
    connected: '已连接运营团队 — AtoC Korea的回复会在聊天中高亮显示。',
    failed: '发送失败 — 请拨打上方112/1330，或重试。',
  },
};

function currentPositionOnce(timeoutMs = 8_000): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resolve(null), // denied/unavailable — the SOS still goes out
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}

export default function SosButton({
  bookingId,
  roomSession,
  locale,
  onSent,
  alreadySentAt,
}: {
  bookingId: string;
  roomSession: string;
  locale: RoomLocale;
  /** W4.3 — fired once on a delivered SOS with the SERVER timestamp (skew-proof). */
  onSent?: (sentAt: string) => void;
  /** W4.3 — when a prior SOS was sent this session, mount straight into 'sent'. */
  alreadySentAt?: string | null;
}) {
  const [state, setState] = useState<'idle' | 'confirm' | 'sending' | 'sent' | 'failed'>(
    alreadySentAt ? 'sent' : 'idle',
  );
  const [note, setNote] = useState('');
  const copy = COPY[locale];

  const send = async () => {
    setState('sending');
    try {
      const location = await currentPositionOnce();
      const res = await fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/sos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': roomSession },
        body: JSON.stringify({ ...location, note: note.trim() || undefined }),
      });
      if (!res.ok) throw new Error(String(res.status));
      // Use the server's message timestamp so the ops-reply highlight can't be
      // thrown off by a fast/slow device clock.
      const json = (await res.json().catch(() => ({}))) as { message?: { created_at?: string } };
      setState('sent');
      onSent?.(json.message?.created_at || new Date().toISOString());
    } catch {
      setState('failed');
    }
  };

  if (state === 'sent') {
    return (
      <div className="rounded-xl bg-[var(--tr-safe-soft)] px-3 py-2.5" data-testid="sos-sent">
        <p className="tr-label flex items-start gap-1.5 font-medium leading-relaxed text-[var(--tr-safe)]">
          <IconDone size={14} className="mt-0.5 shrink-0" aria-hidden />
          {copy.sent}
        </p>
        <p className="tr-label mt-1.5 flex items-center gap-1.5 font-semibold text-[var(--tr-safe)]" data-testid="sos-connected">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          {copy.connected}
        </p>
      </div>
    );
  }

  if (state === 'confirm' || state === 'sending' || state === 'failed') {
    return (
      <div className="rounded-xl bg-[var(--tr-danger-soft)] p-3" data-testid="sos-confirm">
        <p className="tr-card-text font-semibold text-[var(--tr-danger)]">{copy.confirmTitle}</p>
        <p className="tr-label mt-1 leading-relaxed text-[var(--tr-ink-2)]">{copy.consent}</p>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          placeholder={copy.note}
          className="tr-card-text mt-2 w-full rounded-xl bg-[var(--tr-surface)] px-3 py-2.5 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:outline-none focus:ring-2 focus:ring-[var(--tr-danger)]"
        />
        {state === 'failed' && (
          <p className="tr-label mt-1.5 font-medium text-[var(--tr-danger)]">{copy.failed}</p>
        )}
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={() => setState('idle')}
            disabled={state === 'sending'}
            className="tr-card-text min-h-[44px] flex-1 rounded-full bg-[var(--tr-surface)] font-medium text-[var(--tr-ink-2)]"
          >
            {copy.cancel}
          </button>
          <button
            type="button"
            onClick={() => void send()}
            disabled={state === 'sending'}
            className="tr-card-text flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--tr-danger)] font-bold text-white disabled:opacity-60"
            data-testid="sos-send"
          >
            {state === 'sending' ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />
            ) : (
              <>
                <IconEmergency size={15} aria-hidden />
                {copy.send}
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setState('confirm')}
      className="tr-card-text flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[var(--tr-danger)] font-bold text-white active:opacity-90"
      data-testid="sos-button"
    >
      <IconEmergency size={17} aria-hidden />
      {copy.button}
    </button>
  );
}
