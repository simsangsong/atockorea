/**
 * 동행자 초대·등록 5로케일 문구 — AtoC 통합 플랜 §5.2 C-6.
 * joinCopy.ts / checkinCopy.ts와 동일 캡슐 규약 (사전 번역 상수, LLM 0).
 *
 * 🔴 client-safe: 순수 상수만. node:crypto를 쓰는 companionToken.ts를
 *    'use client' 컴포넌트가 절대 임포트하지 않도록 문구는 여기 둔다.
 */

import { ROOM_LOCALES, type RoomLocale } from '@/lib/tour-room/snapshot';

export type CompanionCopyKey =
  // 동행자 랜딩
  | 'joinTitle'
  | 'joinHint'
  | 'nameLabel'
  | 'namePlaceholder'
  | 'joinCta'
  | 'joining'
  | 'joinedTitle'
  | 'joinedHint'
  | 'openRoom'
  | 'full'
  | 'expired'
  | 'error'
  | 'retry'
  // lead 설정 카드
  | 'inviteTitle'
  | 'inviteHint'
  | 'inviteCta'
  | 'inviteSlots' // {remaining} {capacity}
  | 'inviteFull'
  | 'copy'
  | 'copied'
  | 'share'
  | 'inviteExpiry';

const COPY: Record<CompanionCopyKey, Record<RoomLocale, string>> = {
  joinTitle: {
    en: 'Join your group',
    ko: '일행으로 참여하기',
    ja: 'グループに参加',
    es: 'Únete a tu grupo',
    zh: '加入您的同行',
    fr: 'Rejoignez votre groupe',
    de: 'Ihrer Gruppe beitreten',
    ru: 'Присоединитесь к своей группе',
    it: 'Unisciti al tuo gruppo',
  },
  joinHint: {
    en: 'This device gets its own place in the tour room — your own chat, your own check-in.',
    ko: '이 기기가 투어룸의 자리 하나를 갖게 돼요 — 내 채팅, 내 체크인.',
    ja: 'この端末がツアールームの席を1つ持ちます（自分のチャット・自分のチェックイン）。',
    es: 'Este dispositivo tendrá su propio lugar en la sala: tu chat y tu check-in.',
    zh: '此设备将在行程房间中拥有自己的位置：自己的聊天与签到。',
    fr: 'Cet appareil aura sa propre place dans l’espace tour — votre chat, votre check-in.',
    de: 'Dieses Gerät bekommt einen eigenen Platz im Tour-Raum — eigener Chat, eigener Check-in.',
    ru: 'У этого устройства будет свое место в комнате тура — свой чат, свой чек-ин.',
    it: 'Questo dispositivo avrà il suo posto nella stanza del tour — la tua chat, il tuo check-in.',
  },
  nameLabel: { en: 'Your name', ko: '이름', ja: 'お名前', es: 'Tu nombre', zh: '您的姓名', fr: 'Votre nom', de: 'Ihr Name', ru: 'Имя', it: 'Il tuo nome' },
  namePlaceholder: { en: 'e.g. Sofia', ko: '예: 지민', ja: '例: さくら', es: 'p. ej. Sofía', zh: '例：小明', fr: 'ex. Léa', de: 'z. B. Lena', ru: 'например, Анна', it: 'es. Giulia' },
  joinCta: { en: 'Join the room', ko: '투어룸 입장', ja: 'ルームに参加', es: 'Entrar a la sala', zh: '进入房间', fr: 'Rejoindre l’espace tour', de: 'Tour-Raum beitreten', ru: 'Войти в комнату тура', it: 'Entra nella stanza' },
  joining: { en: 'Joining…', ko: '입장 중…', ja: '参加中…', es: 'Entrando…', zh: '正在加入…', fr: 'Connexion…', de: 'Beitritt läuft…', ru: 'Подключение…', it: 'Ingresso in corso…' },
  joinedTitle: { en: 'You are in', ko: '등록됐어요', ja: '参加しました', es: 'Ya estás dentro', zh: '已加入', fr: 'Vous y êtes', de: 'Sie sind dabei', ru: 'Готово — вы в комнате', it: 'Sei dentro' },
  joinedHint: {
    en: 'Opening your tour room…',
    ko: '투어룸을 여는 중…',
    ja: 'ツアールームを開いています…',
    es: 'Abriendo tu sala…',
    zh: '正在打开行程房间…',
    fr: 'Ouverture de votre espace tour…',
    de: 'Ihr Tour-Raum wird geöffnet…',
    ru: 'Открываем вашу комнату тура…',
    it: 'Apertura della tua stanza del tour…',
  },
  openRoom: { en: 'Open the room', ko: '투어룸 열기', ja: 'ルームを開く', es: 'Abrir la sala', zh: '打开房间', fr: 'Ouvrir l’espace tour', de: 'Tour-Raum öffnen', ru: 'Открыть комнату', it: 'Apri la stanza' },
  full: {
    en: 'This booking already has all of its devices registered.',
    ko: '이 예약은 등록 가능한 기기를 이미 다 썼어요.',
    ja: 'この予約はすでに登録可能な端末数に達しています。',
    es: 'Esta reserva ya tiene todos sus dispositivos registrados.',
    zh: '此预订的可注册设备已用完。',
    fr: 'Tous les appareils de cette réservation sont déjà enregistrés.',
    de: 'Für diese Buchung sind bereits alle Geräte registriert.',
    ru: 'Для этого бронирования уже зарегистрированы все устройства.',
    it: 'Questa prenotazione ha già registrato tutti i suoi dispositivi.',
  },
  expired: {
    en: 'This invite is invalid or expired — ask for a fresh link.',
    ko: '이 초대 링크는 만료되었거나 유효하지 않아요. 새 링크를 받아 주세요.',
    ja: 'この招待リンクは無効か期限切れです。新しいリンクをもらってください。',
    es: 'Esta invitación no es válida o caducó: pide un enlace nuevo.',
    zh: '此邀请链接无效或已过期，请索取新链接。',
    fr: 'Cette invitation est invalide ou expirée — demandez un nouveau lien.',
    de: 'Diese Einladung ist ungültig oder abgelaufen — bitten Sie um einen neuen Link.',
    ru: 'Приглашение недействительно или истекло — попросите новую ссылку.',
    it: 'Questo invito non è valido o è scaduto — chiedi un nuovo link.',
  },
  error: {
    en: 'Something went wrong.',
    ko: '문제가 발생했어요.',
    ja: 'エラーが発生しました。',
    es: 'Algo salió mal.',
    zh: '出了点问题。',
    fr: 'Une erreur est survenue.',
    de: 'Etwas ist schiefgelaufen.',
    ru: 'Что-то пошло не так.',
    it: 'Qualcosa è andato storto.',
  },
  retry: { en: 'Try again', ko: '다시 시도', ja: 'もう一度', es: 'Reintentar', zh: '重试', fr: 'Réessayer', de: 'Erneut versuchen', ru: 'Повторить', it: 'Riprova' },

  inviteTitle: {
    en: 'Invite your companions',
    ko: '동행자 초대',
    ja: '同行者を招待',
    es: 'Invitar a tus acompañantes',
    zh: '邀请同行者',
    fr: 'Invitez vos compagnons de voyage',
    de: 'Begleiter einladen',
    ru: 'Пригласите спутников',
    it: 'Invita i tuoi compagni di viaggio',
  },
  inviteHint: {
    en: 'Share a link so someone travelling with you can use the room on their own phone.',
    ko: '함께 오시는 분이 자기 휴대폰으로 투어룸을 쓸 수 있게 링크를 공유하세요.',
    ja: '同行の方がご自身のスマホでルームを使えるようリンクを共有します。',
    es: 'Comparte un enlace para que quien viaja contigo use la sala en su propio móvil.',
    zh: '分享链接，让同行的人用自己的手机使用行程房间。',
    fr: 'Partagez un lien pour qu’une personne qui voyage avec vous utilise l’espace tour sur son propre téléphone.',
    de: 'Teilen Sie einen Link, damit Ihre Mitreisenden den Tour-Raum auf dem eigenen Handy nutzen können.',
    ru: 'Поделитесь ссылкой, чтобы ваш спутник пользовался комнатой тура со своего телефона.',
    it: 'Condividi un link così chi viaggia con te può usare la stanza dal proprio telefono.',
  },
  inviteCta: { en: 'Create invite link', ko: '초대 링크 만들기', ja: '招待リンクを作成', es: 'Crear enlace', zh: '生成邀请链接', fr: 'Créer un lien d’invitation', de: 'Einladungslink erstellen', ru: 'Создать ссылку-приглашение', it: 'Crea link d’invito' },
  inviteSlots: {
    en: '{remaining} of {capacity} devices left',
    ko: '{capacity}대 중 {remaining}대 남음',
    ja: '{capacity}台中 残り{remaining}台',
    es: 'Quedan {remaining} de {capacity} dispositivos',
    zh: '{capacity} 台中还剩 {remaining} 台',
    fr: '{remaining} appareils restants sur {capacity}',
    de: 'Noch {remaining} von {capacity} Geräten frei',
    ru: 'Осталось {remaining} из {capacity} устройств',
    it: 'Restano {remaining} dispositivi su {capacity}',
  },
  inviteFull: {
    en: 'Every device for this booking is already registered.',
    ko: '이 예약의 기기 자리를 모두 썼어요.',
    ja: 'この予約の端末枠はすべて使用済みです。',
    es: 'Ya se registraron todos los dispositivos de esta reserva.',
    zh: '此预订的设备名额已全部使用。',
    fr: 'Toutes les places d’appareil de cette réservation sont déjà utilisées.',
    de: 'Alle Geräteplätze dieser Buchung sind bereits belegt.',
    ru: 'Все места для устройств в этом бронировании уже заняты.',
    it: 'Tutti i posti dispositivo di questa prenotazione sono già occupati.',
  },
  copy: { en: 'Copy link', ko: '링크 복사', ja: 'リンクをコピー', es: 'Copiar enlace', zh: '复制链接', fr: 'Copier le lien', de: 'Link kopieren', ru: 'Скопировать ссылку', it: 'Copia link' },
  copied: { en: 'Copied', ko: '복사됨', ja: 'コピーしました', es: 'Copiado', zh: '已复制', fr: 'Copié', de: 'Kopiert', ru: 'Скопировано', it: 'Copiato' },
  share: { en: 'Share', ko: '공유', ja: '共有', es: 'Compartir', zh: '分享', fr: 'Partager', de: 'Teilen', ru: 'Поделиться', it: 'Condividi' },
  inviteExpiry: {
    en: 'The link stops working the day after the tour.',
    ko: '링크는 투어 다음 날 만료돼요.',
    ja: 'リンクはツアーの翌日に無効になります。',
    es: 'El enlace deja de funcionar el día después del tour.',
    zh: '链接将在行程次日失效。',
    fr: 'Le lien cesse de fonctionner le lendemain du tour.',
    de: 'Der Link läuft am Tag nach der Tour ab.',
    ru: 'Ссылка перестает работать на следующий день после тура.',
    it: 'Il link smette di funzionare il giorno dopo il tour.',
  },
};

export function detectCompanionLocale(raw?: string | null): RoomLocale {
  const base = (raw ?? (typeof window !== 'undefined' ? navigator.language : 'en'))
    .toLowerCase()
    .split('-')[0];
  return (ROOM_LOCALES as readonly string[]).includes(base) ? (base as RoomLocale) : 'en';
}

export function companionCopy(
  locale: RoomLocale,
  key: CompanionCopyKey,
  vars: Record<string, string | number> = {},
): string {
  let text = COPY[key][locale] ?? COPY[key].en;
  for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
  return text;
}
