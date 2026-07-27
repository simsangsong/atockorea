/**
 * QR 체크인 랜딩 5로케일 문구 — AtoC 통합 플랜 §5.4c (기존 캡슐 패턴:
 * 사전 번역 상수, LLM 0 — morningBriefing.ts와 동일 규약, ROOM_LOCALES 기준).
 */

import { ROOM_LOCALES, type RoomLocale } from '@/lib/tour-room/snapshot';

export type CheckinCopyKey =
  | 'recognizing'
  | 'greeting' // {name}
  // §K B5-D3 — 자동 체크인 경로의 문구는 **질문이 아니라 환영**이다.
  // 'greeting'("체크인할까요?")은 물어볼 것이 남아 있는 정적 QR 경로에만 쓴다.
  // 자동이면 물을 것이 없고, 손님이 아침에 처음 보는 화면이 환영이어야 한다.
  | 'welcome' // {name}
  | 'welcomeSeat' // {seat}
  | 'welcomeParty' // {n}
  | 'undo'
  | 'undone'
  | 'openRoom'
  | 'yourSeats'
  | 'partyPrompt' // {n}
  | 'confirmAll' // {n}
  | 'confirmOne'
  | 'selectSome'
  | 'success'
  | 'already'
  | 'noToken'
  | 'noTokenHint'
  | 'wrongRoom'
  | 'unregistered'
  | 'unregisteredHint'
  | 'noSeats'
  | 'notOpen' // {date}
  | 'nonceExpired'
  | 'error'
  | 'retry';

const COPY: Record<CheckinCopyKey, Record<RoomLocale, string>> = {
  recognizing: {
    en: 'Checking your booking…',
    ko: '예약을 확인하는 중…',
    zh: '正在确认您的预订…',
    ja: 'ご予約を確認しています…',
    es: 'Comprobando su reserva…',
    fr: 'Vérification de votre réservation…',
    de: 'Wir prüfen Ihre Buchung…',
    ru: 'Проверяем вашу бронь…',
    it: 'Stiamo verificando la tua prenotazione…',
  },
  greeting: {
    en: 'Hi {name} — check in now?',
    ko: '{name}님, 체크인할까요?',
    zh: '{name}，现在办理登车确认吗？',
    ja: '{name}さん、チェックインしますか？',
    es: 'Hola {name}, ¿confirmamos su asistencia?',
    fr: 'Bonjour {name} — on s’enregistre?',
    de: 'Hallo {name} — jetzt einchecken?',
    ru: 'Здравствуйте, {name} — пройти регистрацию?',
    it: 'Ciao {name} — facciamo il check-in?',
  },
  welcome: {
    en: 'Welcome, {name} 👋',
    ko: '안녕하세요 {name}님 👋',
    zh: '欢迎您，{name} 👋',
    ja: 'ようこそ、{name}さん 👋',
    es: 'Bienvenido/a, {name} 👋',
    fr: 'Bienvenue, {name} 👋',
    de: 'Willkommen, {name} 👋',
    ru: 'Добро пожаловать, {name} 👋',
    it: 'Benvenuto/a, {name} 👋',
  },
  welcomeSeat: {
    en: "You're in seat {seat}.",
    ko: '{seat}번 좌석입니다.',
    zh: '您的座位是 {seat} 号。',
    ja: '{seat}番の座席です。',
    es: 'Su asiento es el {seat}.',
    fr: 'Vous êtes au siège {seat}.',
    de: 'Sie haben Sitzplatz {seat}.',
    ru: 'Ваше место — {seat}.',
    it: 'Il tuo posto è il {seat}.',
  },
  welcomeParty: {
    en: 'Checked in — {n} in your party.',
    ko: '일행 {n}명 체크인 완료.',
    zh: '已确认 — 同行 {n} 人。',
    ja: 'チェックイン完了 — 同行{n}名。',
    es: 'Confirmado — {n} personas en su grupo.',
    fr: 'Enregistré — {n} personnes dans votre groupe.',
    de: 'Eingecheckt — {n} Personen in Ihrer Gruppe.',
    ru: 'Регистрация пройдена — в вашей группе {n} чел.',
    it: 'Check-in fatto — persone nel tuo gruppo: {n}.',
  },
  // B5-D2 — 되돌리기를 모달로 막지 않는다. 일행 3명 중 1명이 아직 화장실인
  // 경우가 실제로 흔하고, 자동의 이득(탭 0)을 지키면서 정정 경로를 남긴다.
  undo: {
    en: 'Fix this',
    ko: '수정',
    zh: '修改',
    ja: '修正',
    es: 'Corregir',
    fr: 'Corriger',
    de: 'Korrigieren',
    ru: 'Исправить',
    it: 'Correggi',
  },
  undone: {
    en: 'Undone — check in again when you are ready.',
    ko: '취소했어요 — 준비되면 다시 체크인하세요.',
    zh: '已撤销 — 准备好后可再次确认。',
    ja: '取り消しました — 準備ができたら再度チェックインしてください。',
    es: 'Deshecho: confirme de nuevo cuando esté listo/a.',
    fr: 'Annulé — refaites l’enregistrement quand vous le souhaitez.',
    de: 'Rückgängig gemacht — checken Sie wieder ein, sobald Sie bereit sind.',
    ru: 'Отменено — зарегистрируйтесь снова, когда будете готовы.',
    it: 'Annullato — rifai il check-in quando sei pronto/a.',
  },
  // B5-D4 — 체크인이 막다른 화면이 되면 안 된다. 스캔 직후가 손님이 앱을
  // 열어보는 유일한 순간일 수 있다.
  openRoom: {
    en: 'Open my tour room',
    ko: '투어룸 열기',
    zh: '打开我的行程群组',
    ja: 'ツアールームを開く',
    es: 'Abrir mi sala de tour',
    fr: 'Ouvrir mon espace tour',
    de: 'Meinen Tour-Raum öffnen',
    ru: 'Открыть комнату тура',
    it: 'Apri la stanza del tour',
  },
  yourSeats: {
    en: 'Your seats',
    ko: '내 좌석',
    zh: '您的座位',
    ja: 'あなたの座席',
    es: 'Sus asientos',
    fr: 'Vos sièges',
    de: 'Ihre Sitzplätze',
    ru: 'Ваши места',
    it: 'I tuoi posti',
  },
  partyPrompt: {
    en: 'Check in all {n} of your party?',
    ko: '일행 {n}명 모두 체크인할까요?',
    zh: '同行 {n} 人全部确认吗？',
    ja: '同行者{n}名まとめてチェックインしますか？',
    es: '¿Confirmar a las {n} personas de su grupo?',
    fr: 'Enregistrer les {n} personnes de votre groupe?',
    de: 'Alle {n} Personen Ihrer Gruppe einchecken?',
    ru: 'Зарегистрировать всех {n} человек из вашей группы?',
    it: 'Check-in per tutte le {n} persone del tuo gruppo?',
  },
  confirmAll: {
    en: 'Check in all ({n})',
    ko: '전원 체크인 ({n}명)',
    zh: '全部确认（{n}人）',
    ja: '全員チェックイン（{n}名）',
    es: 'Confirmar todos ({n})',
    fr: 'Tout enregistrer ({n})',
    de: 'Alle einchecken ({n})',
    ru: 'Зарегистрировать всех ({n})',
    it: 'Check-in per tutti ({n})',
  },
  confirmOne: {
    en: 'Check in',
    ko: '체크인 확인',
    zh: '确认登车',
    ja: 'チェックイン',
    es: 'Confirmar',
    fr: 'S’enregistrer',
    de: 'Einchecken',
    ru: 'Зарегистрироваться',
    it: 'Fai il check-in',
  },
  selectSome: {
    en: 'Select who is here',
    ko: '지금 있는 인원만 선택',
    zh: '仅选择在场的人',
    ja: '今いる人だけ選ぶ',
    es: 'Seleccionar solo a los presentes',
    fr: 'Sélectionner les personnes présentes',
    de: 'Nur Anwesende auswählen',
    ru: 'Выбрать только тех, кто здесь',
    it: 'Seleziona chi è presente',
  },
  success: {
    en: 'Checked in — enjoy the tour! ✅',
    ko: '체크인 완료 — 즐거운 투어 되세요! ✅',
    zh: '已确认 — 祝您旅途愉快！✅',
    ja: 'チェックイン完了 — よい旅を！✅',
    es: 'Confirmado — ¡disfrute del tour! ✅',
    fr: 'Enregistrement confirmé — profitez bien du tour! ✅',
    de: 'Eingecheckt — genießen Sie die Tour! ✅',
    ru: 'Регистрация пройдена — приятной поездки! ✅',
    it: 'Check-in fatto — goditi il tour! ✅',
  },
  already: {
    en: 'You are already checked in. ✅',
    ko: '이미 체크인되어 있어요. ✅',
    zh: '您已完成确认。✅',
    ja: 'すでにチェックイン済みです。✅',
    es: 'Ya está confirmado. ✅',
    fr: 'Votre enregistrement est déjà fait. ✅',
    de: 'Sie sind bereits eingecheckt. ✅',
    ru: 'Вы уже зарегистрированы. ✅',
    it: 'Hai già fatto il check-in. ✅',
  },
  noToken: {
    en: 'We could not recognize this device.',
    ko: '이 기기에서 등록 정보를 찾지 못했어요.',
    zh: '未能在此设备上找到您的登记信息。',
    ja: 'この端末で登録情報が見つかりませんでした。',
    es: 'No pudimos reconocer este dispositivo.',
    fr: 'Impossible de reconnaître cet appareil.',
    de: 'Dieses Gerät konnte nicht erkannt werden.',
    ru: 'Не удалось распознать это устройство.',
    it: 'Non siamo riusciti a riconoscere questo dispositivo.',
  },
  noTokenHint: {
    en: 'Open your invitation link first to register, then scan again — or ask the guide.',
    ko: '먼저 초대 링크를 열어 등록한 뒤 다시 스캔해 주세요 — 또는 가이드에게 문의하세요.',
    zh: '请先打开邀请链接完成登记后再扫描 — 或联系导游。',
    ja: 'まず招待リンクから登録し、もう一度スキャンしてください — またはガイドへ。',
    es: 'Abra primero su enlace de invitación para registrarse y vuelva a escanear, o consulte al guía.',
    fr: 'Ouvrez d’abord votre lien d’invitation pour vous inscrire, puis scannez à nouveau — ou demandez au guide.',
    de: 'Öffnen Sie zuerst Ihren Einladungslink zur Registrierung und scannen Sie dann erneut — oder fragen Sie den Guide.',
    ru: 'Сначала откройте ссылку-приглашение и зарегистрируйтесь, затем отсканируйте снова — или обратитесь к гиду.',
    it: 'Apri prima il link d’invito per registrarti, poi scansiona di nuovo — o chiedi alla guida.',
  },
  wrongRoom: {
    en: 'This QR belongs to a different tour or date.',
    ko: '이 QR은 다른 투어/날짜의 것입니다.',
    zh: '此二维码属于其他行程或日期。',
    ja: 'このQRは別のツアー/日付のものです。',
    es: 'Este QR corresponde a otro tour u otra fecha.',
    fr: 'Ce QR correspond à un autre tour ou à une autre date.',
    de: 'Dieser QR-Code gehört zu einer anderen Tour oder einem anderen Datum.',
    ru: 'Этот QR-код относится к другому туру или другой дате.',
    it: 'Questo QR appartiene a un altro tour o a un’altra data.',
  },
  unregistered: {
    en: 'Your booking was not found on this list.',
    ko: '이 명단에서 예약을 찾지 못했어요.',
    zh: '未在此名单中找到您的预订。',
    ja: 'この名簿にご予約が見つかりませんでした。',
    es: 'Su reserva no aparece en esta lista.',
    fr: 'Votre réservation ne figure pas sur cette liste.',
    de: 'Ihre Buchung wurde auf dieser Liste nicht gefunden.',
    ru: 'Ваша бронь не найдена в этом списке.',
    it: 'La tua prenotazione non risulta in questa lista.',
  },
  unregisteredHint: {
    en: 'The guide has been notified — please show your booking confirmation.',
    ko: '가이드에게 알림을 보냈어요 — 예약 확인서를 보여주세요.',
    zh: '已通知导游 — 请出示您的预订确认。',
    ja: 'ガイドに通知しました — 予約確認をご提示ください。',
    es: 'Se ha avisado al guía; muestre su confirmación de reserva.',
    fr: 'Le guide a été prévenu — merci de présenter votre confirmation de réservation.',
    de: 'Der Guide wurde benachrichtigt — zeigen Sie bitte Ihre Buchungsbestätigung.',
    ru: 'Мы уведомили гида — пожалуйста, покажите подтверждение брони.',
    it: 'La guida è stata avvisata — mostra la conferma della prenotazione.',
  },
  noSeats: {
    en: 'No seat assigned yet — the guide will seat you on board.',
    ko: '아직 좌석이 지정되지 않았어요 — 가이드가 현장에서 지정해 드립니다.',
    zh: '尚未分配座位 — 导游将在车上为您安排。',
    ja: 'まだ座席が未指定です — ガイドが現地でご案内します。',
    es: 'Aún no tiene asiento asignado; el guía se lo asignará a bordo.',
    fr: 'Aucun siège attribué pour l’instant — le guide vous placera à bord.',
    de: 'Noch kein Sitzplatz zugewiesen — der Guide weist Ihnen an Bord einen Platz zu.',
    ru: 'Место пока не назначено — гид укажет вам место при посадке.',
    it: 'Nessun posto assegnato per ora — la guida ti sistemerà a bordo.',
  },
  notOpen: {
    en: 'Check-in opens on the tour day ({date}).',
    ko: '체크인은 투어 당일({date})에 열려요.',
    zh: '登车确认将于行程当天（{date}）开放。',
    ja: 'チェックインはツアー当日（{date}）に開始します。',
    es: 'El registro se abre el día del tour ({date}).',
    fr: 'L’enregistrement ouvre le jour du tour ({date}).',
    de: 'Der Check-in öffnet am Tourtag ({date}).',
    ru: 'Регистрация откроется в день тура ({date}).',
    it: 'Il check-in apre il giorno del tour ({date}).',
  },
  nonceExpired: {
    en: 'This QR view expired — please scan the screen again.',
    ko: 'QR이 갱신되었어요 — 화면을 다시 스캔해 주세요.',
    zh: '二维码已刷新 — 请重新扫描屏幕。',
    ja: 'QRが更新されました — 画面をもう一度スキャンしてください。',
    es: 'El QR se actualizó; vuelva a escanear la pantalla.',
    fr: 'Ce QR a été actualisé — merci de scanner à nouveau l’écran.',
    de: 'Der QR-Code wurde erneuert — bitte scannen Sie den Bildschirm noch einmal.',
    ru: 'QR-код обновился — отсканируйте экран еще раз.',
    it: 'Il QR è stato aggiornato — scansiona di nuovo lo schermo.',
  },
  error: {
    en: 'Something went wrong.',
    ko: '문제가 발생했어요.',
    zh: '出了点问题。',
    ja: 'エラーが発生しました。',
    es: 'Algo salió mal.',
    fr: 'Un problème est survenu.',
    de: 'Etwas ist schiefgelaufen.',
    ru: 'Что-то пошло не так.',
    it: 'Qualcosa è andato storto.',
  },
  retry: {
    en: 'Try again',
    ko: '다시 시도',
    zh: '重试',
    ja: 'もう一度',
    es: 'Reintentar',
    fr: 'Réessayer',
    de: 'Erneut versuchen',
    ru: 'Повторить',
    it: 'Riprova',
  },
};

export function detectCheckinLocale(raw?: string | null): RoomLocale {
  const base = (raw ?? (typeof navigator !== 'undefined' ? navigator.language : 'en'))
    .toLowerCase()
    .split('-')[0];
  return (ROOM_LOCALES as readonly string[]).includes(base) ? (base as RoomLocale) : 'en';
}

export function checkinCopy(
  locale: RoomLocale,
  key: CheckinCopyKey,
  vars: Record<string, string | number> = {},
): string {
  let text = COPY[key][locale] ?? COPY[key].en;
  for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
  return text;
}
