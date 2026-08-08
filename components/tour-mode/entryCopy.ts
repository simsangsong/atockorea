/**
 * Static entry-screen copy for Tour Mode, pre-translated in the 5 room
 * locales (LLM calls: zero — §M-2 ①). T1.8 migrates these into the
 * messages/*.json tourMode.* namespace; keeping them as constants here first
 * keeps the standalone entry route free of the site i18n shell (§O-1 ②).
 */

import { type RoomLocale } from '@/lib/tour-room/snapshot';
import { normalizeEntryLocale } from '@/lib/tour-room/entryLocale';

export interface EntryCopy {
  title: string;
  subtitle: string;
  comingSoon: string;
  myBookings: string;
  noBookings: string;
  loadFailed: string;
  signInHint: string;
  guestTitle: string;
  /** 코드 문(entry-code plan §C-2) — 예전 "예약 ID(UUID)+이메일" 폼을 대체. */
  guestHint: string;
  codeLabel: string;
  codeContinue: string;
  codeOpening: string;
  enterRoom: string;
  linkHint: string;
  loading: string;
  errorGeneric: string;
  errorNotFound: string;
  errorCodeExpired: string;
  errorCodeRevoked: string;
  errorRateLimited: string;
}

export const ENTRY_COPY: Record<RoomLocale, EntryCopy> = {
  en: {
    title: 'Tour Mode',
    subtitle: 'Your live tour room — chat with your guide in your language, follow the route, and never miss a departure.',
    comingSoon: 'Tour Mode is getting ready. If you have a booking, your tour room link will arrive by email before your tour day.',
    myBookings: 'My upcoming tours',
    noBookings: 'No upcoming confirmed tours on this account.',
    loadFailed: "Couldn't load your tours — this is on us, not your booking. Try again in a moment.",
    signInHint: 'Signed-in customers see their tour rooms here.',
    guestTitle: 'Find my tour room',
    guestHint: 'Enter the booking code from our email — or your Klook / GetYourGuide / Viator booking number.',
    codeLabel: 'Booking code',
    codeContinue: 'Find my room',
    codeOpening: 'Opening your tour room…',
    enterRoom: 'Enter tour room',
    linkHint: 'Got a room link from us? Just tap it — it opens the room directly.',
    loading: 'Loading…',
    errorGeneric: 'Could not open the room. Check the details and try again.',
    errorNotFound: 'No booking found for this code.',
    errorCodeExpired: 'This tour day has ended, so its room is closed.',
    errorCodeRevoked: 'This link was replaced — please use the newest message from us.',
    errorRateLimited: 'Too many attempts. Please wait a moment and try again.',
  },
  ko: {
    title: '투어모드',
    subtitle: '실시간 투어룸 — 가이드와 내 언어로 대화하고, 동선을 확인하고, 출발 시간을 놓치지 마세요.',
    comingSoon: '투어모드를 준비 중입니다. 예약이 있으시면 투어 전에 이메일로 투어룸 링크를 보내드립니다.',
    myBookings: '다가오는 내 투어',
    noBookings: '이 계정에 예정된 확정 투어가 없습니다.',
    loadFailed: '투어 목록을 불러오지 못했어요 — 예약 문제가 아니라 저희 쪽 문제예요. 잠시 후 다시 시도해 주세요.',
    signInHint: '로그인한 고객은 여기에서 투어룸을 볼 수 있습니다.',
    guestTitle: '내 투어룸 찾기',
    guestHint: '저희가 보낸 예약 코드(A2C-…)나 Klook · GetYourGuide · Viator 예약번호를 입력하세요.',
    codeLabel: '예약 코드',
    codeContinue: '내 룸 찾기',
    codeOpening: '투어룸을 여는 중…',
    enterRoom: '투어룸 입장',
    linkHint: '저희가 보낸 룸 링크가 있다면 그냥 누르세요 — 바로 열립니다.',
    loading: '불러오는 중…',
    errorGeneric: '룸을 열 수 없습니다. 정보를 확인하고 다시 시도해 주세요.',
    errorNotFound: '이 코드의 예약을 찾을 수 없습니다.',
    errorCodeExpired: '투어일이 지나 룸이 닫혔습니다.',
    errorCodeRevoked: '이 링크는 새 링크로 교체되었어요 — 가장 최근에 받은 메시지를 사용해 주세요.',
    errorRateLimited: '시도가 너무 많았어요. 잠시 후 다시 시도해 주세요.',
  },
  ja: {
    title: 'ツアーモード',
    subtitle: 'リアルタイムのツアールーム — ガイドと自分の言語で会話し、ルートを確認し、出発時刻を逃しません。',
    comingSoon: 'ツアーモードは準備中です。ご予約がある場合、ツアー前にメールでルームリンクをお送りします。',
    myBookings: '今後のツアー',
    noBookings: 'このアカウントに確定済みのツアーはありません。',
    loadFailed: 'ツアーを読み込めませんでした — ご予約ではなく当社側の問題です。少し後に再度お試しください。',
    signInHint: 'ログイン済みのお客様はここでツアールームを確認できます。',
    guestTitle: 'ツアールームを探す',
    guestHint: '当社メールの予約コード（A2C-…）、または Klook・GetYourGuide・Viator の予約番号を入力してください。',
    codeLabel: '予約コード',
    codeContinue: 'ルームを探す',
    codeOpening: 'ツアールームを開いています…',
    enterRoom: 'ルームに入る',
    linkHint: 'ルームリンクが届いていれば、タップするだけで直接開きます。',
    loading: '読み込み中…',
    errorGeneric: 'ルームを開けませんでした。情報を確認して再度お試しください。',
    errorNotFound: 'このコードの予約が見つかりません。',
    errorCodeExpired: 'ツアー日が終了したため、ルームは閉じられました。',
    errorCodeRevoked: 'このリンクは新しいものに置き換えられました。最新のメッセージをご利用ください。',
    errorRateLimited: '試行回数が多すぎます。しばらくしてからもう一度お試しください。',
  },
  es: {
    title: 'Modo Tour',
    subtitle: 'Tu sala de tour en vivo: chatea con tu guía en tu idioma, sigue la ruta y no pierdas ninguna salida.',
    comingSoon: 'El Modo Tour está en preparación. Si tienes una reserva, recibirás el enlace de tu sala por correo antes del tour.',
    myBookings: 'Mis próximos tours',
    noBookings: 'No hay tours confirmados próximos en esta cuenta.',
    loadFailed: 'No pudimos cargar tus tours — es un problema nuestro, no de tu reserva. Inténtalo en un momento.',
    signInHint: 'Los clientes con sesión iniciada ven sus salas aquí.',
    guestTitle: 'Encontrar mi sala de tour',
    guestHint: 'Introduce el código de reserva de nuestro correo — o tu número de reserva de Klook / GetYourGuide / Viator.',
    codeLabel: 'Código de reserva',
    codeContinue: 'Buscar mi sala',
    codeOpening: 'Abriendo tu sala de tour…',
    enterRoom: 'Entrar a la sala',
    linkHint: '¿Tienes un enlace de sala? Tócalo: abre la sala directamente.',
    loading: 'Cargando…',
    errorGeneric: 'No se pudo abrir la sala. Verifica los datos e inténtalo de nuevo.',
    errorNotFound: 'No se encontró ninguna reserva con este código.',
    errorCodeExpired: 'El día del tour ya pasó, así que la sala está cerrada.',
    errorCodeRevoked: 'Este enlace fue reemplazado — usa el mensaje más reciente que te enviamos.',
    errorRateLimited: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
  },
  zh: {
    title: '导览模式',
    subtitle: '实时导览房间 — 用您的语言与导游交流，掌握路线，不错过任何出发时间。',
    comingSoon: '导览模式正在准备中。如果您有预订，出发前会通过电子邮件收到房间链接。',
    myBookings: '我即将出发的行程',
    noBookings: '此账户暂无已确认的行程。',
    loadFailed: '未能加载您的行程 — 这是我们的问题，与您的预订无关。请稍后重试。',
    signInHint: '已登录的顾客可在此查看导览房间。',
    guestTitle: '查找我的导览房间',
    guestHint: '请输入我们邮件中的预订代码（A2C-…），或您的 Klook / GetYourGuide / Viator 预订编号。',
    codeLabel: '预订代码',
    codeContinue: '查找我的房间',
    codeOpening: '正在打开导览房间…',
    enterRoom: '进入房间',
    linkHint: '收到我们发送的房间链接？直接点击即可打开。',
    loading: '加载中…',
    errorGeneric: '无法打开房间。请核对信息后重试。',
    errorNotFound: '未找到该代码对应的预订。',
    errorCodeExpired: '行程日期已结束，房间已关闭。',
    errorCodeRevoked: '此链接已被新链接替换 — 请使用我们最新发送的消息。',
    errorRateLimited: '尝试次数过多，请稍后再试。',
  },
  'zh-TW': {
    title: '導覽模式',
    subtitle: '即時旅遊房間 — 用您的語言與導遊交流，掌握路線，不錯過任何出發時間。',
    comingSoon: '導覽模式正在準備中。如果您有預訂，出發前會透過電子郵件收到房間連結。',
    myBookings: '我即將出發的行程',
    noBookings: '此帳戶暫無已確認的行程。',
    loadFailed: '未能載入您的行程 — 這是我們的問題，與您的預訂無關。請稍後再試。',
    signInHint: '已登入的顧客可在此查看旅遊房間。',
    guestTitle: '尋找我的旅遊房間',
    guestHint: '請輸入我們郵件中的預訂代碼（A2C-…），或您的 Klook / GetYourGuide / Viator 預訂編號。',
    codeLabel: '預訂代碼',
    codeContinue: '尋找我的房間',
    codeOpening: '正在開啟旅遊房間…',
    enterRoom: '進入房間',
    linkHint: '收到我們傳送的房間連結？點一下即可開啟。',
    loading: '載入中…',
    errorGeneric: '無法開啟房間。請核對資訊後再試。',
    errorNotFound: '未找到該代碼對應的預訂。',
    errorCodeExpired: '行程日期已結束，房間已關閉。',
    errorCodeRevoked: '此連結已被新連結取代 — 請使用我們最新傳送的訊息。',
    errorRateLimited: '嘗試次數過多，請稍後再試。',
  },
  fr: {
    title: 'Mode Tour',
    subtitle: 'Votre espace tour en direct — échangez avec votre guide dans votre langue, suivez l’itinéraire et ne manquez aucun départ.',
    comingSoon: 'Le Mode Tour se prépare. Si vous avez une réservation, le lien de votre espace tour arrivera par e-mail avant le jour du tour.',
    myBookings: 'Mes tours à venir',
    noBookings: 'Aucun tour confirmé à venir sur ce compte.',
    loadFailed: 'Impossible de charger vos tours — c’est de notre côté, pas votre réservation. Réessayez dans un instant.',
    signInHint: 'Les clients connectés retrouvent leur espace tour ici.',
    guestTitle: 'Trouver mon espace tour',
    guestHint: 'Saisissez le code de réservation de notre e-mail — ou votre numéro de réservation Klook / GetYourGuide / Viator.',
    codeLabel: 'Code de réservation',
    codeContinue: 'Trouver mon espace',
    codeOpening: 'Ouverture de votre espace tour…',
    enterRoom: 'Entrer dans l’espace tour',
    linkHint: 'Vous avez reçu un lien de notre part? Touchez-le — il ouvre directement votre espace tour.',
    loading: 'Chargement…',
    errorGeneric: 'Impossible d’ouvrir l’espace tour. Vérifiez les informations et réessayez.',
    errorNotFound: 'Aucune réservation trouvée avec ce code.',
    errorCodeExpired: 'Le jour du tour est passé, l’espace est donc fermé.',
    errorCodeRevoked: 'Ce lien a été remplacé — utilisez le message le plus récent que nous vous avons envoyé.',
    errorRateLimited: 'Trop de tentatives. Patientez un instant puis réessayez.',
  },
  de: {
    title: 'Tour-Modus',
    subtitle: 'Ihr Live-Tour-Raum — chatten Sie mit Ihrem Guide in Ihrer Sprache, verfolgen Sie die Route und verpassen Sie keine Abfahrt.',
    comingSoon: 'Der Tour-Modus wird vorbereitet. Wenn Sie eine Buchung haben, erhalten Sie den Raum-Link vor dem Tourtag per E-Mail.',
    myBookings: 'Meine kommenden Touren',
    noBookings: 'Keine bestätigten Touren für dieses Konto.',
    loadFailed: 'Ihre Touren konnten nicht geladen werden — das liegt an uns, nicht an Ihrer Buchung. Versuchen Sie es gleich noch einmal.',
    signInHint: 'Angemeldete Kunden sehen ihre Tour-Räume hier.',
    guestTitle: 'Meinen Tour-Raum finden',
    guestHint: 'Geben Sie den Buchungscode aus unserer E-Mail ein — oder Ihre Klook- / GetYourGuide- / Viator-Buchungsnummer.',
    codeLabel: 'Buchungscode',
    codeContinue: 'Meinen Raum finden',
    codeOpening: 'Ihr Tour-Raum wird geöffnet…',
    enterRoom: 'Tour-Raum betreten',
    linkHint: 'Sie haben einen Raum-Link von uns? Einfach antippen — er öffnet den Raum direkt.',
    loading: 'Wird geladen…',
    errorGeneric: 'Der Raum konnte nicht geöffnet werden. Prüfen Sie die Angaben und versuchen Sie es erneut.',
    errorNotFound: 'Keine Buchung mit diesem Code gefunden.',
    errorCodeExpired: 'Der Tourtag ist vorbei, daher ist der Raum geschlossen.',
    errorCodeRevoked: 'Dieser Link wurde ersetzt — bitte nutzen Sie unsere neueste Nachricht.',
    errorRateLimited: 'Zu viele Versuche. Bitte warten Sie kurz und versuchen Sie es erneut.',
  },
  ru: {
    title: 'Режим тура',
    subtitle: 'Ваша комната тура в реальном времени — общайтесь с гидом на своем языке, следите за маршрутом и не пропускайте отправление.',
    comingSoon: 'Режим тура готовится. Если у вас есть бронирование, ссылка на комнату придет на почту до дня тура.',
    myBookings: 'Мои предстоящие туры',
    noBookings: 'На этом аккаунте нет предстоящих подтвержденных туров.',
    loadFailed: 'Не удалось загрузить туры — проблема на нашей стороне, не с вашим бронированием. Попробуйте чуть позже.',
    signInHint: 'Клиенты, вошедшие в аккаунт, видят свои комнаты здесь.',
    guestTitle: 'Найти мою комнату тура',
    guestHint: 'Введите код бронирования из нашего письма — или номер бронирования Klook / GetYourGuide / Viator.',
    codeLabel: 'Код бронирования',
    codeContinue: 'Найти мою комнату',
    codeOpening: 'Открываем вашу комнату тура…',
    enterRoom: 'Войти в комнату',
    linkHint: 'Получили от нас ссылку на комнату? Просто нажмите — она откроется сразу.',
    loading: 'Загрузка…',
    errorGeneric: 'Не удалось открыть комнату. Проверьте данные и попробуйте снова.',
    errorNotFound: 'Бронирование с таким кодом не найдено.',
    errorCodeExpired: 'День тура прошел, поэтому комната закрыта.',
    errorCodeRevoked: 'Эта ссылка была заменена — используйте самое последнее сообщение от нас.',
    errorRateLimited: 'Слишком много попыток. Подождите немного и попробуйте снова.',
  },
  it: {
    title: 'Modalità Tour',
    subtitle: 'La tua stanza del tour dal vivo: chatta con la guida nella tua lingua, segui il percorso e non perdere nessuna partenza.',
    comingSoon: 'La Modalità Tour è in preparazione. Se hai una prenotazione, il link della stanza arriverà via e-mail prima del tour.',
    myBookings: 'I miei prossimi tour',
    noBookings: 'Nessun tour confermato in arrivo su questo account.',
    loadFailed: 'Non siamo riusciti a caricare i tuoi tour — è un problema nostro, non della prenotazione. Riprova tra poco.',
    signInHint: 'I clienti che hanno effettuato l’accesso vedono qui le loro stanze del tour.',
    guestTitle: 'Trova la mia stanza del tour',
    guestHint: 'Inserisci il codice di prenotazione della nostra e-mail — o il numero di prenotazione Klook / GetYourGuide / Viator.',
    codeLabel: 'Codice di prenotazione',
    codeContinue: 'Trova la mia stanza',
    codeOpening: 'Apertura della tua stanza del tour…',
    enterRoom: 'Entra nella stanza del tour',
    linkHint: 'Hai ricevuto un link della stanza? Toccalo: si apre direttamente.',
    loading: 'Caricamento…',
    errorGeneric: 'Impossibile aprire la stanza. Controlla i dati e riprova.',
    errorNotFound: 'Nessuna prenotazione trovata con questo codice.',
    errorCodeExpired: 'Il giorno del tour è passato, quindi la stanza è chiusa.',
    errorCodeRevoked: 'Questo link è stato sostituito — usa il messaggio più recente che ti abbiamo inviato.',
    errorRateLimited: 'Troppi tentativi. Attendi un momento e riprova.',
  },
};

/** Best-effort UI locale for the standalone tour-mode pages (client only). */
/**
 * Client-side locale detection.
 *
 * ⚠ N6: calling this during RENDER re-creates the hydration mismatch the server
 * guard below was meant to fix — the server says 'en', the browser's first pass
 * says the device locale, and React regenerates the tree. Measured on
 * `/tour-mode` 2026-07-28: every non-English device, every load.
 *
 * Use `useEntryLocale(initialLocale)` instead, seeded from
 * `resolveEntryLocale()` on the server. Calling this inside an EFFECT (as
 * InstallBanner and WebviewEscapeBanner do) is fine — effects run after
 * hydration, so there is nothing to mismatch.
 */
export function detectEntryLocale(): RoomLocale {
  // SSR determinism: Node ≥21 exposes a global `navigator` whose language is
  // the SERVER's locale — letting it leak into server render hydration-
  // mismatches every guest whose device locale differs (QA: full-tree
  // regeneration on iPhone/Safari). Server always says 'en'.
  if (typeof window === 'undefined') return 'en';
  if (typeof document !== 'undefined') {
    const cookie = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/)?.[1];
    const fromCookie = normalize(cookie);
    if (fromCookie) return fromCookie;
  }
  if (typeof navigator !== 'undefined') {
    const fromNavigator = normalize(navigator.language);
    if (fromNavigator) return fromNavigator;
  }
  return 'en';
}

/**
 * N6 — this used to be a local copy of the normalisation rules. The server now
 * has to reach the same verdict from `Accept-Language`, and two copies of a
 * locale rule in this repo have never stayed in agreement (§8 lesson 3), so
 * there is one implementation and both sides import it.
 */
const normalize = normalizeEntryLocale;
