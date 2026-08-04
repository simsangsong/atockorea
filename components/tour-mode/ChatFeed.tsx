'use client';

/**
 * T1.6 → U2/U3 — room message feed, messenger-grade (plan §F).
 *
 * - Bubble system: consecutive-sender grouping (avatar + name once, tail and
 *   timestamp on the group's last bubble), KST date-separator pills, centered
 *   system capsules, my-bubble in the deep-pine signature (U4-D8), text
 *   bubbles capped at 76% of the row (U4-D10 — long messages keep a gutter).
 * - Viewer-locale translation shown first; tapping a translated bubble
 *   toggles the original text (per-message). The affordance lives in the
 *   side meta column (globe / undo), not inside the bubble (U-D11).
 * - Scroll-to-bottom FAB with a while-away counter, an unread divider on
 *   re-entry, and a 140ms rise-in on newly arrived bubbles only.
 * - Windowed rendering: only the latest WINDOW messages mount; "earlier"
 *   reveals more. Keeps 200+ message rooms smooth without a virtual-list
 *   dependency (feed is append-only, newest at the bottom).
 * - Auto-follows the bottom only when the user is already near it.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import AudioButton from '@/components/tour-mode/AudioButton';
import { shareTimelineText } from '@/lib/tour-room/timelineShare';
import LinkPreviewCard from '@/components/tour-mode/LinkPreviewCard';
import { firstUrlIn } from '@/lib/tour-room/linkPreview';
import Avatar from '@/components/tour-mode/Avatar';
import ExtraLedgerCard, { type ExtraLedgerMeta } from '@/components/tour-mode/ExtraLedgerCard';
import SpotArrivalCard from '@/components/tour-mode/SpotArrivalCard';
import WaitEndedCard from '@/components/tour-mode/WaitEndedCard';
import ApproachCard from '@/components/tour-mode/ApproachCard';
import ArrivalBundleCard from '@/components/tour-mode/ArrivalBundleCard';
import ArrivalVideoCard from '@/components/tour-mode/ArrivalVideoCard';
import DiningCard from '@/components/tour-mode/DiningCard';
import BriefingSafetyCard from '@/components/tour-mode/BriefingSafetyCard';
import BriefingScheduleCard from '@/components/tour-mode/BriefingScheduleCard';
import BriefingLunchCard from '@/components/tour-mode/BriefingLunchCard';
import BriefingEtiquetteCard from '@/components/tour-mode/BriefingEtiquetteCard';
import type { BriefingSafetyMeta } from '@/lib/ops/seating/cards/safety';
import type { BriefingScheduleMeta } from '@/lib/ops/seating/cards/schedule';
import type { BriefingLunchMeta } from '@/lib/ops/seating/cards/lunch';
import type { BriefingEtiquetteMeta } from '@/lib/ops/seating/cards/etiquette';
import type { DiningCardMeta } from '@/lib/ops/dining/card';
import { isVideoCardMeta } from '@/lib/tour-room/poiVideos';
import type { ApproachCardMeta } from '@/lib/tour-room/approach';
import type { ArrivalBundleMeta } from '@/lib/tour-room/arrivalBundle';
import Lightbox from '@/components/tour-mode/Lightbox';
import LocationPreview from '@/components/tour-mode/LocationPreview';
import ReplyPreview from '@/components/tour-mode/ReplyPreview';
import { parseLocationMessage } from '@/lib/tour-room/locationMessage';
import Sheet from '@/components/tour-mode/Sheet';
import {
  IconCopy,
  IconOpenExternal,
  IconTrash,
  IconFile,
  IconInstall,
  IconMore,
  IconOpsBadge,
  IconOriginal,
  IconReply,
  IconRetry,
  IconScrollDown,
  IconSending,
  IconTranslated,
  TR_ICON,
  TR_STROKE,
} from '@/components/tour-mode/icons';
import type { ReplySnapshot } from '@/lib/tour-room/reply';
import type { ReactionAgg } from '@/hooks/useTourRoomChannel';

/** Quick emoji set for the reaction row (Phase 2c). */
/**
 * 사장님 결정 2026-08-04 §5-1: 5종 → 30종. 앞의 다섯은 기존 집계 데이터와의
 * 연속성 때문에 자리를 지킨다. 서버(reactions route)는 짧은 이모지면 무엇이든
 * 받으므로(≤8 유닛) 정본은 이 리터럴 하나다. ZWJ 합성 이모지는 서버 길이 캡에
 * 걸릴 수 있어 제외.
 */
const REACTION_EMOJI = [
  '👍', '❤️', '😂', '😮', '🙏',
  '😢', '🎉', '👏', '🔥', '💯',
  '😍', '🤩', '😊', '😅', '😭',
  '🥰', '🙌', '👌', '✨', '🤔',
  '😴', '🫶', '💪', '☕', '🍜',
  '🍺', '📸', '🌊', '🚌', '⏰',
];

const READ_LABEL: Record<RoomLocale, string> = { en: 'Read', ko: '읽음', ja: '既読', es: 'Leído', zh: '已读', 'zh-TW': '已讀', fr: 'Lu', de: 'Gelesen', ru: 'Прочитано', it: 'Letto' };
const TYPING_LABEL: Record<RoomLocale, string> = {
  en: 'typing…',
  ko: '입력 중…',
  ja: '入力中…',
  es: 'escribiendo…',
  zh: '正在输入…',
  'zh-TW': '正在輸入…',
  fr: 'écrit…',
  de: 'schreibt…',
  ru: 'печатает…',
  it: 'sta scrivendo…',
};
import { buildFeedItems, type FeedItem } from '@/lib/tour-room/messageGroups';
import { formatBubbleTime, formatDateSeparator } from '@/lib/tour-room/timeFormat';
import { kstToday } from '@/lib/tour-room/time';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';
import { pickSpotContent } from '@/lib/tour-room/spotContent';
import { useTourRoomSettings } from '@/hooks/useTourRoomSettings';
import type { RoomLocale } from '@/lib/tour-room/snapshot';
import type { TextScaleStep } from '@/hooks/useTourRoomSettings';

const WINDOW = 60;
const NEAR_BOTTOM_PX = 120;

const EARLIER_LABEL: Record<RoomLocale, string> = {
  en: 'Show earlier messages',
  ko: '이전 메시지 보기',
  ja: '以前のメッセージを表示',
  es: 'Ver mensajes anteriores',
  zh: '查看更早的消息',
  'zh-TW': '查看更早的訊息',
  fr: 'Voir les messages précédents',
  de: 'Frühere Nachrichten anzeigen',
  ru: 'Показать более ранние сообщения',
  it: 'Mostra i messaggi precedenti',
};

/**
 * P1-4 — the empty state is role-aware.
 *
 * "가이드의 안내가 여기에 도착해요" is written to a GUEST waiting on their
 * guide. It was rendered for every role, so a guide opening their own chat was
 * told to wait for themselves. viewerRole was already in scope at the render
 * site; only the copy lookup ignored it.
 */
const EMPTY_COPY: Record<'customer' | 'operator', Record<RoomLocale, string>> = {
  customer: {
    en: 'No messages yet — updates from your guide will appear here.',
    ko: '아직 메시지가 없어요 — 가이드의 안내가 여기에 도착해요.',
    ja: 'まだメッセージはありません — ガイドのご案内はここに届きます。',
    es: 'Aún no hay mensajes: los avisos de tu guía aparecerán aquí.',
    zh: '还没有消息 — 导游的通知会显示在这里。',
    'zh-TW': '還沒有訊息 — 導遊的通知會顯示在這裡。',
    fr: 'Pas encore de messages — les infos de votre guide arriveront ici.',
    de: 'Noch keine Nachrichten — Hinweise Ihres Guides erscheinen hier.',
    ru: 'Сообщений пока нет — новости от гида появятся здесь.',
    it: 'Ancora nessun messaggio — gli avvisi della tua guida appariranno qui.',
  },
  operator: {
    en: 'No messages yet — say hello to your guests, or send a quick reply.',
    ko: '아직 메시지가 없어요 — 손님에게 첫 안내를 보내보세요.',
    ja: 'まだメッセージはありません — お客様に最初のご案内を送りましょう。',
    es: 'Aún no hay mensajes: envía el primer aviso a tus viajeros.',
    zh: '还没有消息 — 先给客人发送第一条通知吧。',
    'zh-TW': '還沒有訊息 — 先傳送第一則通知給客人吧。',
    fr: 'Pas encore de messages — envoyez un premier mot à vos voyageurs.',
    de: 'Noch keine Nachrichten — senden Sie Ihren Gästen einen ersten Hinweis.',
    ru: 'Сообщений пока нет — отправьте гостям первое сообщение.',
    it: 'Ancora nessun messaggio — manda un primo saluto ai tuoi ospiti.',
  },
};

/**
 * N4 — the empty feed is a PLACE, not a gap.
 *
 * Measured before this: an empty chat was ~80% blank screen under one grey
 * sentence. Blank is honest — there really are no messages — but it is the
 * only screen in the app that gets a whole viewport to say what this room can
 * do, and it was spending it on nothing. Every guest sees it exactly once, at
 * the moment they have just arrived and know least.
 *
 * Three lines, and three is the budget on purpose: this is the quietest surface
 * in the app and a fourth turns an orientation into a manual.
 *
 * Rules this copy follows:
 *   · Only things that are true HERE. No line points at a screen the reader
 *     cannot reach from this one.
 *   · No duplicate chip row (U-D20v2). These are sentences, not controls — the
 *     signal row is two thumb-widths below and does not need a twin.
 *   · Role-aware, like EMPTY_COPY above: a guide reading "wait for your guide"
 *     was the P1-4 bug, and this block would reproduce it at three times the
 *     size.
 *
 * Typed as a 3-tuple per locale so tsc rejects a locale with two lines or four
 * — the loose `Record<string, …>` shape is exactly what let fr/de/ru/it slip
 * out of `WEATHER_LOCALES` silently (G1).
 */
type EmptyHints = readonly [string, string, string];

const EMPTY_HINTS: Record<'customer' | 'operator', Record<RoomLocale, EmptyHints>> = {
  customer: {
    en: [
      'Write in your own language — your guide reads it in theirs.',
      'Send a photo to ask what something is — a menu, a sign, a dish.',
      'Lost, late, or need a stop? One tap on the row below tells your guide.',
    ],
    ko: [
      '편한 언어로 쓰세요 — 가이드에게는 가이드의 언어로 도착해요.',
      '사진을 보내 물어보세요 — 메뉴판, 표지판, 처음 보는 음식도요.',
      '길을 잃거나 늦거나 잠깐 멈춰야 할 땐, 아래 줄을 한 번만 누르세요.',
    ],
    ja: [
      'お好きな言語でどうぞ — ガイドにはガイドの言語で届きます。',
      '写真を送って聞けます — メニュー、標識、初めて見る料理も。',
      '道に迷った・遅れる・少し止まりたいときは、下の列を一度タップ。',
    ],
    es: [
      'Escribe en tu idioma: tu guía lo recibe en el suyo.',
      'Envía una foto para preguntar qué es: una carta, un cartel, un plato.',
      '¿Perdido, con retraso o necesitas parar? Toca la fila de abajo.',
    ],
    zh: [
      '用你习惯的语言写就行 — 导游会以自己的语言收到。',
      '拍张照片就能提问 — 菜单、路牌、没见过的菜都可以。',
      '走散、迟到或想暂停？点一下下面那一行即可。',
    ],
    'zh-TW': [
      '用你習慣的語言寫就行 — 導遊會以自己的語言收到。',
      '拍張照片就能提問 — 菜單、路牌、沒見過的菜都可以。',
      '走散、遲到或想暫停？點一下下面那一行即可。',
    ],
    fr: [
      'Écrivez dans votre langue — votre guide la reçoit dans la sienne.',
      'Envoyez une photo pour demander ce que c’est : une carte, un panneau, un plat.',
      'Perdu, en retard, besoin d’une pause ? Un appui sur la ligne ci-dessous.',
    ],
    de: [
      'Schreiben Sie in Ihrer Sprache — Ihr Guide liest es in seiner.',
      'Schicken Sie ein Foto und fragen Sie nach — Karte, Schild, unbekanntes Gericht.',
      'Verlaufen, verspätet, kurze Pause nötig? Ein Tipp auf die Zeile unten.',
    ],
    ru: [
      'Пишите на своём языке — гид получит это на своём.',
      'Пришлите фото и спросите, что это: меню, вывеска, незнакомое блюдо.',
      'Заблудились, опаздываете, нужна остановка? Одно нажатие на строку ниже.',
    ],
    it: [
      'Scriva nella Sua lingua — la guida la riceve nella sua.',
      'Mandi una foto per chiedere che cos’è: un menu, un cartello, un piatto.',
      'Perso, in ritardo o serve una sosta? Un tocco sulla riga qui sotto.',
    ],
  },
  operator: {
    en: [
      'Write once — every guest reads it in their own language.',
      'Hold the mic and speak; it arrives as text.',
      'The quick replies below are pre-translated, so they send instantly.',
    ],
    ko: [
      '한 번만 쓰면 손님마다 자기 언어로 받아요.',
      '마이크를 누르고 말하면 글로 전해집니다.',
      '아래 빠른 답장은 미리 번역돼 있어 기다림 없이 나갑니다.',
    ],
    ja: [
      '一度書けば、お客様それぞれの言語で届きます。',
      'マイクを押して話すと、文章になって伝わります。',
      '下のクイック返信は翻訳済みなので、待たずに送れます。',
    ],
    es: [
      'Escribe una vez: cada viajero lo recibe en su idioma.',
      'Mantén pulsado el micro y habla; llega como texto.',
      'Las respuestas rápidas de abajo ya están traducidas y salen al instante.',
    ],
    zh: [
      '写一次即可 — 每位客人都会收到自己语言的版本。',
      '按住麦克风说话，会以文字送达。',
      '下面的快捷回复已预先翻译，发送无需等待。',
    ],
    'zh-TW': [
      '寫一次即可 — 每位客人都會收到自己語言的版本。',
      '按住麥克風說話，會以文字送達。',
      '下面的快捷回覆已預先翻譯，傳送無需等待。',
    ],
    fr: [
      'Écrivez une fois : chaque voyageur le reçoit dans sa langue.',
      'Maintenez le micro et parlez ; cela arrive sous forme de texte.',
      'Les réponses rapides ci-dessous sont déjà traduites et partent aussitôt.',
    ],
    de: [
      'Einmal schreiben — jeder Gast liest es in seiner Sprache.',
      'Mikrofon gedrückt halten und sprechen; es kommt als Text an.',
      'Die Schnellantworten unten sind vorübersetzt und gehen sofort raus.',
    ],
    ru: [
      'Напишите один раз — каждый гость получит это на своём языке.',
      'Удерживайте микрофон и говорите: сообщение придёт текстом.',
      'Быстрые ответы ниже уже переведены и уходят без задержки.',
    ],
    it: [
      'Scriva una volta: ogni ospite lo riceve nella propria lingua.',
      'Tenga premuto il microfono e parli; arriva come testo.',
      'Le risposte rapide qui sotto sono già tradotte e partono subito.',
    ],
  },
};

function isOperatorViewer(role?: string): boolean {
  return role === 'guide' || role === 'driver' || role === 'admin';
}

const UNREAD_LABEL: Record<RoomLocale, string> = {
  en: 'New messages',
  ko: '여기서부터 안 읽음',
  ja: 'ここから未読',
  es: 'Mensajes nuevos',
  zh: '以下为未读消息',
  'zh-TW': '以下為未讀訊息',
  fr: 'Nouveaux messages',
  de: 'Neue Nachrichten',
  ru: 'Новые сообщения',
  it: 'Nuovi messaggi',
};

const ROLE_LABEL: Record<RoomLocale, Record<string, string>> = {
  en: { guide: 'Guide', admin: 'AtoC Korea', driver: 'Driver' },
  ko: { guide: '가이드', admin: 'AtoC Korea', driver: '기사님' },
  ja: { guide: 'ガイド', admin: 'AtoC Korea', driver: 'ドライバー' },
  es: { guide: 'Guía', admin: 'AtoC Korea', driver: 'Conductor' },
  zh: { guide: '导游', admin: 'AtoC Korea', driver: '司机' },
  'zh-TW': { guide: '導遊', admin: 'AtoC Korea', driver: '司機' },
  fr: { guide: 'Guide', admin: 'AtoC Korea', driver: 'Chauffeur' },
  de: { guide: 'Guide', admin: 'AtoC Korea', driver: 'Fahrer' },
  ru: { guide: 'Гид', admin: 'AtoC Korea', driver: 'Водитель' },
  it: { guide: 'Guida', admin: 'AtoC Korea', driver: 'Autista' },
};

/** Long-press action-sheet labels (Phase 2b). */
const ACTION_COPY: Record<RoomLocale, { title: string; reply: string; copy: string; original: string; translated: string; close: string; copied: string; unsend: string; deleted: string; share: string; promote: string }> = {
  en: { title: 'Message', reply: 'Reply', copy: 'Copy', original: 'Show original', translated: 'Show translation', close: 'Close', copied: 'Copied', unsend: 'Delete for everyone', deleted: 'Message deleted', share: 'Share (text only)', promote: 'Announce to everyone' },
  ko: { title: '메시지', reply: '답장', copy: '복사', original: '원문 보기', translated: '번역 보기', close: '닫기', copied: '복사됨', unsend: '모두에게서 삭제', deleted: '삭제된 메시지', share: '공유 (텍스트만)', promote: '전체 공지로 재전송' },
  ja: { title: 'メッセージ', reply: '返信', copy: 'コピー', original: '原文を表示', translated: '翻訳を表示', close: '閉じる', copied: 'コピーしました', unsend: '全員から削除', deleted: '削除されたメッセージ', share: '共有（テキストのみ）', promote: '全体のお知らせとして再送' },
  es: { title: 'Mensaje', reply: 'Responder', copy: 'Copiar', original: 'Ver original', translated: 'Ver traducción', close: 'Cerrar', copied: 'Copiado', unsend: 'Eliminar para todos', deleted: 'Mensaje eliminado', share: 'Compartir (solo texto)', promote: 'Anunciar a todos' },
  zh: { title: '消息', reply: '回复', copy: '复制', original: '查看原文', translated: '查看翻译', close: '关闭', copied: '已复制', unsend: '对所有人删除', deleted: '消息已删除', share: '分享（仅文本）', promote: '作为公告转发给全员' },
  'zh-TW': { title: '訊息', reply: '回覆', copy: '複製', original: '查看原文', translated: '查看翻譯', close: '關閉', copied: '已複製', unsend: '對所有人刪除', deleted: '訊息已刪除', share: '分享（僅文字）', promote: '作為公告轉發給全員' },
  fr: { title: 'Message', reply: 'Répondre', copy: 'Copier', original: 'Voir l’original', translated: 'Voir la traduction', close: 'Fermer', copied: 'Copié', unsend: 'Supprimer pour tous', deleted: 'Message supprimé', share: 'Partager (texte seul)', promote: 'Annoncer à tous' },
  de: { title: 'Nachricht', reply: 'Antworten', copy: 'Kopieren', original: 'Original anzeigen', translated: 'Übersetzung anzeigen', close: 'Schließen', copied: 'Kopiert', unsend: 'Für alle löschen', deleted: 'Nachricht gelöscht', share: 'Teilen (nur Text)', promote: 'An alle ankündigen' },
  ru: { title: 'Сообщение', reply: 'Ответить', copy: 'Копировать', original: 'Показать оригинал', translated: 'Показать перевод', close: 'Закрыть', copied: 'Скопировано', unsend: 'Удалить у всех', deleted: 'Сообщение удалено', share: 'Поделиться (только текст)', promote: 'Объявить всем' },
  it: { title: 'Messaggio', reply: 'Rispondi', copy: 'Copia', original: 'Mostra originale', translated: 'Mostra traduzione', close: 'Chiudi', copied: 'Copiato', unsend: 'Elimina per tutti', deleted: 'Messaggio eliminato', share: 'Condividi (solo testo)', promote: 'Annuncia a tutti' },
};

/** Attachment metadata carried on image/file messages (Phase 1 route). */
interface AttachmentMeta {
  url?: string;
  mime?: string;
  name?: string;
  size?: number;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function displayText(
  message: RoomMessage,
  locale: RoomLocale,
  showOriginal: boolean,
  preferredLocale?: string | null,
): string {
  // Language-agnostic bridge: a guest who writes French reads driver/guide
  // bubbles in French when that translation exists; fixed-locale capsules
  // (POI cards, notices, signals) fall through to the folded room locale.
  const translated =
    (preferredLocale ? message.translations?.[preferredLocale] : undefined) ??
    message.translations?.[locale];
  if (!translated || showOriginal) return message.source_text;
  return translated;
}

// A1.1 — screen-reader labels for icon-only controls. The visible copy is all
// 5-locale; these were the last English-fixed strings a ko/ja/zh/es guest using
// a screen reader would hear.
const A11Y: Record<RoomLocale, { actions: string; scrollLatest: string }> = {
  en: { actions: 'Message actions', scrollLatest: 'Scroll to latest messages' },
  ko: { actions: '메시지 동작', scrollLatest: '최신 메시지로 이동' },
  ja: { actions: 'メッセージ操作', scrollLatest: '最新メッセージへ移動' },
  es: { actions: 'Acciones del mensaje', scrollLatest: 'Ir a los mensajes recientes' },
  zh: { actions: '消息操作', scrollLatest: '滚动到最新消息' },
  'zh-TW': { actions: '訊息操作', scrollLatest: '捲動到最新訊息' },
  fr: { actions: 'Actions du message', scrollLatest: 'Aller aux derniers messages' },
  de: { actions: 'Nachrichtenaktionen', scrollLatest: 'Zu den neuesten Nachrichten springen' },
  ru: { actions: 'Действия с сообщением', scrollLatest: 'К последним сообщениям' },
  it: { actions: 'Azioni del messaggio', scrollLatest: 'Vai agli ultimi messaggi' },
};

export default function ChatFeed({
  messages,
  viewerLocale,
  viewerRole = 'customer',
  textScale = 3,
  tts,
  opsHighlightAfter = null,
  onExtraConfirm,
  preferredLocale = null,
  onReply,
  onPromoteToNotice,
  reactions,
  onReact,
  lastReadByOthersAt = null,
  typingUsers = [],
  focusMessageId = null,
  variant = 'room',
  renderMessageExtra,
  myParticipantId = null,
}: {
  messages: RoomMessage[];
  viewerLocale: RoomLocale;
  /** Bubbles from this role right-align as "mine". */
  viewerRole?: string;
  /** T1.12 settings: 'large' bumps bubble text for senior travellers. */
  textScale?: TextScaleStep;
  /** T2.4 — when set, incoming bubbles get a listen button (TTS ladder). */
  tts?: { bookingId: string; roomSession: string } | null;
  /** W4.3 — after an SOS, admin replies newer than this ISO time get the
   *  "ops responded" highlight so the traveller spots them instantly. */
  opsHighlightAfter?: string | null;
  /** W2.4 — customer one-tap confirm on a logged extras capsule (LEDGER). */
  onExtraConfirm?: (extraId: string) => Promise<boolean>;
  /** Language-agnostic bridge: the viewer's detected chat language ('fr' …) —
   *  preferred over the folded room locale when a translation exists. */
  preferredLocale?: string | null;
  /** §5-6 — staff only: re-send this message's text as an all-rooms announce
   *  (GR-002; the notice ENGINE existed, promotion was the missing door). */
  onPromoteToNotice?: (text: string) => void;
  /** Unsend ownership (2026-08-04): a guest may only delete a message stamped
   *  with THEIR participant id — role alone cannot tell two guests apart. */
  myParticipantId?: string | null;
  /** Kakao-grade reply (Phase 2b): long-press a bubble → this sets the reply
   *  context in the composer. Absent = no reply affordance. */
  onReply?: (message: RoomMessage) => void;
  /** Kakao-grade reactions (Phase 2c): per-message emoji aggregates + toggle. */
  reactions?: Record<string, ReactionAgg[]>;
  onReact?: (messageId: string, emoji: string) => void;
  /** Phase 2d — newest read time among others → "Read" on my last bubble. */
  lastReadByOthersAt?: string | null;
  /** Phase 2d — others currently typing. */
  typingUsers?: Array<{ role: string; displayName: string }>;
  /** Phase 3 — deep-link: scroll to + flash this message once it's in the feed. */
  focusMessageId?: string | null;
  /**
   * C5 (§D-5 U-D7/U-D15) — 'cockpit' raises the bubble-text floor one step.
   * The driving surface is read at arm's length from behind a wheel, so its
   * bubbles were 20px fixed; dropping them to the room's 15px default would
   * trade a safety property for a shared component. The floor rises, the size
   * setting still moves it — which is the whole point of C1/C4.
   */
  variant?: 'room' | 'cockpit';
  /**
   * Surface-specific follow-up rendered under a message (see the call site).
   * Kept as a slot rather than a prop bag so the guest feed never learns what
   * a driver's ETA chip is.
   */
  renderMessageExtra?: (message: RoomMessage) => ReactNode;
}) {
  // P1-6 — --tr-font-scale already scales every size; the class bump gives the
  // top steps an extra jump in the bubble itself (senior-friendly, §E).
  const cockpit = variant === 'cockpit';
  const bubbleText = textScale >= 4 || cockpit ? 'tr-body-lg' : 'tr-body';
  const systemText = textScale >= 4 || cockpit ? 'tr-card-text' : 'tr-label';
  const [windowSize, setWindowSize] = useState(WINDOW);
  const [originals, setOriginals] = useState<Set<string>>(new Set());
  const [awayCount, setAwayCount] = useState(0);
  const [showFab, setShowFab] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; name?: string | null } | null>(null);
  const [actionMsg, setActionMsg] = useState<RoomMessage | null>(null);
  const [copiedNote, setCopiedNote] = useState(false);
  const action = ACTION_COPY[viewerLocale] ?? ACTION_COPY.en;

  /**
   * Unsend (2026-08-04) — 15-minute window, tombstone on the server, replace
   * by id over the wire. Staff own their role's messages (one driver, one
   * guide per van); a guest owns only messages stamped with their participant
   * id, because "mine" here is a ROLE alignment and cannot tell guests apart.
   */
  const staffViewer = viewerRole === 'guide' || viewerRole === 'driver' || viewerRole === 'admin';
  const canUnsend = (m: RoomMessage): boolean => {
    if (!tts || m._local || m.id.startsWith('local-')) return false;
    if ((m.metadata as { deleted?: unknown } | null)?.deleted === true) return false;
    if (m.sender_role !== viewerRole) return false;
    const age = Date.now() - new Date(m.created_at).getTime();
    if (!Number.isFinite(age) || age > 15 * 60 * 1000) return false;
    if (staffViewer) return true;
    const pid = (m.metadata as { sender_participant_id?: unknown } | null)?.sender_participant_id;
    return Boolean(myParticipantId) && pid === myParticipantId;
  };
  /**
   * 사장님 결정 §5-2 (2026-08-04): 방 밖 공유는 **텍스트만**. 뷰어가 읽고 있는
   * 그 문장(자기 언어)만 나간다 — 발신자명·사진 서명 URL·링크 프리뷰는 싣지
   * 않는다(능력 URL 유출·PII, X17 이 사진을 뺀 이유와 동일). 그릇은 검증된
   * shareTimelineText(카톡/WhatsApp 도달, 데스크톱은 클립보드 폴백).
   */
  const shareMessage = async (m: RoomMessage) => {
    const text = displayText(m, viewerLocale, originals.has(m.id), preferredLocale).trim();
    if (!text) return;
    const outcome = await shareTimelineText(typeof navigator === 'undefined' ? undefined : navigator, {
      title: '',
      text,
    });
    if (outcome === 'copied') setCopiedNote(true);
    setActionMsg(null);
  };

  const unsend = async (m: RoomMessage) => {
    if (!tts) return;
    try {
      await fetch(`/api/tour-rooms/${encodeURIComponent(tts.bookingId)}/messages/${encodeURIComponent(m.id)}`, {
        method: 'DELETE',
        headers: { 'x-tour-room-auth': tts.roomSession },
      });
    } catch {
      /* the bubble stays — the guest can try again from the same sheet */
    }
    setActionMsg(null);
  };

  const jumpToMessage = useCallback((id: string) => {
    const el = feedRef.current?.querySelector(`[data-msg-id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('tr-msg-flash');
      window.setTimeout(() => el.classList.remove('tr-msg-flash'), 1600);
    }
  }, []);

  const copyMessage = useCallback(
    async (m: RoomMessage) => {
      const text = displayText(m, viewerLocale, originals.has(m.id), preferredLocale);
      try {
        await navigator.clipboard?.writeText(text);
        setCopiedNote(true);
        window.setTimeout(() => {
          setCopiedNote(false);
          setActionMsg(null);
        }, 800);
      } catch {
        setActionMsg(null);
      }
    },
    [viewerLocale, originals, preferredLocale],
  );
  const feedRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);

  // U3.3 — everything present on mount predates this visit: no entrance
  // animation for those; only genuinely new arrivals rise in.
  const mountedIdsRef = useRef<Set<string> | null>(null);
  if (mountedIdsRef.current === null) {
    mountedIdsRef.current = new Set(messages.map((m) => m.id));
  }

  // U3.2 — unread divider: remember the newest id across an unmount (tab
  // switch); on re-entry, older-than-divider messages sit above the line.
  const unreadAfterRef = useRef<string | null>(null);
  const storageKey = tts ? `tour_mode_last_read:${tts.bookingId}` : null;
  if (unreadAfterRef.current === null && storageKey) {
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      unreadAfterRef.current =
        stored && messages.some((m) => m.id === stored) && messages[messages.length - 1]?.id !== stored
          ? stored
          : '';
    } catch {
      unreadAfterRef.current = '';
    }
  }
  const lastIdRef = useRef<string | null>(null);
  lastIdRef.current = messages[messages.length - 1]?.id ?? null;
  useEffect(() => {
    return () => {
      if (!storageKey) return;
      try {
        if (lastIdRef.current) window.sessionStorage.setItem(storageKey, lastIdRef.current);
      } catch {
        /* divider is best-effort */
      }
    };
  }, [storageKey]);

  const visible = messages.length > windowSize ? messages.slice(messages.length - windowSize) : messages;
  const hiddenCount = messages.length - visible.length;
  const items: FeedItem[] = useMemo(() => buildFeedItems(visible, viewerRole), [visible, viewerRole]);
  const todayKey = kstToday();

  // A2 — arrival briefings speak under the SAME "read aloud" switch that
  // already governs guide notices. Deliberately not a separate default-on
  // preference: primeAudio() unlocks on the first tap anywhere in the room, so
  // a default-on autoplay would have twenty phones on a bus talking at once.
  const { settings: roomSettings } = useTourRoomSettings();
  const speakArrivals = roomSettings.autoRead && viewerRole === 'customer';

  // Phase 2d — the id of my newest delivered bubble (the one that shows "Read").
  const myLastReadableId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].sender_role === viewerRole && !messages[i]._local) return messages[i].id;
    }
    return null;
  }, [messages, viewerRole]);

  // W2.4 — every LEDGER transition drops a fresh capsule; only the newest
  // capsule per extra carries the live state (and the confirm button).
  const latestExtraCapsule = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of messages) {
      const meta = m.metadata as { kind?: string; extra_id?: string } | null;
      if (meta?.kind === 'extra_ledger' && typeof meta.extra_id === 'string') map.set(meta.extra_id, m.id);
    }
    return map;
  }, [messages]);

  const onScroll = useCallback(() => {
    const el = feedRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    nearBottomRef.current = near;
    setShowFab(!near);
    if (near) setAwayCount(0);
  }, []);

  const scrollToBottom = useCallback((smooth: boolean) => {
    const el = feedRef.current;
    if (el && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    }
    nearBottomRef.current = true;
    setShowFab(false);
    setAwayCount(0);
  }, []);

  // Phase 3 — deep-link focus: once the target message is in the feed, scroll
  // to it and flash it (guide console "tap a message → open the chat there").
  const focusedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focusMessageId || focusedRef.current === focusMessageId) return;
    if (!messages.some((m) => m.id === focusMessageId)) return;
    focusedRef.current = focusMessageId;
    const raf = window.requestAnimationFrame(() => jumpToMessage(focusMessageId));
    return () => window.cancelAnimationFrame(raf);
  }, [focusMessageId, messages, jumpToMessage]);

  const prevCountRef = useRef(messages.length);
  useEffect(() => {
    const grew = messages.length > prevCountRef.current;
    prevCountRef.current = messages.length;
    if (nearBottomRef.current) {
      scrollToBottom(false);
    } else if (grew) {
      setAwayCount((count) => count + 1);
    }
  }, [messages.length, scrollToBottom]);

  const toggleOriginal = (id: string) => {
    setOriginals((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={feedRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto pb-2" data-testid="chat-feed">
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setWindowSize((s) => s + WINDOW)}
            className="tr-pill tr-meta mx-auto mb-2 mt-1 block px-4 py-1.5 font-medium"
          >
            {EARLIER_LABEL[viewerLocale]} (+{hiddenCount})
          </button>
        )}

        {messages.length === 0 && (() => {
          const role = isOperatorViewer(viewerRole) ? 'operator' : 'customer';
          return (
            <div
              className="mx-auto max-w-[300px] pt-14 pb-4"
              data-testid="chat-empty-state"
            >
              <p className="tr-card-text mx-auto max-w-[248px] text-center leading-relaxed text-[var(--tr-ink-2)]">
                {EMPTY_COPY[role][viewerLocale]}
              </p>
              {/*
                N4 — the three lines that turn the blank into a place.
                Deliberately NOT buttons: the signal row already owns the taps
                (U-D20v2), and a second set of chips here would make the two
                rows compete. `aria-hidden` on the markers so a screen reader
                hears three sentences, not three bullets.
              */}
              <ul className="mt-6 space-y-3 px-1" data-testid="chat-empty-hints">
                {EMPTY_HINTS[role][viewerLocale].map((hint) => (
                  <li key={hint} className="flex items-start gap-2.5">
                    <span
                      aria-hidden="true"
                      className="mt-[0.5em] h-1 w-1 shrink-0 rounded-full bg-[var(--tr-ink-3)]"
                    />
                    <span className="tr-meta text-cjk-body leading-relaxed text-[var(--tr-ink-3)]">
                      {hint}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}

        {items.map((item) => {
          if (item.type === 'date') {
            return (
              <div key={item.key} className="my-3 flex justify-center" data-testid="date-separator">
                <span className="tr-pill tr-meta px-3.5 py-1 font-medium">
                  {formatDateSeparator(item.at, viewerLocale, { dayKey: item.dayKey, todayDayKey: todayKey })}
                </span>
              </div>
            );
          }

          const { message, mine, system, groupStart, groupEnd } = item;
          // Unsend tombstone — the row keeps its place in the day, the words
          // are gone in every language at once.
          if ((message.metadata as { deleted?: unknown } | null)?.deleted === true) {
            return (
              /* 🔴 `key` and `data-msg-id` — both, like the other two branches of
                 this map. Without the key React reconciles this row by position
                 instead of identity, and a chat feed reorders constantly: a
                 message arriving above a tombstone can hand its DOM to the wrong
                 row. It logged "Each child in a list should have a unique key"
                 on every visit to a room containing a tombstone, and the missing
                 `data-msg-id` is why a duplicate-id sweep of the DOM could not
                 see the row at all. */
              <div
                key={item.key}
                data-msg-id={message.id}
                className={`flex min-w-0 ${mine ? 'justify-end pl-12' : 'justify-start pr-10'} ${groupStart ? 'mt-2' : 'mt-0.5'}`}
              >
                <span className="tr-meta italic text-[var(--tr-ink-3)]" data-testid="deleted-tombstone">
                  {action.deleted}
                </span>
              </div>
            );
          }
          const isNew = !mountedIdsRef.current!.has(message.id);
          const animClass = isNew ? 'tr-anim-bubble-in' : '';
          const unreadDividerHere =
            Boolean(unreadAfterRef.current) && message.id === unreadAfterRef.current;

          // T4.5 — geofence arrivals with resolved content render as the rich
          // briefing card; content-less arrivals fall through to the plain
          // system capsule (3-tier degradation, T4.3).
          // A1 — the briefing is now stored per language; pick the one THIS
          // viewer reads (pre-A1 rows fall back to the single `content` blob).
          const arrivalPick =
            message.metadata?.kind === 'spot_arrival'
              ? pickSpotContent(message.metadata, viewerLocale)
              : null;
          const arrivalContent = arrivalPick?.content;

          const body = (() => {
            if (message.metadata?.kind === 'extra_ledger') {
              const meta = message.metadata as ExtraLedgerMeta;
              const newest = meta.extra_id ? latestExtraCapsule.get(meta.extra_id) === message.id : false;
              return (
                <div className={animClass}>
                  <ExtraLedgerCard
                    meta={meta}
                    locale={viewerLocale}
                    canConfirm={Boolean(newest && meta.status === 'logged' && viewerRole === 'customer' && onExtraConfirm)}
                    onConfirm={onExtraConfirm}
                  />
                </div>
              );
            }
            // A0 — the one-tap arrival bundle renders as a single composite
            // card (meeting strip · badges · route note · restroom map · spot
            // briefing). The multi-line text stays for TTS / push / cockpit.
            if (message.metadata?.kind === 'arrival_bundle') {
              const text = displayText(message, viewerLocale, originals.has(message.id), preferredLocale);
              return (
                <div className={`mt-2 ${animClass}`}>
                  <ArrivalBundleCard
                    meta={message.metadata as unknown as ArrivalBundleMeta}
                    arrivedLine={text.split('\n')[0] ?? text}
                    locale={viewerLocale}
                    auth={tts ? { ...tts, messageId: message.id } : null}
                    autoPlay={isNew && speakArrivals}
                  />
                </div>
              );
            }
            // §11.C C2 — the 1 km approach preview: a light "coming up" card,
            // visually subordinate to the arrival card that follows it.
            if (message.metadata?.kind === 'approach_card') {
              return (
                <div className={`mt-2 ${animClass}`}>
                  <ApproachCard
                    meta={message.metadata as unknown as ApproachCardMeta}
                    locale={viewerLocale}
                  />
                </div>
              );
            }
            // §5.7 R-5 — the dining picks (list + Kakao deep links, no map
            // tile). `tts` already carries this room's { bookingId, roomSession },
            // which is exactly what the feedback POST needs.
            if (message.metadata?.kind === 'dining_card') {
              return (
                <div className={`mt-2 ${animClass}`}>
                  <DiningCard
                    meta={message.metadata as unknown as DiningCardMeta}
                    locale={viewerLocale}
                    auth={tts ?? null}
                  />
                </div>
              );
            }
            // §5.4 C-16 ②~⑤ — the start-briefing card stack. One branch per
            // metadata.kind; the composed capsule text stays the card body so
            // TTS / push / the cockpit keep reading the same words.
            if (message.metadata?.kind === 'briefing_safety') {
              return (
                <div className={`mt-2 ${animClass}`}>
                  <BriefingSafetyCard
                    meta={message.metadata as unknown as BriefingSafetyMeta}
                    text={displayText(message, viewerLocale, originals.has(message.id), preferredLocale)}
                    locale={viewerLocale}
                    preferredLocale={preferredLocale}
                  />
                </div>
              );
            }
            if (message.metadata?.kind === 'briefing_schedule') {
              return (
                <div className={`mt-2 ${animClass}`}>
                  <BriefingScheduleCard
                    meta={message.metadata as unknown as BriefingScheduleMeta}
                    locale={viewerLocale}
                  />
                </div>
              );
            }
            if (message.metadata?.kind === 'briefing_lunch') {
              return (
                <div className={`mt-2 ${animClass}`}>
                  <BriefingLunchCard
                    meta={message.metadata as unknown as BriefingLunchMeta}
                    text={displayText(message, viewerLocale, originals.has(message.id), preferredLocale)}
                    locale={viewerLocale}
                    auth={viewerRole === 'customer' ? tts ?? null : null}
                  />
                </div>
              );
            }
            if (message.metadata?.kind === 'briefing_etiquette') {
              return (
                <div className={`mt-2 ${animClass}`}>
                  <BriefingEtiquetteCard
                    meta={message.metadata as unknown as BriefingEtiquetteMeta}
                    text={displayText(message, viewerLocale, originals.has(message.id), preferredLocale)}
                    locale={viewerLocale}
                  />
                </div>
              );
            }
            // W3/J4 — an approved POI short rides spot_arrival metadata too.
            const arrivalVideo =
              message.metadata?.kind === 'spot_arrival' && isVideoCardMeta(message.metadata.video_card)
                ? message.metadata.video_card
                : null;
            if ((arrivalContent && Object.keys(arrivalContent).length > 0) || arrivalVideo) {
              return (
                <div className={`mt-2 flex flex-col gap-2 ${animClass}`}>
                  {/* video-only arrival: keep the arrived line above the player */}
                  {arrivalVideo && !(arrivalContent && Object.keys(arrivalContent).length > 0) ? (
                    <p className="tr-body px-1 font-semibold text-[var(--tr-ink)]">
                      {displayText(message, viewerLocale, originals.has(message.id), preferredLocale)}
                    </p>
                  ) : null}
                  {arrivalVideo ? <ArrivalVideoCard meta={arrivalVideo} locale={viewerLocale} /> : null}
                  {arrivalContent && Object.keys(arrivalContent).length > 0 ? (
                    <SpotArrivalCard
                      content={arrivalContent}
                      messageText={displayText(message, viewerLocale, originals.has(message.id), preferredLocale)}
                      audioUrl={(message.metadata?.audio_url as string | null | undefined) ?? null}
                      locale={viewerLocale}
                      lang={arrivalPick?.lang}
                      contentTier={(message.metadata?.content_tier as string | null | undefined) ?? null}
                      auth={tts ? { ...tts, messageId: message.id } : null}
                      // A2 — only the arrival that just landed speaks, and only
                      // for guests: an operator console must never start talking
                      // while its owner is driving.
                      autoPlay={isNew && speakArrivals}
                    />
                  ) : null}
                </div>
              );
            }
            // SG-2b-γ — the rejoin capsule. One branch, before the generic
            // pill, exactly like every other typed capsule (기존 채팅 무변경).
            if (message.metadata?.kind === 'wait_ended') {
              return (
                <div key={message.id} className="my-2 flex justify-center px-2">
                  <WaitEndedCard
                    meta={message.metadata as unknown as import('@/components/tour-mode/WaitEndedCard').WaitEndedMeta}
                    locale={viewerLocale}
                  />
                </div>
              );
            }
            if (system) {
              // M-D2/M-D4 — a system capsule carrying a pin (lost-me, "meet me
              // here", pickup request, meeting set) renders the SAME map card
              // bubbles get; the raw URL line alone was invisible-grade for a
              // driver at a red light. Staff get Kakao chips, guests Google.
              const sysText = displayText(message, viewerLocale, originals.has(message.id), preferredLocale);
              const sysLoc = parseLocationMessage(sysText);
              // New templates carry the URL on its own line (clean parser label);
              // the trailing-separator trim covers rows sent before that change.
              const sysLabel = sysLoc
                ? sysLoc.label.replace(/[\s—–\-·:：;]+$/u, '').trim() || sysText
                : sysText;
              return (
                <div className={`my-2 flex flex-col items-center gap-1.5 ${animClass}`}>
                  <div className={`tr-pill max-w-[88%] px-4 py-1.5 text-center leading-relaxed ${systemText}`}>
                    {sysLabel}
                  </div>
                  {sysLoc && (
                    <LocationPreview
                      lat={sysLoc.lat}
                      lng={sysLoc.lng}
                      label={sysLabel}
                      url={sysLoc.url}
                      audience={
                        viewerRole === 'guide' || viewerRole === 'driver' || viewerRole === 'admin'
                          ? 'staff'
                          : 'guest'
                      }
                    />
                  )}
                </div>
              );
            }

            const translated =
              (preferredLocale ? message.translations?.[preferredLocale] : undefined) ??
              message.translations?.[viewerLocale];
            const translatable = Boolean(translated && translated !== message.source_text);
            const showingOriginal = originals.has(message.id);
            const roleLabel = !mine ? ROLE_LABEL[viewerLocale][message.sender_role] : null;
            // W4.3 — an admin reply after the traveller's SOS gets the highlight.
            const opsHighlighted =
              Boolean(opsHighlightAfter) &&
              !mine &&
              message.sender_role === 'admin' &&
              message.created_at > opsHighlightAfter!;
            // T2.4: listen button on delivered incoming bubbles only (optimistic
            // local sends have no server row for the TTS cache to key on).
            const listenable = Boolean(tts) && !mine && !message._local && !message.id.startsWith('local-');
            const sending = message._local === 'sending';
            const failed = message._local === 'failed';

            const tailClass = groupEnd ? (mine ? 'rounded-br-[var(--tr-radius-tail)]' : 'rounded-bl-[var(--tr-radius-tail)]') : '';
            const time = groupEnd ? formatBubbleTime(message.created_at, viewerLocale) : null;

            const readMark =
              mine &&
              !message._local &&
              message.id === myLastReadableId &&
              Boolean(lastReadByOthersAt) &&
              lastReadByOthersAt! >= message.created_at;

            const metaColumn = (
              <div
                className={`tr-meta flex shrink-0 flex-col justify-end gap-0.5 pb-0.5 text-[var(--tr-ink-3)] ${
                  mine ? 'items-end' : 'items-start'
                }`}
              >
                {(onReply || onReact) && !message._local && (
                  <button
                    type="button"
                    onClick={() => setActionMsg(message)}
                    aria-label={(A11Y[viewerLocale] ?? A11Y.en).actions}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--tr-ink-3)] active:bg-[var(--tr-bubble-system)]"
                    data-testid="msg-actions"
                  >
                    <IconMore size={TR_ICON.chip} aria-hidden />
                  </button>
                )}
                {readMark && (
                  <span className="font-semibold text-[var(--tr-safe)]" data-testid="read-mark">
                    {READ_LABEL[viewerLocale]}
                  </span>
                )}
                {failed && (
                  <span className="text-[var(--tr-danger)]" data-testid="bubble-failed" aria-hidden>
                    <IconRetry size={TR_ICON.meta} strokeWidth={TR_STROKE.small} />
                  </span>
                )}
                {sending && !failed && (
                  <span data-testid="bubble-sending" aria-hidden>
                    <IconSending size={TR_ICON.meta} strokeWidth={TR_STROKE.small} />
                  </span>
                )}
                {translatable && (
                  <span aria-hidden>
                    {showingOriginal ? (
                      <IconOriginal size={TR_ICON.meta} strokeWidth={TR_STROKE.small} />
                    ) : (
                      <IconTranslated size={TR_ICON.meta} strokeWidth={TR_STROKE.small} />
                    )}
                  </span>
                )}
                {time && <span className="whitespace-nowrap tabular-nums">{time}</span>}
              </div>
            );

            // Kakao-grade attachments: image → thumbnail bubble → lightbox;
            // file → download chip. The caption (source_text) still translates.
            const attachment = message.metadata?.attachment as AttachmentMeta | undefined;
            const isImage = message.input_kind === 'image' && typeof attachment?.url === 'string';
            const isFile = message.input_kind === 'file' && typeof attachment?.url === 'string';
            const caption = displayText(message, viewerLocale, showingOriginal, preferredLocale);
            // A driver/system location message (…q=lat,lng) renders as an inline
            // map preview instead of a raw URL.
            const loc = !isImage && !isFile ? parseLocationMessage(caption) : null;

            const textBubble = (
              <button
                type="button"
                onClick={translatable ? () => toggleOriginal(message.id) : undefined}
                data-ops-highlight={opsHighlighted ? 'true' : undefined}
                className={`select-text rounded-[var(--tr-radius-bubble)] px-3.5 py-2 text-left leading-relaxed ${bubbleText} ${tailClass} ${
                  mine
                    ? 'bg-[var(--tr-bubble-me)] text-[var(--tr-bubble-me-ink)]'
                    : 'bg-[var(--tr-bubble-in)] text-[var(--tr-bubble-in-ink)]'
                } ${opsHighlighted ? 'border-l-[3px] border-[var(--tr-safe)] pl-3' : ''} ${sending ? 'opacity-60' : ''} ${
                  failed ? 'opacity-60 outline outline-1 outline-[var(--tr-danger)]' : ''
                }`}
              >
                {caption}
              </button>
            );

            const bubble = isImage ? (
              <div className={`flex flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
                <button
                  type="button"
                  onClick={() => setLightbox({ url: attachment!.url!, name: attachment!.name })}
                  className={`block overflow-hidden rounded-[var(--tr-radius-bubble)] ${sending ? 'opacity-60' : ''} ${
                    failed ? 'outline outline-1 outline-[var(--tr-danger)]' : ''
                  }`}
                  data-testid="chat-image"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={attachment!.url}
                    alt={attachment!.name ?? ''}
                    loading="lazy"
                    className="max-h-64 max-w-[62vw] object-cover"
                  />
                </button>
                {caption ? textBubble : null}
              </div>
            ) : isFile ? (
              <a
                href={attachment!.url}
                download={attachment!.name ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex max-w-[70vw] items-center gap-2.5 rounded-[var(--tr-radius-bubble)] px-3.5 py-2.5 ${tailClass} ${
                  mine
                    ? 'bg-[var(--tr-bubble-me)] text-[var(--tr-bubble-me-ink)]'
                    : 'bg-[var(--tr-bubble-in)] text-[var(--tr-bubble-in-ink)]'
                } ${sending ? 'opacity-60' : ''}`}
                data-testid="chat-file"
              >
                <IconFile size={TR_ICON.nav} strokeWidth={TR_STROKE.default} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="tr-card-text block truncate font-medium">{attachment!.name ?? 'file'}</span>
                  {formatBytes(attachment!.size) && (
                    <span className="tr-meta tr-num block opacity-70">{formatBytes(attachment!.size)}</span>
                  )}
                </span>
                <IconInstall size={TR_ICON.chip} aria-hidden />
              </a>
            ) : loc ? (
              <LocationPreview
                lat={loc.lat}
                lng={loc.lng}
                label={loc.label}
                url={loc.url}
                /* M-D2 — the operator opens a guest pin in Kakao, not Google. */
                audience={
                  viewerRole === 'guide' || viewerRole === 'driver' || viewerRole === 'admin'
                    ? 'staff'
                    : 'guest'
                }
              />
            ) : (
              textBubble
            );

            // Kakao-grade reply: a quote block above the bubble, tap → jump.
            const replySnap = message.metadata?.reply_to as ReplySnapshot | undefined;
            const bubbleEl = replySnap ? (
              <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <button type="button" onClick={() => jumpToMessage(replySnap.id)} className="max-w-full text-left" data-testid="reply-jump">
                  <ReplyPreview variant="bubble" snapshot={replySnap} locale={viewerLocale} mine={mine} />
                </button>
                {bubble}
              </div>
            ) : (
              bubble
            );

            /* §5-4 — a text bubble carrying a URL grows a text-only preview
               card beneath it (server-fetched OG title/description, no image).
               Local echoes wait for the server copy; tombstones carry nothing. */
            const previewUrl =
              tts && !message._local && !message.id.startsWith('local-')
                ? firstUrlIn(displayText(message, viewerLocale, showingOriginal, preferredLocale))
                : null;
            const bubbleWithPreview = previewUrl ? (
              <div className={`flex min-w-0 flex-col ${mine ? 'items-end' : 'items-start'}`}>
                {bubbleEl}
                <LinkPreviewCard url={previewUrl} bookingId={tts!.bookingId} roomSession={tts!.roomSession} />
              </div>
            ) : (
              bubbleEl
            );

            if (mine) {
              return (
                <div className={`flex min-w-0 justify-end pl-12 ${groupStart ? 'mt-2' : 'mt-0.5'} ${animClass}`}>
                  {/* U4-D10 — 76% cap: long paragraphs keep a breathing gutter
                      like Kakao/WhatsApp instead of wall-to-wall text.
                      🔴 FA-015 — the cap is a percentage of the row, but the row
                      also carries `pl-12`, and the timestamp column is intrinsic.
                      At 320px with the largest text step that added up past the
                      viewport: measured 324px of content in a 304px row, so the
                      outgoing bubble bled off the right edge on every skin and
                      both themes. `min-w-0` lets the pair shrink, and capping the
                      inner row too keeps the gutter honest at the small end. */}
                  <div className="flex min-w-0 max-w-full items-end gap-1.5 sm:max-w-[76%]">
                    {metaColumn}
                    <div className="min-w-0">{bubbleWithPreview}</div>
                  </div>
                </div>
              );
            }

            return (
              <div className={`flex min-w-0 justify-start pr-10 ${groupStart ? 'mt-2' : 'mt-0.5'} ${animClass}`}>
                <div className="w-9 shrink-0 self-start pt-0.5">
                  {groupStart && <Avatar role={message.sender_role} size={34} />}
                </div>
                {/* 🔴 FA-015, the incoming half. Same arithmetic as the outgoing
                    row above: a 76% cap plus `pr-10` plus a 36px avatar column is
                    more than the row at 320px with the largest text step. Measured
                    in the cockpit feed — the bubble body overflowed its box by 5px
                    on all six {skin × theme} combos at w320/s5. Capping at 100%
                    below the `sm` breakpoint keeps the gutter where there is room
                    for one and drops it where there is not. */}
                <div className="ml-2 min-w-0 max-w-full sm:max-w-[76%]">
                  {groupStart && (
                    <div
                      className={`tr-name mb-1 flex items-center gap-1 ${
                        opsHighlighted ? 'text-[var(--tr-safe)]' : 'text-[var(--tr-ink-2)]'
                      }`}
                    >
                      {roleLabel ?? ''}
                      {opsHighlighted && (
                        <span className="text-[var(--tr-safe)]" data-testid="ops-reply-dot" aria-hidden>
                          <IconOpsBadge size={TR_ICON.meta} strokeWidth={TR_STROKE.small} />
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-end gap-1.5">
                    <div className="min-w-0">{bubbleWithPreview}</div>
                    {metaColumn}
                  </div>
                  {listenable && tts && (
                    <AudioButton
                      text={displayText(message, viewerLocale, showingOriginal, preferredLocale)}
                      bookingId={tts.bookingId}
                      messageId={message.id}
                      locale={viewerLocale}
                      roomSession={tts.roomSession}
                    />
                  )}
                </div>
              </div>
            );
          })();

          const msgReactions = reactions?.[message.id] ?? [];
          return (
            <div
              key={item.key}
              data-msg-id={message.id}
              onContextMenu={
                (onReply || onReact) && !system && !message._local
                  ? (e) => {
                      e.preventDefault();
                      setActionMsg(message);
                    }
                  : undefined
              }
            >
              {body}
              {msgReactions.length > 0 && (
                <div
                  className={`mt-0.5 flex flex-wrap gap-1 ${mine ? 'justify-end pr-1' : 'pl-11'}`}
                  data-testid="reaction-row"
                >
                  {msgReactions.map((r) => (
                    <button
                      key={r.emoji}
                      type="button"
                      onClick={() => onReact?.(message.id, r.emoji)}
                      className={`tr-meta flex items-center gap-0.5 rounded-full px-2 py-0.5 tabular-nums tr-press ${
                        r.mine
                          ? 'bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)] ring-1 ring-[var(--tr-accent)]'
                          : 'border border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]'
                      }`}
                    >
                      <span>{r.emoji}</span>
                      {r.count > 1 && <span>{r.count}</span>}
                    </button>
                  ))}
                </div>
              )}
              {/* C5 — a per-message slot for surface-specific follow-ups. The
                  cockpit hangs its 3/5/10/15/20분 ETA chips off a guest pickup
                  request here; without the slot, embedding this feed in the
                  cockpit would have silently dropped a driver control, which is
                  not a consolidation — it is a regression wearing one. */}
              {renderMessageExtra?.(message) ?? null}
              {unreadDividerHere && (
                <div className="my-3 flex items-center gap-2 px-2" data-testid="unread-divider">
                  <span className="h-px flex-1 bg-[var(--tr-danger)] opacity-40" />
                  <span className="tr-meta font-medium text-[var(--tr-danger)]">{UNREAD_LABEL[viewerLocale]}</span>
                  <span className="h-px flex-1 bg-[var(--tr-danger)] opacity-40" />
                </div>
              )}
            </div>
          );
        })}

        {typingUsers.length > 0 && (
          <div className="mt-1 flex justify-start pl-11" data-testid="typing-indicator">
            <div className="flex items-center gap-1.5 rounded-[var(--tr-radius-bubble)] bg-[var(--tr-bubble-in)] px-3 py-2">
              <span className="flex gap-0.5" aria-hidden>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--tr-ink-3)] [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--tr-ink-3)] [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--tr-ink-3)] [animation-delay:300ms]" />
              </span>
              <span className="tr-meta text-[var(--tr-ink-3)]">
                {(ROLE_LABEL[viewerLocale][typingUsers[0].role] ?? typingUsers[0].displayName ?? '').trim()} {TYPING_LABEL[viewerLocale]}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* U3.1 — scroll-to-bottom FAB with the while-away counter. */}
      {showFab && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          aria-label={(A11Y[viewerLocale] ?? A11Y.en).scrollLatest}
          className="absolute bottom-3 right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--tr-surface)] text-[var(--tr-ink-2)]"
          style={{ boxShadow: 'var(--tr-shadow-overlay)' }}
          data-testid="scroll-to-bottom"
        >
          <IconScrollDown size={TR_ICON.action} />
          {awayCount > 0 && (
            <span className="tr-meta tr-num absolute -top-1.5 min-w-[18px] rounded-full bg-[var(--tr-accent)] px-1 py-0.5 text-center font-bold leading-none text-[var(--tr-bubble-me-ink)]">
              {awayCount > 99 ? '99+' : awayCount}
            </span>
          )}
        </button>
      )}

      <Lightbox url={lightbox?.url ?? null} name={lightbox?.name} locale={viewerLocale} onClose={() => setLightbox(null)} />

      <style>{`
        .tr-msg-flash { animation: tr-msg-flash 1.6s ease-out; border-radius: 14px; }
        @keyframes tr-msg-flash { 0%, 25% { background: var(--tr-accent-soft); } 100% { background: transparent; } }
      `}</style>

      {actionMsg && (
        <Sheet open onClose={() => setActionMsg(null)} closeLabel={action.close} title={action.title}>
          <div className="flex flex-col">
            {onReact && (
              <div className="mb-1 grid grid-cols-6 justify-items-center gap-0.5 border-b border-[var(--tr-hairline)] px-1 pb-3">
                {REACTION_EMOJI.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onReact(actionMsg.id, emoji);
                      setActionMsg(null);
                    }}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-2xl active:bg-[var(--tr-surface-2)]"
                    data-testid={`react-${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
            {onReply && (
              <button
                type="button"
                onClick={() => {
                  onReply(actionMsg);
                  setActionMsg(null);
                }}
                className="tr-card-text flex items-center gap-3 rounded-xl px-2 py-3 text-left font-medium text-[var(--tr-ink)] active:bg-[var(--tr-surface-2)]"
                data-testid="action-reply"
              >
                <IconReply size={TR_ICON.action} aria-hidden />
                {action.reply}
              </button>
            )}
            <button
              type="button"
              onClick={() => void copyMessage(actionMsg)}
              className="tr-card-text flex items-center gap-3 rounded-xl px-2 py-3 text-left font-medium text-[var(--tr-ink)] active:bg-[var(--tr-surface-2)]"
              data-testid="action-copy"
            >
              <IconCopy size={TR_ICON.action} aria-hidden />
              {copiedNote ? action.copied : action.copy}
            </button>
            {Boolean(displayText(actionMsg, viewerLocale, originals.has(actionMsg.id), preferredLocale).trim()) && (
              <button
                type="button"
                onClick={() => void shareMessage(actionMsg)}
                className="tr-card-text text-cjk-safe flex items-center gap-3 rounded-xl px-2 py-3 text-left font-medium text-[var(--tr-ink)] active:bg-[var(--tr-surface-2)]"
                data-testid="action-share"
              >
                <IconOpenExternal size={TR_ICON.action} aria-hidden />
                {action.share}
              </button>
            )}
            {onPromoteToNotice &&
              Boolean(displayText(actionMsg, viewerLocale, originals.has(actionMsg.id), preferredLocale).trim()) && (
                <button
                  type="button"
                  onClick={() => {
                    onPromoteToNotice(displayText(actionMsg, viewerLocale, originals.has(actionMsg.id), preferredLocale).trim());
                    setActionMsg(null);
                  }}
                  className="tr-card-text text-cjk-safe flex items-center gap-3 rounded-xl px-2 py-3 text-left font-medium text-[var(--tr-ink)] active:bg-[var(--tr-surface-2)]"
                  data-testid="action-promote"
                >
                  <IconReply size={TR_ICON.action} aria-hidden />
                  {action.promote}
                </button>
              )}
            {canUnsend(actionMsg) && (
              <button
                type="button"
                onClick={() => void unsend(actionMsg)}
                className="tr-card-text text-cjk-safe flex items-center gap-3 rounded-xl px-2 py-3 text-left font-medium text-[var(--tr-danger)] active:bg-[var(--tr-surface-2)]"
                data-testid="action-unsend"
              >
                <IconTrash size={TR_ICON.action} aria-hidden />
                {action.unsend}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                toggleOriginal(actionMsg.id);
                setActionMsg(null);
              }}
              className="tr-card-text flex items-center gap-3 rounded-xl px-2 py-3 text-left font-medium text-[var(--tr-ink)] active:bg-[var(--tr-surface-2)]"
              data-testid="action-translate"
            >
              {originals.has(actionMsg.id) ? (
                <IconTranslated size={TR_ICON.action} aria-hidden />
              ) : (
                <IconOriginal size={TR_ICON.action} aria-hidden />
              )}
              {originals.has(actionMsg.id) ? action.translated : action.original}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
