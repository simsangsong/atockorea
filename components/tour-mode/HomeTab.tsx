'use client';

/**
 * H2 — the room's home dashboard: the "app entrance" the guest lands on.
 *
 *   ┌ status card — lifecycle-aware (lobby: D-day/pickup via LobbyCard,
 *   │               live: now/next stop + vehicle, ended: recap pointer)
 *   ├ chat preview row — latest bubble + unread echo, one tap to the feed
 *   ├ feature grid (3-col launcher) — every tile opens an EXISTING surface:
 *   │   shell sheets (Smart Guide, emergency), shell tabs (chat/map/schedule),
 *   │   local sheets (pickup, quick signals, travel timeline), or links
 *   │   (/plan D-1 editor, review). No new capabilities, only new entrances.
 *   └ "more" row — overflow sheet (settings & language, review)
 *
 * Customers only — guides/drivers keep their chat-first / console surfaces.
 * All copy is static 5-locale, zero LLM, renders from the join snapshot.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import InstallCard from '@/components/tour-mode/InstallCard';
import LobbyCard from '@/components/tour-mode/LobbyCard';
import NowCard, { type NowCardHandlers } from '@/components/tour-mode/NowCard';
import { nowCard, roomNowCardContext } from '@/lib/tour-room/nowCard';
import { useRoomClock } from '@/components/tour-mode/roomClock';
import { orderHomeTiles, PEEK_COUNT, type HomeTileKey } from '@/lib/tour-room/homeTileOrder';
import { OPS_PHONE } from '@/lib/tour-room/emergency';
import { firstPickup, vehicleLineFromPayload } from '@/components/tour-mode/LobbyCard';
import MeetSetCard from '@/components/tour-mode/MeetSetCard';
import QuickSignalBar from '@/components/tour-mode/QuickSignalBar';
import VehicleLocationCard from '@/components/tour-mode/map/VehicleLocationCard';
import Sheet from '@/components/tour-mode/Sheet';
import AppManual from '@/components/tour-mode/AppManual';
import type { ManualKind } from '@/lib/tour-room/appManual';
import { TravelTimelineSheet } from '@/components/tour-mode/TravelTimeline';
import { currentScheduleIndex, type RoomShellHomeApi } from '@/components/tour-mode/RoomShell';
import { buildTravelTimeline } from '@/lib/tour-room/timeline';
import {
  IconChevronRight,
  IconConcierge,
  IconJourney,
  IconMore,
  IconPickup,
  IconPlanEdit,
  IconQuickReply,
  IconReview,
  IconTabChat,
  IconTabSettings,
  IconTileChat,
  IconTileMap,
  IconTilePickup,
  IconTileSchedule,
  IconTileSos,
  TR_ICON,
  TR_STROKE,
} from '@/components/tour-mode/icons';
import type { RoomLocale } from '@/lib/tour-room/snapshot';
import type { RoomReviewPolicy } from '@/lib/tour-room/reviewPolicy';
import type { VehicleLocationLike } from '@/lib/tour-room/vehicleEta';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

interface ScheduleItem {
  time?: string;
  title?: string;
  name?: string;
  [key: string]: unknown;
}

const COPY: Record<
  RoomLocale,
  {
    now: string;
    next: string;
    first: string;
    liveFallback: string;
    vehicle: string;
    endedTitle: string;
    endedBody: string;
    chatTitle: string;
    chatEmpty: string;
    signalHint: string;
    more: string;
    settingsRow: string;
    reviewRow: string;
    close: string;
    tiles: {
      smartGuide: string;
      chat: string;
      schedule: string;
      map: string;
      pickup: string;
      signal: string;
      timeline: string;
      plan: string;
      review: string;
      sos: string;
    };
  }
> = {
  en: {
    now: 'Now',
    next: 'Next',
    first: 'First stop',
    liveFallback: 'You’re connected with your guide in real time.',
    vehicle: 'Vehicle',
    endedTitle: 'Your tour has ended',
    endedBody: 'Revisit today’s moments in your travel timeline.',
    chatTitle: 'Chat',
    chatEmpty: 'No messages yet — say hello anytime.',
    signalHint: 'One tap tells your guide.',
    more: 'More features',
    settingsRow: 'Settings & language',
    reviewRow: 'Leave a review',
    close: 'Close',
    tiles: {
      smartGuide: 'Smart Guide',
      chat: 'Chat',
      schedule: 'Today',
      map: 'Map',
      pickup: 'Meeting point',
      signal: 'Quick signal',
      timeline: 'Timeline',
      plan: 'Plan my day',
      review: 'Review',
      sos: 'Emergency',
    },
  },
  ko: {
    now: '지금',
    next: '다음',
    first: '첫 일정',
    liveFallback: '가이드와 실시간으로 연결되어 있어요.',
    vehicle: '이용 차량',
    endedTitle: '투어가 종료됐어요',
    endedBody: '여행 기록에서 오늘의 순간을 다시 볼 수 있어요.',
    chatTitle: '채팅',
    chatEmpty: '아직 메시지가 없어요 — 언제든 인사를 남겨보세요.',
    signalHint: '탭 한 번이면 가이드에게 전달돼요.',
    more: '더 많은 기능',
    settingsRow: '설정 · 언어',
    reviewRow: '리뷰 남기기',
    close: '닫기',
    tiles: {
      smartGuide: '스마트 가이드',
      chat: '채팅',
      schedule: '오늘 일정',
      map: '지도',
      pickup: '집합·픽업',
      signal: '빠른 신호',
      timeline: '여행 기록',
      plan: '일정 짜기',
      review: '리뷰 남기기',
      sos: '긴급',
    },
  },
  ja: {
    now: '現在',
    next: '次',
    first: '最初の予定',
    liveFallback: 'ガイドとリアルタイムでつながっています。',
    vehicle: 'ご利用の車両',
    endedTitle: 'ツアーが終了しました',
    endedBody: '旅の記録で今日の瞬間を振り返れます。',
    chatTitle: 'チャット',
    chatEmpty: 'まだメッセージはありません — いつでもどうぞ。',
    signalHint: 'ワンタップでガイドに伝わります。',
    more: 'その他の機能',
    settingsRow: '設定・言語',
    reviewRow: 'レビューを書く',
    close: '閉じる',
    tiles: {
      smartGuide: 'スマートガイド',
      chat: 'チャット',
      schedule: '本日',
      map: '地図',
      pickup: '集合・お迎え',
      signal: 'クイック連絡',
      timeline: '旅の記録',
      plan: 'プラン作成',
      review: 'レビュー',
      sos: '緊急',
    },
  },
  es: {
    now: 'Ahora',
    next: 'Siguiente',
    first: 'Primera parada',
    liveFallback: 'Estás conectado con tu guía en tiempo real.',
    vehicle: 'Vehículo',
    endedTitle: 'Tu tour ha terminado',
    endedBody: 'Revive los momentos de hoy en tu línea de viaje.',
    chatTitle: 'Chat',
    chatEmpty: 'Aún no hay mensajes — saluda cuando quieras.',
    signalHint: 'Un toque avisa a tu guía.',
    more: 'Más funciones',
    settingsRow: 'Ajustes e idioma',
    reviewRow: 'Dejar una reseña',
    close: 'Cerrar',
    tiles: {
      smartGuide: 'Guía inteligente',
      chat: 'Chat',
      schedule: 'Hoy',
      map: 'Mapa',
      pickup: 'Punto de encuentro',
      signal: 'Señal rápida',
      timeline: 'Recorrido',
      plan: 'Planear mi día',
      review: 'Reseña',
      sos: 'Emergencia',
    },
  },
  zh: {
    now: '当前',
    next: '下一站',
    first: '首个行程',
    liveFallback: '您已与导游实时连接。',
    vehicle: '乘坐车辆',
    endedTitle: '行程已结束',
    endedBody: '在旅行记录中回顾今天的精彩瞬间。',
    chatTitle: '聊天',
    chatEmpty: '还没有消息 — 随时打个招呼吧。',
    signalHint: '轻点一下即可通知导游。',
    more: '更多功能',
    settingsRow: '设置 · 语言',
    reviewRow: '写评价',
    close: '关闭',
    tiles: {
      smartGuide: '智能向导',
      chat: '聊天',
      schedule: '今日',
      map: '地图',
      pickup: '集合·接送',
      signal: '快捷信号',
      timeline: '旅行记录',
      plan: '规划行程',
      review: '评价',
      sos: '紧急',
    },
  },
  'zh-TW': {
    now: '目前',
    next: '下一站',
    first: '第一站',
    liveFallback: '您已與導遊即時連線。',
    vehicle: '乘坐車輛',
    endedTitle: '行程已結束',
    endedBody: '在旅程紀錄中回顧今天的精彩瞬間。',
    chatTitle: '聊天',
    chatEmpty: '還沒有訊息 — 隨時打個招呼吧。',
    signalHint: '輕觸一下即可通知導遊。',
    more: '更多功能',
    settingsRow: '設定 · 語言',
    reviewRow: '寫評價',
    close: '關閉',
    tiles: {
      smartGuide: '智慧導覽',
      chat: '聊天',
      schedule: '今日',
      map: '地圖',
      pickup: '集合·接送',
      signal: '快速訊號',
      timeline: '旅程紀錄',
      plan: '規劃行程',
      review: '評價',
      sos: '緊急',
    },
  },
  fr: {
    now: 'Maintenant',
    next: 'Ensuite',
    first: 'Première étape',
    liveFallback: 'Vous êtes en lien direct avec votre guide.',
    vehicle: 'Véhicule',
    endedTitle: 'Votre tour est terminé',
    endedBody: 'Revivez les moments du jour dans le fil du voyage.',
    chatTitle: 'Chat',
    chatEmpty: 'Pas encore de messages — dites bonjour quand vous voulez.',
    signalHint: 'Un geste suffit pour prévenir votre guide.',
    more: 'Plus de fonctions',
    settingsRow: 'Réglages et langue',
    reviewRow: 'Laisser un avis',
    close: 'Fermer',
    tiles: {
      smartGuide: 'Guide intelligent',
      chat: 'Chat',
      schedule: 'Aujourd’hui',
      map: 'Carte',
      pickup: 'Point de rendez-vous',
      signal: 'Signal rapide',
      timeline: 'Fil du voyage',
      plan: 'Planifier ma journée',
      review: 'Avis',
      sos: 'Urgence',
    },
  },
  de: {
    now: 'Jetzt',
    next: 'Als Nächstes',
    first: 'Erster Stopp',
    liveFallback: 'Sie sind live mit Ihrem Guide verbunden.',
    vehicle: 'Fahrzeug',
    endedTitle: 'Ihre Tour ist zu Ende',
    endedBody: 'Erleben Sie die Momente von heute im Reiseverlauf noch einmal.',
    chatTitle: 'Chat',
    chatEmpty: 'Noch keine Nachrichten — sagen Sie einfach Hallo.',
    signalHint: 'Ein Tipp genügt — Ihr Guide weiß Bescheid.',
    more: 'Mehr Funktionen',
    settingsRow: 'Einstellungen & Sprache',
    reviewRow: 'Bewertung schreiben',
    close: 'Schließen',
    tiles: {
      smartGuide: 'Smart Guide',
      chat: 'Chat',
      schedule: 'Heute',
      map: 'Karte',
      pickup: 'Treffpunkt',
      signal: 'Schnellsignal',
      timeline: 'Reiseverlauf',
      plan: 'Tag planen',
      review: 'Bewertung',
      sos: 'Notfall',
    },
  },
  ru: {
    now: 'Сейчас',
    next: 'Далее',
    first: 'Первая остановка',
    liveFallback: 'Вы на связи с гидом в реальном времени.',
    vehicle: 'Транспорт',
    endedTitle: 'Тур завершен',
    endedBody: 'Вспомните моменты дня в ленте путешествия.',
    chatTitle: 'Чат',
    chatEmpty: 'Сообщений пока нет — напишите первым.',
    signalHint: 'Одно касание — и гид уже знает.',
    more: 'Еще функции',
    settingsRow: 'Настройки и язык',
    reviewRow: 'Оставить отзыв',
    close: 'Закрыть',
    tiles: {
      smartGuide: 'Умный гид',
      chat: 'Чат',
      schedule: 'Сегодня',
      map: 'Карта',
      pickup: 'Место сбора',
      signal: 'Быстрый сигнал',
      timeline: 'Лента путешествия',
      plan: 'План на день',
      review: 'Отзыв',
      sos: 'SOS',
    },
  },
  it: {
    now: 'Adesso',
    next: 'Poi',
    first: 'Prima tappa',
    liveFallback: 'Sei in contatto diretto con la tua guida.',
    vehicle: 'Veicolo',
    endedTitle: 'Il tuo tour è finito',
    endedBody: 'Rivivi i momenti di oggi nel diario di viaggio.',
    chatTitle: 'Chat',
    chatEmpty: 'Ancora nessun messaggio — saluta quando vuoi.',
    signalHint: 'Basta un tocco per avvisare la guida.',
    more: 'Altre funzioni',
    settingsRow: 'Impostazioni e lingua',
    reviewRow: 'Lascia una recensione',
    close: 'Chiudi',
    tiles: {
      smartGuide: 'Guida smart',
      chat: 'Chat',
      schedule: 'Oggi',
      map: 'Mappa',
      pickup: 'Punto di ritrovo',
      signal: 'Segnale rapido',
      timeline: 'Diario di viaggio',
      plan: 'Pianifica la giornata',
      review: 'Recensione',
      sos: 'Emergenza',
    },
  },
};

/**
 * "Now" for surfaces outside this tab (the schedule cards), DERIVED from the
 * map above rather than typed out again. A second hand-copied list of the same
 * ten strings is a list that will diverge — this repo has already been bitten
 * by exactly that (§D A4.1, a locale array whose copy had ja/es/zh in a
 * different order).
 */
export const NOW_LABEL: Record<RoomLocale, string> = Object.fromEntries(
  (Object.keys(COPY) as RoomLocale[]).map((l) => [l, COPY[l].now]),
) as Record<RoomLocale, string>;

function formatKstTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

// Schedule times are usually HH:MM(:SS) but ops sometimes write free text
// ("≈ 08:30") — only truncate the strict clock form. Shared by the label and
// the resolver threading so the two can never disagree about what "the time"
// of a stop is.
function stopTime(item: ScheduleItem | undefined): string | null {
  const raw = typeof item?.time === 'string' ? item.time.trim() : '';
  if (!raw) return null;
  return /^\d{2}:\d{2}/.test(raw) ? raw.slice(0, 5) : raw;
}

function stopLabel(item: ScheduleItem | undefined): string | null {
  if (!item) return null;
  const title = String(item.title ?? item.name ?? '').trim();
  if (!title) return null;
  const time = stopTime(item);
  return time ? `${time} · ${title}` : title;
}

type HomeSheet = 'pickup' | 'signal' | 'timeline' | null;

interface Tile {
  key: string;
  label: string;
  Icon: typeof IconTabChat;
  tone?: 'accent' | 'danger';
  href?: string;
  /** href가 우리 오리진 밖(OTA 리스팅)이면 next/link 대신 새 탭 <a className="text-cjk-safe">로 연다. */
  external?: boolean;
  onPress?: () => void;
  dot?: boolean;
}

export default function HomeTab({
  api,
  locale,
  lifecycle,
  bookingId,
  roomSession,
  messages,
  schedule,
  tourDate,
  tourTime,
  pickupPoints,
  busPayload,
  reviewPolicy,
  canSignal,
  showConcierge,
  isPrivate,
  locations,
  manualKind,
  theme,
  tourTitle,
}: {
  api: RoomShellHomeApi;
  locale: RoomLocale;
  lifecycle: 'lobby' | 'live' | 'ended';
  bookingId: string;
  roomSession: string;
  messages: RoomMessage[];
  schedule: ScheduleItem[];
  tourDate: string | null;
  tourTime?: string | null;
  pickupPoints?: unknown;
  busPayload?: unknown;
  /**
   * OTA 심사 대비 — 리뷰 CTA가 어디로 갈지(또는 아예 안 뜰지)와 자사 쿠폰
   * 허용 여부. 서버가 예약 채널로 정해 스냅샷에 실어 보낸다.
   */
  reviewPolicy: RoomReviewPolicy;
  /** X17 — a shared recap names the trip it came from. */
  tourTitle?: string | null;
  canSignal: boolean;
  showConcierge: boolean;
  /**
   * D2: the "Plan my day" editor is a PRIVATE-tour capability only. Join /
   * shared tours run a fixed itinerary, so this tile is hidden for them.
   */
  isPrivate: boolean;
  /**
   * §11.C C1 — live room positions (the channel's by-participant map). Feeds
   * the vehicle card; absent or vehicle-less simply renders nothing.
   */
  locations?: Record<string, VehicleLocationLike> | null;
  /** Manual shape (join vs private). Absent → the manual button is hidden. */
  manualKind?: ManualKind;
  /** The sheet mounts outside .tr-root, so it re-scopes the token layer. */
  theme?: 'light' | 'dark';
}) {
  const copy = COPY[locale];
  const [sheet, setSheet] = useState<HomeSheet>(null);
  // I6 default: collapsed. One boolean, so the owner's answer is a one-line change.
  const [moreOpen, setMoreOpen] = useState(false);
  // Now marker advances on a 1-min tick, kept out of render so it stays pure
  // (a bare clock read in render is impure/unstable) — mirrors RoomShell.
  // SG-0c: the source is the room's corrected clock, not the device's.
  const roomNow = useRoomClock();
  const [nowMs, setNowMs] = useState(() => roomNow());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(roomNow()), 60_000);
    return () => window.clearInterval(id);
  }, [roomNow]);

  const timelineData = useMemo(() => buildTravelTimeline(messages), [messages]);
  const hasTimeline = timelineData.stopCount > 0 || timelineData.photoCount > 0;
  const vehicleLine = vehicleLineFromPayload(busPayload);
  const reviewHref = reviewPolicy.reviewHref;
  // 외부(OTA)로 나가는 링크는 새 탭 + rel 가드. 자사 경로는 그대로 앱 안에서.
  const reviewLinkProps = reviewPolicy.reviewExternal
    ? { target: '_blank' as const, rel: 'noopener noreferrer' }
    : {};

  // §11.C C3 — the guest's own meeting point is the vehicle-ETA destination.
  const pickupPoint = firstPickup(pickupPoints);
  const vehicleDestination =
    typeof pickupPoint?.lat === 'number' && typeof pickupPoint?.lng === 'number'
      ? { lat: pickupPoint.lat, lng: pickupPoint.lng, name: pickupPoint.name ?? null }
      : null;

  // Live now/next — same KST wall-clock derivation as the schedule tab.
  const currentIndex = currentScheduleIndex(schedule, lifecycle, nowMs);
  const nowStop = currentIndex >= 0 ? stopLabel(schedule[currentIndex]) : null;
  const nextItem = currentIndex >= 0 ? schedule[currentIndex + 1] : schedule[0];
  const nextStop = stopLabel(nextItem);
  // SG-1a — the resolver gets name and time SEPARATELY (the label glues them
  // for display); the time string is what the adapter turns into the moving
  // numeral's wall-clock target. Rendered output is byte-identical to the
  // glued label for every input the label accepted.
  const nextTitle = nextItem ? String(nextItem.title ?? nextItem.name ?? '').trim() || null : null;
  const nextTime = stopTime(nextItem);

  const latest = messages.length > 0 ? messages[messages.length - 1] : null;
  const latestText = latest ? latest.translations?.[locale] || latest.source_text || '' : '';

  /**
   * I2 — the now card.
   *
   * The resolver is pure and the adapter reads only what the room already
   * broadcasts, so this is a derivation, not a fetch. `moving` needs a next
   * stop and `arrived` needs an arrival event; when neither exists the resolver
   * answers `lobby`, and on a live tour that is the one state this screen does
   * NOT want the hero to claim — the old now/next strip is a better answer
   * there, because it can still show "first stop" before the day starts moving.
   */
  const nowCardResult = useMemo(() => {
    const result = nowCard(
      roomNowCardContext({
        messages,
        lifecycle,
        tourDate,
        locale,
        nextStop: nextTitle ? { name: nextTitle, time: nextTime } : null,
        currentStop: nowStop ? { name: nowStop } : null,
        // pickupBoardState needs the guide's live position and the full pickup
        // sequence, which this tab does not hold; VehicleLocationCard owns that
        // surface already, so the pickup state stays off until X15 threads it.
        pickup: null,
        contactPhone: OPS_PHONE,
        nowMs,
      }),
    );
    return result.state === 'lobby' ? null : result;
  }, [messages, lifecycle, tourDate, locale, nextTitle, nextTime, nowStop, nowMs]);

  const nowCardHandlers: NowCardHandlers = useMemo(
    () => ({
      onCall: (phone) => {
        window.location.href = `tel:${phone}`;
      },
      onShareLocation: () => setSheet('signal'),
      onRouteBack: () => api.selectTab('map'),
      onListen: () => api.selectTab('chat'),
      onMeetMeHere: () => setSheet('signal'),
      onOpenMap: () => api.selectTab('map'),
      onOpenPlan: () => api.selectTab('schedule'),
      onOpenTimeline: () => setSheet('timeline'),
      // Facility chips live in the map tab's pin layer; the meeting point and
      // the next stop are both answered by surfaces that already exist.
      onChip: (chip) => {
        if (chip === 'meeting_point') setSheet('pickup');
        else if (chip === 'next_stop') api.selectTab('schedule');
        else api.selectTab('map');
      },
    }),
    [api],
  );

  const tiles: Tile[] = [];
  if (showConcierge) {
    tiles.push({
      key: 'smart-guide',
      label: copy.tiles.smartGuide,
      Icon: IconConcierge,
      tone: 'accent',
      onPress: api.openConcierge,
    });
  }
  tiles.push(
    { key: 'chat', label: copy.tiles.chat, Icon: IconTileChat, onPress: () => api.selectTab('chat'), dot: api.chatUnread },
    { key: 'schedule', label: copy.tiles.schedule, Icon: IconTileSchedule, onPress: () => api.selectTab('schedule') },
    { key: 'map', label: copy.tiles.map, Icon: IconTileMap, onPress: () => api.selectTab('map') },
    { key: 'pickup', label: copy.tiles.pickup, Icon: IconTilePickup, onPress: () => setSheet('pickup') },
  );
  // D2: the plan editor is private-tour only — join tours run a fixed
  // itinerary, so this entrance stays hidden for them.
  if (lifecycle === 'lobby' && isPrivate) {
    tiles.push({
      key: 'plan',
      label: copy.tiles.plan,
      Icon: IconPlanEdit,
      href: `/tour-mode/plan/${encodeURIComponent(bookingId)}`,
    });
  }
  if (canSignal) {
    tiles.push({ key: 'signal', label: copy.tiles.signal, Icon: IconQuickReply, onPress: () => setSheet('signal') });
  }
  if (lifecycle === 'ended' || hasTimeline) {
    tiles.push({ key: 'timeline', label: copy.tiles.timeline, Icon: IconJourney, onPress: () => setSheet('timeline') });
  }
  // reviewHref가 null이면 CTA 자체를 만들지 않는다 — OTA 예약인데 그 플랫폼의
  // 리스팅 URL이 없는 경우다. 자사 상품 페이지로 폴백하지 않는 것이 요점.
  if (lifecycle === 'ended' && reviewHref) {
    tiles.push({
      key: 'review',
      label: copy.tiles.review,
      Icon: IconReview,
      href: reviewHref,
      external: reviewPolicy.reviewExternal,
    });
  }
  tiles.push({ key: 'sos', label: copy.tiles.sos, Icon: IconTileSos, tone: 'danger', onPress: api.openEmergency });

  /* I7 — order the grid so the three tiles the guest can see without asking are
     the ones this minute calls for. Ordering, never filtering: the same tiles
     in the same sequence whether the grid is shut or open, so expanding reveals
     rather than rearranges (U-D25). `orderHomeTiles` also keeps chat/today/map
     out of the promoted slots, since the tab bar already holds them (U-D24). */
  const orderedKeys = orderHomeTiles(
    tiles.map((t) => t.key as HomeTileKey),
    nowCardResult?.state ?? null,
  );
  tiles.sort((a, b) => orderedKeys.indexOf(a.key as HomeTileKey) - orderedKeys.indexOf(b.key as HomeTileKey));

  const tileClass =
    'tr-home-card flex min-h-[76px] flex-col items-center justify-center gap-1.5 px-2 py-2.5 text-center tr-press';

  // H2.1 — "tech" squircle chips (gradient + gloss, .tr-chip in the theme CSS).
  const iconWrapClass = (tone?: 'accent' | 'danger') =>
    `tr-chip relative flex h-11 w-11 items-center justify-center ${
      tone === 'danger' ? 'tr-chip--danger' : tone === 'accent' ? 'tr-chip--accent' : 'tr-chip--base'
    }`;

  const renderTile = (tile: Tile, fullWidth = false) =>
    tile.href && tile.external ? (
      <a
        key={tile.key}
        href={tile.href}
        target="_blank"
        rel="noopener noreferrer"
        data-testid={`home-tile-${tile.key}`}
        className={fullWidth ? `${tileClass} col-span-3` : tileClass}
      >
        {tileInner(tile)}
      </a>
    ) : tile.href ? (
      <Link key={tile.key} href={tile.href} data-testid={`home-tile-${tile.key}`} className={fullWidth ? `${tileClass} col-span-3` : tileClass}>
        {tileInner(tile)}
      </Link>
    ) : (
      <button
        key={tile.key}
        type="button"
        onClick={tile.onPress}
        data-testid={`home-tile-${tile.key}`}
        className={fullWidth ? `${tileClass} col-span-3` : tileClass}
      >
        {tileInner(tile)}
      </button>
    );

  const tileInner = (tile: Tile) => (
    <>
      <span className={iconWrapClass(tile.tone)}>
        <tile.Icon size={TR_ICON.action} strokeWidth={TR_STROKE.default} aria-hidden />
        {tile.dot && (
          <span
            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--tr-danger)]"
            data-testid="home-chat-dot"
          />
        )}
      </span>
      <span className="tr-label text-cjk-safe max-w-full leading-tight text-[var(--tr-ink)]">{tile.label}</span>
    </>
  );

  return (
    <div data-testid="home-tab">
      {/* ---- Status card ------------------------------------------- */}
      {lifecycle === 'lobby' && (
        <LobbyCard
          locale={locale}
          tourDate={tourDate}
          tourTime={tourTime}
          pickupPoints={pickupPoints}
          busPayload={busPayload}
        />
      )}
      {/* I2 — the now card takes the hero slot whenever the resolver has an
          answer for the minute the guest is living in. It keeps the
          `home-status-live` testid because it replaces that card rather than
          joining it: two hero cards would be two protagonists (U-D23). The
          old now/next strip below is the fallback for the states the resolver
          leaves to their existing owners (lobby → LobbyCard, ended → recap). */}
      {lifecycle === 'live' && nowCardResult && (
        <>
          <NowCard
            result={nowCardResult}
            locale={locale}
            testId="home-status-live"
            nowLabel={copy.now}
            handlers={nowCardHandlers}
          />
          {/* The vehicle line used to live inside the status card. It is a fact
              about today, not a choice, so it survives the restructure verbatim
              — testid included, because something watched it. */}
          {vehicleLine && (
            <p
              className="tr-label -mt-1 mb-2 flex items-center gap-1.5 px-1 text-[var(--tr-ink-2)]"
              data-testid="home-vehicle"
            >
              <IconPickup
                size={TR_ICON.meta}
                strokeWidth={TR_STROKE.small}
                className="shrink-0 text-[var(--tr-ink-3)]"
                aria-hidden
              />
              <span className="text-cjk-safe truncate">{vehicleLine}</span>
            </p>
          )}
        </>
      )}
      {lifecycle === 'live' && !nowCardResult && (
        <div className="tr-home-card tr-card-hero mb-2 px-4 py-3.5" data-testid="home-status-live">
          {nowStop || nextStop ? (
            <div className="flex flex-col gap-1.5">
              {nowStop && (
                <p className="tr-card-text flex items-baseline gap-2 text-[var(--tr-ink)]">
                  <span className="tr-meta shrink-0 whitespace-nowrap rounded-full bg-[var(--tr-safe-soft)] px-2 py-0.5 text-center font-bold text-[var(--tr-safe)]">
                    {copy.now}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{nowStop}</span>
                </p>
              )}
              {nextStop && (
                <p className="tr-card-text flex items-baseline gap-2 text-[var(--tr-ink-2)]">
                  <span className="tr-meta shrink-0 whitespace-nowrap rounded-full bg-[var(--tr-bubble-system)] px-2 py-0.5 text-center font-semibold text-[var(--tr-ink-3)]">
                    {nowStop ? copy.next : copy.first}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{nextStop}</span>
                </p>
              )}
            </div>
          ) : (
            <p className="tr-card-text text-[var(--tr-ink-2)]">{copy.liveFallback}</p>
          )}
          {vehicleLine && (
            <p className="tr-label mt-2.5 flex items-center gap-1.5 text-[var(--tr-ink-2)]" data-testid="home-vehicle">
              <IconPickup size={TR_ICON.meta} strokeWidth={TR_STROKE.small} className="shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
              <span className="truncate">{vehicleLine}</span>
            </p>
          )}
        </div>
      )}
      {lifecycle === 'ended' && (
        <div className="tr-home-card mb-2 px-4 py-4" data-testid="home-status-ended" data-tr-phase="ended">
          <p className="tr-title text-[var(--tr-ink)]">{copy.endedTitle}</p>
          <p className="tr-card-text mt-1 text-[var(--tr-ink-2)]">{copy.endedBody}</p>
        </div>
      )}

      {/* ---- Vehicle location + ETA (§11.C C1/C3) -------------------- */}
      {lifecycle !== 'ended' && (
        <VehicleLocationCard
          locale={locale}
          locations={locations}
          pickup={vehicleDestination}
          bookingId={bookingId}
          roomSession={roomSession}
          tourDate={tourDate}
          pickupTime={pickupPoint?.pickup_time ?? null}
          onOpenMap={() => api.selectTab('map')}
        />
      )}

      {/* ---- Chat preview ------------------------------------------- */}
      <button
        type="button"
        onClick={() => api.selectTab('chat')}
        data-testid="home-chat-preview"
        className="tr-home-card mb-2 flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="tr-chip tr-chip--base relative flex h-9 w-9 shrink-0 items-center justify-center !rounded-[13px]">
          <IconTileChat size={TR_ICON.chip} aria-hidden />
          {api.chatUnread && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--tr-danger)]" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="tr-label block font-semibold text-[var(--tr-ink)]">
            {copy.chatTitle}
            {latest && <span className="tr-meta ml-2 font-normal text-[var(--tr-ink-3)]">{formatKstTime(latest.created_at)}</span>}
          </span>
          <span
            className={`tr-card-text block truncate ${
              api.chatUnread ? 'font-semibold text-[var(--tr-ink)]' : 'text-[var(--tr-ink-2)]'
            }`}
          >
            {latestText || copy.chatEmpty}
          </span>
        </span>
        <IconChevronRight size={TR_ICON.action} className="shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
      </button>

      {/* ---- "How this app works" (2026-07-28, moved 2026-07-29) ------
          This REPLACES the modal that used to open itself on first entry.
          I7 (사장님 결정) moved it out of the overflow and up here, directly
          under the chat preview: a guest who does not know what the app is
          will not go looking behind a "more" button to find out. Same content,
          on request instead of on arrival. */}
      {manualKind && (
        <div className="mt-2" data-testid="home-manual-slot">
          <AppManual variant="button" kind={manualKind} locale={locale} theme={theme} />
        </div>
      )}

      {/* ---- Action grid, as a peek (I7) -----------------------------
          Three tiles open, the next row showing its icon heads, and a button
          for the rest. Fully collapsed read as "there is nothing here"; fully
          open is what I2 spent a wave undoing. A cropped icon says "more"
          without spending a word on it — and without a word, it says the same
          thing in all ten locales.

          U-D24: which three is derived (`orderHomeTiles`), and a tile that
          duplicates a bottom tab is never promoted into them.
          U-D25: nothing is filtered. The grid holds every tile in both states;
          shut, it is clipped. So expanding reveals rather than rebuilds, and
          no tile a guest learned has moved.

          The peeked tiles are real DOM, not a picture of tiles: focusable, in
          the reading order, and not `aria-hidden`. `onFocusCapture` opens the
          grid the moment focus reaches one, so a keyboard or switch user is
          never left operating something they can only half see.

          Two grids rather than one clipped grid, because the clip height has to
          be exact and a single grid's first row is not a number we know. Tile
          labels wrap to two lines in German and Russian, and a max-height
          guessed from the English layout would slice row one in those locales.
          Splitting means only the PEEK height is fixed — and 26px of a tile is
          the icon's head by construction, whatever the label below it does.
          Both grids are `grid-cols-3 gap-1.5` at the same width, so the columns
          line up as if they were one. */}
      <div
        data-testid="home-grid"
        data-peek={moreOpen ? 'open' : 'peek'}
        onFocusCapture={() => setMoreOpen(true)}
      >
        <div className="tr-stagger mt-2 grid grid-cols-3 gap-1.5">
          {tiles.slice(0, PEEK_COUNT).map((tile) => renderTile(tile))}
        </div>
        {tiles.length > PEEK_COUNT && (
          <div
            className={`mt-1.5 grid grid-cols-3 gap-1.5 ${moreOpen ? '' : 'tr-home-grid-peek'}`}
            data-testid="home-grid-rest"
          >
            {/* 🔴 N-b — the orphan row.
                The tile count is conditional (5 to 10 depending on lifecycle,
                privacy, concierge and whether a review link exists), so at 7 or
                10 tiles the last row holds exactly ONE and the grid reads as
                unfinished. I7's peek moved where the break falls; it did not
                remove the possibility.
                The stranded tile is always SOS — it is pushed last — so rather
                than leaving it hanging in a third of a row, it takes the whole
                row. An emergency action owning its own line reads as deliberate
                where a single orphaned square reads as a bug. */}
            {tiles.slice(PEEK_COUNT).map((tile, index, rest) =>
              renderTile(tile, index === rest.length - 1 && rest.length % 3 === 1),
            )}
          </div>
        )}
      </div>

      {/* The door. It sits under the grid because that is what it opens — put
          above, it reads as a heading for the three tiles rather than as the
          way to the rest. */}
      <button
        type="button"
        onClick={() => setMoreOpen((v) => !v)}
        data-testid="home-more"
        aria-expanded={moreOpen}
        aria-controls="home-more-panel"
        className="tr-label text-cjk-safe mt-1.5 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full font-medium text-[var(--tr-ink-3)] active:bg-[var(--tr-surface)]"
      >
        <IconMore size={TR_ICON.chip} aria-hidden />
        {copy.more}
        <IconChevronRight
          size={TR_ICON.chip}
          className={`transition-transform ${moreOpen ? '-rotate-90' : 'rotate-90'}`}
          aria-hidden
        />
      </button>

      <div id="home-more-panel" hidden={!moreOpen} data-testid="home-more-sheet">
      {/* ---- Install entry (T-D2) — self-hides when no install path. -- */}
      <div className="mt-1.5">
        <InstallCard locale={locale} surface="home" />
      </div>

      {/* Settings & review used to live in a separate overflow sheet. Two
          overflow containers for one screen is one too many, so they join the
          grid here — same destinations, one door. */}
      <div className="mt-1 flex flex-col">
        <button
          type="button"
          onClick={() => api.selectTab('settings')}
          className="flex min-h-[52px] w-full items-center gap-3 text-left"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]">
            <IconTabSettings size={TR_ICON.action} aria-hidden />
          </span>
          <span className="tr-card-text text-cjk-safe flex-1 font-medium text-[var(--tr-ink)]">
            {copy.settingsRow}
          </span>
          <IconChevronRight size={TR_ICON.action} className="shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
        </button>
        {reviewHref && (
          <a
            href={reviewHref}
            {...reviewLinkProps}
            data-testid="home-more-review"
            className="flex min-h-[52px] w-full items-center gap-3 text-left"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]">
              <IconReview size={TR_ICON.action} aria-hidden />
            </span>
            <span className="tr-card-text text-cjk-safe flex-1 font-medium text-[var(--tr-ink)]">
              {copy.reviewRow}
            </span>
            <IconChevronRight size={TR_ICON.action} className="shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
          </a>
        )}
      </div>
      </div>

      {/* ---- Pickup sheet -------------------------------------------- */}
      <Sheet
        open={sheet === 'pickup'}
        onClose={() => setSheet(null)}
        closeLabel={copy.close}
        title={
          <span className="flex items-center gap-2 text-[var(--tr-ink)]">
            <IconPickup size={TR_ICON.action} aria-hidden />
            {copy.tiles.pickup}
          </span>
        }
      >
        {/* M-D5 — private tours: the guest sets time & place; lobby (D-1) and
            live alike. Join tours keep the fixed pickup board only. */}
        {isPrivate && lifecycle !== 'ended' && (
          <MeetSetCard bookingId={bookingId} roomSession={roomSession} locale={locale} />
        )}
        <LobbyCard
          locale={locale}
          tourDate={tourDate}
          tourTime={tourTime}
          pickupPoints={pickupPoints}
          busPayload={busPayload}
        />
      </Sheet>

      {/* ---- Quick-signal sheet -------------------------------------- */}
      {canSignal && (
        <Sheet
          open={sheet === 'signal'}
          onClose={() => setSheet(null)}
          closeLabel={copy.close}
          title={
            <span className="flex items-center gap-2 text-[var(--tr-ink)]">
              <IconQuickReply size={TR_ICON.action} aria-hidden />
              {copy.tiles.signal}
            </span>
          }
        >
          <p className="tr-card-text pb-3 text-[var(--tr-ink-2)]">{copy.signalHint}</p>
          <QuickSignalBar bookingId={bookingId} roomSession={roomSession} locale={locale} />
        </Sheet>
      )}

      {/* ---- Timeline sheet ------------------------------------------ */}
      <TravelTimelineSheet
        open={sheet === 'timeline'}
        onClose={() => setSheet(null)}
        locale={locale}
        messages={messages}
        bookingId={bookingId}
        roomSession={roomSession}
        reviewPolicy={reviewPolicy}
        tourTitle={tourTitle}
      />


    </div>
  );
}
