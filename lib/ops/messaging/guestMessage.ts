/**
 * 손님 안내 메시지 조립 — M1~M3
 * (`docs/ops-center-settlement-upgrade-plan-2026-07-25.md` §13).
 *
 * 왓츠앱(wa.me 딥링크)과 이메일이 **같은 문구·같은 변수**를 쓴다. 채널마다
 * 다른 것은 링크를 어떻게 보여주느냐뿐이다 — 두 벌로 만들면 문구를 고칠 때
 * 한쪽만 고쳐지는 날이 반드시 온다(§K B0-D1b가 경고한 드리프트).
 *
 * 순수 모듈이다. 조회(템플릿·예보·개인 링크)는 라우트가 하고, 여기서는 조립만 한다.
 */

import {
  missingRequired,
  renderTemplate,
  stripEmptyTokenLines,
  type MessageVars,
} from './template';
import {
  clothingAdvice,
  weatherLine,
  weatherLocaleOf,
  type DailyForecast,
} from '@/lib/ops/weather/forecast';

export const MESSAGE_CHANNELS = ['whatsapp', 'email'] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

export function isMessageChannel(v: unknown): v is MessageChannel {
  return typeof v === 'string' && (MESSAGE_CHANNELS as readonly string[]).includes(v);
}

/** 템플릿 한 벌 — 어디서 왔는지까지 들고 다닌다(화면이 "투어 전용"을 표시한다). */
export interface ResolvedTemplate {
  body: string;
  subject: string | null;
  /** 'tour' = 투어별 오버라이드, 'tenant' = 전역 DB, 'code' = 코드 프리셋. */
  source: 'tour' | 'tenant' | 'code';
}

export interface TemplateCandidates {
  /** ops_tour_message_templates — (preset, locale, channel) 일치. */
  tour?: { body: string; subject?: string | null } | null;
  /** ops_whatsapp_templates — (preset, locale). */
  tenant?: { body: string } | null;
  /** 코드 프리셋 (lib/ops/whatsapp/presets). 항상 있다. */
  code: string;
}

/**
 * 해석 순서: 투어 오버라이드 → 전역 → 코드.
 *
 * 빈 문자열은 "설정 안 함"으로 본다 — 실수로 비워 둔 행이 코드 프리셋을 가려
 * 손님에게 빈 메시지가 나가는 것을 막는다.
 */
export function resolveTemplate(candidates: TemplateCandidates): ResolvedTemplate {
  const tourBody = candidates.tour?.body?.trim();
  if (tourBody) {
    return { body: tourBody, subject: candidates.tour?.subject?.trim() || null, source: 'tour' };
  }
  const tenantBody = candidates.tenant?.body?.trim();
  if (tenantBody) return { body: tenantBody, subject: null, source: 'tenant' };
  return { body: candidates.code, subject: null, source: 'code' };
}

/**
 * 예보 → 템플릿 변수. 예보가 없으면 **두 값 모두 null**이고, 그 줄은
 * `stripEmptyTokenLines`가 지운다. 지어낸 날씨는 절대 넣지 않는다.
 */
export function weatherVars(
  forecast: DailyForecast | null | undefined,
  locale: string | null | undefined,
): { weather: string | null; clothing: string | null } {
  if (!forecast) return { weather: null, clothing: null };
  const wl = weatherLocaleOf(locale);
  return { weather: weatherLine(forecast, wl), clothing: clothingAdvice(forecast, wl) };
}

export interface RecipientInput {
  bookingId: string;
  guestName: string;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  locale?: string | null;
  pickupPoint?: string | null;
  pickupTime?: string | null;
  /** 이 손님의 **개인** 투어룸 링크 (§K B0.3). */
  roomLink?: string | null;
  passLink?: string | null;
}

export interface ComposeContext {
  tourName?: string | null;
  tourDate?: string | null;
  operatorName?: string | null;
  forecast?: DailyForecast | null;
}

export interface ComposedMessage {
  bookingId: string;
  guestName: string;
  locale: string;
  subject: string | null;
  body: string;
  /** 채우지 못한 필수 변수 — 화면이 "이 사람은 링크가 비었습니다"를 띄운다. */
  missing: string[];
}

/**
 * 수신자 1명분 렌더.
 *
 * 🔴 `missing`을 **버리지 않고 돌려주는 것**이 이 함수의 요점이다. 링크 자리가
 * 빈 채로 나가는 메시지가 이 체인에서 가장 흔한 사고이고, 조용히 보내면
 * 손님이 "링크가 없어요"라고 연락해 올 때까지 아무도 모른다.
 */
export function composeForRecipient(
  template: { body: string; subject?: string | null },
  recipient: RecipientInput,
  ctx: ComposeContext,
): ComposedMessage {
  const { weather, clothing } = weatherVars(ctx.forecast, recipient.locale);
  const vars: MessageVars = {
    guestName: recipient.guestName || 'Guest',
    tourName: ctx.tourName ?? null,
    tourDate: ctx.tourDate ?? null,
    pickupPoint: recipient.pickupPoint ?? null,
    pickupTime: recipient.pickupTime ?? null,
    roomLink: recipient.roomLink ?? null,
    passLink: recipient.passLink ?? null,
    operatorName: ctx.operatorName ?? null,
    weather,
    clothing,
  };

  const rawBody = renderTemplate(template.body, vars);
  // 선택 정보(날씨·착장)가 없어 라벨만 남은 줄은 지운다.
  const body = stripEmptyTokenLines(rawBody, template.body, vars);
  const subject = template.subject ? renderTemplate(template.subject, vars).trim() : null;

  return {
    bookingId: recipient.bookingId,
    guestName: vars.guestName,
    locale: recipient.locale ?? 'en',
    subject: subject || null,
    body,
    // 날씨는 없을 수 있는 정보다 — 필수 누락으로 세지 않는다.
    missing: missingRequired(template.body, vars).filter((t) => t !== '{weather}' && t !== '{clothing}'),
  };
}

/** 이메일로 보낼 수 있는 수신자인가. */
export function canEmail(r: RecipientInput): boolean {
  const email = r.email?.trim() ?? '';
  return email.length > 3 && email.includes('@');
}

export interface BulkPlan {
  sendable: ComposedMessage[];
  /** 주소가 없어 보낼 수 없는 사람 — 목록에서 지우지 않고 이유와 함께 보여준다. */
  skipped: Array<{ bookingId: string; guestName: string; reason: 'no_email' | 'missing_vars' }>;
}

/**
 * 일괄 발송 계획. **보낼 수 없는 사람을 조용히 빼지 않는다** — 20명 중 17명에게
 * 갔다는 사실을 화면이 말해야 나머지 3명을 사람이 처리한다.
 *
 * 필수 변수가 빈 사람도 보내지 않는다. 링크 없는 안내 메일은 안 보낸 것보다 나쁘다
 * (손님은 받았다고 생각하고 기다린다).
 */
export function planBulkEmail(
  template: { body: string; subject?: string | null },
  recipients: RecipientInput[],
  ctx: ComposeContext,
): BulkPlan {
  const sendable: ComposedMessage[] = [];
  const skipped: BulkPlan['skipped'] = [];

  for (const r of recipients) {
    const composed = composeForRecipient(template, r, ctx);
    if (!canEmail(r)) {
      skipped.push({ bookingId: r.bookingId, guestName: composed.guestName, reason: 'no_email' });
      continue;
    }
    if (composed.missing.length > 0) {
      skipped.push({ bookingId: r.bookingId, guestName: composed.guestName, reason: 'missing_vars' });
      continue;
    }
    sendable.push(composed);
  }

  return { sendable, skipped };
}

export const SKIP_REASON_LABEL: Record<BulkPlan['skipped'][number]['reason'], string> = {
  no_email: '이메일 주소 없음',
  missing_vars: '링크 등 필수 항목이 비어 있음',
};

/**
 * 프리셋별 기본 이메일 제목. 투어명이 있으면 붙인다.
 *
 * 🔴 라우트 파일이 아니라 여기 사는 이유: Next 라우트 모듈은 **핸들러와 정해진
 * 설정 값 외의 export를 금지**한다(`next build`가 거절한다. `tsc --noEmit`은
 * 잡지 못하므로 빌드까지 돌려야 드러난다).
 */
export function defaultEmailSubject(preset: string, tourName: string | null): string {
  const suffix = tourName ? ` — ${tourName}` : '';
  switch (preset) {
    case 'confirm_d7':
      return `Your booking is confirmed${suffix}`;
    case 'pickup_d1':
      return `Tomorrow's pickup details${suffix}`;
    case 'room_invite':
      return `Your tour room link${suffix}`;
    case 'day_pass':
      return `Today's tour — meeting point${suffix}`;
    case 'thanks':
      return `Thank you for travelling with us${suffix}`;
    default:
      return `AtoC Korea${suffix}`;
  }
}

/** 평문 본문 → 최소 HTML. 링크만 클릭 가능하게 만들고 나머지는 그대로 둔다. */
export function plainTextToEmailHtml(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const linked = escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#2563eb">$1</a>');
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.7;color:#111827;white-space:pre-wrap">${linked}</div>`;
}
