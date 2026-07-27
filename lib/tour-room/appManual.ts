/**
 * A5 — in-app usage manual (docs/smart-guide-ops-detail-audit-2026-07-21.md).
 *
 * The guest-facing "how this app works" — shown ONCE on first room entry
 * (auto sheet) and always reachable from Settings. Two shapes: join (bus /
 * small-group with a field staff) and private (charter driver). All copy is
 * a pre-translated 5-locale constant (zero-LLM).
 *
 * The role-separation section is deliberate wording (2026-07-21 legal-risk
 * note): on join tours the on-site staff handles SAFETY and OPERATIONS; the
 * sightseeing commentary comes from the Smart Guide in this app.
 */

import type { RoomLocale } from '@/lib/tour-room/snapshot';

export type ManualKind = 'join' | 'private';

export interface ManualSection {
  key: string;
  emoji: string;
  /** Which manual shapes include this section. */
  kinds: ManualKind[];
  title: Record<RoomLocale, string>;
  body: Record<RoomLocale, string>;
}

export const MANUAL_TITLE: Record<RoomLocale, string> = {
  en: 'How this app works',
  ko: '앱 사용 안내',
  ja: 'アプリの使い方',
  es: 'Cómo funciona esta app',
  zh: '应用使用指南',
  'zh-TW': 'App 使用指南',
  fr: 'Comment fonctionne cette app',
  de: 'So funktioniert die App',
  ru: 'Как работает приложение',
  it: 'Come funziona l’app',
};

export const MANUAL_CTA: Record<RoomLocale, string> = {
  en: 'Got it',
  ko: '확인했어요',
  ja: 'わかりました',
  es: 'Entendido',
  zh: '知道了',
  'zh-TW': '我知道了',
  fr: 'Compris',
  de: 'Verstanden',
  ru: 'Понятно',
  it: 'Ho capito',
};

export const MANUAL_SECTIONS: ManualSection[] = [
  {
    key: 'chat',
    emoji: '💬',
    kinds: ['join', 'private'],
    title: {
      en: 'Chat in your language',
      ko: '내 언어로 채팅',
      ja: '自分の言語でチャット',
      es: 'Chatea en tu idioma',
      zh: '用您的语言聊天',
      'zh-TW': '用您的語言聊天',
      fr: 'Discutez dans votre langue',
      de: 'Chatten in Ihrer Sprache',
      ru: 'Чат на вашем языке',
      it: 'Chatta nella tua lingua',
    },
    body: {
      en: 'Everything here translates automatically — text, photos, and voice messages all reach the team in Korean, and replies come back in your language.',
      ko: '모든 메시지는 자동으로 번역돼요 — 텍스트·사진·음성이 한국어로 전달되고, 답장은 내 언어로 돌아옵니다.',
      ja: 'すべてのメッセージは自動翻訳されます — テキスト・写真・音声が韓国語で伝わり、返信はあなたの言語で届きます。',
      es: 'Todo se traduce automáticamente: texto, fotos y mensajes de voz llegan al equipo en coreano y las respuestas vuelven en tu idioma.',
      zh: '所有消息都会自动翻译 — 文字、照片和语音以韩语传达给团队，回复则以您的语言送达。',
      'zh-TW': '這裡的所有訊息都會自動翻譯 — 文字、照片和語音都會以韓語傳達給團隊，回覆則會以您的語言送達。',
      fr: 'Tout est traduit automatiquement — textes, photos et messages vocaux parviennent à l’équipe en coréen, et les réponses vous reviennent dans votre langue.',
      de: 'Alles hier wird automatisch übersetzt — Texte, Fotos und Sprachnachrichten erreichen das Team auf Koreanisch, und die Antworten kommen in Ihrer Sprache zurück.',
      ru: 'Все сообщения переводятся автоматически — текст, фото и голосовые доходят до команды на корейском, а ответы приходят на вашем языке.',
      it: 'Tutto qui si traduce automaticamente — testi, foto e messaggi vocali arrivano al team in coreano, e le risposte tornano nella tua lingua.',
    },
  },
  {
    key: 'arrival',
    emoji: '📍',
    kinds: ['join', 'private'],
    title: {
      en: 'Arrival cards at every stop',
      ko: '장소마다 도착 카드',
      ja: '各スポットで到着カード',
      es: 'Tarjetas de llegada en cada parada',
      zh: '每站都有到达卡片',
      'zh-TW': '每一站都有抵達卡片',
      fr: 'Cartes d’arrivée à chaque étape',
      de: 'Ankunftskarten an jedem Stopp',
      ru: 'Карточки прибытия на каждой остановке',
      it: 'Card di arrivo a ogni tappa',
    },
    body: {
      en: "When you arrive somewhere, a card lands here with the meeting time, a restroom map, the parking pin, and a mini guide to the spot — check it before you wander off.",
      ko: '어딘가에 도착하면 집합 시간·화장실 지도·주차 위치·미니 가이드가 담긴 카드가 도착해요 — 둘러보기 전에 꼭 확인하세요.',
      ja: '到着すると、集合時間・トイレ地図・駐車位置・ミニガイドが入ったカードが届きます — 散策の前にご確認ください。',
      es: 'Al llegar a un lugar, aquí aparece una tarjeta con la hora de reunión, el mapa de baños, el pin del aparcamiento y una mini guía: revísala antes de explorar.',
      zh: '到达景点后，这里会收到一张卡片，包含集合时间、洗手间地图、停车位置和小导览 — 游览前请先查看。',
      'zh-TW': '抵達景點後，這裡會收到一張卡片，內含集合時間、洗手間地圖、停車位置和迷你導覽 — 開始遊覽前請先看一下。',
      fr: 'À chaque arrivée, une carte apparaît ici avec l’heure de rendez-vous, la carte des toilettes, l’emplacement du parking et un mini-guide du lieu — consultez-la avant de partir explorer.',
      de: 'Sobald Sie irgendwo ankommen, erscheint hier eine Karte mit Treffzeit, Toilettenplan, Park-Pin und einem Mini-Guide zum Ort — am besten kurz ansehen, bevor Sie losziehen.',
      ru: 'Когда вы куда-то прибываете, здесь появляется карточка со временем сбора, картой туалетов, отметкой парковки и мини-гидом по месту — загляните в нее, прежде чем идти гулять.',
      it: 'Quando arrivi in un posto, qui compare una card con l’orario di ritrovo, la mappa dei bagni, il pin del parcheggio e una mini guida del luogo — dagli un’occhiata prima di andare in giro.',
    },
  },
  {
    key: 'meeting',
    emoji: '⏰',
    kinds: ['join', 'private'],
    title: {
      en: 'Meeting-time countdown',
      ko: '집합 시간 카운트다운',
      ja: '集合時間カウントダウン',
      es: 'Cuenta regresiva de reunión',
      zh: '集合时间倒计时',
      'zh-TW': '集合時間倒數',
      fr: 'Compte à rebours du rendez-vous',
      de: 'Countdown zur Treffzeit',
      ru: 'Отсчет до времени сбора',
      it: 'Conto alla rovescia per il ritrovo',
    },
    body: {
      en: 'Your phone nudges you 10 and 5 minutes before the meeting time, and a live countdown appears at the top for the last 3 minutes. Please keep notifications on and come back a little early.',
      ko: '집합 10분·5분 전에 알림이 오고, 3분 전부터 화면 상단에 카운트다운이 떠요. 알림을 켜두고 조금 일찍 돌아와 주세요.',
      ja: '集合の10分前と5分前に通知が届き、3分前からは画面上部にカウントダウンが表示されます。通知をオンにして少し早めにお戻りください。',
      es: 'El teléfono te avisa 10 y 5 minutos antes de la hora de reunión, y en los últimos 3 minutos aparece una cuenta regresiva arriba. Mantén las notificaciones activadas y vuelve con antelación.',
      zh: '集合前 10 分钟和 5 分钟手机会提醒您，最后 3 分钟屏幕顶部会显示倒计时。请开启通知并提前返回。',
      'zh-TW': '集合前 10 分鐘和 5 分鐘手機會提醒您，最後 3 分鐘螢幕頂端會顯示倒數計時。請開啟通知並提早回來。',
      fr: 'Votre téléphone vous prévient 10 et 5 minutes avant l’heure de rendez-vous, et un compte à rebours s’affiche en haut pendant les 3 dernières minutes. Gardez les notifications activées et revenez un peu en avance.',
      de: 'Ihr Handy erinnert Sie 10 und 5 Minuten vor der Treffzeit, und in den letzten 3 Minuten läuft oben ein Countdown. Bitte lassen Sie Benachrichtigungen an und kommen Sie etwas früher zurück.',
      ru: 'Телефон напомнит вам за 10 и за 5 минут до времени сбора, а в последние 3 минуты вверху экрана появится отсчет. Держите уведомления включенными и возвращайтесь чуть раньше.',
      it: 'Il telefono ti avvisa 10 e 5 minuti prima dell’orario di ritrovo, e negli ultimi 3 minuti in alto compare un conto alla rovescia. Tieni le notifiche attive e torna con un po’ di anticipo.',
    },
  },
  {
    key: 'signals',
    emoji: '🚕',
    kinds: ['join', 'private'],
    title: {
      en: 'One-tap requests',
      ko: '원탭 요청 버튼',
      ja: 'ワンタップリクエスト',
      es: 'Peticiones de un toque',
      zh: '一键请求',
      'zh-TW': '一鍵請求',
      fr: 'Demandes en un geste',
      de: 'Anfragen per Fingertipp',
      ru: 'Запросы в одно касание',
      it: 'Richieste con un tocco',
    },
    body: {
      en: "Above the chat box: I'm running late · need a stop · I'm lost · pick me up here (shares your location once) · change my drop-off. One tap reaches the team instantly.",
      ko: '채팅창 위 버튼들: 늦어요 · 잠깐 서고 싶어요 · 길을 잃었어요 · 여기로 픽업(위치 1회 공유) · 드랍 변경. 한 번의 탭으로 팀에 바로 전달돼요.',
      ja: 'チャット欄の上のボタン：遅れています・少し止まりたい・道に迷いました・ここに迎えに来て（現在地を1回共有）・降車地点を変更。ワンタップでチームに届きます。',
      es: 'Sobre el chat: voy tarde · necesito parar · estoy perdido · recógeme aquí (comparte tu ubicación una vez) · cambiar bajada. Un toque y el equipo lo recibe al instante.',
      zh: '聊天框上方的按钮：我会迟到 · 想停一下 · 我迷路了 · 来这里接我（一次性共享位置）· 更改下车点。一键即可传达给团队。',
      'zh-TW': '聊天框上方的按鈕：我會遲到 · 想停一下 · 我迷路了 · 來這裡接我（位置只分享一次）· 更改下車地點。輕觸一下就能馬上傳達給團隊。',
      fr: 'Au-dessus de la zone de saisie: je suis en retard · besoin d’un arrêt · je suis perdu · venez me chercher ici (partage votre position une fois) · modifier ma dépose. Un seul geste, et l’équipe est prévenue aussitôt.',
      de: 'Über dem Chatfeld: Ich verspäte mich · Kurze Pause nötig · Ich habe mich verlaufen · Holen Sie mich hier ab (teilt Ihren Standort einmalig) · Ausstieg ändern. Ein Fingertipp genügt, und das Team weiß sofort Bescheid.',
      ru: 'Над полем чата: я опаздываю · нужна остановка · я потерялся · заберите меня здесь (позиция отправится один раз) · изменить место высадки. Одно касание — и команда сразу в курсе.',
      it: 'Sopra la casella di chat: sono in ritardo · serve una sosta · mi sono perso · vieni a prendermi qui (condivide la tua posizione una volta) · cambia il punto di discesa. Un tocco e il team lo riceve all’istante.',
    },
  },
  {
    key: 'sos',
    emoji: '🆘',
    kinds: ['join', 'private'],
    title: {
      en: 'Emergency',
      ko: '긴급 상황',
      ja: '緊急時',
      es: 'Emergencia',
      zh: '紧急情况',
      'zh-TW': '緊急狀況',
      fr: 'Urgence',
      de: 'Notfall',
      ru: 'Экстренная ситуация',
      it: 'Emergenza',
    },
    body: {
      en: 'The SOS button alerts the driver/staff AND the operations center at the same time. For medical emergencies in Korea, dial 119.',
      ko: 'SOS 버튼은 기사/스태프와 관제센터에 동시에 알립니다. 의료 응급 상황은 119로 전화하세요.',
      ja: 'SOSボタンはドライバー/スタッフと運営センターへ同時に通知します。医療緊急時は119へ電話してください。',
      es: 'El botón SOS avisa al conductor/personal Y al centro de operaciones a la vez. Para emergencias médicas en Corea, marca 119.',
      zh: 'SOS 按钮会同时通知司机/工作人员和运营中心。医疗紧急情况请拨打 119。',
      'zh-TW': 'SOS 按鈕會同時通知司機/工作人員和營運中心。醫療緊急狀況請撥打 119。',
      fr: 'Le bouton SOS alerte en même temps le chauffeur/le personnel ET le centre des opérations. En cas d’urgence médicale en Corée, composez le 119.',
      de: 'Der SOS-Knopf alarmiert gleichzeitig den Fahrer bzw. das Personal UND unsere Zentrale. Bei einem medizinischen Notfall in Korea wählen Sie die 119.',
      ru: 'Кнопка SOS одновременно оповещает водителя/персонал И оперативный центр. При медицинской экстренной ситуации в Корее звоните 119.',
      it: 'Il pulsante SOS avvisa contemporaneamente autista/staff E la centrale operativa. Per le emergenze mediche in Corea chiama il 119.',
    },
  },
  {
    key: 'money',
    emoji: '💵',
    kinds: ['private'],
    title: {
      en: 'Day-of expenses',
      ko: '당일 비용 정산',
      ja: '当日の精算',
      es: 'Gastos del día',
      zh: '当日费用结算',
      'zh-TW': '當日費用結算',
      fr: 'Frais du jour',
      de: 'Ausgaben am Tourtag',
      ru: 'Расходы в день тура',
      it: 'Spese della giornata',
    },
    body: {
      en: 'Tickets the driver buys for you, parking, or overtime appear here as cards — confirm each one with a tap, then settle in cash at the end of the day. Receipts attach to the card.',
      ko: '기사님이 대신 구매한 입장권·주차비·초과시간은 카드로 표시돼요 — 탭으로 확인하고, 하루가 끝날 때 현금으로 정산합니다. 영수증도 카드에 첨부돼요.',
      ja: 'ドライバーが立て替えたチケット・駐車料金・延長料金はカードで表示されます — タップで確認し、1日の終わりに現金で精算します。領収書もカードに添付されます。',
      es: 'Las entradas que compra el conductor, el parking o las horas extra aparecen aquí como tarjetas: confírmalas con un toque y liquida en efectivo al final del día. Los recibos se adjuntan.',
      zh: '司机代买的门票、停车费或超时费会以卡片形式显示 — 点击确认，当天结束时以现金结算。收据也会附在卡片上。',
      'zh-TW': '司機代購的門票、停車費或超時費用會以卡片形式顯示 — 點一下確認，當天結束時以現金結算。收據也會附在卡片上。',
      fr: 'Les billets achetés pour vous par le chauffeur, le parking ou les heures supplémentaires apparaissent ici sous forme de cartes — confirmez chacune d’un geste, puis réglez en espèces en fin de journée. Les reçus sont joints à la carte.',
      de: 'Tickets, die der Fahrer für Sie kauft, Parkgebühren oder Überstunden erscheinen hier als Karten — bestätigen Sie jede per Fingertipp und rechnen Sie am Ende des Tages bar ab. Belege hängen an der Karte.',
      ru: 'Билеты, которые водитель покупает за вас, парковка и дополнительные часы появляются здесь в виде карточек — подтверждайте каждую касанием, а в конце дня рассчитайтесь наличными. Чеки прикрепляются к карточке.',
      it: 'I biglietti che l’autista compra per te, il parcheggio o gli straordinari compaiono qui come card — confermali con un tocco e a fine giornata salda in contanti. Le ricevute restano allegate alla card.',
    },
  },
  {
    key: 'roles',
    emoji: '🧑‍✈️',
    kinds: ['join'],
    title: {
      en: 'Who does what',
      ko: '역할 안내',
      ja: '役割のご案内',
      es: 'Quién hace qué',
      zh: '角色说明',
      'zh-TW': '角色說明',
      fr: 'Qui fait quoi',
      de: 'Wer macht was',
      ru: 'Кто за что отвечает',
      it: 'Chi fa cosa',
    },
    body: {
      en: 'The on-site staff takes care of your SAFETY and the day’s operations — boarding, meeting times, emergencies. The sightseeing commentary comes from the Smart Guide right here in the app, in your language.',
      ko: '현장 스태프는 안전과 운영(승하차·집합·긴급 대응)을 담당해요. 관광지 해설은 이 앱의 스마트 가이드가 여러분의 언어로 제공합니다.',
      ja: '現場スタッフは安全と運営（乗降・集合・緊急対応）を担当します。観光解説はこのアプリのスマートガイドが、あなたの言語でお届けします。',
      es: 'El personal en el lugar se ocupa de tu SEGURIDAD y de la operación del día: abordaje, horas de reunión, emergencias. El comentario turístico lo ofrece la Smart Guide aquí en la app, en tu idioma.',
      zh: '现场工作人员负责您的安全与当日运营 — 上下车、集合时间、紧急应对。景点讲解由本应用的智能导览以您的语言提供。',
      'zh-TW': '現場工作人員負責您的安全與當日營運 — 上下車、集合時間、緊急應變。景點解說則由本 App 的智慧導覽以您的語言提供。',
      fr: 'Le personnel sur place s’occupe de votre SÉCURITÉ et du déroulement de la journée — embarquement, heures de rendez-vous, urgences. Les commentaires touristiques viennent du Guide intelligent, ici même dans l’app, dans votre langue.',
      de: 'Das Personal vor Ort kümmert sich um Ihre SICHERHEIT und den Tagesablauf — Einstieg, Treffzeiten, Notfälle. Die Sehenswürdigkeiten erklärt Ihnen der Smart Guide direkt hier in der App, in Ihrer Sprache.',
      ru: 'Персонал на месте отвечает за вашу БЕЗОПАСНОСТЬ и ход дня — посадку, время сбора, экстренные случаи. Экскурсионные комментарии дает Умный гид прямо здесь, в приложении, на вашем языке.',
      it: 'Lo staff sul posto si occupa della tua SICUREZZA e dell’operativo della giornata — salita a bordo, orari di ritrovo, emergenze. Il commento turistico arriva dalla Guida smart proprio qui nell’app, nella tua lingua.',
    },
  },
  {
    key: 'driver_role',
    emoji: '🚐',
    kinds: ['private'],
    title: {
      en: 'Your driver + the Smart Guide',
      ko: '기사님 + 스마트 가이드',
      ja: 'ドライバー＋スマートガイド',
      es: 'Tu conductor + la Smart Guide',
      zh: '司机 + 智能导览',
      'zh-TW': '司機 + 智慧導覽',
      fr: 'Votre chauffeur + le Guide intelligent',
      de: 'Ihr Fahrer + der Smart Guide',
      ru: 'Ваш водитель + Умный гид',
      it: 'Il tuo autista + la Guida smart',
    },
    body: {
      en: 'Your driver focuses on safe driving and the route. Commentary, tips, and answers come from the Smart Guide in this app — ask anything by text, photo, or voice.',
      ko: '기사님은 안전 운전과 이동에 집중해요. 해설·팁·질문 답변은 이 앱의 스마트 가이드가 담당하니 텍스트·사진·음성으로 무엇이든 물어보세요.',
      ja: 'ドライバーは安全運転と移動に集中します。解説・ヒント・質問への回答はこのアプリのスマートガイドが担当 — テキスト・写真・音声で何でも聞いてください。',
      es: 'Tu conductor se concentra en conducir con seguridad. El comentario, los consejos y las respuestas vienen de la Smart Guide de esta app: pregunta lo que sea por texto, foto o voz.',
      zh: '司机专注于安全驾驶和路线。讲解、贴士和答疑由本应用的智能导览负责 — 可以用文字、照片或语音随时提问。',
      'zh-TW': '司機專注於安全駕駛和路線。解說、小提示和問答由本 App 的智慧導覽負責 — 隨時可以用文字、照片或語音發問。',
      fr: 'Votre chauffeur se concentre sur la conduite et l’itinéraire. Commentaires, conseils et réponses viennent du Guide intelligent de cette app — posez vos questions par texte, photo ou message vocal.',
      de: 'Ihr Fahrer konzentriert sich auf sicheres Fahren und die Route. Erklärungen, Tipps und Antworten kommen vom Smart Guide in dieser App — fragen Sie einfach per Text, Foto oder Sprachnachricht.',
      ru: 'Водитель сосредоточен на безопасном вождении и маршруте. Комментарии, советы и ответы дает Умный гид в этом приложении — спрашивайте что угодно текстом, фото или голосом.',
      it: 'Il tuo autista si concentra sulla guida sicura e sul percorso. Commenti, consigli e risposte arrivano dalla Guida smart di questa app — chiedi qualsiasi cosa con testo, foto o voce.',
    },
  },
];

/** Sections for one manual shape, in display order. */
export function manualSections(kind: ManualKind): ManualSection[] {
  return MANUAL_SECTIONS.filter((section) => section.kinds.includes(kind));
}

/** localStorage key — bump the suffix to re-show after a big manual change. */
export const MANUAL_SEEN_KEY = 'tr_manual_seen_v1';
