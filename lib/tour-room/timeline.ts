/**
 * V4 — Travel Timeline aggregation + copy (concierge-uiux-v2 plan §E).
 *
 * Pure, shared by the client card and the server coupon endpoint so the
 * completion rule lives in exactly one place. It re-aggregates data the room
 * already stored — spot_arrival system messages (each geofence arrival) and
 * shared vision_answer photos — into an ordered recap. No new event schema,
 * no LLM, and (per §B guardrail) no AI-written review drafts: the timeline is
 * a memory aid only.
 */

import type { RoomLocale } from '@/lib/tour-room/snapshot';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

/**
 * Completion thresholds. The reward is gated on the guest actually having a
 * trip to remember — at least one arrival AND at least one photo — so it can
 * never be farmed by an empty room. Tunable at launch.
 */
export const TIMELINE_MIN_STOPS = 1;
export const TIMELINE_MIN_PHOTOS = 1;

export interface TimelineStop {
  id: string;
  title: string;
  at: string;
}

export interface TimelinePhoto {
  id: string;
  url: string;
  caption: string | null;
  at: string;
}

export interface TravelTimelineData {
  stops: TimelineStop[];
  photos: TimelinePhoto[];
  stopCount: number;
  photoCount: number;
  /** Meets both thresholds — eligible for the timeline reward (§E). */
  complete: boolean;
}

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** True if there is anything worth showing a timeline entry for. */
export function hasTimelineContent(messages: RoomMessage[]): boolean {
  return messages.some((m) => {
    const kind = m.metadata?.kind;
    return kind === 'spot_arrival' || (kind === 'vision_answer' && typeof m.metadata?.image_url === 'string');
  });
}

/**
 * Re-aggregate the existing feed into a chronological recap. Arrivals are
 * de-duplicated by spot title (a guest can re-enter a geofence) keeping the
 * first arrival time; photos keep every shared vision answer that carried an
 * image.
 */
export function buildTravelTimeline(messages: RoomMessage[]): TravelTimelineData {
  const ordered = [...messages].sort((a, b) =>
    String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')),
  );

  const stops: TimelineStop[] = [];
  const seenSpots = new Set<string>();
  const photos: TimelinePhoto[] = [];

  for (const m of ordered) {
    const kind = m.metadata?.kind;
    if (kind === 'spot_arrival') {
      const title = cleanString(m.metadata?.spot_title);
      if (title && !seenSpots.has(title)) {
        seenSpots.add(title);
        stops.push({ id: m.id, title, at: String(m.created_at ?? '') });
      }
    } else if (kind === 'vision_answer') {
      const url = cleanString(m.metadata?.image_url);
      if (url) {
        photos.push({
          id: m.id,
          url,
          caption: cleanString(m.source_text),
          at: String(m.created_at ?? ''),
        });
      }
    }
  }

  const complete = stops.length >= TIMELINE_MIN_STOPS && photos.length >= TIMELINE_MIN_PHOTOS;
  return { stops, photos, stopCount: stops.length, photoCount: photos.length, complete };
}

// ---- Copy (5-locale static consts, room i18n pattern) -----------------

export interface TimelineCopy {
  entry: string;
  title: string;
  summary: (stops: number, photos: number) => string;
  empty: string;
  stopsHeading: string;
  photosHeading: string;
  reviewCta: string;
  reviewHint: string;
  rewardProgressTitle: string;
  rewardProgressBody: string;
  rewardReadyTitle: string;
  rewardReadyBody: string;
  claim: string;
  claiming: string;
  rewardDoneTitle: string;
  rewardDoneBody: (code: string) => string;
  rewardAlready: string;
  rewardLogin: string;
  rewardUnavailable: string;
  rewardError: string;
}

export const TIMELINE_COPY: Record<RoomLocale, TimelineCopy> = {
  en: {
    entry: 'See your travel timeline',
    title: 'Your travel timeline',
    summary: (s, p) => `${s} ${s === 1 ? 'stop' : 'stops'} · ${p} ${p === 1 ? 'photo' : 'photos'}`,
    empty: 'Your timeline fills in as you reach each stop and add photos along the way.',
    stopsHeading: 'Where you went',
    photosHeading: 'Your photos',
    reviewCta: 'Leave a review',
    reviewHint: 'Share your own words — we never write reviews for you.',
    rewardProgressTitle: 'A little reward is waiting',
    rewardProgressBody: 'Reach a stop and add at least one photo to unlock a coupon for your next tour.',
    rewardReadyTitle: 'Your timeline is complete',
    rewardReadyBody: 'Claim a thank-you coupon for your next tour.',
    claim: 'Claim reward',
    claiming: 'Claiming…',
    rewardDoneTitle: 'Reward unlocked',
    rewardDoneBody: (code) => `Use code ${code} on your next booking.`,
    rewardAlready: "You've already claimed this reward — it's in your account.",
    rewardLogin: 'Log in with your booking email to claim your reward.',
    rewardUnavailable: 'Rewards are not available right now.',
    rewardError: 'Something went wrong. Please try again.',
  },
  ko: {
    entry: '여행 타임라인 보기',
    title: '나의 여행 타임라인',
    summary: (s, p) => `${s}곳 · 사진 ${p}장`,
    empty: '스팟에 도착하고 사진을 남기면 타임라인이 채워져요.',
    stopsHeading: '다녀온 곳',
    photosHeading: '내 사진',
    reviewCta: '리뷰 남기기',
    reviewHint: '후기는 직접 작성해 주세요 — 저희가 대신 써 드리지 않아요.',
    rewardProgressTitle: '작은 선물이 기다리고 있어요',
    rewardProgressBody: '스팟에 도착하고 사진을 한 장 이상 남기면 다음 투어 쿠폰이 열려요.',
    rewardReadyTitle: '타임라인이 완성됐어요',
    rewardReadyBody: '다음 투어에서 쓸 수 있는 감사 쿠폰을 받아 가세요.',
    claim: '쿠폰 받기',
    claiming: '받는 중…',
    rewardDoneTitle: '쿠폰이 지급됐어요',
    rewardDoneBody: (code) => `다음 예약 때 ${code} 코드를 사용하세요.`,
    rewardAlready: '이미 받은 쿠폰이에요 — 내 계정에 들어 있어요.',
    rewardLogin: '예약 이메일로 로그인하면 쿠폰을 받을 수 있어요.',
    rewardUnavailable: '지금은 쿠폰을 받을 수 없어요.',
    rewardError: '문제가 생겼어요. 다시 시도해 주세요.',
  },
  ja: {
    entry: '旅のタイムラインを見る',
    title: '旅のタイムライン',
    summary: (s, p) => `${s}スポット · 写真${p}枚`,
    empty: 'スポットに到着して写真を追加すると、タイムラインが埋まっていきます。',
    stopsHeading: '訪れた場所',
    photosHeading: 'あなたの写真',
    reviewCta: 'レビューを書く',
    reviewHint: 'レビューはご自身の言葉で。こちらで代筆することはありません。',
    rewardProgressTitle: 'ちょっとした特典があります',
    rewardProgressBody: 'スポットに到着し、写真を1枚以上追加すると、次のツアーで使えるクーポンが開きます。',
    rewardReadyTitle: 'タイムラインが完成しました',
    rewardReadyBody: '次のツアーで使えるお礼クーポンを受け取りましょう。',
    claim: 'クーポンを受け取る',
    claiming: '受け取り中…',
    rewardDoneTitle: 'クーポンを獲得しました',
    rewardDoneBody: (code) => `次回のご予約時にコード ${code} をご利用ください。`,
    rewardAlready: 'すでに受け取り済みです — アカウントに入っています。',
    rewardLogin: 'ご予約のメールでログインするとクーポンを受け取れます。',
    rewardUnavailable: '現在クーポンは受け取れません。',
    rewardError: '問題が発生しました。もう一度お試しください。',
  },
  es: {
    entry: 'Ver tu línea de viaje',
    title: 'Tu línea de viaje',
    summary: (s, p) => `${s} ${s === 1 ? 'parada' : 'paradas'} · ${p} ${p === 1 ? 'foto' : 'fotos'}`,
    empty: 'Tu línea de viaje se completa a medida que llegas a cada parada y añades fotos.',
    stopsHeading: 'Dónde estuviste',
    photosHeading: 'Tus fotos',
    reviewCta: 'Dejar una reseña',
    reviewHint: 'Escríbela con tus propias palabras — nunca redactamos reseñas por ti.',
    rewardProgressTitle: 'Te espera una pequeña recompensa',
    rewardProgressBody: 'Llega a una parada y añade al menos una foto para desbloquear un cupón para tu próximo tour.',
    rewardReadyTitle: 'Tu línea de viaje está completa',
    rewardReadyBody: 'Reclama un cupón de agradecimiento para tu próximo tour.',
    claim: 'Reclamar recompensa',
    claiming: 'Reclamando…',
    rewardDoneTitle: 'Recompensa desbloqueada',
    rewardDoneBody: (code) => `Usa el código ${code} en tu próxima reserva.`,
    rewardAlready: 'Ya reclamaste esta recompensa — está en tu cuenta.',
    rewardLogin: 'Inicia sesión con el correo de tu reserva para reclamar tu recompensa.',
    rewardUnavailable: 'Las recompensas no están disponibles en este momento.',
    rewardError: 'Algo salió mal. Inténtalo de nuevo.',
  },
  zh: {
    entry: '查看你的旅行时间线',
    title: '你的旅行时间线',
    summary: (s, p) => `${s} 个地点 · ${p} 张照片`,
    empty: '当你到达每个地点并添加照片后，时间线就会逐渐完整。',
    stopsHeading: '你去过的地方',
    photosHeading: '你的照片',
    reviewCta: '写评价',
    reviewHint: '请用你自己的话来写 —— 我们绝不会代写评价。',
    rewardProgressTitle: '有一份小奖励在等你',
    rewardProgressBody: '到达一个地点并至少添加一张照片，即可解锁下次行程的优惠券。',
    rewardReadyTitle: '你的时间线已完成',
    rewardReadyBody: '领取一张感谢优惠券，用于你的下一次行程。',
    claim: '领取奖励',
    claiming: '领取中…',
    rewardDoneTitle: '奖励已解锁',
    rewardDoneBody: (code) => `下次预订时使用优惠码 ${code}。`,
    rewardAlready: '你已领取过这份奖励 —— 它就在你的账户里。',
    rewardLogin: '使用预订邮箱登录即可领取奖励。',
    rewardUnavailable: '目前无法领取奖励。',
    rewardError: '出了点问题，请重试。',
  },
};
