'use client';

/**
 * M-D5 (docs/meet-exactly-master-plan-2026-07-27.md) — private-tour guests SET
 * the meeting themselves: the day before (pickup time/place) or mid-tour at a
 * spot ("한 시간 뒤 여기서"). One form: HH:MM + place name and/or the current
 * location as a one-shot pin (default ON — the pin is what the driver's
 * KakaoNavi eats).
 *
 * Fires POST /signals { type: 'meeting_propose' } — the server writes the
 * guide-grade meeting_notice metadata, so the countdown banner, the 10/5-min
 * warnings and the rally ladder run for everyone with zero new plumbing.
 * Join tours never see this card (isPrivate gate at the mount) and the server
 * refuses them regardless (403 private_tour_only).
 */

import { useState } from 'react';
import { IconArrived, IconDone, IconMeeting, TR_ICON } from '@/components/tour-mode/icons';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const COPY: Record<
  RoomLocale,
  {
    title: string;
    hint: string;
    time: string;
    place: string;
    placePh: string;
    usePin: string;
    submit: string;
    sent: string;
    failed: string;
    needPlace: string;
  }
> = {
  en: {
    title: 'Set the meeting',
    hint: 'Your tour, your call — pick a time and where to meet. Your driver gets it as a navigable pin.',
    time: 'Time',
    place: 'Place',
    placePh: 'e.g. hotel lobby, Cartier on 1F…',
    usePin: 'Attach my current location as the pin',
    submit: 'Send to driver & guide',
    sent: 'Meeting set — your driver has the pin ✓',
    failed: 'Not sent — please try again or use the chat.',
    needPlace: 'Add a place name or keep the location pin on.',
  },
  ko: {
    title: '만남 정하기',
    hint: '프라이빗 투어는 손님이 정해요 — 시간과 장소를 고르면 기사님에게 내비 핀으로 전달돼요.',
    time: '시간',
    place: '장소',
    placePh: '예: 호텔 로비, 1층 까르띠에 앞…',
    usePin: '지금 내 위치를 핀으로 함께 보내기',
    submit: '기사·가이드에게 보내기',
    sent: '만남이 정해졌어요 — 기사님에게 핀이 전달됐어요 ✓',
    failed: '전송되지 않았어요 — 다시 시도하거나 채팅으로 알려주세요.',
    needPlace: '장소 이름을 적거나 위치 핀을 켜 주세요.',
  },
  ja: {
    title: '待ち合わせを設定',
    hint: 'プライベートツアーはお客様が決めます — 時間と場所を選ぶと、ドライバーにナビ用ピンで届きます。',
    time: '時間',
    place: '場所',
    placePh: '例: ホテルロビー、1階カルティエ前…',
    usePin: '現在地をピンとして一緒に送る',
    submit: 'ドライバー・ガイドに送る',
    sent: '待ち合わせを設定しました — ドライバーにピンが届きました ✓',
    failed: '送信できませんでした — もう一度試すか、チャットでお知らせください。',
    needPlace: '場所名を入力するか、位置ピンをオンにしてください。',
  },
  es: {
    title: 'Fijar el encuentro',
    hint: 'En un tour privado decides tú: elige hora y lugar, y tu conductor lo recibe como pin navegable.',
    time: 'Hora',
    place: 'Lugar',
    placePh: 'p. ej. lobby del hotel, Cartier en la 1.ª planta…',
    usePin: 'Adjuntar mi ubicación actual como pin',
    submit: 'Enviar al conductor y guía',
    sent: 'Encuentro fijado: tu conductor ya tiene el pin ✓',
    failed: 'No se envió; inténtalo de nuevo o usa el chat.',
    needPlace: 'Escribe un lugar o deja activado el pin de ubicación.',
  },
  zh: {
    title: '确定见面安排',
    hint: '私人团由您决定——选好时间和地点，司机会收到可导航的定位图钉。',
    time: '时间',
    place: '地点',
    placePh: '例如：酒店大堂、1楼卡地亚门前…',
    usePin: '同时发送我当前位置的图钉',
    submit: '发送给司机和导游',
    sent: '见面安排已确定——司机已收到定位 ✓',
    failed: '未能发送——请重试或在聊天中告知。',
    needPlace: '请填写地点名称，或保持位置图钉开启。',
  },
  fr: {
    title: 'Fixer le rendez-vous',
    hint: 'Votre tour, votre choix — choisissez l’heure et le lieu. Votre chauffeur reçoit un repère navigable.',
    time: 'Heure',
    place: 'Lieu',
    placePh: 'ex. hall de l’hôtel, devant Cartier au 1er…',
    usePin: 'Joindre ma position actuelle comme repère',
    submit: 'Envoyer au chauffeur et au guide',
    sent: 'Rendez-vous fixé — votre chauffeur a le repère ✓',
    failed: 'Non envoyé — réessayez ou passez par le chat.',
    needPlace: 'Indiquez un lieu ou laissez le repère de position activé.',
  },
  de: {
    title: 'Treffen festlegen',
    hint: 'Ihre Tour, Ihre Entscheidung — wählen Sie Zeit und Ort. Ihr Fahrer erhält einen navigierbaren Pin.',
    time: 'Uhrzeit',
    place: 'Ort',
    placePh: 'z. B. Hotellobby, vor Cartier im 1. OG…',
    usePin: 'Meinen aktuellen Standort als Pin anhängen',
    submit: 'An Fahrer & Guide senden',
    sent: 'Treffen festgelegt — Ihr Fahrer hat den Pin ✓',
    failed: 'Nicht gesendet — bitte erneut versuchen oder den Chat nutzen.',
    needPlace: 'Geben Sie einen Ort an oder lassen Sie den Standort-Pin aktiviert.',
  },
  ru: {
    title: 'Назначить встречу',
    hint: 'Ваш тур — вам решать: выберите время и место, водитель получит точку для навигатора.',
    time: 'Время',
    place: 'Место',
    placePh: 'напр.: лобби отеля, у Cartier на 1-м этаже…',
    usePin: 'Приложить мое текущее местоположение',
    submit: 'Отправить водителю и гиду',
    sent: 'Встреча назначена — у водителя есть точка ✓',
    failed: 'Не отправлено — попробуйте снова или напишите в чат.',
    needPlace: 'Укажите место или оставьте включенной точку местоположения.',
  },
  it: {
    title: 'Fissa il ritrovo',
    hint: 'Il tour è tuo, decidi tu — scegli ora e luogo. L’autista riceve un pin navigabile.',
    time: 'Ora',
    place: 'Luogo',
    placePh: 'es. lobby dell’hotel, davanti a Cartier al 1° piano…',
    usePin: 'Allega la mia posizione attuale come pin',
    submit: 'Invia ad autista e guida',
    sent: 'Ritrovo fissato — l’autista ha il pin ✓',
    failed: 'Non inviato — riprova o usa la chat.',
    needPlace: 'Scrivi un luogo o lascia attivo il pin della posizione.',
  },
};

async function currentPosition(timeoutMs = 8000): Promise<{ lat: number; lng: number } | null> {
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

export default function MeetSetCard({
  bookingId,
  roomSession,
  locale,
}: {
  bookingId: string;
  roomSession: string;
  locale: RoomLocale;
}) {
  const copy = COPY[locale];
  const [time, setTime] = useState('');
  const [place, setPlace] = useState('');
  const [usePin, setUsePin] = useState(true);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<'idle' | 'sent' | 'failed' | 'need_place'>('idle');

  const submit = async () => {
    if (!time || busy) return;
    if (!place.trim() && !usePin) {
      setState('need_place');
      return;
    }
    setBusy(true);
    setState('idle');
    try {
      const coords = usePin ? await currentPosition() : null;
      if (!place.trim() && !coords) {
        // The pin was the only place info and GPS failed — surface it, don't
        // send a meeting with nowhere to navigate to.
        setState('need_place');
        return;
      }
      const res = await fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/signals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': roomSession },
        body: JSON.stringify({
          type: 'meeting_propose',
          time,
          ...(place.trim() ? { point: place.trim() } : {}),
          ...(coords ?? {}),
        }),
      });
      setState(res.ok ? 'sent' : 'failed');
    } catch {
      setState('failed');
    } finally {
      setBusy(false);
    }
  };

  if (state === 'sent') {
    return (
      <div className="tr-card mb-3 flex items-center gap-2.5 border border-[var(--tr-hairline)] px-4 py-3.5" data-testid="meet-set-sent">
        <IconDone size={TR_ICON.action} className="shrink-0 text-[var(--tr-safe)]" aria-hidden />
        <p className="tr-card-text text-cjk-body font-medium text-[var(--tr-ink)]">{copy.sent}</p>
      </div>
    );
  }

  return (
    <div className="tr-card mb-3 border border-[var(--tr-hairline)] px-4 py-3.5" data-testid="meet-set-card">
      <p className="tr-card-text flex items-center gap-1.5 font-semibold text-[var(--tr-ink)]">
        <IconMeeting size={TR_ICON.chip} className="text-[var(--tr-accent-deep)]" aria-hidden />
        {copy.title}
      </p>
      <p className="tr-meta text-cjk-body mt-1 leading-relaxed text-[var(--tr-ink-2)]">{copy.hint}</p>

      <div className="mt-2.5 flex gap-2">
        <label className="shrink-0">
          <span className="tr-meta block font-semibold text-[var(--tr-ink-2)]">{copy.time}</span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="tr-card-text mt-1 w-28 rounded-[var(--tr-radius-input)] border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 py-2 text-[var(--tr-ink)]"
            data-testid="meet-set-time"
          />
        </label>
        <label className="min-w-0 flex-1">
          <span className="tr-meta block font-semibold text-[var(--tr-ink-2)]">{copy.place}</span>
          <input
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            maxLength={120}
            placeholder={copy.placePh}
            className="tr-card-text mt-1 w-full rounded-[var(--tr-radius-input)] border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-2 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:border-[var(--tr-accent)] focus:outline-none"
            data-testid="meet-set-place"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={() => setUsePin((v) => !v)}
        aria-pressed={usePin}
        className={`tr-label mt-2 flex min-h-[40px] w-full items-center gap-2 rounded-xl px-3 text-left font-medium ${
          usePin
            ? 'bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)]'
            : 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]'
        }`}
        data-testid="meet-set-pin-toggle"
      >
        <IconArrived size={TR_ICON.chip} className="shrink-0" aria-hidden />
        <span className="text-cjk-body min-w-0 flex-1">{copy.usePin}</span>
        {usePin && <IconDone size={TR_ICON.chip} className="shrink-0" aria-hidden />}
      </button>

      {state === 'need_place' && (
        <p className="tr-label mt-2 rounded-xl bg-[var(--tr-danger-soft)] px-3 py-2 font-medium text-[var(--tr-danger)]">
          {copy.needPlace}
        </p>
      )}
      {state === 'failed' && (
        <p className="tr-label mt-2 rounded-xl bg-[var(--tr-danger-soft)] px-3 py-2 font-medium text-[var(--tr-danger)]" data-testid="meet-set-failed">
          {copy.failed}
        </p>
      )}

      <button
        type="button"
        disabled={!time || busy}
        onClick={() => void submit()}
        className="tr-label text-cjk-safe mt-2.5 flex min-h-[46px] w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--tr-accent)] px-4 font-bold text-[var(--tr-bubble-me-ink)] disabled:opacity-40"
        data-testid="meet-set-submit"
      >
        {busy ? '…' : copy.submit}
      </button>
    </div>
  );
}
