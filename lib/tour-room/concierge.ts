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
import type { RoomLifecycle } from '@/lib/tour-room/time';
import { selectFacilityPins, type FacilityKind, type FacilityPin } from '@/lib/tour-room/facilityPins';

// ---------------------------------------------------------------------------
// Intents & guardrails
// ---------------------------------------------------------------------------

export type ConciergeIntent = 'restroom' | 'photo_spot' | 'next_stop' | 'time_left' | 'restaurant';

export type ConciergeGuardrail = 'emergency' | 'ops_request' | 'venue_recommendation';

interface KeywordSet {
  latin: string[];
  cjk: string[];
}

const INTENT_KEYWORDS: Record<ConciergeIntent, KeywordSet> = {
  restroom: {
    latin: ['restroom', 'toilet', 'bathroom', 'washroom', 'wc', 'baño', 'banos', 'aseo', 'servicios'],
    cjk: ['화장실', 'トイレ', 'お手洗い', '洗面所', '厕所', '洗手间', '卫生间', '廁所', '洗手間', '衛生間'],
  },
  photo_spot: {
    latin: ['photo', 'picture', 'selfie', 'foto', 'instagram'],
    cjk: ['포토', '사진', '셀카', '写真', 'フォト', '撮影', '拍照', '照片', '打卡', '自拍'],
  },
  restaurant: {
    latin: ['restaurant', 'where to eat', 'where should we eat', 'good food', 'best food', 'good restaurant', 'hungry', 'lunch spot', 'dinner spot', 'donde comer', 'dónde comer', 'buen restaurante', 'restaurante'],
    cjk: ['맛집', '식당', '음식점', '먹을 곳', '먹을만한', '밥집', '뭐 먹', '뭐먹', 'レストラン', '美味しい店', 'おすすめの店', 'ご飯', '食事', '餐厅', '饭店', '好吃的', '美食', '餐廳', '飯店'],
  },
  next_stop: {
    latin: ['next stop', 'next place', 'where next', 'what next', 'siguiente parada', 'proxima parada', 'próxima parada', 'adonde vamos', 'adónde vamos'],
    cjk: ['다음 일정', '다음 장소', '다음 코스', '어디 가', '어디로 가', '次の予定', '次はどこ', 'この後どこ', '下一站', '接下来去', '下个地方', '接下來去', '下個地方'],
  },
  time_left: {
    latin: ['time left', 'how much time', 'how long do we have', 'until when', 'what time do we leave', 'when do we leave', 'cuanto tiempo', 'cuánto tiempo', 'hasta que hora', 'hasta qué hora', 'a que hora salimos', 'a qué hora salimos'],
    cjk: ['남은 시간', '몇 시까지', '언제까지', '언제 출발', '몇시까지', '몇 시에 출발', 'あと何分', '何時まで', '何時に出発', 'いつ出発', '还有多久', '几点出发', '几点集合', '集合时间', '還有多久', '幾點出發', '幾點集合', '集合時間'],
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
    // A7.1 — the leak-hunt corpus (conciergeGuardrailLeak.test.ts) added the
    // distress phrasings a real guest types that the original dictionary missed:
    // faint/collapse/passed out/can't breathe/choking/seizure/chest pain/
    // allergic reaction, and the bare Korea emergency numbers 119/112. An
    // emergency that leaks to the LLM instead of the SOS/119 path is a P0.
    latin: ['ambulance', 'police', 'hospital', 'emergency', 'injured', 'bleeding', 'unconscious', 'heart attack', 'faint', 'fainted', 'collapse', 'collapsed', 'passed out', 'breathe', 'breathing', 'choking', 'choke', 'seizure', 'chest pain', 'allergic reaction', 'anaphylaxis', '119', '112', 'ambulancia', 'policia', 'policía', 'emergencia', 'herido', 'sangrando', 'desmayó', 'no puede respirar'],
    cjk: ['응급', '구급차', '경찰', '병원', '다쳤', '피가', '의식이', '쓰러졌', '쓰러져', '기절', '숨을 못', '숨을 안', '숨이 안', '발작', '가슴 통증', '가슴이 아프', '救急', '警察', '病院', '怪我', '出血', '意識', '倒れ', '気を失', '息ができ', '窒息', '発作', '救护车', '医院', '受伤', '流血', '晕倒', '失去意识', '意识', '窒息', '心脏病', '发作', '救護車', '醫院', '受傷', '暈倒', '失去意識', '心臟病', '發作', '叫救護車', '需要急救'],
  },
  ops_request: {
    latin: ['refund', 'cancel', 'reschedule', 'change the schedule', 'change the itinerary', 'change the time', 'rebook', 'discount', 'reembolso', 'cancelar', 'cambiar la hora', 'cambiar el itinerario', 'descuento'],
    cjk: ['환불', '취소', '일정 변경', '일정을 바꿔', '시간 바꿔', '시간을 바꿔', '변경해', '바꿔주', '할인', '返金', 'キャンセル', '予定変更', '日程変更', '時間変更', '割引', '退款', '取消', '改时间', '更改行程', '改行程', '折扣', '改時間', '更改行程', '退費'],
  },
  venue_recommendation: {
    latin: ['restaurant', 'where to eat', 'where should we eat', 'good food', 'best food', 'cafe nearby', 'shopping', 'where to buy', 'souvenir shop', 'restaurante', 'donde comer', 'dónde comer', 'compras', 'tienda'],
    cjk: ['맛집', '식당 추천', '음식점 추천', '먹을 곳', '먹을만한', '쇼핑', '살 만한', '기념품 가게', '美味しい店', 'レストラン', 'おすすめの店', '買い物', 'お土産屋', '好吃的', '餐厅', '饭店', '购物', '纪念品店', '餐廳', '飯店', '購物', '紀念品店'],
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
  for (const intent of ['time_left', 'next_stop', 'restroom', 'photo_spot', 'restaurant'] as const) {
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
    label: { en: 'Restroom', ko: '화장실', ja: 'トイレ', es: 'Baños', zh: '洗手间', 'zh-TW': '洗手間', fr: 'Toilettes', de: 'Toilette', ru: 'Туалет', it: 'Bagno' },
  },
  {
    intent: 'photo_spot',
    label: { en: 'Photo spot', ko: '포토스팟', ja: '写真スポット', es: 'Mejor foto', zh: '拍照点', 'zh-TW': '拍照點', fr: 'Spot photo', de: 'Fotospot', ru: 'Фотоспот', it: 'Punto foto' },
  },
  {
    intent: 'restaurant',
    label: { en: 'Food nearby', ko: '맛집', ja: '近くの店', es: 'Comer cerca', zh: '附近餐厅', 'zh-TW': '附近餐廳', fr: 'Où manger', de: 'Essen in der Nähe', ru: 'Где поесть', it: 'Dove mangiare' },
  },
  {
    intent: 'next_stop',
    label: { en: 'Next stop', ko: '다음 일정', ja: '次の予定', es: 'Siguiente parada', zh: '下一站', 'zh-TW': '下一站', fr: 'Prochaine étape', de: 'Nächster Stopp', ru: 'Куда дальше', it: 'Prossima tappa' },
  },
  {
    intent: 'time_left',
    label: { en: 'Time left', ko: '남은 시간', ja: '残り時間', es: 'Tiempo restante', zh: '剩余时间', 'zh-TW': '剩餘時間', fr: 'Temps restant', de: 'Restzeit', ru: 'Сколько осталось', it: 'Tempo rimasto' },
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
    /** A1 — first-visit tooltip on the header button. */
    hint: string;
    /** R7 — the camera button in the sheet (photo question). */
    photoAsk: string;
    photoAsking: string;
    /** A1 — chat-tab entry row label ("ask the Smart Guide"). */
    entryRow: string;
    /** C — label on an AI answer shown only on the asker's own screen. */
    aiLabel: string;
  }
> = {
  en: {
    title: 'Smart Guide',
    intro: 'Instant answers about today’s tour — restrooms, photo spots, schedule.',
    placeholder: 'Ask about today’s tour…',
    thinking: 'Checking…',
    error: 'Something went wrong — please try again or ask your guide.',
    send: 'Ask',
    hint: 'Ask me anything',
    photoAsk: 'Ask about a photo',
    photoAsking: 'Reading the photo…',
    entryRow: 'Ask the Smart Guide',
    aiLabel: 'Smart Guide · AI',
  },
  ko: {
    title: '스마트 가이드',
    intro: '오늘 투어에 대한 즉답 — 화장실·포토스팟·일정.',
    placeholder: '오늘 투어에 대해 물어보세요…',
    thinking: '확인 중…',
    error: '문제가 발생했어요 — 다시 시도하거나 가이드에게 물어보세요.',
    send: '질문',
    hint: '무엇이든 물어보세요',
    photoAsk: '사진으로 물어보기',
    photoAsking: '사진 읽는 중…',
    entryRow: '스마트 가이드에게 물어보기',
    aiLabel: '스마트 가이드 · AI',
  },
  ja: {
    title: 'スマートガイド',
    intro: '本日のツアーに即答 — トイレ・写真スポット・予定。',
    placeholder: '本日のツアーについて質問…',
    thinking: '確認中…',
    error: 'エラーが発生しました — もう一度試すか、ガイドにお尋ねください。',
    send: '質問',
    hint: '何でも聞いてください',
    photoAsk: '写真で質問',
    photoAsking: '写真を読み取り中…',
    entryRow: 'スマートガイドに質問',
    aiLabel: 'スマートガイド · AI',
  },
  es: {
    title: 'Guía inteligente',
    intro: 'Respuestas al instante sobre el tour de hoy: baños, fotos, horario.',
    placeholder: 'Pregunta sobre el tour de hoy…',
    thinking: 'Consultando…',
    error: 'Algo salió mal — inténtalo de nuevo o pregunta a tu guía.',
    send: 'Preguntar',
    hint: 'Pregúntame lo que sea',
    photoAsk: 'Preguntar con una foto',
    photoAsking: 'Leyendo la foto…',
    entryRow: 'Pregunta a la Guía inteligente',
    aiLabel: 'Guía inteligente · IA',
  },
  zh: {
    title: '智能向导',
    intro: '即时解答今日行程 — 洗手间、拍照点、日程。',
    placeholder: '询问今天的行程…',
    thinking: '查询中…',
    error: '出了点问题 — 请重试或询问导游。',
    send: '提问',
    hint: '有问题尽管问',
    photoAsk: '用照片提问',
    photoAsking: '正在识别照片…',
    entryRow: '向智能向导提问',
    aiLabel: '智能向导 · AI',
  },
  'zh-TW': {
    title: '智慧導覽',
    intro: '即時解答今日行程 — 洗手間、拍照點、行程安排。',
    placeholder: '詢問今天的行程…',
    thinking: '查詢中…',
    error: '出了點問題 — 請再試一次或詢問導遊。',
    send: '提問',
    hint: '有問題儘管問',
    photoAsk: '用照片提問',
    photoAsking: '正在辨識照片…',
    entryRow: '向智慧導覽提問',
    aiLabel: '智慧導覽 · AI',
  },
  fr: {
    title: 'Guide intelligent',
    intro: 'Réponses immédiates sur le tour du jour — toilettes, spots photo, programme.',
    placeholder: 'Une question sur le tour du jour…',
    thinking: 'Vérification…',
    error: 'Une erreur est survenue — réessayez ou demandez à votre guide.',
    send: 'Demander',
    hint: 'Posez-moi vos questions',
    photoAsk: 'Poser une question avec une photo',
    photoAsking: 'Lecture de la photo…',
    entryRow: 'Demander au Guide intelligent',
    aiLabel: 'Guide intelligent · IA',
  },
  de: {
    title: 'Smart Guide',
    intro: 'Sofort-Antworten zur heutigen Tour — Toiletten, Fotospots, Programm.',
    placeholder: 'Frage zur heutigen Tour…',
    thinking: 'Wird geprüft…',
    error: 'Etwas ist schiefgelaufen — versuchen Sie es erneut oder fragen Sie Ihren Guide.',
    send: 'Fragen',
    hint: 'Fragen Sie mich alles',
    photoAsk: 'Mit einem Foto fragen',
    photoAsking: 'Foto wird gelesen…',
    entryRow: 'Den Smart Guide fragen',
    aiLabel: 'Smart Guide · KI',
  },
  ru: {
    title: 'Умный гид',
    intro: 'Мгновенные ответы о сегодняшнем туре — туалеты, фотоместа, расписание.',
    placeholder: 'Спросите о сегодняшнем туре…',
    thinking: 'Проверяем…',
    error: 'Что-то пошло не так — попробуйте еще раз или спросите гида.',
    send: 'Спросить',
    hint: 'Спрашивайте о чем угодно',
    photoAsk: 'Спросить по фото',
    photoAsking: 'Читаю фото…',
    entryRow: 'Спросить Умного гида',
    aiLabel: 'Умный гид · ИИ',
  },
  it: {
    title: 'Guida smart',
    intro: 'Risposte immediate sul tour di oggi — bagni, punti foto, programma.',
    placeholder: 'Chiedi qualcosa sul tour di oggi…',
    thinking: 'Un attimo…',
    error: 'Qualcosa è andato storto — riprova o chiedi alla tua guida.',
    send: 'Chiedi',
    hint: 'Chiedimi quello che vuoi',
    photoAsk: 'Chiedi con una foto',
    photoAsking: 'Sto leggendo la foto…',
    entryRow: 'Chiedi alla Guida smart',
    aiLabel: 'Guida smart · IA',
  },
};

/** {spot}/{info}/{title}/{time}/{minutes}/{point}/{q} interpolate verbatim. */
type AnswerKind =
  | 'restroom_info'
  | 'restroom_map'
  | 'restroom_none'
  | 'photo_info'
  | 'photo_map'
  | 'photo_none'
  | 'restaurant_map'
  | 'next_stop_info'
  | 'next_stop_lobby'
  | 'time_lobby'
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
    'zh-TW': '{spot} — {info}',
    fr: '{spot} — {info}',
    de: '{spot} — {info}',
    ru: '{spot} — {info}',
    it: '{spot} — {info}',
  },
  restroom_map: {
    en: '🚻 {spot} — {count} restroom(s) nearby. Tap a pin for directions.',
    ko: '🚻 {spot} — 근처 화장실 {count}곳이에요. 핀을 누르면 길안내가 열려요.',
    ja: '🚻 {spot} — 近くのトイレ{count}か所です。ピンをタップで道案内。',
    es: '🚻 {spot} — {count} baño(s) cerca. Toca un pin para llegar.',
    zh: '🚻 {spot} — 附近有{count}处洗手间。点击图钉查看路线。',
    'zh-TW': '🚻 {spot} — 附近有{count}處洗手間。點一下圖釘查看路線。',
    fr: '🚻 {spot} — {count} toilettes à proximité. Touchez un repère pour l’itinéraire.',
    de: '🚻 {spot} — {count} Toilette(n) in der Nähe. Tippen Sie auf einen Pin für den Weg.',
    ru: '🚻 {spot} — туалетов рядом: {count}. Нажмите на метку, чтобы построить маршрут.',
    it: '🚻 {spot} — {count} bagno/i nelle vicinanze. Tocca un pin per le indicazioni.',
  },
  restroom_none: {
    en: 'I don’t have restroom details for this spot — your guide will know best. You can also send the “Restroom” quick reply in chat.',
    ko: '이 스팟의 화장실 정보가 없어요 — 가이드가 가장 잘 알아요. 채팅의 "화장실" 퀵답장으로 바로 물어볼 수도 있어요.',
    ja: 'このスポットのトイレ情報がありません — ガイドが一番よく知っています。チャットの「トイレ」クイック返信でも聞けます。',
    es: 'No tengo datos de baños para este punto — tu guía lo sabrá mejor. También puedes enviar la respuesta rápida de “baño” en el chat.',
    zh: '暂无此景点的洗手间信息 — 导游最清楚。也可以在聊天中发送"洗手间"快捷回复。',
    'zh-TW': '目前沒有這個景點的洗手間資訊 — 導遊最清楚。也可以在聊天中傳送「洗手間」快速回覆。',
    fr: 'Je n’ai pas d’infos sur les toilettes pour ce lieu — votre guide saura vous renseigner. Vous pouvez aussi envoyer la réponse rapide « Toilettes » dans le chat.',
    de: 'Für diesen Ort habe ich keine Toiletten-Infos — Ihr Guide weiß es am besten. Sie können im Chat auch die Schnellantwort „Toilette“ senden.',
    ru: 'У меня нет данных о туалетах для этого места — лучше всех подскажет гид. Можно также отправить в чате быстрый ответ «Туалет».',
    it: 'Non ho informazioni sui bagni per questo posto — la tua guida saprà dirti meglio. Puoi anche inviare la risposta rapida “Bagno” in chat.',
  },
  photo_info: {
    en: '📸 {spot} — {info}',
    ko: '📸 {spot} — {info}',
    ja: '📸 {spot} — {info}',
    es: '📸 {spot} — {info}',
    zh: '📸 {spot} — {info}',
    'zh-TW': '📸 {spot} — {info}',
    fr: '📸 {spot} — {info}',
    de: '📸 {spot} — {info}',
    ru: '📸 {spot} — {info}',
    it: '📸 {spot} — {info}',
  },
  photo_map: {
    en: '📸 {spot} — {count} photo spot(s) marked. Tap a pin for directions.',
    ko: '📸 {spot} — 포토스팟 {count}곳을 찍어뒀어요. 핀을 누르면 길안내가 열려요.',
    ja: '📸 {spot} — 写真スポット{count}か所です。ピンをタップで道案内。',
    es: '📸 {spot} — {count} punto(s) de foto. Toca un pin para llegar.',
    zh: '📸 {spot} — 已标记{count}处拍照点。点击图钉查看路线。',
    'zh-TW': '📸 {spot} — 已標記{count}處拍照點。點一下圖釘查看路線。',
    fr: '📸 {spot} — {count} spot(s) photo repérés. Touchez un repère pour l’itinéraire.',
    de: '📸 {spot} — {count} Fotospot(s) markiert. Tippen Sie auf einen Pin für den Weg.',
    ru: '📸 {spot} — отмечено фотомест: {count}. Нажмите на метку, чтобы построить маршрут.',
    it: '📸 {spot} — {count} punto/i foto segnati. Tocca un pin per le indicazioni.',
  },
  restaurant_map: {
    en: '🍽️ {spot} — {count} top-rated restaurant(s) nearby (by rating & reviews). Tap for directions.',
    ko: '🍽️ {spot} — 근처 평점 높은 맛집 {count}곳이에요 (평점·리뷰순). 핀을 누르면 길안내가 열려요.',
    ja: '🍽️ {spot} — 近くの高評価レストラン{count}軒です（評価・口コミ順）。ピンで道案内。',
    es: '🍽️ {spot} — {count} restaurante(s) mejor valorados cerca (por reseñas). Toca para llegar.',
    zh: '🍽️ {spot} — 附近{count}家高分餐厅（按评分·评论）。点击查看路线。',
    'zh-TW': '🍽️ {spot} — 附近{count}家高評價餐廳（依評分·評論）。點一下查看路線。',
    fr: '🍽️ {spot} — {count} restaurant(s) bien notés à proximité (notes et avis). Touchez pour l’itinéraire.',
    de: '🍽️ {spot} — {count} Top-Restaurant(s) in der Nähe (nach Bewertungen). Zum Navigieren antippen.',
    ru: '🍽️ {spot} — ресторанов с высоким рейтингом рядом: {count} (по оценкам и отзывам). Нажмите, чтобы построить маршрут.',
    it: '🍽️ {spot} — {count} ristorante/i più votati nelle vicinanze (per valutazioni e recensioni). Tocca per le indicazioni.',
  },
  photo_none: {
    en: 'No photo tips saved for this spot yet — ask your guide for the best angle!',
    ko: '이 스팟의 포토 팁이 아직 없어요 — 가이드에게 베스트 앵글을 물어보세요!',
    ja: 'このスポットの写真のコツはまだありません — ベストアングルはガイドに聞いてみましょう！',
    es: 'Aún no hay consejos de foto para este punto — ¡pregunta a tu guía por el mejor ángulo!',
    zh: '此景点还没有拍照小贴士 — 问问导游最佳角度吧！',
    'zh-TW': '這個景點還沒有拍照小訣竅 — 問問導遊最佳角度吧！',
    fr: 'Pas encore de conseils photo pour ce lieu — demandez le meilleur angle à votre guide!',
    de: 'Für diesen Ort gibt es noch keine Fototipps — fragen Sie Ihren Guide nach dem besten Winkel!',
    ru: 'Для этого места пока нет фотосоветов — спросите у гида лучший ракурс!',
    it: 'Nessun consiglio foto per questo posto, per ora — chiedi alla tua guida l’inquadratura migliore!',
  },
  next_stop_info: {
    en: 'Next: {title} ({time})',
    ko: '다음 일정: {title} ({time})',
    ja: '次の予定: {title} ({time})',
    es: 'Siguiente: {title} ({time})',
    zh: '下一站：{title}（{time}）',
    'zh-TW': '下一站：{title}（{time}）',
    fr: 'Prochaine étape: {title} ({time})',
    de: 'Als Nächstes: {title} ({time})',
    ru: 'Дальше: {title} ({time})',
    it: 'Prossima tappa: {title} ({time})',
  },
  next_stop_lobby: {
    en: 'The tour hasn’t started yet — first stop: {title} ({time}). Pickup details are on the Today tab.',
    ko: '아직 투어 시작 전이에요 — 첫 일정: {title} ({time}). 픽업 정보는 "오늘 일정" 탭에서 확인하세요.',
    ja: 'ツアーはまだ始まっていません — 最初の予定: {title}（{time}）。集合情報は「本日」タブでご確認ください。',
    es: 'El tour aún no ha comenzado — primera parada: {title} ({time}). Los detalles de recogida están en la pestaña Hoy.',
    zh: '行程尚未开始 — 第一站：{title}（{time}）。接送信息请查看"今日"标签。',
    'zh-TW': '行程還沒開始 — 第一站：{title}（{time}）。接送資訊請查看「今日」分頁。',
    fr: 'Le tour n’a pas encore commencé — première étape: {title} ({time}). Les infos de prise en charge sont dans l’onglet Aujourd’hui.',
    de: 'Die Tour hat noch nicht begonnen — erster Stopp: {title} ({time}). Die Abholdetails stehen im Tab „Heute“.',
    ru: 'Тур еще не начался — первая остановка: {title} ({time}). Детали трансфера — на вкладке «Сегодня».',
    it: 'Il tour non è ancora iniziato — prima tappa: {title} ({time}). I dettagli del pick-up sono nella scheda Oggi.',
  },
  time_lobby: {
    en: '⏳ It isn’t the tour day yet — no timer is running. Pickup time and place are on the Today tab.',
    ko: '⏳ 아직 투어 당일이 아니에요 — 진행 중인 타이머가 없어요. 픽업 시간·장소는 "오늘 일정" 탭에 있어요.',
    ja: '⏳ まだツアー当日ではありません — 進行中のタイマーはありません。集合時間・場所は「本日」タブにあります。',
    es: '⏳ Aún no es el día del tour — no hay temporizador activo. La hora y el punto de recogida están en la pestaña Hoy.',
    zh: '⏳ 还没到行程当天 — 当前没有倒计时。集合时间和地点请查看"今日"标签。',
    'zh-TW': '⏳ 還沒到行程當天 — 目前沒有倒數計時。集合時間和地點請查看「今日」分頁。',
    fr: '⏳ Ce n’est pas encore le jour du tour — aucun minuteur en cours. L’heure et le lieu de prise en charge sont dans l’onglet Aujourd’hui.',
    de: '⏳ Es ist noch nicht der Tourtag — kein Timer aktiv. Abholzeit und -ort stehen im Tab „Heute“.',
    ru: '⏳ День тура еще не наступил — таймер не запущен. Время и место трансфера — на вкладке «Сегодня».',
    it: '⏳ Non è ancora il giorno del tour — nessun timer attivo. Orario e luogo del pick-up sono nella scheda Oggi.',
  },
  schedule_done: {
    en: 'Today’s scheduled stops are done — enjoy the rest of the day!',
    ko: '오늘 예정된 일정은 모두 끝났어요 — 남은 하루를 즐기세요!',
    ja: '本日の予定はすべて終了しました — 残りの時間をお楽しみください！',
    es: 'Las paradas programadas de hoy han terminado — ¡disfruta el resto del día!',
    zh: '今天的行程都结束了 — 好好享受剩下的时光！',
    'zh-TW': '今天的行程都結束了 — 好好享受剩下的時光！',
    fr: 'Les étapes prévues aujourd’hui sont terminées — profitez du reste de la journée!',
    de: 'Die geplanten Stopps für heute sind geschafft — genießen Sie den Rest des Tages!',
    ru: 'Запланированные на сегодня остановки завершены — наслаждайтесь оставшимся днем!',
    it: 'Le tappe in programma per oggi sono finite — goditi il resto della giornata!',
  },
  schedule_none: {
    en: 'I don’t have today’s schedule on hand — check the Today tab or ask your guide.',
    ko: '지금 일정 정보를 불러올 수 없어요 — "오늘 일정" 탭을 확인하거나 가이드에게 물어보세요.',
    ja: '予定情報が見つかりません — 「本日」タブを確認するか、ガイドにお尋ねください。',
    es: 'No tengo el horario a mano — revisa la pestaña Hoy o pregunta a tu guía.',
    zh: '暂时无法获取日程 — 请查看"今日"标签或询问导游。',
    'zh-TW': '暫時無法取得行程資訊 — 請查看「今日」分頁或詢問導遊。',
    fr: 'Je n’ai pas le programme du jour sous la main — consultez l’onglet Aujourd’hui ou demandez à votre guide.',
    de: 'Ich habe den heutigen Plan gerade nicht zur Hand — schauen Sie in den Tab „Heute“ oder fragen Sie Ihren Guide.',
    ru: 'У меня нет под рукой сегодняшнего расписания — загляните на вкладку «Сегодня» или спросите гида.',
    it: 'Non ho sottomano il programma di oggi — controlla la scheda Oggi o chiedi alla tua guida.',
  },
  time_left_free: {
    en: '⏳ About {minutes} min until gathering{point}.',
    ko: '⏳ 집합까지 약 {minutes}분 남았어요{point}.',
    ja: '⏳ 集合まで約{minutes}分です{point}。',
    es: '⏳ Quedan unos {minutes} min para reunirse{point}.',
    zh: '⏳ 距离集合还有约{minutes}分钟{point}。',
    'zh-TW': '⏳ 距離集合還有約{minutes}分鐘{point}。',
    fr: '⏳ Environ {minutes} min avant le rassemblement{point}.',
    de: '⏳ Noch etwa {minutes} Min. bis zum Treffen{point}.',
    ru: '⏳ До сбора около {minutes} мин{point}.',
    it: '⏳ Circa {minutes} min al ritrovo{point}.',
  },
  time_left_next: {
    en: '⏳ About {minutes} min until the next stop: {title} ({time}).',
    ko: '⏳ 다음 일정까지 약 {minutes}분 — {title} ({time}).',
    ja: '⏳ 次の予定まで約{minutes}分 — {title}（{time}）。',
    es: '⏳ Unos {minutes} min hasta la siguiente parada: {title} ({time}).',
    zh: '⏳ 距离下一站约{minutes}分钟 — {title}（{time}）。',
    'zh-TW': '⏳ 距離下一站約{minutes}分鐘 — {title}（{time}）。',
    fr: '⏳ Environ {minutes} min avant la prochaine étape: {title} ({time}).',
    de: '⏳ Noch etwa {minutes} Min. bis zum nächsten Stopp: {title} ({time}).',
    ru: '⏳ До следующей остановки около {minutes} мин — {title} ({time}).',
    it: '⏳ Circa {minutes} min alla prossima tappa: {title} ({time}).',
  },
  time_none: {
    en: 'No timer is running right now — your guide will announce the next gathering time.',
    ko: '지금 진행 중인 타이머가 없어요 — 다음 집합 시간은 가이드가 안내할 거예요.',
    ja: '現在進行中のタイマーはありません — 次の集合時間はガイドがご案内します。',
    es: 'No hay temporizador activo — tu guía anunciará la próxima hora de reunión.',
    zh: '当前没有倒计时 — 下次集合时间将由导游通知。',
    'zh-TW': '目前沒有倒數計時 — 下次集合時間導遊會再通知。',
    fr: 'Aucun minuteur en cours — votre guide annoncera la prochaine heure de rendez-vous.',
    de: 'Gerade läuft kein Timer — Ihr Guide gibt die nächste Treffzeit bekannt.',
    ru: 'Сейчас таймер не запущен — гид объявит следующее время сбора.',
    it: 'Al momento nessun timer attivo — la tua guida annuncerà il prossimo orario di ritrovo.',
  },
  emergency: {
    en: '🚨 For an emergency, tap the red shield at the top right to open emergency contacts and the SOS button. Korea: 119 (fire/medical) · 112 (police) · 1330 (tourist line, 24h).',
    ko: '🚨 응급 상황이라면 우측 상단의 빨간 방패 아이콘을 눌러 긴급 연락처와 SOS 버튼을 여세요. 한국: 119(화재·구급) · 112(경찰) · 1330(관광통역, 24시간).',
    ja: '🚨 緊急の場合は右上の赤い盾アイコンから緊急連絡先とSOSボタンを開いてください。韓国: 119（消防・救急）・112（警察）・1330（観光通訳、24時間）。',
    es: '🚨 En una emergencia, toca el escudo rojo arriba a la derecha para abrir los contactos de emergencia y el botón SOS. Corea: 119 (bomberos/médica) · 112 (policía) · 1330 (línea turística, 24h).',
    zh: '🚨 如遇紧急情况，请点击右上角的红色盾牌图标，打开紧急联系方式和SOS按钮。韩国：119（消防/急救）· 112（警察）· 1330（旅游热线，24小时）。',
    'zh-TW': '🚨 如遇緊急狀況，請點一下右上角的紅色盾牌圖示，開啟緊急聯絡方式和SOS按鈕。韓國：119（消防/急救）· 112（警察）· 1330（觀光諮詢專線，24小時）。',
    fr: '🚨 En cas d’urgence, touchez le bouclier rouge en haut à droite pour ouvrir les contacts d’urgence et le bouton SOS. Corée: 119 (pompiers/secours) · 112 (police) · 1330 (ligne touristique, 24h/24).',
    de: '🚨 Im Notfall tippen Sie auf das rote Schild oben rechts — dort finden Sie Notfallkontakte und den SOS-Knopf. Korea: 119 (Feuerwehr/Rettung) · 112 (Polizei) · 1330 (Touristen-Hotline, rund um die Uhr).',
    ru: '🚨 В экстренной ситуации нажмите красный щит вверху справа — там экстренные контакты и кнопка SOS. Корея: 119 (пожарные/скорая) · 112 (полиция) · 1330 (туристическая линия, круглосуточно).',
    it: '🚨 In caso di emergenza tocca lo scudo rosso in alto a destra per aprire i contatti di emergenza e il pulsante SOS. Corea: 119 (vigili del fuoco/ambulanza) · 112 (polizia) · 1330 (linea turistica, 24 ore su 24).',
  },
  escalated_ack: {
    en: 'That needs a human — I’ve passed your question to the guide and our team. They’ll reply here in chat.',
    ko: '이건 사람이 확인해야 해요 — 질문을 가이드와 운영팀에 전달했어요. 채팅으로 답변이 올 거예요.',
    ja: 'こちらは担当者の確認が必要です — ご質問をガイドと運営チームに伝えました。チャットで返信が届きます。',
    es: 'Esto necesita a una persona — he pasado tu pregunta al guía y a nuestro equipo. Te responderán aquí en el chat.',
    zh: '这需要人工处理 — 已将您的问题转给导游和运营团队，他们会在聊天中回复您。',
    'zh-TW': '這需要真人處理 — 已將您的問題轉給導遊和營運團隊，他們會在聊天中回覆您。',
    fr: 'Il faut une personne pour ça — j’ai transmis votre question au guide et à notre équipe. La réponse arrivera ici, dans le chat.',
    de: 'Das braucht einen Menschen — ich habe Ihre Frage an den Guide und unser Team weitergegeben. Die Antwort kommt hier im Chat.',
    ru: 'Здесь нужен человек — я передал ваш вопрос гиду и нашей команде. Ответ придет сюда, в чат.',
    it: 'Qui serve una persona — ho passato la tua domanda alla guida e al nostro team. Ti risponderanno qui in chat.',
  },
  venue_refusal: {
    en: 'I don’t recommend restaurants or shops I can’t vouch for — your guide knows the trustworthy local picks, so please ask them!',
    ko: '확인되지 않은 맛집·상점은 추천하지 않아요 — 믿을 만한 현지 정보는 가이드가 가장 잘 알고 있으니 직접 물어보세요!',
    ja: '確認できていないお店はおすすめしません — 信頼できる地元情報はガイドが一番詳しいので、ぜひ聞いてみてください！',
    es: 'No recomiendo restaurantes o tiendas que no pueda garantizar — tu guía conoce los sitios locales de confianza, ¡pregúntale!',
    zh: '我不推荐未经确认的餐厅或商店 — 导游最了解可靠的本地好去处，请直接问他们！',
    'zh-TW': '我不推薦未經確認的餐廳或商店 — 導遊最了解可靠的在地好去處，請直接問他們！',
    fr: 'Je ne recommande pas de restaurants ou boutiques que je ne peux pas garantir — votre guide connaît les bonnes adresses locales, demandez-lui!',
    de: 'Ich empfehle keine Restaurants oder Läden, für die ich nicht bürgen kann — Ihr Guide kennt die verlässlichen Tipps vor Ort, fragen Sie ihn einfach!',
    ru: 'Я не советую рестораны и магазины, за которые не могу поручиться — гид знает проверенные местные места, спросите у него!',
    it: 'Non consiglio ristoranti o negozi che non posso garantire — la tua guida conosce gli indirizzi locali affidabili, chiediglielo!',
  },
  scope_refusal: {
    en: 'I can only help with today’s tour — for anything else, our team chat on the AtoC site is happy to help.',
    ko: '저는 오늘 투어에 대해서만 도와드릴 수 있어요 — 다른 문의는 AtoC 사이트의 상담 채팅을 이용해 주세요.',
    ja: '本日のツアーに関することのみお手伝いできます — その他はAtoCサイトのチャットをご利用ください。',
    es: 'Solo puedo ayudarte con el tour de hoy — para lo demás, el chat del sitio de AtoC estará encantado de ayudarte.',
    zh: '我只能协助今天的行程 — 其他问题请使用AtoC网站上的客服聊天。',
    'zh-TW': '我只能協助今天的行程 — 其他問題請使用AtoC網站上的客服聊天。',
    fr: 'Je ne peux aider que pour le tour du jour — pour le reste, le chat de notre équipe sur le site AtoC se fera un plaisir de vous répondre.',
    de: 'Ich kann nur bei der heutigen Tour helfen — für alles andere hilft Ihnen der Team-Chat auf der AtoC-Website gern weiter.',
    ru: 'Я помогаю только с сегодняшним туром — по остальным вопросам вам с радостью ответят в чате на сайте AtoC.',
    it: 'Posso aiutarti solo con il tour di oggi — per tutto il resto c’è la chat del nostro team sul sito AtoC.',
  },
  budget_exhausted: {
    en: 'The Smart Guide is resting for today — your guide has every answer, just ask in chat!',
    ko: '스마트 가이드가 오늘은 쉬어가요 — 가이드가 모든 걸 알고 있으니 채팅으로 물어보세요!',
    ja: 'スマートガイドは本日お休みです — ガイドが何でも知っていますので、チャットでお尋ねください！',
    es: 'La guía inteligente descansa por hoy — tu guía tiene todas las respuestas, ¡pregunta en el chat!',
    zh: '智能向导今天休息啦 — 导游什么都知道，请在聊天中提问！',
    'zh-TW': '智慧導覽今天休息囉 — 導遊什麼都知道，請在聊天中發問！',
    fr: 'Le Guide intelligent se repose pour aujourd’hui — votre guide a réponse à tout, posez vos questions dans le chat!',
    de: 'Der Smart Guide macht für heute Pause — Ihr Guide weiß alles, fragen Sie einfach im Chat!',
    ru: 'Умный гид сегодня отдыхает — у гида есть ответы на все, просто спросите в чате!',
    it: 'La Guida smart per oggi riposa — la tua guida sa tutto, chiedi pure in chat!',
  },
  /** Feed capsule the guide/ops see when a question escalates (V3.3). */
  escalation_feed: {
    en: '🤝 Smart Guide passed a question to the team — {q}',
    ko: '🤝 스마트 가이드가 질문을 전달했어요 — {q}',
    ja: '🤝 スマートガイドが質問を転送しました — {q}',
    es: '🤝 La guía inteligente pasó una pregunta al equipo — {q}',
    zh: '🤝 智能向导已转达问题 — {q}',
    'zh-TW': '🤝 智慧導覽已轉達問題 — {q}',
    fr: '🤝 Le Guide intelligent a transmis une question à l’équipe — {q}',
    de: '🤝 Der Smart Guide hat eine Frage ans Team weitergegeben — {q}',
    ru: '🤝 Умный гид передал вопрос команде — {q}',
    it: '🤝 La Guida smart ha passato una domanda al team — {q}',
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
  count?: number;
}

function interpolate(template: string, params: ConciergeAnswerParams): string {
  return template
    .replaceAll('{spot}', params.spot ?? '')
    .replaceAll('{info}', params.info ?? '')
    .replaceAll('{title}', params.title ?? '')
    .replaceAll('{time}', params.time ?? '')
    .replaceAll('{minutes}', params.minutes === undefined ? '' : String(params.minutes))
    .replaceAll('{point}', params.point ?? '')
    .replaceAll('{q}', params.q ?? '')
    .replaceAll('{count}', params.count === undefined ? '' : String(params.count));
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
  /**
   * Current arrival spot's restroom/photo pins (metadata.facility_pins),
   * injected server-side at arrival so the restroom/photo answers can attach a
   * scoped map card with ZERO network. Empty/omitted → text-only fallback.
   */
  facilityPins?: FacilityPin[];
  schedule: ScheduleItemLike[];
  /**
   * Active free-time / meeting countdown, derived by the caller from
   * lib/tour-room/notices.ts activeNotice() (the NoticeBanner's source of
   * truth — expiry, cancellation, and extension rules live there).
   */
  freeTime: { remainingMs: number; point: string | null } | null;
  nowMs: number;
  /**
   * Room lifecycle (lib/tour-room/time.ts roomLifecycle). Before the tour day
   * ('lobby') the clock-only schedule comparison lies — e.g. joining the
   * evening before at 20:00 would report "today's stops are done". Omitted =
   * 'live' (legacy callers/tests).
   */
  lifecycle?: RoomLifecycle;
}

/** A scoped facility map card attached to a restroom/photo answer (F-D6). */
export interface ConciergeMapCard {
  kind: FacilityKind;
  pins: FacilityPin[];
}

export interface Tier0Answer {
  text: string;
  /** false = honest "no data" fallback (still a terminal Tier 0 answer). */
  answered: boolean;
  /** Present when the current spot has restroom/photo pins for this intent. */
  mapCard?: ConciergeMapCard;
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
      const pins = selectFacilityPins(ctx.facilityPins ?? [], 'restroom');
      const info = ctx.content?.convenience?.restroom || ctx.content?.smartNotes?.facilities;
      if (pins.length > 0) {
        // Pins win: show the scoped map. Prefer the curated blurb as the lead
        // line when we also have one, else a map-specific lead.
        const text =
          info && ctx.spotTitle
            ? renderConciergeAnswer('restroom_info', locale, { spot: ctx.spotTitle, info })
            : renderConciergeAnswer('restroom_map', locale, { spot: ctx.spotTitle ?? '', count: pins.length });
        return { text, answered: true, mapCard: { kind: 'restroom', pins } };
      }
      if (info && ctx.spotTitle) {
        return { text: renderConciergeAnswer('restroom_info', locale, { spot: ctx.spotTitle, info }), answered: true };
      }
      return { text: renderConciergeAnswer('restroom_none', locale), answered: false };
    }
    case 'photo_spot': {
      const pins = selectFacilityPins(ctx.facilityPins ?? [], 'photo');
      const info = ctx.content?.smartNotes?.photo;
      if (pins.length > 0) {
        const text =
          info && ctx.spotTitle
            ? renderConciergeAnswer('photo_info', locale, { spot: ctx.spotTitle, info })
            : renderConciergeAnswer('photo_map', locale, { spot: ctx.spotTitle ?? '', count: pins.length });
        return { text, answered: true, mapCard: { kind: 'photo', pins } };
      }
      if (info && ctx.spotTitle) {
        return { text: renderConciergeAnswer('photo_info', locale, { spot: ctx.spotTitle, info }), answered: true };
      }
      return { text: renderConciergeAnswer('photo_none', locale), answered: false };
    }
    case 'restaurant': {
      const pins = selectFacilityPins(ctx.facilityPins ?? [], 'restaurant');
      if (pins.length > 0) {
        return {
          text: renderConciergeAnswer('restaurant_map', locale, { spot: ctx.spotTitle ?? '', count: pins.length }),
          answered: true,
          mapCard: { kind: 'restaurant', pins },
        };
      }
      // No curated rating-backed picks for this spot → the honest venue refusal
      // (we never recommend food from LLM memory — §D-3).
      return { text: renderConciergeAnswer('venue_refusal', locale), answered: false };
    }
    case 'next_stop': {
      if (ctx.schedule.length === 0) {
        return { text: renderConciergeAnswer('schedule_none', locale), answered: false };
      }
      if ((ctx.lifecycle ?? 'live') === 'lobby') {
        const first = ctx.schedule[0];
        return {
          text: renderConciergeAnswer('next_stop_lobby', locale, {
            title: scheduleTitle(first),
            time: String(first.time ?? '').slice(0, 5),
          }),
          answered: true,
        };
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
      if ((ctx.lifecycle ?? 'live') === 'lobby') {
        return { text: renderConciergeAnswer('time_lobby', locale), answered: true };
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

/**
 * C — decide whether a free-text customer chat message warrants an instant,
 * on-screen-only Smart Guide answer, and produce it. Returns the answer text,
 * or null when the message isn't a Tier-0 info question — or is an emergency /
 * ops / venue ask that must route to a human instead of being auto-answered.
 *
 * Pure (client-only, zero network, zero LLM): the guardrail keeps the AI out of
 * anything with a human side effect, and the intent gate keeps it silent on
 * chit-chat, so it never talks over the guide in the shared feed.
 */
export function inlineConciergeAnswer(text: string, ctx: Tier0Context, locale: RoomLocale): Tier0Answer | null {
  const intent = matchConciergeIntent(text);
  // Food asks: serve this spot's curated, rating-ranked picks if we have them;
  // otherwise stay silent (fall through to the venue guardrail → no auto-answer,
  // the guide handles it). This is what lets us recommend restaurants at all
  // without violating §D-3 (never from LLM memory — only vetted data).
  if (intent === 'restaurant') {
    const answer = answerTier0('restaurant', ctx, locale);
    return answer.mapCard ? answer : null;
  }
  if (classifyConciergeGuardrail(text)) return null;
  if (!intent) return null;
  return answerTier0(intent, ctx, locale);
}

// ---------------------------------------------------------------------------
// Context extraction helpers (shared by panel + endpoint)
// ---------------------------------------------------------------------------

interface MessageLike {
  metadata?: Record<string, unknown> | null;
  created_at?: string;
}

export interface ArrivalContext {
  spotTitle: string | null;
  content: SpotArrivalContent | null;
  poiKey: string | null;
  facilityPins: FacilityPin[];
}

const EMPTY_ARRIVAL: ArrivalContext = { spotTitle: null, content: null, poiKey: null, facilityPins: [] };

/**
 * Metadata kinds that mean "the group is AT this spot now".
 *
 * `arrival_bundle` is not optional: the A0 one-tap bundle replaced the geofence
 * `spot_arrival` on every operator-driven tour, so a bundle-only room used to
 * hand the concierge no spot context at all — every restroom / photo / food ask
 * fell back to "ask your guide" even though the answer was sitting in the feed.
 */
const ARRIVAL_KINDS = new Set(['spot_arrival', 'arrival_bundle']);

function arrivalFrom(metadata: Record<string, unknown>): ArrivalContext {
  const content = metadata.content;
  const rawPins = metadata.facility_pins;
  return {
    spotTitle: typeof metadata.spot_title === 'string' ? metadata.spot_title : null,
    content:
      content && typeof content === 'object' && Object.keys(content as object).length > 0
        ? (content as SpotArrivalContent)
        : null,
    poiKey: typeof metadata.poi_key === 'string' ? metadata.poi_key : null,
    facilityPins: Array.isArray(rawPins) ? (rawPins as FacilityPin[]) : [],
  };
}

/**
 * Newest arrival → { spotTitle, content, poiKey, facilityPins }.
 *
 * An `approach_card` is only a WEAK fallback: it means "we are 1 km out", not
 * "we are here", so it is used only when no real arrival exists in the window.
 * That still beats a null context — the approaching stop is the one the guest
 * is asking about.
 */
export function latestArrivalContext(messages: MessageLike[]): ArrivalContext {
  let weak: ArrivalContext | null = null;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const metadata = messages[i]?.metadata;
    if (!metadata || typeof metadata.kind !== 'string') continue;
    if (ARRIVAL_KINDS.has(metadata.kind)) return arrivalFrom(metadata);
    if (!weak && metadata.kind === 'approach_card') weak = arrivalFrom(metadata);
  }
  return weak ?? EMPTY_ARRIVAL;
}

