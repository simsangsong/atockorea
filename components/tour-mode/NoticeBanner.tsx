'use client';

/**
 * T6.3/T6.5 — traveller countdown banner for meeting notices and free-time
 * timers. Pinned above the tabs; ticks against the KST wall-clock target
 * (screen-return resync is inherent), pulses + vibrates at 10 and 5 minutes,
 * and speaks the warning when auto-read is on (device TTS only).
 * Presentation ladder (2026-07-22): hidden until T-10 → quiet banner (target
 * time, no ticking) until T-3 → live countdown from T-3.
 */

import { useEffect, useRef, useState } from 'react';
import { activeNotice, formatRemaining, formatTargetTime, noticeBannerMode, rallyStage } from '@/lib/tour-room/notices';
import { kakaoWebRouteUrl } from '@/lib/tour-room/nav-links';
import { IconFreeTime, IconMeeting, TR_ICON } from '@/components/tour-mode/icons';
import { OPS_PHONE } from '@/lib/tour-room/emergency';
import { speakWithDevice } from '@/lib/tour-room/tts';
import { useRoomClock } from '@/components/tour-mode/roomClock';
import { useTourRoomSettings } from '@/hooks/useTourRoomSettings';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const COPY: Record<
  RoomLocale,
  {
    meeting: string;
    freeTime: string;
    backBy: (t: string) => string;
    at: (p: string) => string;
    now: string;
    /**
     * The zero mark for the countdown capsule — a MARKER, not an instruction.
     * Kept to a few characters on purpose: this element is `shrink-0`, so
     * whatever goes in it takes width away from the text beside it. The
     * instruction itself lives on the rally line, where it can wrap.
     */
    nowShort: string;
    warn: (m: number) => string;
    waiting: string;
    contact: string;
    call: string;
    screenshot: string;
    map: string;
  }
> = {
  en: {
    meeting: 'Meeting time',
    freeTime: 'Free time',
    backBy: (t) => `Back by ${t}`,
    at: (p) => `at ${p}`,
    now: 'Please gather now',
    nowShort: 'NOW',
    warn: (m) => `${m} minutes left — please head back to the meeting point.`,
    waiting: 'The party is waiting — please head to the meeting point.',
    contact: 'Can’t make it? Contact your guide now.',
    call: 'Call',
    screenshot: 'Tip: screenshot this — it works with no signal.',
    map: 'Map',
  },
  ko: {
    meeting: '집합 시간',
    freeTime: '자유시간',
    backBy: (t) => `${t}까지 복귀`,
    at: (p) => `${p}에서`,
    now: '지금 모여주세요',
    nowShort: '지금',
    warn: (m) => `${m}분 남았어요 — 집합 장소로 이동해 주세요.`,
    waiting: '일행이 기다리고 있어요 — 집합 장소로 와주세요.',
    contact: '어려우면 지금 가이드에게 연락해 주세요.',
    call: '전화',
    screenshot: '팁: 이 화면을 스크린샷해 두면 신호가 없어도 볼 수 있어요.',
    map: '지도',
  },
  ja: {
    meeting: '集合時間',
    freeTime: '自由時間',
    backBy: (t) => `${t}までに戻る`,
    at: (p) => `${p}にて`,
    now: '今すぐお集まりください',
    nowShort: '今',
    warn: (m) => `残り${m}分です — 集合場所へお戻りください。`,
    waiting: '皆さまお待ちです — 集合場所へお越しください。',
    contact: '難しい場合は今すぐガイドへご連絡ください。',
    call: '電話',
    screenshot: 'ヒント: この画面をスクショしておくと圏外でも確認できます。',
    map: '地図',
  },
  es: {
    meeting: 'Hora de reunión',
    freeTime: 'Tiempo libre',
    backBy: (t) => `Regreso a las ${t}`,
    at: (p) => `en ${p}`,
    now: 'Reúnanse ahora, por favor',
    nowShort: 'YA',
    warn: (m) => `Quedan ${m} minutos — vuelve al punto de encuentro.`,
    waiting: 'El grupo está esperando; ve al punto de encuentro.',
    contact: '¿No puedes llegar? Contacta a tu guía ahora.',
    call: 'Llamar',
    screenshot: 'Consejo: haz captura — funciona sin señal.',
    map: 'Mapa',
  },
  zh: {
    meeting: '集合时间',
    freeTime: '自由活动',
    backBy: (t) => `${t}前返回`,
    at: (p) => `地点：${p}`,
    now: '请现在集合',
    nowShort: '现在',
    warn: (m) => `还剩${m}分钟 — 请返回集合地点。`,
    waiting: '同行者正在等待——请前往集合地点。',
    contact: '赶不到?请立即联系导游。',
    call: '致电',
    screenshot: '提示: 截图保存此画面——无信号也能查看。',
    map: '地图',
  },
  'zh-TW': {
    meeting: '集合時間',
    freeTime: '自由活動',
    backBy: (t) => `${t}前返回`,
    at: (p) => `地點：${p}`,
    now: '請現在集合',
    nowShort: '現在',
    warn: (m) => `還剩${m}分鐘——請返回集合地點。`,
    waiting: '同行夥伴正在等候——請前往集合地點。',
    contact: '趕不上嗎？請立即聯絡導遊。',
    call: '撥打',
    screenshot: '提示：把這個畫面截圖存起來——沒有訊號也能查看。',
    map: '地圖',
  },
  fr: {
    meeting: 'Heure de rendez-vous',
    freeTime: 'Temps libre',
    backBy: (t) => `Retour pour ${t}`,
    at: (p) => `à ${p}`,
    now: 'Merci de vous rassembler maintenant',
    nowShort: 'MAINT.',
    warn: (m) => `Plus que ${m} minutes — rejoignez le point de rendez-vous.`,
    waiting: 'Le groupe vous attend — rejoignez le point de rendez-vous.',
    contact: 'Un empêchement? Contactez votre guide maintenant.',
    call: 'Appeler',
    screenshot: 'Astuce: faites une capture d’écran — elle reste lisible sans réseau.',
    map: 'Carte',
  },
  de: {
    meeting: 'Treffzeit',
    freeTime: 'Freizeit',
    backBy: (t) => `Zurück bis ${t}`,
    at: (p) => `Treffpunkt: ${p}`,
    now: 'Bitte jetzt zum Treffpunkt kommen',
    nowShort: 'JETZT',
    warn: (m) => `Noch ${m} Minuten — bitte zurück zum Treffpunkt.`,
    waiting: 'Die Gruppe wartet — bitte kommen Sie zum Treffpunkt.',
    contact: 'Sie schaffen es nicht? Kontaktieren Sie jetzt Ihren Guide.',
    call: 'Anrufen',
    screenshot: 'Tipp: Machen Sie einen Screenshot — er funktioniert auch ohne Empfang.',
    map: 'Karte',
  },
  ru: {
    meeting: 'Время сбора',
    freeTime: 'Свободное время',
    backBy: (t) => `Вернуться к ${t}`,
    at: (p) => `Место сбора: ${p}`,
    now: 'Подойдите к месту сбора',
    nowShort: 'СЕЙЧАС',
    warn: (m) => `Осталось ${m} мин — возвращайтесь к месту сбора.`,
    waiting: 'Группа ждет — подойдите к месту сбора.',
    contact: 'Не успеваете? Свяжитесь с гидом прямо сейчас.',
    call: 'Позвонить',
    screenshot: 'Совет: сделайте скриншот — он работает и без связи.',
    map: 'Карта',
  },
  it: {
    meeting: 'Orario di ritrovo',
    freeTime: 'Tempo libero',
    backBy: (t) => `Rientro entro le ${t}`,
    at: (p) => `presso ${p}`,
    now: 'Radunatevi ora, per favore',
    nowShort: 'ORA',
    warn: (m) => `Mancano ${m} minuti — torna al punto di ritrovo.`,
    waiting: 'Il gruppo ti sta aspettando — vai al punto di ritrovo.',
    contact: 'Non ce la fai? Contatta subito la guida.',
    call: 'Chiama',
    screenshot: 'Consiglio: fai uno screenshot — funziona anche senza segnale.',
    map: 'Mappa',
  },
};

/**
 * Exported for the standing gate (noticeBannerZero.test). The capsule length
 * rule is a property of the COPY itself, so the test reads the data rather
 * than rendering ten locales to measure pixels it cannot measure in jsdom.
 */
export const NOTICE_COPY_FOR_TEST = COPY;

export default function NoticeBanner({
  messages,
  tourDate,
  locale,
  bookingId,
  roomSession,
  canSignal = false,
  viewerRole = 'customer',
  heroOwnsCountdown = false,
}: {
  messages: RoomMessage[];
  tourDate: string | null | undefined;
  locale: RoomLocale;
  /** With a session, the banner fires the E2 overdue signal (W2.3, P-D6). */
  bookingId?: string;
  roomSession?: string | null;
  canSignal?: boolean;
  /** M-D2 — staff open the gather pin in Kakao (car route), guests in Google. */
  viewerRole?: string;
  /**
   * SG-1e — true while the viewer is a guest LOOKING at the home tab, where
   * the hero's numeral may already be this notice's clock. The banner still
   * decides per-notice whether to yield; the parent only says where the
   * guest is looking.
   */
  heroOwnsCountdown?: boolean;
}) {
  // SG-0c — the room's corrected clock; device clock only outside a provider.
  const roomNow = useRoomClock();
  const [nowMs, setNowMs] = useState(() => roomNow());
  const { settings } = useTourRoomSettings();
  const warnedRef = useRef<{ id: string | null; warned10: boolean; warned5: boolean }>({
    id: null,
    warned10: false,
    warned5: false,
  });
  const overdueFiredRef = useRef<string | null>(null);

  const notice = activeNotice(messages, tourDate, nowMs);
  const copy = COPY[locale];
  const stage = rallyStage(notice, nowMs);
  const mode = noticeBannerMode(notice);

  /**
   * SG-1e — one target, one clock on screen. The capsule yields ONLY when
   * the home hero's numeral reads this very notice: a running free-time
   * countdown, or a meeting rally from overdue on (the hero enters rally at
   * T+5 — SG-2d keeps 'due' quiet on purpose). In every other combination
   * the capsule stays, because there the banner IS the only rally clock —
   * suppressing it under a moving/arrived hero was v1.2's over-suppression
   * finding (2차 감사 #6). Kill switch: the parent passes false when
   * NEXT_PUBLIC_TR_NUMERAL_V1 is off, restoring today's banner everywhere.
   */
  const heroReadsThisClock =
    !!notice &&
    !notice.cancelled &&
    notice.targetMs !== null &&
    (notice.kind === 'free_time_timer'
      ? notice.remainingMs !== null && notice.remainingMs > 0
      : stage === 'overdue' || stage === 'contact');
  const suppressCountdown = heroOwnsCountdown && heroReadsThisClock;

  // A1.2 — adaptive tick. The banner is 'hidden' for most of the tour day, so
  // ticking every second while drawing nothing was pure battery/render waste
  // (the discipline DepartureCountdown already had). `now` must still advance to
  // detect the time-based transitions, so tick coarsely when hidden/quiet and
  // only at 1s during the live seconds-countdown; resync on tab return.
  useEffect(() => {
    const tick = () => setNowMs(roomNow());
    const period = mode === 'countdown' ? 1_000 : mode === 'quiet' ? 15_000 : 30_000;
    const timer = setInterval(tick, period);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [mode, roomNow]);

  // W2.3 / P-D6 — the T+5 crossing fires exactly one room-wide event: every
  // customer client attempts it, the server's UNIQUE(subject_key) dedupes.
  useEffect(() => {
    if (!canSignal || !bookingId || !roomSession || !notice || notice.cancelled) return;
    if (stage !== 'overdue' && stage !== 'contact') return;
    if (overdueFiredRef.current === notice.messageId) return;
    overdueFiredRef.current = notice.messageId;
    void fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': roomSession },
      body: JSON.stringify({ type: 'rally_overdue', noticeId: notice.messageId }),
    }).catch(() => undefined);
  }, [canSignal, bookingId, roomSession, notice, stage]);

  // 10/5-minute warnings — once each per notice (T6.5).
  useEffect(() => {
    if (!notice || notice.cancelled || notice.remainingMs === null) return;
    if (warnedRef.current.id !== notice.messageId) {
      warnedRef.current = { id: notice.messageId, warned10: false, warned5: false };
    }
    const fire = (minutes: 10 | 5) => {
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {
        /* unsupported */
      }
      if (settings.autoRead && document.visibilityState === 'visible') {
        void speakWithDevice(copy.warn(minutes), locale);
      }
    };
    if (notice.warn5 && !warnedRef.current.warned5) {
      warnedRef.current.warned5 = true;
      warnedRef.current.warned10 = true; // 5min implies 10min already passed
      fire(5);
    } else if (notice.warn10 && !warnedRef.current.warned10) {
      warnedRef.current.warned10 = true;
      fire(10);
    }
  }, [notice, settings.autoRead, locale, copy]);

  // Presentation ladder (user decision 2026-07-22): hidden until T-10 — the
  // T-10/T-5 nudge effects above still run — quiet (no ticking) until T-3,
  // then the live countdown. A cancel capsule keeps its brief quiet banner.
  if (!notice || notice.cancelled || mode === 'hidden') return null;

  const urgent = notice.warn5 || (notice.remainingMs !== null && notice.remainingMs === 0);
  const title = notice.kind === 'free_time_timer' ? copy.freeTime : copy.meeting;
  // T2-2 — the operator's place name, translated into the viewer's language.
  const displayPoint = notice.pointI18n?.[locale] ?? notice.point;

  // U5.4 — a floating overlay pill (rendered in the shell's overlay zone):
  // flat surface + one accent; when urgent only the countdown capsule pulses,
  // not the whole banner.
  return (
    <div
      data-testid="notice-banner"
      className="tr-anim-panel-in mb-2 flex items-center gap-3 rounded-[var(--tr-radius-card)] bg-[var(--tr-surface)] px-4 py-2.5"
      style={{ boxShadow: 'var(--tr-shadow-overlay)' }}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          urgent ? 'bg-[var(--tr-danger-soft)] text-[var(--tr-danger)]' : 'bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)]'
        }`}
        aria-hidden
      >
        {notice.kind === 'free_time_timer' ? <IconFreeTime size={TR_ICON.chip} /> : <IconMeeting size={TR_ICON.chip} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`tr-card-text font-semibold ${urgent ? 'text-[var(--tr-danger)]' : 'text-[var(--tr-ink)]'}`}>
          {title}
          {notice.targetMs !== null && ` · ${copy.backBy(formatTargetTime(notice.targetMs, locale))}`}
        </p>
        {(displayPoint || (notice.lat !== null && notice.lng !== null)) && (
          <p className="tr-label truncate text-[var(--tr-ink-2)]">
            {displayPoint ? copy.at(displayPoint) : ''}
            {notice.lat !== null && notice.lng !== null && (
              <a
                href={
                  viewerRole === 'guide' || viewerRole === 'driver' || viewerRole === 'admin'
                    ? kakaoWebRouteUrl({ lat: notice.lat, lng: notice.lng, name: displayPoint ?? undefined })
                    : `https://maps.google.com/?q=${notice.lat},${notice.lng}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1.5 whitespace-nowrap font-semibold text-[var(--tr-accent-deep)] underline"
                data-testid="notice-map-link"
              >
                📍 {copy.map}
              </a>
            )}
          </p>
        )}
        {mode === 'quiet' && stage !== 'overdue' && stage !== 'contact' && (
          // W4.2 / E5 — dead-battery / no-signal insurance while there's time
          // (the quiet T-10..T-3 window is the last calm moment to screenshot).
          <p data-testid="screenshot-hint" className="tr-meta mt-0.5 text-[var(--tr-ink-3)]">
            {copy.screenshot}
          </p>
        )}
        {(stage === 'overdue' || stage === 'contact') && (
          <p data-testid="rally-stage-line" className="tr-label mt-0.5 font-semibold text-[var(--tr-danger)]">
            {stage === 'overdue' ? copy.waiting : copy.contact}
            {/* The env behind this was never set, so the call chip on the rally
                escalation — the exact moment a guest has lost the group and is
                being told to phone someone — never rendered. */}
            {stage === 'contact' && OPS_PHONE && (
              <a
                href={`tel:${OPS_PHONE}`}
                className="ml-2 rounded-full bg-[var(--tr-danger)] px-2.5 py-0.5 font-bold text-white"
              >
                {copy.call}
              </a>
            )}
          </p>
        )}
      </div>
      {mode === 'countdown' && notice.remainingMs !== null && !suppressCountdown && (
        <span
          data-testid="notice-countdown"
          /* text-cjk-safe + a width cap so a long localized marker can never
             again take the text column’s space (the 2026-07-29 report). */
          className={`tr-title tr-num tr-anim-panel-in text-cjk-safe max-w-[38%] shrink-0 rounded-full px-3 py-1.5 font-bold text-white ${
            urgent ? 'animate-pulse bg-[var(--tr-danger)]' : 'bg-[var(--tr-accent)]'
          }`}
        >
          {notice.remainingMs === 0 ? copy.nowShort : formatRemaining(notice.remainingMs)}
        </span>
      )}
    </div>
  );
}
