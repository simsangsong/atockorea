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

import { useMemo, useState } from 'react';
import Link from 'next/link';
import LobbyCard from '@/components/tour-mode/LobbyCard';
import { vehicleLineFromPayload } from '@/components/tour-mode/LobbyCard';
import QuickSignalBar from '@/components/tour-mode/QuickSignalBar';
import Sheet from '@/components/tour-mode/Sheet';
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
} from '@/components/tour-mode/icons';
import type { RoomLocale } from '@/lib/tour-room/snapshot';
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
};

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

function stopLabel(item: ScheduleItem | undefined): string | null {
  if (!item) return null;
  const title = String(item.title ?? item.name ?? '').trim();
  if (!title) return null;
  // Schedule times are usually HH:MM(:SS) but ops sometimes write free text
  // ("≈ 08:30") — only truncate the strict clock form.
  const raw = typeof item.time === 'string' ? item.time.trim() : '';
  const time = /^\d{2}:\d{2}/.test(raw) ? raw.slice(0, 5) : raw;
  return time ? `${time} · ${title}` : title;
}

type HomeSheet = 'pickup' | 'signal' | 'timeline' | 'more' | null;

interface Tile {
  key: string;
  label: string;
  Icon: typeof IconTabChat;
  tone?: 'accent' | 'danger';
  href?: string;
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
  tourSlug,
  canSignal,
  showConcierge,
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
  tourSlug?: string | null;
  canSignal: boolean;
  showConcierge: boolean;
}) {
  const copy = COPY[locale];
  const [sheet, setSheet] = useState<HomeSheet>(null);

  const timelineData = useMemo(() => buildTravelTimeline(messages), [messages]);
  const hasTimeline = timelineData.stopCount > 0 || timelineData.photoCount > 0;
  const vehicleLine = vehicleLineFromPayload(busPayload);
  const reviewHref = tourSlug ? `/tour-product/${tourSlug}#reviews` : '/mypage';

  // Live now/next — same KST wall-clock derivation as the schedule tab.
  const currentIndex = currentScheduleIndex(schedule, lifecycle, Date.now());
  const nowStop = currentIndex >= 0 ? stopLabel(schedule[currentIndex]) : null;
  const nextStop =
    currentIndex >= 0 ? stopLabel(schedule[currentIndex + 1]) : stopLabel(schedule[0]);

  const latest = messages.length > 0 ? messages[messages.length - 1] : null;
  const latestText = latest ? latest.translations?.[locale] || latest.source_text || '' : '';

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
  if (lifecycle === 'lobby') {
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
  if (lifecycle === 'ended') {
    tiles.push({ key: 'review', label: copy.tiles.review, Icon: IconReview, href: reviewHref });
  }
  tiles.push({ key: 'sos', label: copy.tiles.sos, Icon: IconTileSos, tone: 'danger', onPress: api.openEmergency });

  const tileClass =
    'tr-home-card flex min-h-[86px] flex-col items-center justify-center gap-1.5 px-2 py-3 text-center active:scale-[0.98]';

  // H2.1 — "tech" squircle chips (gradient + gloss, .tr-chip in the theme CSS).
  const iconWrapClass = (tone?: 'accent' | 'danger') =>
    `tr-chip relative flex h-11 w-11 items-center justify-center ${
      tone === 'danger' ? 'tr-chip--danger' : tone === 'accent' ? 'tr-chip--accent' : 'tr-chip--base'
    }`;

  const tileInner = (tile: Tile) => (
    <>
      <span className={iconWrapClass(tile.tone)}>
        <tile.Icon size={19} strokeWidth={2} aria-hidden />
        {tile.dot && (
          <span
            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--tr-danger)]"
            data-testid="home-chat-dot"
          />
        )}
      </span>
      <span className="tr-label font-medium leading-tight text-[var(--tr-ink)]">{tile.label}</span>
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
      {lifecycle === 'live' && (
        <div className="tr-home-card mb-2 px-4 py-4" data-testid="home-status-live">
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
              <IconPickup size={13} className="shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
              <span className="truncate">{vehicleLine}</span>
            </p>
          )}
        </div>
      )}
      {lifecycle === 'ended' && (
        <div className="tr-home-card mb-2 px-4 py-4" data-testid="home-status-ended">
          <p className="tr-title text-[var(--tr-ink)]">{copy.endedTitle}</p>
          <p className="tr-card-text mt-1 text-[var(--tr-ink-2)]">{copy.endedBody}</p>
        </div>
      )}

      {/* ---- Chat preview ------------------------------------------- */}
      <button
        type="button"
        onClick={() => api.selectTab('chat')}
        data-testid="home-chat-preview"
        className="tr-home-card mb-2 flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="tr-chip tr-chip--base relative flex h-9 w-9 shrink-0 items-center justify-center !rounded-[13px]">
          <IconTileChat size={17} aria-hidden />
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
        <IconChevronRight size={18} className="shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
      </button>

      {/* ---- Feature grid ------------------------------------------- */}
      <div className="grid grid-cols-3 gap-2" data-testid="home-grid">
        {tiles.map((tile) =>
          tile.href ? (
            <Link key={tile.key} href={tile.href} data-testid={`home-tile-${tile.key}`} className={tileClass}>
              {tileInner(tile)}
            </Link>
          ) : (
            <button
              key={tile.key}
              type="button"
              onClick={tile.onPress}
              data-testid={`home-tile-${tile.key}`}
              className={tileClass}
            >
              {tileInner(tile)}
            </button>
          ),
        )}
      </div>

      {/* ---- More row ------------------------------------------------ */}
      <button
        type="button"
        onClick={() => setSheet('more')}
        data-testid="home-more"
        className="tr-label mt-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full font-medium text-[var(--tr-ink-3)] active:bg-[var(--tr-surface)]"
      >
        <IconMore size={16} aria-hidden />
        {copy.more}
      </button>

      {/* ---- Pickup sheet -------------------------------------------- */}
      <Sheet
        open={sheet === 'pickup'}
        onClose={() => setSheet(null)}
        closeLabel={copy.close}
        title={
          <span className="flex items-center gap-2 text-[var(--tr-ink)]">
            <IconPickup size={18} aria-hidden />
            {copy.tiles.pickup}
          </span>
        }
      >
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
              <IconQuickReply size={18} aria-hidden />
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
        tourSlug={tourSlug}
      />

      {/* ---- More sheet ---------------------------------------------- */}
      <Sheet
        open={sheet === 'more'}
        onClose={() => setSheet(null)}
        closeLabel={copy.close}
        title={
          <span className="flex items-center gap-2 text-[var(--tr-ink)]">
            <IconMore size={18} aria-hidden />
            {copy.more}
          </span>
        }
      >
        <div className="flex flex-col" data-testid="home-more-sheet">
          <button
            type="button"
            onClick={() => {
              setSheet(null);
              api.selectTab('settings');
            }}
            className="flex min-h-[52px] w-full items-center gap-3 text-left"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]">
              <IconTabSettings size={18} aria-hidden />
            </span>
            <span className="tr-card-text flex-1 font-medium text-[var(--tr-ink)]">{copy.settingsRow}</span>
            <IconChevronRight size={18} className="shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
          </button>
          <a href={reviewHref} className="flex min-h-[52px] w-full items-center gap-3 text-left">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]">
              <IconReview size={18} aria-hidden />
            </span>
            <span className="tr-card-text flex-1 font-medium text-[var(--tr-ink)]">{copy.reviewRow}</span>
            <IconChevronRight size={18} className="shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
          </a>
        </div>
      </Sheet>
    </div>
  );
}
