/**
 * 조인투어 게스트 claim + 좌석선택 5로케일 문구 — AtoC 통합 플랜 §5.2/§5.3.
 * checkinCopy.ts와 동일 캡슐 규약 (사전 번역 상수, LLM 0, ROOM_LOCALES 기준).
 */

import { ROOM_LOCALES, type RoomLocale } from '@/lib/tour-room/snapshot';

export type JoinCopyKey =
  | 'rosterTitle'
  | 'rosterHint'
  | 'pax' // {n}
  | 'claimed'
  | 'pickName'
  | 'verifyTitle' // {name}
  | 'verifyHint'
  | 'emailTailLabel'
  | 'partySizeLabel'
  | 'confirm'
  | 'back'
  | 'verifyFailed'
  | 'alreadyClaimed'
  | 'alreadyClaimedHint'
  | 'reclaim'
  | 'seatTitle'
  | 'seatHint' // {n}
  | 'seatSoon'
  | 'seatTaken'
  | 'seatLocked'
  | 'selectedCount' // {sel} {n}
  | 'confirmSeats'
  | 'changeSeats'
  | 'done'
  | 'doneHint'
  | 'yourSeats'
  | 'loading'
  | 'error'
  | 'retry';

const COPY: Record<JoinCopyKey, Record<RoomLocale, string>> = {
  rosterTitle: {
    en: 'Find your name',
    ko: '본인 이름을 선택하세요',
    zh: '选择您的姓名',
    ja: 'お名前を選んでください',
    es: 'Seleccione su nombre',
  },
  rosterHint: {
    en: 'Tap your booking to check in for the tour.',
    ko: '명단에서 본인 예약을 탭하세요.',
    zh: '点击您的预订以加入本次行程。',
    ja: 'ご自身の予約をタップしてください。',
    es: 'Toque su reserva para unirse al tour.',
  },
  pax: { en: '{n} pax', ko: '{n}명', zh: '{n}人', ja: '{n}名', es: '{n} pers.' },
  claimed: { en: 'registered', ko: '등록됨', zh: '已登记', ja: '登録済み', es: 'registrado' },
  pickName: { en: 'This is me', ko: '본인입니다', zh: '这是我', ja: '本人です', es: 'Soy yo' },
  verifyTitle: {
    en: 'Confirm it is you, {name}',
    ko: '{name}님이 맞나요?',
    zh: '确认是您本人，{name}',
    ja: '{name}様で間違いありませんか？',
    es: '¿Es usted, {name}?',
  },
  verifyHint: {
    en: 'Answer one to confirm — this prevents mis-selection.',
    ko: '오선택 방지를 위해 하나만 확인해 주세요.',
    zh: '请回答其一以确认，防止误选。',
    ja: '誤選択防止のため、いずれかをご確認ください。',
    es: 'Responda uno para confirmar y evitar errores.',
  },
  emailTailLabel: {
    en: 'Last part of your booking email',
    ko: '예약 이메일 뒷부분',
    zh: '预订邮箱的后段',
    ja: '予約メールの末尾',
    es: 'Parte final de su correo de reserva',
  },
  partySizeLabel: {
    en: 'Number of people in your booking',
    ko: '예약 인원 수',
    zh: '预订人数',
    ja: 'ご予約の人数',
    es: 'Número de personas de su reserva',
  },
  confirm: { en: 'Confirm', ko: '확인', zh: '确认', ja: '確認', es: 'Confirmar' },
  back: { en: 'Back', ko: '뒤로', zh: '返回', ja: '戻る', es: 'Atrás' },
  verifyFailed: {
    en: 'That did not match — please try again.',
    ko: '일치하지 않아요 — 다시 시도해 주세요.',
    zh: '不匹配，请重试。',
    ja: '一致しません — もう一度お試しください。',
    es: 'No coincide, inténtelo de nuevo.',
  },
  alreadyClaimed: {
    en: 'This booking is already registered.',
    ko: '이미 등록된 예약입니다.',
    zh: '此预订已登记。',
    ja: 'この予約はすでに登録済みです。',
    es: 'Esta reserva ya está registrada.',
  },
  alreadyClaimedHint: {
    en: 'If this is you, request re-registration — the guide will approve it.',
    ko: '본인이라면 재등록을 요청하세요 — 가이드가 승인합니다.',
    zh: '若确为本人，请申请重新登记，导游将予以批准。',
    ja: 'ご本人の場合は再登録をリクエストしてください — ガイドが承認します。',
    es: 'Si es usted, solicite volver a registrarse; el guía lo aprobará.',
  },
  reclaim: {
    en: 'This is me — request re-registration',
    ko: '내가 맞습니다 — 재등록 요청',
    zh: '这是我 — 申请重新登记',
    ja: '本人です — 再登録をリクエスト',
    es: 'Soy yo, solicitar nuevo registro',
  },
  seatTitle: {
    en: 'Choose your seats',
    ko: '좌석을 선택하세요',
    zh: '选择您的座位',
    ja: '座席を選んでください',
    es: 'Elija sus asientos',
  },
  seatHint: {
    en: 'Select {n} seat(s) for your party.',
    ko: '일행 {n}석을 선택하세요.',
    zh: '为您的同行选择 {n} 个座位。',
    ja: '同行者{n}席を選んでください。',
    es: 'Seleccione {n} asiento(s) para su grupo.',
  },
  seatSoon: {
    en: 'Seats open once your vehicle is assigned.',
    ko: '차량 배정이 완료되면 좌석이 열려요.',
    zh: '车辆分配后即可选座。',
    ja: '車両が割り当てられると座席が開きます。',
    es: 'Los asientos se abren cuando se asigne su vehículo.',
  },
  seatTaken: {
    en: 'That seat was just taken — please pick another.',
    ko: '방금 다른 분이 선택했어요 — 다른 좌석을 골라주세요.',
    zh: '该座位刚被选走，请另选一个。',
    ja: 'その席は今埋まりました — 別の席をお選びください。',
    es: 'Ese asiento acaba de ocuparse; elija otro.',
  },
  seatLocked: {
    en: 'Seats are locked for boarding today.',
    ko: '오늘은 탑승을 위해 좌석이 잠겼어요.',
    zh: '今日座位已锁定以便登车。',
    ja: '本日は乗車のため座席がロックされています。',
    es: 'Los asientos están bloqueados para el embarque de hoy.',
  },
  selectedCount: {
    en: 'Selected {sel} of {n}',
    ko: '{n}석 중 {sel}석 선택',
    zh: '已选 {sel}/{n}',
    ja: '{n}席中 {sel}席選択',
    es: 'Seleccionados {sel} de {n}',
  },
  confirmSeats: {
    en: 'Confirm seats',
    ko: '좌석 확정',
    zh: '确认座位',
    ja: '座席を確定',
    es: 'Confirmar asientos',
  },
  changeSeats: {
    en: 'Change seats',
    ko: '좌석 변경',
    zh: '更改座位',
    ja: '座席を変更',
    es: 'Cambiar asientos',
  },
  done: {
    en: 'All set — see you on the tour! ✅',
    ko: '완료 — 투어에서 만나요! ✅',
    zh: '已完成 — 行程见！✅',
    ja: '完了 — ツアーでお会いしましょう！✅',
    es: 'Listo — ¡nos vemos en el tour! ✅',
  },
  doneHint: {
    en: 'On the tour day, scan the guide QR to check in.',
    ko: '투어 당일 가이드 QR을 스캔해 체크인하세요.',
    zh: '行程当天扫描导游二维码即可登车确认。',
    ja: 'ツアー当日はガイドのQRをスキャンしてチェックインしてください。',
    es: 'El día del tour, escanee el QR del guía para registrarse.',
  },
  yourSeats: { en: 'Your seats', ko: '내 좌석', zh: '您的座位', ja: 'あなたの座席', es: 'Sus asientos' },
  loading: { en: 'Loading…', ko: '불러오는 중…', zh: '加载中…', ja: '読み込み中…', es: 'Cargando…' },
  error: {
    en: 'Something went wrong.',
    ko: '문제가 발생했어요.',
    zh: '出了点问题。',
    ja: 'エラーが発生しました。',
    es: 'Algo salió mal.',
  },
  retry: { en: 'Try again', ko: '다시 시도', zh: '重试', ja: 'もう一度', es: 'Reintentar' },
};

export function detectJoinLocale(raw?: string | null): RoomLocale {
  const base = (raw ?? (typeof navigator !== 'undefined' ? navigator.language : 'en'))
    .toLowerCase()
    .split('-')[0];
  return (ROOM_LOCALES as readonly string[]).includes(base) ? (base as RoomLocale) : 'en';
}

export function joinCopy(
  locale: RoomLocale,
  key: JoinCopyKey,
  vars: Record<string, string | number> = {},
): string {
  let text = COPY[key][locale] ?? COPY[key].en;
  for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
  return text;
}
