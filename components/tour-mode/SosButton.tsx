'use client';

/**
 * T7.3 — the traveller SOS control, living inside the emergency card area.
 *
 * Tap → confirm sheet with an honest one-shot-location line (even a sharing-
 * OFF traveller sends this single fix, after this explicit consent) →
 * getCurrentPosition once (denial still sends, just without coordinates) →
 * POST /sos. Sent state shows reassurance, not silence.
 */

import { useRef, useState } from 'react';
import { IconDone, IconEmergency, TR_ICON } from '@/components/tour-mode/icons';
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
  'zh-TW': {
    button: 'SOS — 我需要緊急協助',
    confirmTitle: '要向導遊和營運團隊傳送SOS嗎？',
    consent: '僅這次SOS會附上一次您目前的位置，以便我們找到您。',
    note: '發生了什麼事？（選填）',
    send: '傳送SOS',
    cancel: '取消',
    sent: 'SOS已傳送——已通知導遊和營運團隊。若安全請在原地等候。',
    connected: '已連線營運團隊——AtoC Korea 的回覆會在聊天中醒目顯示。',
    failed: '傳送失敗——請撥打上方的112/1330，或再試一次。',
  },
  fr: {
    button: 'SOS — j’ai besoin d’aide en urgence',
    confirmTitle: 'Envoyer un SOS à votre guide et à notre équipe?',
    consent: 'Votre position actuelle sera jointe une seule fois (pour ce SOS uniquement) afin de vous retrouver.',
    note: 'Que s’est-il passé? (facultatif)',
    send: 'Envoyer le SOS',
    cancel: 'Annuler',
    sent: 'SOS envoyé — votre guide et notre équipe sont prévenus. Restez sur place si c’est sûr.',
    connected: 'En lien avec notre équipe — les réponses d’AtoC Korea sont mises en avant dans le chat.',
    failed: 'Envoi impossible — appelez le 112/1330 ci-dessus, ou réessayez.',
  },
  de: {
    button: 'SOS — ich brauche dringend Hilfe',
    confirmTitle: 'SOS an Ihren Guide und unser Team senden?',
    consent: 'Ihr aktueller Standort wird einmalig angehängt (nur für dieses SOS), damit wir Sie erreichen.',
    note: 'Was ist passiert? (optional)',
    send: 'SOS senden',
    cancel: 'Abbrechen',
    sent: 'SOS gesendet — Ihr Guide und unser Team sind alarmiert. Bleiben Sie, wenn möglich, wo Sie sind.',
    connected: 'Mit unserem Team verbunden — Antworten von AtoC Korea werden im Chat hervorgehoben.',
    failed: 'Senden fehlgeschlagen — rufen Sie oben 112/1330 an oder versuchen Sie es erneut.',
  },
  ru: {
    button: 'SOS — мне срочно нужна помощь',
    confirmTitle: 'Отправить SOS гиду и нашей команде?',
    consent: 'Ваше текущее местоположение будет приложено один раз (только для этого SOS), чтобы мы вас нашли.',
    note: 'Что случилось? (необязательно)',
    send: 'Отправить SOS',
    cancel: 'Отмена',
    sent: 'SOS отправлен — гид и наша команда предупреждены. Если безопасно, оставайтесь на месте.',
    connected: 'На связи с нашей командой — ответы AtoC Korea выделяются в чате.',
    failed: 'Не удалось отправить — позвоните по номерам 112/1330 выше или попробуйте снова.',
  },
  it: {
    button: 'SOS — ho bisogno di aiuto urgente',
    confirmTitle: 'Inviare un SOS alla guida e al nostro team?',
    consent: 'La tua posizione attuale verrà allegata una sola volta (solo per questo SOS) così possiamo raggiungerti.',
    note: 'Cos’è successo? (facoltativo)',
    send: 'Invia SOS',
    cancel: 'Annulla',
    sent: 'SOS inviato — la guida e il nostro team sono stati avvisati. Se sei al sicuro, resta dove sei.',
    connected: 'In contatto con il nostro team — le risposte di AtoC Korea sono evidenziate nella chat.',
    failed: 'Invio non riuscito — chiama il 112/1330 qui sopra o riprova.',
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

/**
 * 🔴 A1.6 — the alert must never wait on a permission dialog.
 *
 * `getCurrentPosition`'s own `timeout` explicitly EXCLUDES the time the user
 * spends deciding on the browser permission prompt, so a guest who has never
 * granted location (or who is staring at the SOS screen and never notices the
 * system dialog) could sit on a spinner forever — in an emergency, with the
 * alert still on the device. This wall-clock cap covers the prompt too.
 *
 * A fix that lands after the cap is dropped rather than sent late: the SOS
 * carries the position it had at send time and nothing else claims otherwise.
 */
const LOCATION_SEND_CAP_MS = 4_000;

function withCap<T>(promise: Promise<T | null>, capMs = LOCATION_SEND_CAP_MS): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: T | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), capMs);
    void promise.then((value) => {
      clearTimeout(timer);
      finish(value);
    });
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
  /**
   * The fix is requested when the consent sheet opens, not when [Send] is
   * tapped: the guest spends those seconds reading the consent line (and maybe
   * typing a note), so the permission prompt and the GPS acquisition overlap
   * with reading instead of delaying the alert. Nothing is transmitted unless
   * they press Send — cancelling still sends nothing.
   */
  const pendingLocation = useRef<Promise<{ latitude: number; longitude: number } | null> | null>(null);

  const openConfirm = () => {
    pendingLocation.current = currentPositionOnce();
    setState('confirm');
  };

  const send = async () => {
    setState('sending');
    try {
      const location = await withCap(pendingLocation.current ?? currentPositionOnce());
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
          <IconDone size={TR_ICON.meta} className="mt-0.5 shrink-0" aria-hidden />
          {copy.sent}
        </p>
        <p className="tr-label mt-1.5 flex items-center gap-1.5 font-semibold text-[var(--tr-safe)]" data-testid="sos-connected">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--tr-safe)] opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-[var(--tr-safe)]" />
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
                <IconEmergency size={TR_ICON.chip} aria-hidden />
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
      onClick={openConfirm}
      className="tr-card-text flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[var(--tr-danger)] font-bold text-white active:opacity-90"
      data-testid="sos-button"
    >
      <IconEmergency size={TR_ICON.chip} aria-hidden />
      {copy.button}
    </button>
  );
}
