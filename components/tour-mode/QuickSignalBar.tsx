'use client';

/**
 * W2.4 — guest one-tap SIGNAL chips (§D SIGNAL: no free text, 2 taps max).
 * Three fixed signals above the composer: running late (B6), rest stop (C2),
 * lost (E3 — attaches a one-shot location pin when the guest allows it).
 * Fires POST /signals; the server fans out the 5-locale capsule.
 */

import { useEffect, useRef, useState } from 'react';
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
    meet: string;
    meetConfirm: string;
    photoAsk: string;
    photoCaption: string;
    skip: string;
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
    meet: '📍 Meet me here',
    meetConfirm: 'Send your exact location so your driver can navigate right to you?',
    photoAsk: 'Add one photo of this spot',
    photoCaption: '📍 What I can see from here',
    skip: 'Skip',
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
    meet: '📍 여기서 만나요',
    meetConfirm: '기사님이 바로 내비로 찾아올 수 있게 정확한 위치를 보낼까요?',
    photoAsk: '보이는 풍경 사진 1장 더하기',
    photoCaption: '📍 지금 여기서 보이는 풍경이에요',
    skip: '건너뛰기',
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
    meet: '📍 ここで会いましょう',
    meetConfirm: 'ドライバーがナビで直行できるよう、正確な現在地を送信しますか?',
    photoAsk: '見えている景色を1枚追加',
    photoCaption: '📍 いまここから見える景色です',
    skip: 'スキップ',
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
    meet: '📍 Encuéntrame aquí',
    meetConfirm: '¿Enviar tu ubicación exacta para que el conductor navegue hasta ti?',
    photoAsk: 'Añadir una foto del lugar',
    photoCaption: '📍 Esto es lo que veo desde aquí',
    skip: 'Omitir',
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
    meet: '📍 在这里见面',
    meetConfirm: '发送您的准确位置，让司机直接导航到您身边？',
    photoAsk: '再拍一张眼前的照片',
    photoCaption: '📍 这是我现在看到的景象',
    skip: '跳过',
  },
  fr: {
    late: '🕒 J’arrive en retard',
    rest: '🚻 Besoin d’une pause',
    lost: '🧭 Je suis perdu',
    lostConfirm: 'Partager une fois votre position actuelle avec le guide?',
    sent: 'Envoyé à votre guide ✓',
    failed: 'Non envoyé — prévenez votre guide dans le chat ci-dessous.',
    pickup: '🚕 Venez me chercher ici',
    pickupConfirm: 'Partager une fois votre position pour que le chauffeur vienne à vous?',
    drop: '📍 Changer la dépose',
    dropPrompt: 'Où souhaitez-vous descendre? (nom du lieu)',
    ok: 'Partager',
    cancel: 'Annuler',
  },
  de: {
    late: '🕒 Ich verspäte mich',
    rest: '🚻 Kurze Pause nötig',
    lost: '🧭 Ich habe mich verlaufen',
    lostConfirm: 'Ihren aktuellen Standort einmalig mit dem Guide teilen?',
    sent: 'An Ihren Guide gesendet ✓',
    failed: 'Nicht gesendet — sagen Sie Ihrem Guide unten im Chat Bescheid.',
    pickup: '🚕 Holen Sie mich hier ab',
    pickupConfirm: 'Standort einmalig teilen, damit der Fahrer zu Ihnen kommt?',
    drop: '📍 Ausstieg ändern',
    dropPrompt: 'Wo möchten Sie aussteigen? (Name des Ortes)',
    ok: 'Teilen',
    cancel: 'Abbrechen',
  },
  ru: {
    late: '🕒 Я опаздываю',
    rest: '🚻 Нужна остановка',
    lost: '🧭 Я потерялся',
    lostConfirm: 'Один раз поделиться текущим местоположением с гидом?',
    sent: 'Отправлено гиду ✓',
    failed: 'Не отправлено — напишите гиду в чате ниже.',
    pickup: '🚕 Заберите меня здесь',
    pickupConfirm: 'Поделиться местоположением один раз, чтобы водитель подъехал к вам?',
    drop: '📍 Изменить место высадки',
    dropPrompt: 'Где вы хотите выйти? (название места)',
    ok: 'Поделиться',
    cancel: 'Отмена',
  },
  it: {
    late: '🕒 Sono in ritardo',
    rest: '🚻 Mi serve una sosta',
    lost: '🧭 Mi sono perso',
    lostConfirm: 'Condividere una volta la tua posizione con la guida?',
    sent: 'Inviato alla tua guida ✓',
    failed: 'Non inviato — avvisa la guida nella chat qui sotto.',
    pickup: '🚕 Vieni a prendermi qui',
    pickupConfirm: 'Condividere la posizione una volta così l’autista viene da te?',
    drop: '📍 Cambia punto di discesa',
    dropPrompt: 'Dove vuoi scendere? (nome del luogo)',
    ok: 'Condividi',
    cancel: 'Annulla',
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
  // M-D4 — after the exact-location pin lands, ONE photo makes the spot
  // unmistakable. The camera input opens right away; skipping is fine — the
  // pin is already sent either way.
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [photoAsk, setPhotoAsk] = useState(false);
  // M1 — in-app confirm/prompt sheet (native dialogs banned on tour surfaces).
  const { confirm, prompt, sheet } = useConfirmSheet({ confirm: copy.ok, cancel: copy.cancel });

  const sendPhoto = async (file: File) => {
    try {
      const form = new FormData();
      form.append('attachment', file);
      form.append('caption', copy.photoCaption);
      await fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/messages`, {
        method: 'POST',
        headers: { 'x-tour-room-auth': roomSession },
        body: form,
      });
    } catch {
      /* the pin already went out — the photo is best-effort */
    }
  };

  const fire = async (
    type: 'running_late' | 'rest_stop' | 'lost' | 'pickup_request' | 'dropoff_change' | 'share_location',
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
      // M-D4 — "meet me exactly here": pin + (optional) one photo.
      if (type === 'share_location') {
        if (!(await confirm({ message: copy.meetConfirm }))) {
          setBusy(null);
          return;
        }
        coords = await currentPosition();
        if (!coords) {
          setOutcome('failed');
          setBusy(null);
          return;
        }
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
      // M-D4 — pin delivered → offer the one photo that nails the spot.
      if (res.ok && type === 'share_location') {
        setPhotoAsk(true);
        photoInputRef.current?.click();
      }
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
          className={`tr-label shrink-0 whitespace-nowrap px-1 py-1 font-semibold ${
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
            ['share_location', copy.meet],
            ['running_late', copy.late],
            ['rest_stop', copy.rest],
            ['lost', copy.lost],
            ['pickup_request', copy.pickup],
            ['dropoff_change', copy.drop],
          ] as Array<
            [
              'share_location' | 'running_late' | 'rest_stop' | 'lost' | 'pickup_request' | 'dropoff_change',
              string,
            ]
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
      {/* M-D4 — the one-photo follow-up. capture=environment opens the rear
          camera directly on phones; picking a photo sends it through the
          normal attachment pipeline with a 5-locale caption. */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        data-testid="meet-photo-input"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          e.target.value = '';
          setPhotoAsk(false);
          if (file) void sendPhoto(file);
        }}
      />
      {/* iOS Safari may refuse a programmatic input.click() this long after
          the tap gesture — the hint doubles as the manual (re)open button, so
          the photo path never dead-ends. */}
      {photoAsk && !outcome && (
        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          className="tr-meta tr-press shrink-0 rounded-full bg-[var(--tr-surface-2)] px-3 py-1.5 font-semibold text-[var(--tr-ink)]"
          data-testid="meet-photo-hint"
        >
          📷 {copy.photoAsk}
        </button>
      )}
      {sheet}
    </div>
  );
}
