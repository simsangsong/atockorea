'use client';

/**
 * W2.4 — guest one-tap SIGNAL chips (§D SIGNAL: no free text, 2 taps max).
 * Three fixed signals above the composer: running late (B6), rest stop (C2),
 * lost (E3 — attaches a one-shot location pin when the guest allows it).
 * Fires POST /signals; the server fans out the 5-locale capsule.
 */

import { useEffect, useState } from 'react';
import { useConfirmSheet } from '@/components/tour-mode/ConfirmSheet';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const COPY: Record<
  RoomLocale,
  {
    late: string;
    rest: string;
    lost: string;
    lostConfirm: string;
    sent: string;
    failed: string;
    pickup: string;
    pickupConfirm: string;
    drop: string;
    dropPrompt: string;
    ok: string;
    cancel: string;
  }
> = {
  en: {
    late: '🕒 Running late',
    rest: '🚻 Need a stop',
    lost: '🧭 I’m lost',
    lostConfirm: 'Share your current location with the guide once?',
    sent: 'Sent to your guide ✓',
    failed: 'Not sent — tell your guide in the chat below.',
    pickup: '🚕 Pick me up here',
    pickupConfirm: 'Share your current location once so the driver can come to you?',
    drop: '📍 Change drop-off',
    dropPrompt: 'Where would you like to be dropped off? (place name)',
    ok: 'Share',
    cancel: 'Cancel',
  },
  ko: {
    late: '🕒 늦어요',
    rest: '🚻 잠깐 서고 싶어요',
    lost: '🧭 길을 잃었어요',
    lostConfirm: '현재 위치를 가이드에게 1회 공유할까요?',
    sent: '가이드에게 전달됐어요 ✓',
    failed: '전달되지 않았어요 — 아래 채팅으로 알려주세요.',
    pickup: '🚕 여기로 픽업',
    pickupConfirm: '기사님이 올 수 있도록 현재 위치를 1회 공유할까요?',
    drop: '📍 드랍 변경',
    dropPrompt: '어디에서 내리고 싶으세요? (장소 이름)',
    ok: '공유',
    cancel: '취소',
  },
  ja: {
    late: '🕒 遅れています',
    rest: '🚻 少し止まりたい',
    lost: '🧭 道に迷いました',
    lostConfirm: '現在地をガイドに1回共有しますか?',
    sent: 'ガイドに送信しました ✓',
    failed: '送信できませんでした — 下のチャットでお知らせください。',
    pickup: '🚕 ここに迎えに来て',
    pickupConfirm: 'ドライバーが向かえるよう、現在地を1回共有しますか?',
    drop: '📍 降車地点を変更',
    dropPrompt: 'どこで降りたいですか？（場所の名前）',
    ok: '共有する',
    cancel: 'キャンセル',
  },
  es: {
    late: '🕒 Voy tarde',
    rest: '🚻 Necesito parar',
    lost: '🧭 Estoy perdido',
    lostConfirm: '¿Compartir tu ubicación actual con el guía una vez?',
    sent: 'Enviado a tu guía ✓',
    failed: 'No se envió — avisa a tu guía en el chat de abajo.',
    pickup: '🚕 Recógeme aquí',
    pickupConfirm: '¿Compartir tu ubicación una vez para que el conductor vaya por ti?',
    drop: '📍 Cambiar bajada',
    dropPrompt: '¿Dónde quieres bajarte? (nombre del lugar)',
    ok: 'Compartir',
    cancel: 'Cancelar',
  },
  zh: {
    late: '🕒 我会迟到',
    rest: '🚻 想停一下',
    lost: '🧭 我迷路了',
    lostConfirm: '向导游一次性共享当前位置?',
    sent: '已发送给导游 ✓',
    failed: '未能发送 — 请在下方聊天中告诉导游。',
    pickup: '🚕 来这里接我',
    pickupConfirm: '一次性共享当前位置，让司机来接您？',
    drop: '📍 更改下车点',
    dropPrompt: '您想在哪里下车？（地点名称）',
    ok: '共享',
    cancel: '取消',
  },
};

async function currentPosition(timeoutMs = 6000): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}

export default function QuickSignalBar({
  bookingId,
  roomSession,
  locale,
}: {
  bookingId: string;
  roomSession: string;
  locale: RoomLocale;
}) {
  const copy = COPY[locale];
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<'sent' | 'failed' | null>(null);
  // M1 — in-app confirm/prompt sheet (native dialogs banned on tour surfaces).
  const { confirm, prompt, sheet } = useConfirmSheet({ confirm: copy.ok, cancel: copy.cancel });

  const fire = async (
    type: 'running_late' | 'rest_stop' | 'lost' | 'pickup_request' | 'dropoff_change',
  ) => {
    setBusy(type);
    try {
      let coords: { lat: number; lng: number } | null = null;
      let note: string | null = null;
      if (type === 'lost' && (await confirm({ message: copy.lostConfirm }))) {
        coords = await currentPosition();
      }
      // A3 — "come get me HERE": the location IS the request.
      if (type === 'pickup_request') {
        if (!(await confirm({ message: copy.pickupConfirm }))) {
          setBusy(null);
          return;
        }
        coords = await currentPosition();
      }
      // A3 — drop-off change: the guest names the place (translated server-side).
      if (type === 'dropoff_change') {
        note = await prompt({ message: copy.dropPrompt, inputPlaceholder: copy.drop.replace('📍 ', '') });
        if (!note) {
          setBusy(null);
          return;
        }
      }
      const res = await fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/signals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': roomSession },
        body: JSON.stringify({ type, ...(coords ?? {}), ...(note ? { note } : {}) }),
      });
      // 🔴 A1.6 — a help signal that did not arrive must not look like one that
      // did. Saying nothing leaves the bar exactly as it was before the tap, so
      // a guest who pressed "I'm lost" walks away believing the guide knows.
      // The chat below IS the fallback — but only if we say so.
      setOutcome(res.ok ? 'sent' : 'failed');
    } catch {
      setOutcome('failed');
    } finally {
      setBusy(null);
    }
  };

  // The outcome line replaces the chips, so it has to clear itself. It used to
  // be derived from Date.now() in render with nothing scheduled to re-render,
  // which in a quiet room left "Sent ✓" up — and the chips unreachable —
  // until some unrelated update happened to arrive.
  useEffect(() => {
    if (!outcome) return;
    const timer = setTimeout(() => setOutcome(null), outcome === 'sent' ? 4000 : 6000);
    return () => clearTimeout(timer);
  }, [outcome]);

  return (
    <div className="mb-1.5 flex items-center gap-1.5 overflow-x-auto" data-testid="quick-signal-bar">
      {outcome ? (
        <span
          className={`tr-label px-1 py-1 font-semibold ${
            outcome === 'sent' ? 'text-[var(--tr-safe)]' : 'text-[var(--tr-danger)]'
          }`}
          aria-live="polite"
          data-testid={outcome === 'sent' ? 'quick-signal-sent' : 'quick-signal-failed'}
        >
          {outcome === 'sent' ? copy.sent : copy.failed}
        </span>
      ) : (
        (
          [
            ['running_late', copy.late],
            ['rest_stop', copy.rest],
            ['lost', copy.lost],
            ['pickup_request', copy.pickup],
            ['dropoff_change', copy.drop],
          ] as Array<
            ['running_late' | 'rest_stop' | 'lost' | 'pickup_request' | 'dropoff_change', string]
          >
        ).map(([type, label]) => (
          <button
            key={type}
            type="button"
            disabled={busy !== null}
            onClick={() => void fire(type)}
            className="tr-label tr-press shrink-0 rounded-full bg-[var(--tr-accent-soft)] px-3 py-1.5 font-semibold text-[var(--tr-accent-deep)] disabled:opacity-50"
            data-testid={`signal-${type}`}
          >
            {busy === type ? '…' : label}
          </button>
        ))
      )}
      {sheet}
    </div>
  );
}
