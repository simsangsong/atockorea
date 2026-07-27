/**
 * T4.3 — spot-event content layer + zero-LLM event templates.
 *
 * Templates (§M-2 ①): arrival / audio / meeting-notice phrasing is a fixed,
 * pre-translated 5-locale constant — handling a geofence arrival makes ZERO
 * LLM calls. Spot names, times, and meeting points interpolate verbatim
 * (proper nouns are never machine-translated).
 *
 * Content (D-5) resolves in three tiers, best first:
 *   1. tour_guide_spots.content jsonb — { [locale]: TourStopDrawerStop-like }
 *      (admin-curated, T4.2);
 *   2. data/poi_kb entry via tour_guide_spots.poi_key (fact sheet fallback);
 *   3. null — the arrival card renders the plain template message only.
 */

import poiKnowledgeBase from '@/data/poi_kb/poi_knowledge_base_v1.29.json';
import { ROOM_LOCALES, type RoomLocale } from '@/lib/tour-room/snapshot';

/** TourStopDrawerStop-compatible subset the arrival card renders (T4.5). */
export interface SpotArrivalContent {
  name?: string;
  description?: string;
  image?: string;
  images?: string[];
  highlights?: string[];
  visitBasics?: { hours?: string; closed?: string; admission?: string; walking?: string };
  convenience?: { restroom?: string; parking?: string };
  smartNotes?: { photo?: string; facilities?: string; tip?: string };
  /** Cancellation/weather alternate venue (mirrors ItineraryStop.alternate). */
  alternate?: { label?: string; name: string; note?: string };
}

export type SpotEventKind =
  | 'arrived'
  | 'arrived_audio'
  | 'audio_played'
  | 'meeting_notice'
  | 'meeting_notice_timed'
  | 'free_time'
  | 'free_time_cancelled'
  | 'onboard_ack'
  | 'sos';

/** {spot}/{time}/{point} interpolate verbatim. */
const TEMPLATES: Record<SpotEventKind, Record<RoomLocale, string>> = {
  arrived: {
    en: 'You have arrived near {spot}.',
    ko: '{spot} 근처에 도착했어요.',
    ja: '{spot}の近くに到着しました。',
    es: 'Has llegado cerca de {spot}.',
    zh: '您已到达{spot}附近。',
    'zh-TW': '您已抵達{spot}附近。',
    fr: 'Vous voici près de {spot}.',
    de: 'Sie sind in der Nähe von {spot} angekommen.',
    ru: 'Мы на месте — рядом {spot}.',
    it: 'Sei nei pressi di {spot}.',
  },
  arrived_audio: {
    en: 'You have arrived near {spot}. Tap the audio guide button to play the guide.',
    ko: '{spot} 근처에 도착했어요. 오디오 가이드 버튼을 눌러 설명을 들어보세요.',
    ja: '{spot}の近くに到着しました。オーディオガイドボタンで解説を再生できます。',
    es: 'Has llegado cerca de {spot}. Toca el botón de audioguía para escucharla.',
    zh: '您已到达{spot}附近。点击语音导览按钮即可收听讲解。',
    'zh-TW': '您已抵達{spot}附近。點一下語音導覽按鈕即可收聽解說。',
    fr: 'Vous voici près de {spot}. Touchez le bouton audioguide pour lancer le commentaire.',
    de: 'Sie sind in der Nähe von {spot} angekommen. Tippen Sie auf den Audioguide-Button, um die Erklärung zu hören.',
    ru: 'Мы на месте — рядом {spot}. Нажмите кнопку аудиогида, чтобы послушать рассказ.',
    it: 'Sei nei pressi di {spot}. Tocca il pulsante dell’audioguida per ascoltare la spiegazione.',
  },
  audio_played: {
    en: 'Audio guide started for {spot}.',
    ko: '{spot} 오디오 가이드를 시작했어요.',
    ja: '{spot}のオーディオガイドを開始しました。',
    es: 'Audioguía iniciada para {spot}.',
    zh: '已开始播放{spot}的语音导览。',
    'zh-TW': '已開始播放{spot}的語音導覽。',
    fr: 'Audioguide lancé pour {spot}.',
    de: 'Audioguide für {spot} gestartet.',
    ru: 'Аудиогид запущен: {spot}.',
    it: 'Audioguida avviata per {spot}.',
  },
  meeting_notice: {
    en: 'Please gather at {point}.',
    ko: '{point}에서 모여주세요.',
    ja: '{point}にお集まりください。',
    es: 'Por favor, reúnanse en {point}.',
    zh: '请在{point}集合。',
    'zh-TW': '請於{point}集合。',
    fr: 'Merci de vous rassembler au point de rendez-vous: {point}.',
    de: 'Bitte sammeln Sie sich am Treffpunkt: {point}.',
    ru: 'Пожалуйста, соберитесь у места сбора: {point}.',
    it: 'Radunatevi al punto di ritrovo: {point}.',
  },
  meeting_notice_timed: {
    en: 'Meeting time is {time}. Please gather at {point}.',
    ko: '집합 시간은 {time}입니다. {point}에서 모여주세요.',
    ja: '集合時間は{time}です。{point}にお集まりください。',
    es: 'La hora de reunión es {time}. Por favor, reúnanse en {point}.',
    zh: '集合时间为{time}。请在{point}集合。',
    'zh-TW': '集合時間為{time}。請於{point}集合。',
    fr: 'Heure de rendez-vous: {time}. Point de rendez-vous: {point}.',
    de: 'Treffzeit ist {time} Uhr. Bitte sammeln Sie sich am Treffpunkt: {point}.',
    ru: 'Время сбора — {time}. Место сбора: {point}.',
    it: 'Orario di ritrovo: {time}. Punto di ritrovo: {point}.',
  },
  free_time: {
    en: 'Free time until {time} — please be back at {point} by then.',
    ko: '{time}까지 자유시간이에요 — 시간에 맞춰 {point}(으)로 돌아와 주세요.',
    ja: '{time}まで自由時間です — 時間までに{point}へお戻りください。',
    es: 'Tiempo libre hasta las {time} — vuelve a {point} para entonces.',
    zh: '自由活动至{time} — 请届时回到{point}。',
    'zh-TW': '自由活動至{time} — 請屆時回到{point}。',
    fr: 'Temps libre jusqu’à {time} — soyez de retour d’ici là. Point de rendez-vous: {point}.',
    de: 'Freizeit bis {time} Uhr — seien Sie bis dahin bitte zurück. Treffpunkt: {point}.',
    ru: 'Свободное время до {time} — пожалуйста, вернитесь к этому времени. Место сбора: {point}.',
    it: 'Tempo libero fino alle {time} — tornate entro quell’ora. Punto di ritrovo: {point}.',
  },
  free_time_cancelled: {
    en: 'Free time has ended — please gather at {point} now.',
    ko: '자유시간이 종료됐어요 — 지금 {point}(으)로 모여주세요.',
    ja: '自由時間は終了しました — 今すぐ{point}にお集まりください。',
    es: 'El tiempo libre ha terminado — reúnanse en {point} ahora.',
    zh: '自由活动结束 — 请立即在{point}集合。',
    'zh-TW': '自由活動結束 — 請立即於{point}集合。',
    fr: 'Le temps libre est terminé — rejoignez maintenant le point de rendez-vous: {point}.',
    de: 'Die Freizeit ist beendet — bitte kommen Sie jetzt zum Treffpunkt: {point}.',
    ru: 'Свободное время закончилось — пожалуйста, сразу подходите к месту сбора: {point}.',
    it: 'Il tempo libero è finito — radunatevi subito al punto di ritrovo: {point}.',
  },
  onboard_ack: {
    en: "I'm on the bus. 🚌",
    ko: '버스에 탑승했어요. 🚌',
    ja: 'バスに乗りました。🚌',
    es: 'Ya estoy en el bus. 🚌',
    zh: '我已上车。🚌',
    'zh-TW': '我已上車。🚌',
    fr: 'Je suis dans le bus. 🚌',
    de: 'Ich bin im Bus. 🚌',
    ru: 'Я в автобусе. 🚌',
    it: 'Sono sul bus. 🚌',
  },
  sos: {
    en: '🆘 EMERGENCY — I need help right now. Please contact me immediately.',
    ko: '🆘 긴급 — 지금 도움이 필요해요. 즉시 연락 부탁드립니다.',
    ja: '🆘 緊急 — 今すぐ助けが必要です。至急ご連絡ください。',
    es: '🆘 EMERGENCIA — Necesito ayuda ahora mismo. Contáctenme de inmediato.',
    zh: '🆘 紧急 — 我现在需要帮助，请立即联系我。',
    'zh-TW': '🆘 緊急 — 我現在需要協助，請立即與我聯絡。',
    fr: '🆘 URGENCE — j’ai besoin d’aide immédiatement. Contactez-moi tout de suite.',
    de: '🆘 NOTFALL — ich brauche sofort Hilfe. Bitte kontaktieren Sie mich umgehend.',
    ru: '🆘 SOS — мне срочно нужна помощь. Пожалуйста, свяжитесь со мной немедленно.',
    it: '🆘 EMERGENZA — ho bisogno di aiuto adesso. Contattatemi subito.',
  },
};

export interface SpotEventParams {
  spot?: string;
  time?: string;
  point?: string;
}

function interpolate(template: string, params: SpotEventParams): string {
  return template
    .replaceAll('{spot}', params.spot ?? '')
    .replaceAll('{time}', params.time ?? '')
    .replaceAll('{point}', params.point ?? '');
}

export function renderSpotEventText(kind: SpotEventKind, locale: RoomLocale, params: SpotEventParams): string {
  return interpolate(TEMPLATES[kind][locale], params);
}

/**
 * All-locale translations bundle for a message row — zero LLM calls by default.
 *
 * T2-2: `pointByLocale` optionally supplies a per-locale translated place name
 * (the operator typed it in Korean; the caller ran it through the translation
 * router). When absent (or a locale is missing), the raw `params.point`
 * interpolates verbatim — preserving the previous behaviour + the R-6 fallback
 * when translation is unavailable.
 */
export function renderSpotEventTranslations(
  kind: SpotEventKind,
  params: SpotEventParams,
  pointByLocale?: Record<string, string> | null,
): { source_locale: string; source_text: string; translations: Record<string, string> } {
  const translations: Record<string, string> = {};
  for (const locale of ROOM_LOCALES) {
    const localeParams = pointByLocale ? { ...params, point: pointByLocale[locale] ?? params.point } : params;
    translations[locale] = renderSpotEventText(kind, locale, localeParams);
  }
  return { source_locale: 'en', source_text: translations.en, translations };
}

// ---------------------------------------------------------------------------
// Content resolution (3 tiers).
// ---------------------------------------------------------------------------

interface PoiKbEntry {
  visitBasics?: SpotArrivalContent['visitBasics'];
  convenience?: SpotArrivalContent['convenience'];
  smartNotes?: SpotArrivalContent['smartNotes'];
  [key: string]: unknown;
}

/** P-D16 — does the static 82-POI KB cover this key? (generation skips these) */
export function hasPoiKbEntry(poiKey: string | null | undefined): boolean {
  return poiKbEntry(poiKey) !== null;
}

function poiKbEntry(poiKey: string | null | undefined): PoiKbEntry | null {
  if (!poiKey) return null;
  const entry = (poiKnowledgeBase as Record<string, unknown>)[poiKey];
  if (!entry || typeof entry !== 'object' || poiKey === '_metadata') return null;
  return entry as PoiKbEntry;
}

function isNonEmptyObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && Object.keys(value as object).length > 0;
}

export interface SpotContentSource {
  title: string;
  content?: unknown;
  poi_key?: string | null;
}

/**
 * Resolve the richest available content for a spot in `locale`.
 * Returns { content, tier } — tier is exported for tests/telemetry.
 */
export function resolveSpotContent(
  spot: SpotContentSource,
  locale: RoomLocale,
): { content: SpotArrivalContent | null; tier: 'curated' | 'poi_kb' | 'none' } {
  // Tier 1 — admin-curated content jsonb (locale key, en fallback).
  if (isNonEmptyObject(spot.content)) {
    const byLocale = spot.content as Record<string, unknown>;
    const candidate = byLocale[locale] ?? byLocale.en;
    if (isNonEmptyObject(candidate)) {
      return { content: { name: spot.title, ...(candidate as SpotArrivalContent) }, tier: 'curated' };
    }
  }

  // Tier 2 — poi_kb fact sheet.
  const kb = poiKbEntry(spot.poi_key);
  if (kb && (isNonEmptyObject(kb.visitBasics) || isNonEmptyObject(kb.convenience) || isNonEmptyObject(kb.smartNotes))) {
    return {
      content: {
        name: spot.title,
        visitBasics: kb.visitBasics,
        convenience: kb.convenience,
        smartNotes: kb.smartNotes,
      },
      tier: 'poi_kb',
    };
  }

  // Tier 3 — template message only.
  return { content: null, tier: 'none' };
}

// ---------------------------------------------------------------------------
// A1 — per-locale resolution (one card, every language in the room).
//
// The arrival routes used to resolve content ONCE, for whoever triggered the
// stop, and put that single blob in the message metadata. The arrived LINE was
// correctly 10-locale (renderSpotEventTranslations) but the briefing BODY —
// the part that carries the actual guiding — was whatever language the driver's
// device asked for. A mixed-language room (the whole premise of the chat
// bridge) therefore showed most guests the wrong language on the richest card
// the app has.
//
// Resolution now runs per room locale. `lang` records the language the prose is
// ACTUALLY in, which is NOT always the key:
//   - curated content covers 6 locales today (en/es/ja/ko/zh/zh-TW), so fr/de/
//     ru/it fall back to English;
//   - the poi_kb fact sheet is English-only, full stop.
// A2 (voice) reads `lang`, never the key — otherwise a French guest would hear
// English prose forced through a fr-FR voice.
// ---------------------------------------------------------------------------

/** Mirrors MAX_TTS_TEXT_CHARS in tts-server.ts (client-safe copy). */
export const MAX_SPOKEN_CHARS = 1200;

export type SpotContentTier = 'curated' | 'match_poi' | 'poi_kb' | 'generated' | 'none';

/** One locale's briefing + the language its prose is actually written in. */
export interface ResolvedSpotContent {
  content: SpotArrivalContent;
  lang: RoomLocale;
  tier: SpotContentTier;
}

/** Room locale → that locale's briefing. Absent key = nothing to show. */
export type SpotContentByLocale = Partial<Record<RoomLocale, ResolvedSpotContent>>;

/** Like `resolveSpotContent`, but reports which language it landed on. */
export function resolveSpotContentFor(spot: SpotContentSource, locale: RoomLocale): ResolvedSpotContent | null {
  // Tier 1 — curated jsonb. Exact locale wins; English is the honest fallback.
  if (isNonEmptyObject(spot.content)) {
    const byLocale = spot.content as Record<string, unknown>;
    const exact = byLocale[locale];
    if (isNonEmptyObject(exact)) {
      return { content: { name: spot.title, ...(exact as SpotArrivalContent) }, lang: locale, tier: 'curated' };
    }
    if (isNonEmptyObject(byLocale.en)) {
      return { content: { name: spot.title, ...(byLocale.en as SpotArrivalContent) }, lang: 'en', tier: 'curated' };
    }
  }

  // Tier 2 — poi_kb fact sheet. English-only by construction.
  const kb = poiKbEntry(spot.poi_key);
  if (kb && (isNonEmptyObject(kb.visitBasics) || isNonEmptyObject(kb.convenience) || isNonEmptyObject(kb.smartNotes))) {
    return {
      content: {
        name: spot.title,
        visitBasics: kb.visitBasics,
        convenience: kb.convenience,
        smartNotes: kb.smartNotes,
      },
      lang: 'en',
      tier: 'poi_kb',
    };
  }

  return null;
}

/** Resolve one spot for every locale present in the room. */
export function resolveSpotContentForLocales(
  spot: SpotContentSource,
  locales: readonly string[],
): SpotContentByLocale {
  const byLocale: SpotContentByLocale = {};
  for (const raw of locales) {
    if (!ROOM_LOCALES.includes(raw as RoomLocale)) continue;
    const locale = raw as RoomLocale;
    if (byLocale[locale]) continue;
    const resolved = resolveSpotContentFor(spot, locale);
    if (resolved) byLocale[locale] = resolved;
  }
  return byLocale;
}

// ---------------------------------------------------------------------------
// Wire shape.
//
// Storing one full briefing per locale would put up to 8 × ~6 KB of prose in a
// single message's metadata — and most of those copies are byte-identical,
// because every locale without curated content falls back to the same English
// text. So the wire form is keyed by LANGUAGE and carries a locale→language
// map beside it: 8 locales that all fall back to English cost one blob.
// ---------------------------------------------------------------------------

/** The `spot_arrival` / `arrival_bundle` metadata fields A1 adds. */
export interface SpotContentPack {
  /** Language → the briefing written in it. Deduped. */
  content_by_lang: Partial<Record<RoomLocale, SpotArrivalContent>>;
  /** Room locale → which language it is served (identity when covered). */
  content_langs: Partial<Record<RoomLocale, RoomLocale>>;
}

/**
 * The only keys the arrival card and the concierge actually read.
 *
 * The curated jsonb is a whole page payload — `galleryItems`, `imageCredits`,
 * `_poi_meta`, route bookkeeping. Shipping all of it once per language turned a
 * single arrival into a 22 KB realtime broadcast, and put internal metadata on
 * the wire for no reason. Project to what renders.
 */
const WIRE_KEYS = [
  'name',
  'description',
  'image',
  'images',
  'highlights',
  'visitBasics',
  'convenience',
  'smartNotes',
  'alternate',
] as const;

function projectForWire(content: SpotArrivalContent): SpotArrivalContent {
  const slim: Record<string, unknown> = {};
  for (const key of WIRE_KEYS) {
    const value = (content as Record<string, unknown>)[key];
    if (value !== undefined && value !== null && value !== '') slim[key] = value;
  }
  return slim as SpotArrivalContent;
}

/** Fold per-locale resolution into the deduped wire shape. */
export function packSpotContent(byLocale: SpotContentByLocale): SpotContentPack | null {
  const pack: SpotContentPack = { content_by_lang: {}, content_langs: {} };
  let any = false;
  for (const key of Object.keys(byLocale) as RoomLocale[]) {
    const resolved = byLocale[key];
    if (!resolved) continue;
    any = true;
    pack.content_langs[key] = resolved.lang;
    if (!pack.content_by_lang[resolved.lang]) {
      pack.content_by_lang[resolved.lang] = projectForWire(resolved.content);
    }
  }
  return any ? pack : null;
}

/**
 * Client-safe picker: the briefing THIS viewer should see, and the language it
 * is really written in (which the voice layer must use).
 *
 * Falls back to the legacy single-locale `content` field so arrival messages
 * posted before A1 keep rendering exactly as they did.
 */
export function pickSpotContent(
  metadata: Record<string, unknown> | null | undefined,
  viewerLocale: RoomLocale,
): { content: SpotArrivalContent; lang: RoomLocale } | null {
  const byLang = metadata?.content_by_lang as SpotContentPack['content_by_lang'] | undefined;
  const langs = metadata?.content_langs as SpotContentPack['content_langs'] | undefined;
  if (isNonEmptyObject(byLang)) {
    const lang = langs?.[viewerLocale] ?? (byLang[viewerLocale] ? viewerLocale : 'en');
    const content = byLang[lang] ?? byLang.en ?? Object.values(byLang)[0];
    if (isNonEmptyObject(content)) {
      return { content: content as SpotArrivalContent, lang: (byLang[lang] ? lang : 'en') as RoomLocale };
    }
  }
  const legacy = metadata?.content;
  if (isNonEmptyObject(legacy)) {
    // Pre-A1 rows never recorded a language; the safest assumption for the
    // voice layer is the room default, which is what they were resolved as.
    return { content: legacy as SpotArrivalContent, lang: viewerLocale };
  }
  return null;
}

/**
 * A2 — the words a guest actually HEARS at a stop.
 *
 * A live guide talks; the card made guests read, and the story was even folded
 * behind "More details". This composes the same resolved content into one
 * spoken paragraph, ordered the way a guide narrates: name → story →
 * highlights → the practical notes worth saying out loud.
 *
 * Falls back to the fact rows when there is no prose, because that is the only
 * tier 82 of today's POIs have — "restrooms are by the main entrance, parking
 * is paid" is still guiding, and staying silent is not.
 */
export function composeSpotNarration(content: SpotArrivalContent | null | undefined): string {
  if (!content) return '';
  const parts: string[] = [];
  const push = (value: unknown) => {
    const text = speechSafe(typeof value === 'string' ? value : '');
    if (text) parts.push(/[.!?。！？]$/.test(text) ? text : `${text}.`);
  };

  push(content.name);
  push(content.description);
  for (const highlight of content.highlights ?? []) push(highlight);

  const hasProse = Boolean(content.description) || (content.highlights?.length ?? 0) > 0;
  if (!hasProse) {
    // Fact-sheet tier: speak what a guide would actually mention on arrival.
    push(content.visitBasics?.hours);
    push(content.visitBasics?.admission);
    push(content.convenience?.restroom);
    push(content.convenience?.parking);
  }
  push(content.smartNotes?.photo);
  push(content.smartNotes?.tip);

  // Nothing but the name is not narration — keep the button off the card.
  if (parts.length <= 1) return '';
  return trimToSentence(parts.join(' '), MAX_SPOKEN_CHARS);
}

/**
 * Curated briefings are written for the EYE — the live rows are full of
 * `**bold**`, markdown links and heading marks. Handed to a speech engine
 * verbatim those become spoken asterisks or mangled words, so strip the
 * formatting before anything is said out loud.
 */
export function speechSafe(raw: string): string {
  return stripMarkdown(raw);
}

/**
 * Shared markdown cleanup. Used by the voice (asterisks get read aloud) and by
 * short display strings like the highlight chips, where emphasis inside a
 * two-line pill is noise rather than hierarchy.
 */
export function stripMarkdown(raw: string): string {
  return raw
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')      // images say nothing
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')   // links: keep the words, drop the URL
    .replace(/`{1,3}([^`]*)`{1,3}/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,!?]|$)/g, '$1$2')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Display counterpart to `speechSafe`: the briefings are authored in markdown
 * (`**bold**`), and the card renders `content.description` as plain text, so a
 * guest reads the asterisks. That was invisible while only the 11 curated spots
 * showed a description; wiring the POI master took it to 119.
 *
 * Emphasis is kept as emphasis rather than stripped — the authors bolded the
 * place name and the key facts on purpose — and everything else markdown-ish is
 * cleaned the same way the voice cleans it.
 */
export interface EmphasisPart {
  text: string;
  bold: boolean;
}

export function splitEmphasis(raw: string | null | undefined): EmphasisPart[] {
  if (!raw) return [];
  const parts: EmphasisPart[] = [];
  // Only **strong** is treated as emphasis. Single `*`/`_` appear inside real
  // prose often enough (measurements, transliterations) that treating them as
  // markup does more damage than it repairs.
  // [\s\S] rather than the `s` flag — the tsconfig target predates dotAll.
  const pattern = /\*\*([\s\S]+?)\*\*/g;
  let last = 0;
  for (let match = pattern.exec(raw); match; match = pattern.exec(raw)) {
    if (match.index > last) parts.push({ text: raw.slice(last, match.index), bold: false });
    parts.push({ text: match[1], bold: true });
    last = match.index + match[0].length;
  }
  if (last < raw.length) parts.push({ text: raw.slice(last), bold: false });
  return parts.filter((part) => part.text.length > 0);
}

/**
 * Cut to the budget on a sentence boundary. A hard slice() ends mid-word, and
 * a voice that stops mid-word sounds broken rather than brief.
 */
function trimToSentence(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const window = text.slice(0, limit);
  const lastStop = Math.max(
    window.lastIndexOf('. '),
    window.lastIndexOf('。'),
    window.lastIndexOf('! '),
    window.lastIndexOf('? '),
  );
  // Only honour the boundary if it keeps most of the budget — otherwise a stray
  // early period would throw away the whole briefing.
  if (lastStop > limit * 0.5) return window.slice(0, lastStop + 1).trim();
  const lastSpace = window.lastIndexOf(' ');
  return `${(lastSpace > 0 ? window.slice(0, lastSpace) : window).trim()}…`;
}
