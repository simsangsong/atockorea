/**
 * 조인투어 게스트 claim + 좌석선택 5로케일 문구 — AtoC 통합 플랜 §5.2/§5.3.
 * checkinCopy.ts와 동일 캡슐 규약 (사전 번역 상수, LLM 0, ROOM_LOCALES 기준).
 */

import { ROOM_LOCALES, normalizeRoomLocale, type RoomLocale } from '@/lib/tour-room/snapshot';

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
    'zh-TW': '選擇您的姓名',
    ja: 'お名前を選んでください',
    es: 'Seleccione su nombre',
    fr: 'Trouvez votre nom',
    de: 'Finden Sie Ihren Namen',
    ru: 'Найдите свое имя',
    it: 'Trova il tuo nome',
  },
  rosterHint: {
    en: 'Tap your booking to check in for the tour.',
    ko: '명단에서 본인 예약을 탭하세요.',
    zh: '点击您的预订以加入本次行程。',
    'zh-TW': '點一下您的預訂即可加入本次行程。',
    ja: 'ご自身の予約をタップしてください。',
    es: 'Toque su reserva para unirse al tour.',
    fr: 'Touchez votre réservation pour rejoindre le tour.',
    de: 'Tippen Sie auf Ihre Buchung, um sich für die Tour anzumelden.',
    ru: 'Нажмите на свою бронь, чтобы зарегистрироваться на тур.',
    it: 'Tocca la tua prenotazione per unirti al tour.',
  },
  pax: { en: '{n} pax', ko: '{n}명', zh: '{n}人', 'zh-TW': '{n}人', ja: '{n}名', es: '{n} pers.', fr: '{n} pers.', de: '{n} Pers.', ru: '{n} чел.', it: '{n} pers.' },
  claimed: { en: 'registered', ko: '등록됨', zh: '已登记', 'zh-TW': '已登記', ja: '登録済み', es: 'registrado', fr: 'enregistré', de: 'registriert', ru: 'зарегистрировано', it: 'registrato' },
  pickName: { en: 'This is me', ko: '본인입니다', zh: '这是我', 'zh-TW': '這是我', ja: '本人です', es: 'Soy yo', fr: 'C’est moi', de: 'Das bin ich', ru: 'Это я', it: 'Sono io' },
  verifyTitle: {
    en: 'Confirm it is you, {name}',
    ko: '{name}님이 맞나요?',
    zh: '确认是您本人，{name}',
    'zh-TW': '確認是您本人，{name}',
    ja: '{name}様で間違いありませんか？',
    es: '¿Es usted, {name}?',
    fr: 'Confirmez que c’est bien vous, {name}',
    de: 'Bestätigen Sie, dass Sie es sind, {name}',
    ru: 'Подтвердите, что это вы, {name}',
    it: 'Conferma che sei tu, {name}',
  },
  verifyHint: {
    en: 'Answer one to confirm — this prevents mis-selection.',
    ko: '오선택 방지를 위해 하나만 확인해 주세요.',
    zh: '请回答其一以确认，防止误选。',
    'zh-TW': '請回答其中一題以確認，避免誤選。',
    ja: '誤選択防止のため、いずれかをご確認ください。',
    es: 'Responda uno para confirmar y evitar errores.',
    fr: 'Répondez à une question pour confirmer — cela évite les erreurs de sélection.',
    de: 'Beantworten Sie eine Frage zur Bestätigung — das verhindert Verwechslungen.',
    ru: 'Ответьте на один вопрос для подтверждения — это защита от ошибочного выбора.',
    it: 'Rispondi a una domanda per confermare — serve a evitare selezioni sbagliate.',
  },
  emailTailLabel: {
    en: 'Last part of your booking email',
    ko: '예약 이메일 뒷부분',
    zh: '预订邮箱的后段',
    'zh-TW': '預訂電子郵件的後半段',
    ja: '予約メールの末尾',
    es: 'Parte final de su correo de reserva',
    fr: 'Fin de l’adresse e-mail de réservation',
    de: 'Letzter Teil Ihrer Buchungs-E-Mail',
    ru: 'Последняя часть e-mail из брони',
    it: 'Parte finale dell’e-mail di prenotazione',
  },
  partySizeLabel: {
    en: 'Number of people in your booking',
    ko: '예약 인원 수',
    zh: '预订人数',
    'zh-TW': '預訂人數',
    ja: 'ご予約の人数',
    es: 'Número de personas de su reserva',
    fr: 'Nombre de personnes de votre réservation',
    de: 'Personenzahl Ihrer Buchung',
    ru: 'Количество человек в брони',
    it: 'Numero di persone della prenotazione',
  },
  confirm: { en: 'Confirm', ko: '확인', zh: '确认', 'zh-TW': '確認', ja: '確認', es: 'Confirmar', fr: 'Confirmer', de: 'Bestätigen', ru: 'Подтвердить', it: 'Conferma' },
  back: { en: 'Back', ko: '뒤로', zh: '返回', 'zh-TW': '返回', ja: '戻る', es: 'Atrás', fr: 'Retour', de: 'Zurück', ru: 'Назад', it: 'Indietro' },
  verifyFailed: {
    en: 'That did not match — please try again.',
    ko: '일치하지 않아요 — 다시 시도해 주세요.',
    zh: '不匹配，请重试。',
    'zh-TW': '不相符，請再試一次。',
    ja: '一致しません — もう一度お試しください。',
    es: 'No coincide, inténtelo de nuevo.',
    fr: 'Ça ne correspond pas — réessayez.',
    de: 'Das stimmt nicht überein — bitte erneut versuchen.',
    ru: 'Не совпало — попробуйте еще раз.',
    it: 'Non corrisponde — riprova.',
  },
  alreadyClaimed: {
    en: 'This booking is already registered.',
    ko: '이미 등록된 예약입니다.',
    zh: '此预订已登记。',
    'zh-TW': '此預訂已登記。',
    ja: 'この予約はすでに登録済みです。',
    es: 'Esta reserva ya está registrada.',
    fr: 'Cette réservation est déjà enregistrée.',
    de: 'Diese Buchung ist bereits registriert.',
    ru: 'Эта бронь уже зарегистрирована.',
    it: 'Questa prenotazione è già registrata.',
  },
  alreadyClaimedHint: {
    en: 'If this is you, request re-registration — the guide will approve it.',
    ko: '본인이라면 재등록을 요청하세요 — 가이드가 승인합니다.',
    zh: '若确为本人，请申请重新登记，导游将予以批准。',
    'zh-TW': '若確為本人，請申請重新登記，導遊會協助核准。',
    ja: 'ご本人の場合は再登録をリクエストしてください — ガイドが承認します。',
    es: 'Si es usted, solicite volver a registrarse; el guía lo aprobará.',
    fr: 'Si c’est vous, demandez un nouvel enregistrement — le guide validera.',
    de: 'Wenn Sie das sind, fordern Sie die Neu-Registrierung an — der Guide bestätigt sie.',
    ru: 'Если это вы, запросите повторную регистрацию — гид ее одобрит.',
    it: 'Se sei tu, richiedi una nuova registrazione — la guida l’approverà.',
  },
  reclaim: {
    en: 'This is me — request re-registration',
    ko: '내가 맞습니다 — 재등록 요청',
    zh: '这是我 — 申请重新登记',
    'zh-TW': '這是我 — 申請重新登記',
    ja: '本人です — 再登録をリクエスト',
    es: 'Soy yo, solicitar nuevo registro',
    fr: 'C’est moi — demander un nouvel enregistrement',
    de: 'Das bin ich — Neu-Registrierung anfordern',
    ru: 'Это я — запросить повторную регистрацию',
    it: 'Sono io — richiedi una nuova registrazione',
  },
  seatTitle: {
    en: 'Choose your seats',
    ko: '좌석을 선택하세요',
    zh: '选择您的座位',
    'zh-TW': '選擇您的座位',
    ja: '座席を選んでください',
    es: 'Elija sus asientos',
    fr: 'Choisissez vos sièges',
    de: 'Wählen Sie Ihre Sitzplätze',
    ru: 'Выберите места',
    it: 'Scegli i tuoi posti',
  },
  seatHint: {
    en: 'Select {n} seat(s) for your party.',
    ko: '일행 {n}석을 선택하세요.',
    zh: '为您的同行选择 {n} 个座位。',
    'zh-TW': '請為您的同行選擇 {n} 個座位。',
    ja: '同行者{n}席を選んでください。',
    es: 'Seleccione {n} asiento(s) para su grupo.',
    fr: 'Sélectionnez {n} siège(s) pour votre groupe.',
    de: 'Wählen Sie {n} Sitzplätze für Ihre Gruppe.',
    ru: 'Выберите места для вашей группы ({n}).',
    it: 'Posti da selezionare per il tuo gruppo: {n}.',
  },
  seatSoon: {
    en: 'Seats open once your vehicle is assigned.',
    ko: '차량 배정이 완료되면 좌석이 열려요.',
    zh: '车辆分配后即可选座。',
    'zh-TW': '車輛安排好後即可選位。',
    ja: '車両が割り当てられると座席が開きます。',
    es: 'Los asientos se abren cuando se asigne su vehículo.',
    fr: 'Les sièges s’ouvrent une fois votre véhicule attribué.',
    de: 'Die Sitzplatzwahl öffnet, sobald Ihr Fahrzeug zugeteilt ist.',
    ru: 'Выбор мест откроется, когда будет назначен транспорт.',
    it: 'La scelta dei posti si apre una volta assegnato il veicolo.',
  },
  seatTaken: {
    en: 'That seat was just taken — please pick another.',
    ko: '방금 다른 분이 선택했어요 — 다른 좌석을 골라주세요.',
    zh: '该座位刚被选走，请另选一个。',
    'zh-TW': '這個座位剛被選走了，請另選一個。',
    ja: 'その席は今埋まりました — 別の席をお選びください。',
    es: 'Ese asiento acaba de ocuparse; elija otro.',
    fr: 'Ce siège vient d’être pris — choisissez-en un autre.',
    de: 'Dieser Platz wurde gerade belegt — bitte wählen Sie einen anderen.',
    ru: 'Это место только что заняли — выберите другое.',
    it: 'Quel posto è appena stato preso — scegline un altro.',
  },
  seatLocked: {
    en: 'Seats are locked for boarding today.',
    ko: '오늘은 탑승을 위해 좌석이 잠겼어요.',
    zh: '今日座位已锁定以便登车。',
    'zh-TW': '今日座位已鎖定，以利上車報到。',
    ja: '本日は乗車のため座席がロックされています。',
    es: 'Los asientos están bloqueados para el embarque de hoy.',
    fr: 'Les sièges sont verrouillés pour l’embarquement d’aujourd’hui.',
    de: 'Für den heutigen Einstieg sind die Sitzplätze fixiert.',
    ru: 'Сегодня места зафиксированы для посадки.',
    it: 'Oggi i posti sono bloccati per la salita a bordo.',
  },
  selectedCount: {
    en: 'Selected {sel} of {n}',
    ko: '{n}석 중 {sel}석 선택',
    zh: '已选 {sel}/{n}',
    'zh-TW': '已選 {sel}/{n}',
    ja: '{n}席中 {sel}席選択',
    es: 'Seleccionados {sel} de {n}',
    fr: '{sel} sur {n} sélectionnés',
    de: '{sel} von {n} ausgewählt',
    ru: 'Выбрано {sel} из {n}',
    it: 'Selezionati {sel} su {n}',
  },
  confirmSeats: {
    en: 'Confirm seats',
    ko: '좌석 확정',
    zh: '确认座位',
    'zh-TW': '確認座位',
    ja: '座席を確定',
    es: 'Confirmar asientos',
    fr: 'Confirmer les sièges',
    de: 'Sitzplätze bestätigen',
    ru: 'Подтвердить места',
    it: 'Conferma i posti',
  },
  changeSeats: {
    en: 'Change seats',
    ko: '좌석 변경',
    zh: '更改座位',
    'zh-TW': '更改座位',
    ja: '座席を変更',
    es: 'Cambiar asientos',
    fr: 'Changer de sièges',
    de: 'Sitzplätze ändern',
    ru: 'Изменить места',
    it: 'Cambia posti',
  },
  done: {
    en: 'All set — see you on the tour! ✅',
    ko: '완료 — 투어에서 만나요! ✅',
    zh: '已完成 — 行程见！✅',
    'zh-TW': '完成了 — 行程見！✅',
    ja: '完了 — ツアーでお会いしましょう！✅',
    es: 'Listo — ¡nos vemos en el tour! ✅',
    fr: 'Tout est prêt — à bientôt pour le tour! ✅',
    de: 'Alles bereit — bis bald auf der Tour! ✅',
    ru: 'Все готово — до встречи на туре! ✅',
    it: 'Tutto pronto — ci vediamo al tour! ✅',
  },
  doneHint: {
    en: 'On the tour day, scan the guide QR to check in.',
    ko: '투어 당일 가이드 QR을 스캔해 체크인하세요.',
    zh: '行程当天扫描导游二维码即可登车确认。',
    'zh-TW': '行程當天掃描導遊的 QR Code 即可完成上車報到。',
    ja: 'ツアー当日はガイドのQRをスキャンしてチェックインしてください。',
    es: 'El día del tour, escanee el QR del guía para registrarse.',
    fr: 'Le jour du tour, scannez le QR du guide pour vous enregistrer.',
    de: 'Scannen Sie am Tourtag den QR-Code des Guides zum Einchecken.',
    ru: 'В день тура отсканируйте QR-код гида, чтобы пройти регистрацию.',
    it: 'Il giorno del tour scansiona il QR della guida per fare il check-in.',
  },
  yourSeats: { en: 'Your seats', ko: '내 좌석', zh: '您的座位', 'zh-TW': '您的座位', ja: 'あなたの座席', es: 'Sus asientos', fr: 'Vos sièges', de: 'Ihre Sitzplätze', ru: 'Ваши места', it: 'I tuoi posti' },
  loading: { en: 'Loading…', ko: '불러오는 중…', zh: '加载中…', 'zh-TW': '載入中…', ja: '読み込み中…', es: 'Cargando…', fr: 'Chargement…', de: 'Wird geladen…', ru: 'Загрузка…', it: 'Caricamento…' },
  error: {
    en: 'Something went wrong.',
    ko: '문제가 발생했어요.',
    zh: '出了点问题。',
    'zh-TW': '出了點狀況。',
    ja: 'エラーが発生しました。',
    es: 'Algo salió mal.',
    fr: 'Un problème est survenu.',
    de: 'Etwas ist schiefgelaufen.',
    ru: 'Что-то пошло не так.',
    it: 'Qualcosa è andato storto.',
  },
  retry: { en: 'Try again', ko: '다시 시도', zh: '重试', 'zh-TW': '重試', ja: 'もう一度', es: 'Reintentar', fr: 'Réessayer', de: 'Erneut versuchen', ru: 'Повторить', it: 'Riprova' },
};

export function detectJoinLocale(raw?: string | null): RoomLocale {
  // Delegates so zh-TW survives: a bare split('-')[0] folds it to 'zh'.
  return normalizeRoomLocale(raw ?? (typeof navigator !== 'undefined' ? navigator.language : 'en'), 'en');
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
