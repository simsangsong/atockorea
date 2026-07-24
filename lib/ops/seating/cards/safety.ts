/**
 * C-16 card ② — safety briefing (`briefing_safety`).
 *
 * Seatbelt · stay with the group · what to do when you get separated. The
 * separation line deliberately POINTS AT the room's existing surfaces (the SOS
 * button and the emergency card) instead of restating phone numbers: two copies
 * of an emergency number is one copy that goes stale.
 *
 * Video slot: the 30-second multi-track film rides along as `video_card`,
 * exactly like the arrival card's. When no approved render exists the card is
 * still complete — the text IS the briefing, the video is the nicety.
 *
 * Re-boarding (§5.5.2): a guest who already got this card on an earlier tour
 * day of the same booking receives the COLLAPSED variant — one reminder line
 * plus a tap to re-open the full text — rather than the whole card again.
 *
 * Pre-translated 5-locale constants, zero LLM at send time.
 */

import { capsuleFrom, joinLocaleLines, type ComposedBriefingCard } from '@/lib/ops/seating/cards/types';
import type { SafetyVideoCardMeta } from '@/lib/tour-room/safetyVideo';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

/** The `metadata` contract of a `briefing_safety` message row. */
export interface BriefingSafetyMeta {
  kind: 'briefing_safety';
  /** Re-boarding guest → render the one-line dismissable variant. */
  collapsed: boolean;
  /** The tour day this card was composed for (KST YYYY-MM-DD). */
  tour_date?: string | null;
  video_card?: SafetyVideoCardMeta | null;
  [key: string]: unknown;
}

const SAFETY_LINES: Array<Record<RoomLocale, string>> = [
  {
    en: 'Before we set off — three quick safety points. 🦺',
    ko: '출발 전에 — 안전 안내 3가지 알려드릴게요. 🦺',
    ja: '出発前に — 安全のお願いを3つご案内します。🦺',
    es: 'Antes de salir: tres puntos rápidos de seguridad. 🦺',
    zh: '出发前 — 三点安全提示。🦺',
  },
  {
    en: 'Seatbelts stay fastened in every seat for the whole ride — it is Korean law, front and back.',
    ko: '주행 중에는 앞·뒷좌석 모두 안전벨트를 계속 착용해 주세요 — 한국 법규입니다.',
    ja: '走行中は前後席とも常にシートベルトを着用してください — 韓国の法律です。',
    es: 'Lleven el cinturón abrochado todo el trayecto, delante y detrás: lo exige la ley coreana.',
    zh: '行驶全程请系好安全带，前后座皆须 — 这是韩国法律规定。',
  },
  {
    en: 'At every stop, stay with the group and keep the staff in sight — we move as one party.',
    ko: '각 장소에서는 일행과 함께 움직이고 스태프가 보이는 곳에 있어 주세요 — 다 같이 이동합니다.',
    ja: '各スポットでは一行と一緒に行動し、スタッフが見える範囲にいてください — 全員で移動します。',
    es: 'En cada parada, permanezcan con el grupo y a la vista del personal: nos movemos juntos.',
    zh: '每一站请与团队同行，保持在工作人员视线内 — 我们整队行动。',
  },
  {
    en: 'If you get separated, do not wander — send a message here, or tap the red SOS button in the app and we will come to you.',
    ko: '길이 엇갈리면 헤매지 마시고 — 여기로 메시지를 보내시거나 앱의 빨간 SOS 버튼을 눌러주세요. 저희가 찾아갑니다.',
    ja: 'はぐれてしまったら動き回らず — ここにメッセージを送るか、アプリの赤いSOSボタンを押してください。こちらから向かいます。',
    es: 'Si se separan, no se alejen: escriban aquí o pulsen el botón rojo SOS de la app y les iremos a buscar.',
    zh: '如果走散了，请不要乱走 — 在这里发消息，或点击App里的红色SOS按钮，我们会去找您。',
  },
  {
    en: 'Emergency numbers are always one tap away in the app — you never need to remember them.',
    ko: '긴급 연락처는 앱에서 언제든 한 번에 열 수 있어요 — 외우지 않으셔도 됩니다.',
    ja: '緊急連絡先はアプリからいつでもワンタップで開けます — 覚えておく必要はありません。',
    es: 'Los números de emergencia están siempre a un toque en la app: no hace falta memorizarlos.',
    zh: '紧急联系方式在App中随时一键可查 — 无需记忆。',
  },
];

/** The collapsed (re-boarding) variant — one line, no repetition of the drill. */
const SAFETY_COLLAPSED_LINES: Array<Record<RoomLocale, string>> = [
  {
    en: 'Safety reminder: seatbelts on, stay with the group, and use SOS in the app if you get separated.',
    ko: '안전 안내 요약: 안전벨트 착용, 일행과 함께 이동, 길이 엇갈리면 앱의 SOS를 눌러주세요.',
    ja: '安全のご案内（要約）：シートベルト着用、一行と一緒に行動、はぐれたらアプリのSOSを押してください。',
    es: 'Recordatorio de seguridad: cinturón puesto, sigan con el grupo y usen SOS en la app si se separan.',
    zh: '安全提示（简版）：系好安全带、与团队同行，走散请点App的SOS。',
  },
];

/** Card chrome — the 5-locale labels the guest component renders. */
export const SAFETY_COPY: Record<
  RoomLocale,
  { title: string; collapsedTitle: string; expand: string; collapse: string; video: string }
> = {
  en: {
    title: 'Safety briefing',
    collapsedTitle: 'Safety — you already have this',
    expand: 'Show again',
    collapse: 'Hide',
    video: 'Watch the 30-second safety clip',
  },
  ko: {
    title: '안전 안내',
    collapsedTitle: '안전 안내 — 이미 확인하셨어요',
    expand: '다시 보기',
    collapse: '접기',
    video: '30초 안전 영상 보기',
  },
  ja: {
    title: '安全のご案内',
    collapsedTitle: '安全のご案内 — 確認済みです',
    expand: 'もう一度見る',
    collapse: '閉じる',
    video: '30秒の安全動画を見る',
  },
  es: {
    title: 'Información de seguridad',
    collapsedTitle: 'Seguridad: ya la viste',
    expand: 'Ver de nuevo',
    collapse: 'Ocultar',
    video: 'Ver el clip de seguridad de 30 s',
  },
  zh: {
    title: '安全须知',
    collapsedTitle: '安全须知 — 您已看过',
    expand: '再看一次',
    collapse: '收起',
    video: '观看30秒安全影片',
  },
};

export interface ComposeSafetyArgs {
  /** True when this booking already received the safety card on an earlier day. */
  collapsed?: boolean;
  videoCard?: SafetyVideoCardMeta | null;
  tourDate?: string | null;
}

export function composeSafetyTranslations(args: ComposeSafetyArgs = {}): Record<RoomLocale, string> {
  return joinLocaleLines(args.collapsed ? SAFETY_COLLAPSED_LINES : SAFETY_LINES);
}

export function composeSafety(args: ComposeSafetyArgs = {}): ComposedBriefingCard {
  const meta: BriefingSafetyMeta = {
    kind: 'briefing_safety',
    collapsed: Boolean(args.collapsed),
    tour_date: args.tourDate ?? null,
    video_card: args.videoCard ?? null,
  };
  return capsuleFrom(composeSafetyTranslations(args), meta as unknown as Record<string, unknown>);
}

/** The full text, for the collapsed card's "show again" expansion. */
export function safetyFullTranslations(): Record<RoomLocale, string> {
  return joinLocaleLines(SAFETY_LINES);
}
