/**
 * OTA 심사 대비 (2026-07-28) — 손님 앱에서 자사 마켓플레이스로 나가는 경로를
 * **예약 채널로** 가른다.
 *
 * 왜 필요했나. 투어가 끝난 뒤 손님 화면에는 직접 채널 유인이 두 개 있었다.
 *   ① "리뷰 남기기" → `/tour-product/{slug}#reviews` — 가격과 예약 위젯이
 *      붙어 있는 자사 상품 페이지다. 홈탭 타일·설정 행·타임라인 시트 세 곳.
 *   ② 타임라인 완주 쿠폰 — "다음 예약 때 이 코드를 쓰세요" + 자사 계정 로그인
 *      유도. 자사에서만 쓸 수 있는 코드다.
 * Klook·GetYourGuide로 들어온 손님에게 상품을 제공하는 도중에 이 둘을 보여주는
 * 것은 OTA 계약의 유인금지 조항(Klook §5.11 계열)이 정확히 겨냥하는 형태다.
 *
 * 결정(사용자, 2026-07-28, 옵션 B): 직접 예약 손님은 지금 그대로 두고, OTA
 * 예약 손님은 리뷰를 **그 OTA로** 보내고 쿠폰은 아예 제공하지 않는다. OTA
 * 입장에서 자기 플랫폼 리뷰가 늘어나는 쪽이라 가점이면 가점이지 감점이 아니다.
 *
 * 이 모듈이 순수한 이유. 클라이언트에서 UI만 감추는 것으로는 부족하다 — 숨겨도
 * `POST /timeline-coupon`이 살아 있으면 OTA 손님 앞으로 발급된 자사 쿠폰이
 * `coupon_grants`에 그대로 남고, 그게 심사보다 무거운 계약 실체다. 그래서 서버
 * 라우트와 화면이 **같은 함수**를 부른다.
 */

/** 정규화된 예약 채널. `ota_other`는 "모르는 값" = 보수적으로 OTA 취급. */
export type BookingChannel =
  | 'direct'
  | 'klook'
  | 'getyourguide'
  | 'viator'
  | 'kkday'
  | 'ota_other';

/**
 * 자사 채널로 인정하는 `bookings.source` 값들.
 *
 * 🔴 화이트리스트인 것이 의도다. 새 직접 채널(예: 자사 앱, 오프라인 워크인)을
 * 만들면 **여기에 추가해야** 그 손님에게 리뷰 CTA와 쿠폰이 돌아온다. 모르는
 * 값을 direct로 넘기면 조용히 계약 위반이 되지만, OTA로 넘기면 UX가 조금
 * 심심해질 뿐이다 — 실패 방향을 안전한 쪽으로 고정한다.
 */
const DIRECT_SOURCES = new Set([
  'tour_product',
  'direct',
  'atoc',
  'atockorea',
  'web',
  'website',
  'admin',
  'manual',
  // 시뮬/테스트 예약도 직접으로 본다. 라이브에 'test' 행이 존재한다.
  'test',
  'sim',
]);

const OTA_SOURCES: Record<string, Exclude<BookingChannel, 'direct' | 'ota_other'>> = {
  klook: 'klook',
  gyg: 'getyourguide',
  getyourguide: 'getyourguide',
  get_your_guide: 'getyourguide',
  viator: 'viator',
  tripadvisor: 'viator', // TripAdvisor 판매분은 Viator 예약으로 들어온다
  kkday: 'kkday',
};

const CHANNEL_LABEL: Record<BookingChannel, string | null> = {
  direct: null,
  klook: 'Klook',
  getyourguide: 'GetYourGuide',
  viator: 'Viator',
  kkday: 'KKday',
  ota_other: null,
};

export function normalizeBookingChannel(source: string | null | undefined): BookingChannel {
  const key = typeof source === 'string' ? source.trim().toLowerCase() : '';
  // source 미기입 = 자사 예약 폼으로 들어온 초창기 행들. direct로 본다.
  if (!key) return 'direct';
  if (DIRECT_SOURCES.has(key)) return 'direct';
  return OTA_SOURCES[key] ?? 'ota_other';
}

export function isOtaChannel(channel: BookingChannel): boolean {
  return channel !== 'direct';
}

/**
 * 이 채널의 리스팅 URL을 `tour_external_reviews.platform`에서 찾을 때 쓸 키.
 * KKday와 미상 OTA는 그 테이블이 아예 모르는 플랫폼이라 null이다.
 */
export function externalReviewPlatformFor(channel: BookingChannel): string | null {
  switch (channel) {
    case 'klook':
      return 'klook';
    case 'getyourguide':
      return 'getyourguide';
    case 'viator':
      return 'viator';
    default:
      return null;
  }
}

/**
 * 리스팅 URL로 쓸 만한가.
 *
 * 라이브 `tour_external_reviews`의 source_url 4건은 전부 `https://www.klook.com/`
 * 같은 **플랫폼 홈**이다(2026-07-28 확인). 손님을 거기로 보내면 "리뷰 남기기"를
 * 눌렀는데 OTA 첫 화면이 뜨는 셈이라 없느니만 못하다. 경로가 비어 있으면 링크로
 * 인정하지 않는다 — ops가 실제 리스팅 URL을 넣는 순간 저절로 살아난다.
 */
export function isUsableListingUrl(url: string | null | undefined): boolean {
  if (typeof url !== 'string' || !url.trim()) return false;
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const path = u.pathname.replace(/\/+$/, '');
    return path.length > 0 || u.search.length > 0;
  } catch {
    return false;
  }
}

export interface RoomReviewPolicy {
  channel: BookingChannel;
  /** "리뷰 남기기"가 갈 곳. null이면 **CTA를 아예 렌더하지 않는다.** */
  reviewHref: string | null;
  /** 우리 오리진 밖으로 나가는가 (target=_blank + rel 필요). */
  reviewExternal: boolean;
  /** 도착지 플랫폼 이름. 자사면 null. */
  reviewPlatformLabel: string | null;
  /** 자사 쿠폰을 제안해도 되는가. OTA 예약이면 언제나 false. */
  rewardAllowed: boolean;
}

/**
 * 한 예약의 리뷰/보상 정책을 정한다. 순수 — DB도 env도 보지 않는다.
 *
 * OTA인데 쓸 만한 리스팅 URL이 없으면 리뷰 CTA를 **숨긴다**. 자사 페이지로
 * 보내는 것보다 안 보여주는 쪽이 안전하고, 어차피 OTA가 자기 손님에게 리뷰
 * 요청 메일을 따로 보낸다.
 */
export function resolveReviewPolicy(input: {
  source: string | null | undefined;
  tourSlug?: string | null;
  /** `tour_external_reviews`에서 이 투어 × 이 채널로 찾은 리스팅 URL. */
  otaListingUrl?: string | null;
}): RoomReviewPolicy {
  const channel = normalizeBookingChannel(input.source);

  if (!isOtaChannel(channel)) {
    const slug = input.tourSlug?.trim();
    return {
      channel,
      reviewHref: slug ? `/tour-product/${slug}#reviews` : '/mypage',
      reviewExternal: false,
      reviewPlatformLabel: null,
      rewardAllowed: true,
    };
  }

  const listing = isUsableListingUrl(input.otaListingUrl) ? input.otaListingUrl!.trim() : null;
  return {
    channel,
    reviewHref: listing,
    reviewExternal: listing !== null,
    reviewPlatformLabel: listing ? CHANNEL_LABEL[channel] : null,
    rewardAllowed: false,
  };
}

/** 직접 예약 기본값. 스냅샷이 예약 행을 못 읽었을 때의 안전한 자리. */
export const DEFAULT_REVIEW_POLICY: RoomReviewPolicy = {
  channel: 'direct',
  reviewHref: '/mypage',
  reviewExternal: false,
  reviewPlatformLabel: null,
  rewardAllowed: true,
};
