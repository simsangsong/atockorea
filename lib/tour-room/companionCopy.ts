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
  },
  joinHint: {
    en: 'This device gets its own place in the tour room — your own chat, your own check-in.',
    ko: '이 기기가 투어룸의 자리 하나를 갖게 돼요 — 내 채팅, 내 체크인.',
    ja: 'この端末がツアールームの席を1つ持ちます（自分のチャット・自分のチェックイン）。',
    es: 'Este dispositivo tendrá su propio lugar en la sala: tu chat y tu check-in.',
    zh: '此设备将在行程房间中拥有自己的位置：自己的聊天与签到。',
  },
  nameLabel: { en: 'Your name', ko: '이름', ja: 'お名前', es: 'Tu nombre', zh: '您的姓名' },
  namePlaceholder: { en: 'e.g. Sofia', ko: '예: 지민', ja: '例: さくら', es: 'p. ej. Sofía', zh: '例：小明' },
  joinCta: { en: 'Join the room', ko: '투어룸 입장', ja: 'ルームに参加', es: 'Entrar a la sala', zh: '进入房间' },
  joining: { en: 'Joining…', ko: '입장 중…', ja: '参加中…', es: 'Entrando…', zh: '正在加入…' },
  joinedTitle: { en: 'You are in', ko: '등록됐어요', ja: '参加しました', es: 'Ya estás dentro', zh: '已加入' },
  joinedHint: {
    en: 'Opening your tour room…',
    ko: '투어룸을 여는 중…',
    ja: 'ツアールームを開いています…',
    es: 'Abriendo tu sala…',
    zh: '正在打开行程房间…',
  },
  openRoom: { en: 'Open the room', ko: '투어룸 열기', ja: 'ルームを開く', es: 'Abrir la sala', zh: '打开房间' },
  full: {
    en: 'This booking already has all of its devices registered.',
    ko: '이 예약은 등록 가능한 기기를 이미 다 썼어요.',
    ja: 'この予約はすでに登録可能な端末数に達しています。',
    es: 'Esta reserva ya tiene todos sus dispositivos registrados.',
    zh: '此预订的可注册设备已用完。',
  },
  expired: {
    en: 'This invite is invalid or expired — ask for a fresh link.',
    ko: '이 초대 링크는 만료되었거나 유효하지 않아요. 새 링크를 받아 주세요.',
    ja: 'この招待リンクは無効か期限切れです。新しいリンクをもらってください。',
    es: 'Esta invitación no es válida o caducó: pide un enlace nuevo.',
    zh: '此邀请链接无效或已过期，请索取新链接。',
  },
  error: {
    en: 'Something went wrong.',
    ko: '문제가 발생했어요.',
    ja: 'エラーが発生しました。',
    es: 'Algo salió mal.',
    zh: '出了点问题。',
  },
  retry: { en: 'Try again', ko: '다시 시도', ja: 'もう一度', es: 'Reintentar', zh: '重试' },

  inviteTitle: {
    en: 'Invite your companions',
    ko: '동행자 초대',
    ja: '同行者を招待',
    es: 'Invitar a tus acompañantes',
    zh: '邀请同行者',
  },
  inviteHint: {
    en: 'Share a link so someone travelling with you can use the room on their own phone.',
    ko: '함께 오시는 분이 자기 휴대폰으로 투어룸을 쓸 수 있게 링크를 공유하세요.',
    ja: '同行の方がご自身のスマホでルームを使えるようリンクを共有します。',
    es: 'Comparte un enlace para que quien viaja contigo use la sala en su propio móvil.',
    zh: '分享链接，让同行的人用自己的手机使用行程房间。',
  },
  inviteCta: { en: 'Create invite link', ko: '초대 링크 만들기', ja: '招待リンクを作成', es: 'Crear enlace', zh: '生成邀请链接' },
  inviteSlots: {
    en: '{remaining} of {capacity} devices left',
    ko: '{capacity}대 중 {remaining}대 남음',
    ja: '{capacity}台中 残り{remaining}台',
    es: 'Quedan {remaining} de {capacity} dispositivos',
    zh: '{capacity} 台中还剩 {remaining} 台',
  },
  inviteFull: {
    en: 'Every device for this booking is already registered.',
    ko: '이 예약의 기기 자리를 모두 썼어요.',
    ja: 'この予約の端末枠はすべて使用済みです。',
    es: 'Ya se registraron todos los dispositivos de esta reserva.',
    zh: '此预订的设备名额已全部使用。',
  },
  copy: { en: 'Copy link', ko: '링크 복사', ja: 'リンクをコピー', es: 'Copiar enlace', zh: '复制链接' },
  copied: { en: 'Copied', ko: '복사됨', ja: 'コピーしました', es: 'Copiado', zh: '已复制' },
  share: { en: 'Share', ko: '공유', ja: '共有', es: 'Compartir', zh: '分享' },
  inviteExpiry: {
    en: 'The link stops working the day after the tour.',
    ko: '링크는 투어 다음 날 만료돼요.',
    ja: 'リンクはツアーの翌日に無効になります。',
    es: 'El enlace deja de funcionar el día después del tour.',
    zh: '链接将在行程次日失效。',
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
