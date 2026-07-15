/**
 * V2/V3 — Smart Guide concierge core (concierge-uiux-v2 plan §D).
 *
 * Pure, isomorphic module shared by the ConciergePanel (client Tier 0 — zero
 * API calls) and POST /concierge (server re-check + Tier 1). One source of
 * truth for intent keywords, guardrails, and the pre-translated answer
 * templates, so client and server can never drift.
 *
 * Tier ladder (§D-1):
 *   Tier 0 — the four quick intents (restroom / photo spot / next stop /
 *            time left) answered from data the room already has: the latest
 *            geofence arrival's SpotArrivalContent + the tour schedule.
 *            No LLM, no network.
 *   Tier 1 — free questions the keywords don't catch → the concierge API
 *            (LLM through the §M-1 router).
 *   Tier 2 — guardrail hits (§D-3) skip the LLM entirely: emergencies are
 *            pointed at the SOS surface, operational requests are escalated
 *            to a human via a room message, venue recommendations are
 *            declined (no curated list yet — never from LLM memory).
 *
 * Keyword matching follows lib/tour-ops/attention.ts: word boundaries for
 * Latin scripts (the chatbot's includes() token-boundary bug is the
 * cautionary tale), substring for CJK where \b does not exist.
 */

import { ROOM_LOCALES, type RoomLocale } from '@/lib/tour-room/snapshot';
import type { SpotArrivalContent } from '@/lib/tour-room/spotContent';

// ---------------------------------------------------------------------------
// Intents & guardrails
// ---------------------------------------------------------------------------

export type ConciergeIntent = 'restroom' | 'photo_spot' | 'next_stop' | 'time_left';

export type ConciergeGuardrail = 'emergency' | 'ops_request' | 'venue_recommendation';

interface KeywordSet {
  latin: string[];
  cjk: string[];
}

const INTENT_KEYWORDS: Record<ConciergeIntent, KeywordSet> = {
  restroom: {
    latin: ['restroom', 'toilet', 'bathroom', 'washroom', 'wc', 'baño', 'banos', 'aseo', 'servicios'],
    cjk: ['화장실', 'トイレ', 'お手洗い', '洗面所', '厕所', '洗手间', '卫生间'],
  },
  photo_spot: {
    latin: ['photo', 'picture', 'selfie', 'foto', 'instagram'],
    cjk: ['포토', '사진', '셀카', '写真', 'フォト', '撮影', '拍照', '照片', '打卡', '自拍'],
  },
  next_stop: {
    latin: ['next stop', 'next place', 'where next', 'what next', 'siguiente parada', 'proxima parada', 'próxima parada', 'adonde vamos', 'adónde vamos'],
    cjk: ['다음 일정', '다음 장소', '다음 코스', '어디 가', '어디로 가', '次の予定', '次はどこ', 'この後どこ', '下一站', '接下来去', '下个地方'],
  },
  time_left: {
    latin: ['time left', 'how much time', 'how long do we have', 'until when', 'what time do we leave', 'when do we leave', 'cuanto tiempo', 'cuánto tiempo', 'hasta que hora', 'hasta qué hora', 'a que hora salimos', 'a qué hora salimos'],
    cjk: ['남은 시간', '몇 시까지', '언제까지', '언제 출발', '몇시까지', '몇 시에 출발', 'あと何分', '何時まで', '何時に出発', 'いつ出発', '还有多久', '几点出发', '几点集合', '集合时间'],
  },
};

/**
 * §D-3 — hardcoded, checked BEFORE any intent or LLM work. Emergency wording
 * routes to the SOS surface; operational requests (things only a human may
 * promise) escalate; venue recommendations are declined until a curated list
 * exists (never generated from LLM memory).
 */
const GUARDRAIL_KEYWORDS: Record<ConciergeGuardrail, KeywordSet> = {
  emergency: {
    latin: ['ambulance', 'police', 'hospital', 'emergency', 'injured', 'bleeding', 'unconscious', 'heart attack', 'ambulancia', 'policia', 'policía', 'emergencia', 'herido', 'sangrando'],
    cjk: ['응급', '구급차', '경찰', '병원', '다쳤', '피가', '의식이', '救急', '警察', '病院', '怪我', '出血', '意識', '救护车', '警察', '医院', '受伤', '流血', '晕倒'],
  },
  ops_request: {
    latin: ['refund', 'cancel', 'reschedule', 'change the schedule', 'change the itinerary', 'change the time', 'rebook', 'discount', 'reembolso', 'cancelar', 'cambiar la hora', 'cambiar el itinerario', 'descuento'],
    cjk: ['환불', '취소', '일정 변경', '일정을 바꿔', '시간 바꿔', '시간을 바꿔', '변경해', '바꿔주', '할인', '返金', 'キャンセル', '予定変更', '日程変更', '時間変更', '割引', '退款', '取消', '改时间', '更改行程', '改行程', '折扣'],
  },
  venue_recommendation: {
    latin: ['restaurant', 'where to eat', 'where should we eat', 'good food', 'best food', 'cafe nearby', 'shopping', 'where to buy', 'souvenir shop', 'restaurante', 'donde comer', 'dónde comer', 'compras', 'tienda'],
    cjk: ['맛집', '식당 추천', '음식점 추천', '먹을 곳', '먹을만한', '쇼핑', '살 만한', '기념품 가게', '美味しい店', 'レストラン', 'おすすめの店', '買い物', 'お土産屋', '好吃的', '餐厅推荐', '饭店推荐', '购物', '纪念品店'],
  },
};

function buildLatinRegex(words: string[]): RegExp {
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(?:${escaped.join('|')})\\b`, 'i');
}

const INTENT_LATIN_RE = Object.fromEntries(
  (Object.keys(INTENT_KEYWORDS) as ConciergeIntent[]).map((intent) => [
    intent,
    buildLatinRegex(INTENT_KEYWORDS[intent].latin),
  ]),
) as Record<ConciergeIntent, RegExp>;

const GUARDRAIL_LATIN_RE = Object.fromEntries(
  (Object.keys(GUARDRAIL_KEYWORDS) as ConciergeGuardrail[]).map((guardrail) => [
    guardrail,
    buildLatinRegex(GUARDRAIL_KEYWORDS[guardrail].latin),
  ]),
) as Record<ConciergeGuardrail, RegExp>;

function matchesSet(text: string, set: KeywordSet, latinRe: RegExp): boolean {
  if (latinRe.test(text)) return true;
  return set.cjk.some((keyword) => text.includes(keyword));
}

/** Guardrails outrank intents; emergency outranks everything (§D-3 order). */
export function classifyConciergeGuardrail(text: string): ConciergeGuardrail | null {
  if (!text) return null;
  for (const guardrail of ['emergency', 'ops_request', 'venue_recommendation'] as const) {
    if (matchesSet(text, GUARDRAIL_KEYWORDS[guardrail], GUARDRAIL_LATIN_RE[guardrail])) return guardrail;
  }
  return null;
}

export function matchConciergeIntent(text: string): ConciergeIntent | null {
  if (!text) return null;
  // next_stop / time_left before the broader single-word intents so
  // "what time do we leave for the next stop" resolves to the schedule.
  for (const intent of ['time_left', 'next_stop', 'restroom', 'photo_spot'] as const) {
    if (matchesSet(text, INTENT_KEYWORDS[intent], INTENT_LATIN_RE[intent])) return intent;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Copy — chips, panel chrome, answers (pre-translated, §M-2 ① pattern)
// ---------------------------------------------------------------------------

export const CONCIERGE_CHIPS: ReadonlyArray<{ intent: ConciergeIntent; label: Record<RoomLocale, string> }> = [
  {
    intent: 'restroom',
    label: { en: 'Restroom', ko: '화장실', ja: 'トイレ', es: 'Baños', zh: '洗手间' },
  },
  {
    intent: 'photo_spot',
    label: { en: 'Photo spot', ko: '포토스팟', ja: '写真スポット', es: 'Mejor foto', zh: '拍照点' },
  },
  {
    intent: 'next_stop',
    label: { en: 'Next stop', ko: '다음 일정', ja: '次の予定', es: 'Siguiente parada', zh: '下一站' },
  },
  {
    intent: 'time_left',
    label: { en: 'Time left', ko: '남은 시간', ja: '残り時間', es: 'Tiempo restante', zh: '剩余时间' },
  },
];

export const CONCIERGE_COPY: Record<
  RoomLocale,
  {
    title: string;
    intro: string;
    placeholder: string;
    thinking: string;
    error: string;
    send: string;
  }
> = {
  en: {
    title: 'Smart Guide',
    intro: 'Instant answers about today’s tour — restrooms, photo spots, schedule.',
    placeholder: 'Ask about today’s tour…',
    thinking: 'Checking…',
    error: 'Something went wrong — please try again or ask your guide.',
    send: 'Ask',
  },
  ko: {
    title: '스마트 가이드',
    intro: '오늘 투어에 대한 즉답 — 화장실·포토스팟·일정.',
    placeholder: '오늘 투어에 대해 물어보세요…',
    thinking: '확인 중…',
    error: '문제가 발생했어요 — 다시 시도하거나 가이드에게 물어보세요.',
    send: '질문',
  },
  ja: {
    title: 'スマートガイド',
    intro: '本日のツアーに即答 — トイレ・写真スポット・予定。',
    placeholder: '本日のツアーについて質問…',
    thinking: '確認中…',
    error: 'エラーが発生しました — もう一度試すか、ガイドにお尋ねください。',
    send: '質問',
  },
  es: {
    title: 'Guía inteligente',
    intro: 'Respuestas al instante sobre el tour de hoy: baños, fotos, horario.',
    placeholder: 'Pregunta sobre el tour de hoy…',
    thinking: 'Consultando…',
    error: 'Algo salió mal — inténtalo de nuevo o pregunta a tu guía.',
    send: 'Preguntar',
  },
  zh: {
    title: '智能向导',
    intro: '即时解答今日行程 — 洗手间、拍照点、日程。',
    placeholder: '询问今天的行程…',
    thinking: '查询中…',
    error: '出了点问题 — 请重试或询问导游。',
    send: '提问',
  },
};

/** {spot}/{info}/{title}/{time}/{minutes}/{point}/{q} interpolate verbatim. */
type AnswerKind =
  | 'restroom_info'
  | 'restroom_none'
  | 'photo_info'
  | 'photo_none'
  | 'next_stop_info'
  | 'schedule_done'
  | 'schedule_none'
  | 'time_left_free'
  | 'time_left_next'
  | 'time_none'
  | 'emergency'
  | 'escalated_ack'
  | 'venue_refusal'
  | 'scope_refusal'
  | 'budget_exhausted'
  | 'escalation_feed';

const ANSWERS: Record<AnswerKind, Record<RoomLocale, string>> = {
  restroom_info: {
    en: '{spot} — {info}',
    ko: '{spot} — {info}',
    ja: '{spot} — {info}',
    es: '{spot} — {info}',
    zh: '{spot} — {info}',
  },
  restroom_none: {
    en: 'I don’t have restroom details for this spot — your guide will know best. You can also send the “Restroom” quick reply in chat.',
    ko: '이 스팟의 화장실 정보가 없어요 — 가이드가 가장 잘 알아요. 채팅의 "화장실" 퀵답장으로 바로 물어볼 수도 있어요.',
    ja: 'このスポットのトイレ情報がありません — ガイドが一番よく知っています。チャットの「トイレ」クイック返信でも聞けます。',
    es: 'No tengo datos de baños para este punto — tu guía lo sabrá mejor. También puedes enviar la respuesta rápida de “baño” en el chat.',
    zh: '暂无此景点的洗手间信息 — 导游最清楚。也可以在聊天中发送"洗手间"快捷回复。',
  },
  photo_info: {
    en: '📸 {spot} — {info}',
    ko: '📸 {spot} — {info}',
    ja: '📸 {spot} — {info}',
    es: '📸 {spot} — {info}',
    zh: '📸 {spot} — {info}',
  },
  photo_none: {
    en: 'No photo tips saved for this spot yet — ask your guide for the best angle!',
    ko: '이 스팟의 포토 팁이 아직 없어요 — 가이드에게 베스트 앵글을 물어보세요!',
    ja: 'このスポットの写真のコツはまだありません — ベストアングルはガイドに聞いてみましょう！',
    es: 'Aún no hay consejos de foto para este punto — ¡pregunta a tu guía por el mejor ángulo!',
    zh: '此景点还没有拍照小贴士 — 问问导游最佳角度吧！',
  },
  next_stop_info: {
    en: 'Next: {title} ({time})',
    ko: '다음 일정: {title} ({time})',
    ja: '次の予定: {title} ({time})',
    es: 'Siguiente: {title} ({time})',
    zh: '下一站：{title}（{time}）',
  },
  schedule_done: {
    en: 'Today’s scheduled stops are done — enjoy the rest of the day!',
    ko: '오늘 예정된 일정은 모두 끝났어요 — 남은 하루를 즐기세요!',
    ja: '本日の予定はすべて終了しました — 残りの時間をお楽しみください！',
    es: 'Las paradas programadas de hoy han terminado — ¡disfruta el resto del día!',
    zh: '今天的行程都结束了 — 好好享受剩下的时光！',
  },
  schedule_none: {
    en: 'I don’t have today’s schedule on hand — check the Today tab or ask your guide.',
    ko: '지금 일정 정보를 불러올 수 없어요 — "오늘 일정" 탭을 확인하거나 가이드에게 물어보세요.',
    ja: '予定情報が見つかりません — 「本日」タブを確認するか、ガイドにお尋ねください。',
    es: 'No tengo el horario a mano — revisa la pestaña Hoy o pregunta a tu guía.',
    zh: '暂时无法获取日程 — 请查看"今日"标签或询问导游。',
  },
  time_left_free: {
    en: '⏳ About {minutes} min until gathering{point}.',
    ko: '⏳ 집합까지 약 {minutes}분 남았어요{point}.',
    ja: '⏳ 集合まで約{minutes}分です{point}。',
    es: '⏳ Quedan unos {minutes} min para reunirse{point}.',
    zh: '⏳ 距离集合还有约{minutes}分钟{point}。',
  },
  time_left_next: {
    en: '⏳ About {minutes} min until the next stop: {title} ({time}).',
    ko: '⏳ 다음 일정까지 약 {minutes}분 — {title} ({time}).',
    ja: '⏳ 次の予定まで約{minutes}分 — {title}（{time}）。',
    es: '⏳ Unos {minutes} min hasta la siguiente parada: {title} ({time}).',
    zh: '⏳ 距离下一站约{minutes}分钟 — {title}（{time}）。',
  },
  time_none: {
    en: 'No timer is running right now — your guide will announce the next gathering time.',
    ko: '지금 진행 중인 타이머가 없어요 — 다음 집합 시간은 가이드가 안내할 거예요.',
    ja: '現在進行中のタイマーはありません — 次の集合時間はガイドがご案内します。',
    es: 'No hay temporizador activo — tu guía anunciará la próxima hora de reunión.',
    zh: '当前没有倒计时 — 下次集合时间将由导游通知。',
  },
  emergency: {
    en: '🚨 For an emergency, tap the red shield at the top right to open emergency contacts and the SOS button. Korea: 119 (fire/medical) · 112 (police) · 1330 (tourist line, 24h).',
    ko: '🚨 응급 상황이라면 우측 상단의 빨간 방패 아이콘을 눌러 긴급 연락처와 SOS 버튼을 여세요. 한국: 119(화재·구급) · 112(경찰) · 1330(관광통역, 24시간).',
    ja: '🚨 緊急の場合は右上の赤い盾アイコンから緊急連絡先とSOSボタンを開いてください。韓国: 119（消防・救急）・112（警察）・1330（観光通訳、24時間）。',
    es: '🚨 En una emergencia, toca el escudo rojo arriba a la derecha para abrir los contactos de emergencia y el botón SOS. Corea: 119 (bomberos/médica) · 112 (policía) · 1330 (línea turística, 24h).',
    zh: '🚨 如遇紧急情况，请点击右上角的红色盾牌图标，打开紧急联系方式和SOS按钮。韩国：119（消防/急救）· 112（警察）· 1330（旅游热线，24小时）。',
  },
  escalated_ack: {
    en: 'That needs a human — I’ve passed your question to the guide and our team. They’ll reply here in chat.',
    ko: '이건 사람이 확인해야 해요 — 질문을 가이드와 운영팀에 전달했어요. 채팅으로 답변이 올 거예요.',
    ja: 'こちらは担当者の確認が必要です — ご質問をガイドと運営チームに伝えました。チャットで返信が届きます。',
    es: 'Esto necesita a una persona — he pasado tu pregunta al guía y a nuestro equipo. Te responderán aquí en el chat.',
    zh: '这需要人工处理 — 已将您的问题转给导游和运营团队，他们会在聊天中回复您。',
  },
  venue_refusal: {
    en: 'I don’t recommend restaurants or shops I can’t vouch for — your guide knows the trustworthy local picks, so please ask them!',
    ko: '확인되지 않은 맛집·상점은 추천하지 않아요 — 믿을 만한 현지 정보는 가이드가 가장 잘 알고 있으니 직접 물어보세요!',
    ja: '確認できていないお店はおすすめしません — 信頼できる地元情報はガイドが一番詳しいので、ぜひ聞いてみてください！',
    es: 'No recomiendo restaurantes o tiendas que no pueda garantizar — tu guía conoce los sitios locales de confianza, ¡pregúntale!',
    zh: '我不推荐未经确认的餐厅或商店 — 导游最了解可靠的本地好去处，请直接问他们！',
  },
  scope_refusal: {
    en: 'I can only help with today’s tour — for anything else, our team chat on the AtoC site is happy to help.',
    ko: '저는 오늘 투어에 대해서만 도와드릴 수 있어요 — 다른 문의는 AtoC 사이트의 상담 채팅을 이용해 주세요.',
    ja: '本日のツアーに関することのみお手伝いできます — その他はAtoCサイトのチャットをご利用ください。',
    es: 'Solo puedo ayudarte con el tour de hoy — para lo demás, el chat del sitio de AtoC estará encantado de ayudarte.',
    zh: '我只能协助今天的行程 — 其他问题请使用AtoC网站上的客服聊天。',
  },
  budget_exhausted: {
    en: 'The Smart Guide is resting for today — your guide has every answer, just ask in chat!',
    ko: '스마트 가이드가 오늘은 쉬어가요 — 가이드가 모든 걸 알고 있으니 채팅으로 물어보세요!',
    ja: 'スマートガイドは本日お休みです — ガイドが何でも知っていますので、チャットでお尋ねください！',
    es: 'La guía inteligente descansa por hoy — tu guía tiene todas las respuestas, ¡pregunta en el chat!',
    zh: '智能向导今天休息啦 — 导游什么都知道，请在聊天中提问！',
  },
  /** Feed capsule the guide/ops see when a question escalates (V3.3). */
  escalation_feed: {
    en: '🤝 Smart Guide passed a question to the team — {q}',
    ko: '🤝 스마트 가이드가 질문을 전달했어요 — {q}',
    ja: '🤝 スマートガイドが質問を転送しました — {q}',
    es: '🤝 La guía inteligente pasó una pregunta al equipo — {q}',
    zh: '🤝 智能向导已转达问题 — {q}',
  },
};

export interface ConciergeAnswerParams {
  spot?: string;
  info?: string;
  title?: string;
  time?: string;
  minutes?: number;
  point?: string;
  q?: string;
}

function interpolate(template: string, params: ConciergeAnswerParams): string {
  return template
    .replaceAll('{spot}', params.spot ?? '')
    .replaceAll('{info}', params.info ?? '')
    .replaceAll('{title}', params.title ?? '')
    .replaceAll('{time}', params.time ?? '')
    .replaceAll('{minutes}', params.minutes === undefined ? '' : String(params.minutes))
    .replaceAll('{point}', params.point ?? '')
    .replaceAll('{q}', params.q ?? '');
}

export function renderConciergeAnswer(kind: AnswerKind, locale: RoomLocale, params: ConciergeAnswerParams = {}): string {
  return interpolate(ANSWERS[kind][locale], params);
}

/** All-locale bundle for a feed message (escalation capsule) — zero LLM. */
export function renderConciergeTranslations(
  kind: AnswerKind,
  params: ConciergeAnswerParams = {},
): { source_locale: string; source_text: string; translations: Record<string, string> } {
  const translations: Record<string, string> = {};
  for (const locale of ROOM_LOCALES) {
    translations[locale] = renderConciergeAnswer(kind, locale, params);
  }
  return { source_locale: 'en', source_text: translations.en, translations };
}

// ---------------------------------------------------------------------------
// Tier 0 answers (pure — the caller assembles context from snapshot/messages)
// ---------------------------------------------------------------------------

export interface ScheduleItemLike {
  time?: string;
  departure_time?: string;
  title?: string;
  name?: string;
  [key: string]: unknown;
}

export interface Tier0Context {
  /** Latest geofence-arrival spot title (metadata.spot_title). */
  spotTitle: string | null;
  /** Resolved SpotArrivalContent of that arrival (metadata.content). */
  content: SpotArrivalContent | null;
  schedule: ScheduleItemLike[];
  /**
   * Active free-time / meeting countdown, derived by the caller from
   * lib/tour-room/notices.ts activeNotice() (the NoticeBanner's source of
   * truth — expiry, cancellation, and extension rules live there).
   */
  freeTime: { remainingMs: number; point: string | null } | null;
  nowMs: number;
}

export interface Tier0Answer {
  text: string;
  /** false = honest "no data" fallback (still a terminal Tier 0 answer). */
  answered: boolean;
}

function kstNowHm(nowMs: number): string | null {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(nowMs));
  } catch {
    return null;
  }
}

function minutesUntil(targetHm: string, nowMs: number): number | null {
  const now = kstNowHm(nowMs);
  const target = /^(\d{2}):(\d{2})/.exec(targetHm);
  const current = now ? /^(\d{2}):(\d{2})/.exec(now) : null;
  if (!target || !current) return null;
  return Number(target[1]) * 60 + Number(target[2]) - (Number(current[1]) * 60 + Number(current[2]));
}

function scheduleTitle(item: ScheduleItemLike): string {
  return String(item.title ?? item.name ?? '').trim();
}

function nextScheduleItem(
  schedule: ScheduleItemLike[],
  nowMs: number,
): { item: ScheduleItemLike; time: string } | null {
  const now = kstNowHm(nowMs);
  if (!now) return null;
  for (const item of schedule) {
    const start = String(item.time ?? '').slice(0, 5);
    if (/^\d{2}:\d{2}$/.test(start) && start > now) return { item, time: start };
  }
  return null;
}

export function answerTier0(intent: ConciergeIntent, ctx: Tier0Context, locale: RoomLocale): Tier0Answer {
  switch (intent) {
    case 'restroom': {
      const info = ctx.content?.convenience?.restroom || ctx.content?.smartNotes?.facilities;
      if (info && ctx.spotTitle) {
        return { text: renderConciergeAnswer('restroom_info', locale, { spot: ctx.spotTitle, info }), answered: true };
      }
      return { text: renderConciergeAnswer('restroom_none', locale), answered: false };
    }
    case 'photo_spot': {
      const info = ctx.content?.smartNotes?.photo;
      if (info && ctx.spotTitle) {
        return { text: renderConciergeAnswer('photo_info', locale, { spot: ctx.spotTitle, info }), answered: true };
      }
      return { text: renderConciergeAnswer('photo_none', locale), answered: false };
    }
    case 'next_stop': {
      if (ctx.schedule.length === 0) {
        return { text: renderConciergeAnswer('schedule_none', locale), answered: false };
      }
      const next = nextScheduleItem(ctx.schedule, ctx.nowMs);
      if (!next) {
        return { text: renderConciergeAnswer('schedule_done', locale), answered: true };
      }
      return {
        text: renderConciergeAnswer('next_stop_info', locale, { title: scheduleTitle(next.item), time: next.time }),
        answered: true,
      };
    }
    case 'time_left': {
      if (ctx.freeTime) {
        const minutes = Math.max(0, Math.round(ctx.freeTime.remainingMs / 60_000));
        const point = ctx.freeTime.point ? ` · ${ctx.freeTime.point}` : '';
        return { text: renderConciergeAnswer('time_left_free', locale, { minutes, point }), answered: true };
      }
      const next = nextScheduleItem(ctx.schedule, ctx.nowMs);
      if (next) {
        const minutes = minutesUntil(next.time, ctx.nowMs);
        if (minutes !== null && minutes >= 0) {
          return {
            text: renderConciergeAnswer('time_left_next', locale, {
              minutes,
              title: scheduleTitle(next.item),
              time: next.time,
            }),
            answered: true,
          };
        }
      }
      return { text: renderConciergeAnswer('time_none', locale), answered: false };
    }
  }
}

// ---------------------------------------------------------------------------
// Context extraction helpers (shared by panel + endpoint)
// ---------------------------------------------------------------------------

interface MessageLike {
  metadata?: Record<string, unknown> | null;
  created_at?: string;
}

/** Latest geofence arrival → { spotTitle, content } (null-safe). */
export function latestArrivalContext(messages: MessageLike[]): {
  spotTitle: string | null;
  content: SpotArrivalContent | null;
} {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const metadata = messages[i]?.metadata;
    if (metadata?.kind === 'spot_arrival') {
      const content = metadata.content;
      return {
        spotTitle: typeof metadata.spot_title === 'string' ? metadata.spot_title : null,
        content:
          content && typeof content === 'object' && Object.keys(content as object).length > 0
            ? (content as SpotArrivalContent)
            : null,
      };
    }
  }
  return { spotTitle: null, content: null };
}

