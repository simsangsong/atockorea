/**
 * A5 — in-app usage manual (docs/smart-guide-ops-detail-audit-2026-07-21.md).
 *
 * The guest-facing "how this app works" — shown ONCE on first room entry
 * (auto sheet) and always reachable from Settings. Two shapes: join (bus /
 * small-group with field staff) and private (charter driver). All copy is a
 * pre-translated 9-locale constant (zero-LLM).
 *
 * 2026-07-27 rewrite (owner brief): FEATURE-LED and written from the guest's
 * convenience, not from our org chart. Each section answers "what can I do,
 * and what does the app do for me": live two-way translation, the Smart
 * Guide, automatic arrival briefings, the meeting pin + countdown, one-button
 * exact location, private-tour schedule control, one-tap signals, the cash
 * ledger, and emergency.
 *
 * The role-separation wording in `roles`/`driver_role` is deliberate
 * (2026-07-21 legal-risk note): on join tours the on-site staff handles
 * SAFETY and OPERATIONS; sightseeing commentary comes from the Smart Guide.
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
  'zh-TW': '知道了',
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
      en: 'Talk in your own language',
      ko: '내 언어로 그냥 말하세요',
      ja: '自分の言語でそのまま話せます',
      es: 'Habla en tu propio idioma',
      zh: '用您自己的语言交流',
      'zh-TW': '用您自己的語言交流',
      fr: 'Parlez dans votre langue',
      de: 'Sprechen Sie einfach Ihre Sprache',
      ru: 'Пишите на своем языке',
      it: 'Parla nella tua lingua',
    },
    body: {
      en: 'Write or record a voice message however you normally would. Your guide and driver read it in Korean, and their replies come back translated — instantly, both ways. No translation app, no phrasebook.',
      ko: '평소 쓰는 말로 그대로 쓰거나 음성으로 보내세요. 가이드·기사님은 한국어로 읽고, 답장은 손님 언어로 번역되어 도착해요 — 양방향 실시간이라 번역 앱을 따로 열 필요가 없어요.',
      ja: 'いつもの言語で入力するか、音声で送ってください。ガイドとドライバーには韓国語で届き、返事はあなたの言語に翻訳されて戻ります — 双方向リアルタイムなので翻訳アプリは不要です。',
      es: 'Escribe o graba un mensaje de voz como lo harías normalmente. Tu guía y tu conductor lo leen en coreano y sus respuestas te llegan traducidas — al instante y en ambos sentidos.',
      zh: '像平时一样打字或发语音即可。导游和司机会看到韩语版本，他们的回复也会翻译成您的语言 — 双向实时，无需另开翻译软件。',
      'zh-TW': '像平常一樣打字或傳語音就好。導遊和司機會看到韓語版本，他們的回覆也會翻成您的語言 — 雙向即時，不必另外開翻譯軟體。',
      fr: 'Écrivez ou enregistrez un vocal comme d’habitude. Votre guide et votre chauffeur le lisent en coréen, et leurs réponses vous reviennent traduites — instantanément, dans les deux sens.',
      de: 'Schreiben oder sprechen Sie einfach wie gewohnt. Guide und Fahrer lesen alles auf Koreanisch, ihre Antworten kommen in Ihrer Sprache zurück — sofort und in beide Richtungen.',
      ru: 'Пишите или отправляйте голосовые как обычно. Гид и водитель читают их по-корейски, а ответы приходят к вам переведенными — мгновенно и в обе стороны.',
      it: 'Scrivi o registra un vocale come faresti normalmente. La guida e l’autista lo leggono in coreano e le loro risposte ti tornano tradotte — subito, in entrambe le direzioni.',
    },
  },
  {
    key: 'smart_guide',
    emoji: '✨',
    kinds: ['join', 'private'],
    title: {
      en: 'Smart Guide answers on the spot',
      ko: '스마트 가이드가 바로 답해요',
      ja: 'スマートガイドがその場で回答',
      es: 'La Smart Guide responde al momento',
      zh: '智能导览即刻解答',
      'zh-TW': '智慧導覽即刻解答',
      fr: 'Le Guide intelligent répond sur place',
      de: 'Der Smart Guide antwortet sofort',
      ru: 'Умный гид отвечает на месте',
      it: 'La Guida smart risponde subito',
    },
    body: {
      en: 'Tap ✨ and ask anything — “where is the restroom?”, “what am I looking at?”, “is this spicy?”. Send a photo of a sign or a dish and it reads it for you. Answers come in seconds, so you never have to wait for a quiet moment to ask.',
      ko: '✨를 눌러 무엇이든 물어보세요 — “화장실 어디예요?”, “이건 뭔가요?”, “이거 매워요?”. 간판이나 메뉴 사진을 보내면 읽어 드려요. 몇 초 만에 답이 오니 가이드가 한가해질 때까지 기다릴 필요가 없어요.',
      ja: '✨をタップして何でも聞いてください —「トイレはどこ?」「これは何?」「辛いですか?」。看板やメニューの写真を送れば読み取ります。数秒で答えが返るので、聞くタイミングを待つ必要はありません。',
      es: 'Toca ✨ y pregunta lo que sea: “¿dónde está el baño?”, “¿qué estoy viendo?”, “¿pica?”. Manda la foto de un cartel o un plato y te lo interpreta. Responde en segundos, sin esperar el momento oportuno.',
      zh: '点击 ✨ 随便问 —「洗手间在哪里?」「这是什么?」「辣吗?」。拍下招牌或菜单发过来即可读懂。几秒就有答案，不必等导游有空。',
      'zh-TW': '點一下 ✨ 儘管問 —「洗手間在哪裡？」「這是什麼？」「會辣嗎？」。拍下招牌或菜單傳過來就能看懂。幾秒就有答案，不必等導遊有空。',
      fr: 'Touchez ✨ et demandez ce que vous voulez : « où sont les toilettes ? », « qu’est-ce que je regarde ? », « c’est épicé ? ». Envoyez la photo d’un panneau ou d’un plat, il vous l’explique. Réponse en quelques secondes.',
      de: 'Tippen Sie auf ✨ und fragen Sie alles — „Wo ist die Toilette?“, „Was sehe ich hier?“, „Ist das scharf?“. Schicken Sie ein Foto von Schild oder Speisekarte, er liest es für Sie. Antwort in Sekunden.',
      ru: 'Нажмите ✨ и спрашивайте что угодно: «где туалет?», «что это за место?», «это острое?». Пришлите фото вывески или меню — он прочитает. Ответ приходит за секунды.',
      it: 'Tocca ✨ e chiedi qualsiasi cosa: «dov’è il bagno?», «cosa sto guardando?», «è piccante?». Manda la foto di un cartello o di un piatto e te lo interpreta. Risposta in pochi secondi.',
    },
  },
  {
    key: 'arrival',
    emoji: '📍',
    kinds: ['join', 'private'],
    title: {
      en: 'Each stop explains itself',
      ko: '도착하면 안내가 저절로 떠요',
      ja: '到着すると案内が自動で届く',
      es: 'Cada parada se explica sola',
      zh: '每到一站自动讲解',
      'zh-TW': '每到一站自動解說',
      fr: 'Chaque étape s’explique toute seule',
      de: 'Jeder Stopp erklärt sich selbst',
      ru: 'Каждая остановка расскажет о себе',
      it: 'Ogni tappa si racconta da sola',
    },
    /**
     * 🔴 The one instruction this manual was missing.
     *
     * Everything below was true EXCEPT that it needs location sharing, which
     * defaults off. So the manual promised automatic arrival cards to guests
     * who would never receive one, and gave them nothing to act on. The last
     * sentence is the fix; the home tab now carries the same one-tap door.
     */
    body: {
      en: 'When you arrive somewhere, a card appears in the chat: what makes it worth seeing, how long you have, and where the restrooms, cafés and best photo spots are. It arrives in your language — nothing to ask for. One thing to switch on: tap "Turn on" on the home screen (or Share my location on the Map tab) so the app knows you have arrived.',
      ko: '관광지에 도착하면 채팅에 카드가 떠요 — 볼거리, 머무는 시간, 화장실·카페·포토스팟 위치까지. 손님 언어로 자동 도착하니 따로 물어볼 필요가 없어요. 한 가지만 켜주세요: 홈 화면의 [켜기] (또는 지도 탭의 「내 위치 공유」)를 눌러야 도착한 걸 앱이 알 수 있어요.',
      ja: '到着すると、見どころ・滞在時間・トイレやカフェ・写真スポットの場所をまとめたカードがチャットに届きます。あなたの言語で自動的に届くので、質問は不要です。ひとつだけオンにしてください：ホーム画面の［オンにする］（または地図タブの「位置情報を共有」）。これで到着をアプリが検知できます。',
      es: 'Al llegar aparece una tarjeta en el chat: qué merece la pena ver, cuánto tiempo tienes y dónde están baños, cafeterías y los mejores puntos de foto. En tu idioma y sin pedir nada. Solo hay que activar una cosa: pulsa «Activar» en la pantalla de inicio (o «Compartir mi ubicación» en la pestaña Mapa) para que la app sepa que has llegado.',
      zh: '抵达景点时，聊天里会自动出现卡片：看点、停留时间，以及洗手间、咖啡店和最佳拍照点的位置。以您的语言呈现，无需询问。只需开启一项：在首页点击「开启」（或在地图标签开启「共享我的位置」），应用才能知道您已抵达。',
      'zh-TW': '抵達景點時，聊天室會自動出現卡片：看點、停留時間，以及洗手間、咖啡廳和最佳拍照點的位置。以您的語言呈現，不必開口問。只需開啟一項：在首頁點擊「開啟」（或在地圖分頁開啟「分享我的位置」），App 才能知道您已抵達。',
      fr: 'À chaque arrivée, une fiche apparaît dans le chat : ce qu’il faut voir, le temps dont vous disposez, et où sont toilettes, cafés et meilleurs spots photo. Dans votre langue, sans rien demander. Une seule chose à activer : appuyez sur « Activer » sur l’écran d’accueil (ou « Partager ma position » dans l’onglet Carte) pour que l’app sache que vous êtes arrivé.',
      de: 'Bei jeder Ankunft erscheint eine Karte im Chat: was sich lohnt, wie viel Zeit Sie haben und wo Toiletten, Cafés und die besten Fotopunkte sind — in Ihrer Sprache, ganz von selbst. Eines müssen Sie einschalten: Tippen Sie auf dem Startbildschirm auf „Einschalten“ (oder im Tab Karte auf „Meinen Standort teilen“), damit die App Ihre Ankunft erkennt.',
      ru: 'При прибытии в чате появляется карточка: что стоит увидеть, сколько у вас времени, где туалеты, кафе и лучшие точки для фото. На вашем языке и без запроса. Включить нужно одно: нажмите «Включить» на главном экране (или «Делиться геопозицией» во вкладке «Карта»), чтобы приложение узнало о вашем прибытии.',
      it: 'All’arrivo compare una scheda in chat: cosa vale la pena vedere, quanto tempo hai e dove sono bagni, caffè e i punti foto migliori. Nella tua lingua, senza chiedere nulla. Una sola cosa da attivare: tocca «Attiva» nella schermata iniziale (o «Condividi la mia posizione» nella scheda Mappa) perché l’app sappia che sei arrivato.',
    },
  },
  {
    key: 'meeting',
    emoji: '⏱️',
    kinds: ['join', 'private'],
    title: {
      en: 'Meeting point on a map, with a countdown',
      ko: '집합 장소는 지도 핀, 시간은 카운트다운',
      ja: '集合場所は地図ピン、時間はカウントダウン',
      es: 'Punto de encuentro en el mapa, con cuenta atrás',
      zh: '集合地点看地图，时间有倒计时',
      'zh-TW': '集合地點看地圖，時間有倒數',
      fr: 'Point de rendez-vous sur la carte, avec compte à rebours',
      de: 'Treffpunkt auf der Karte, mit Countdown',
      ru: 'Место сбора на карте и обратный отсчет',
      it: 'Punto di ritrovo sulla mappa, con conto alla rovescia',
    },
    body: {
      en: 'Free time always comes with a map pin for the meeting point and a countdown at the top of your screen, with a nudge at 10 and 5 minutes. Wander without watching the clock — and tap the pin to navigate straight back.',
      ko: '자유시간에는 집합 장소 지도 핀과 화면 상단 카운트다운이 함께 떠요. 10분·5분 전에 알려주니 시계를 계속 보지 않아도 되고, 핀을 누르면 길안내로 바로 돌아올 수 있어요.',
      ja: '自由時間には集合場所の地図ピンと画面上部のカウントダウンが表示され、10分前・5分前にお知らせします。時計を気にせず楽しめ、ピンをタップすればそのまま道案内で戻れます。',
      es: 'El tiempo libre siempre incluye un pin del punto de encuentro y una cuenta atrás arriba, con aviso a los 10 y 5 minutos. Pasea sin mirar el reloj y toca el pin para volver con navegación.',
      zh: '自由活动时会显示集合点地图图钉和顶部倒计时，并在剩余 10 分钟和 5 分钟时提醒。不用一直看表，点图钉即可导航返回。',
      'zh-TW': '自由活動時會顯示集合地點的地圖圖釘和上方倒數，並在剩下 10 分鐘和 5 分鐘時提醒您。不用一直看錶，點一下圖釘就能導航回去。',
      fr: 'Le temps libre s’accompagne toujours d’un repère cartographique et d’un compte à rebours en haut de l’écran, avec alerte à 10 et 5 minutes. Touchez le repère pour revenir en navigation.',
      de: 'Zur Freizeit gehören immer ein Karten-Pin für den Treffpunkt und ein Countdown oben im Bild — mit Hinweis bei 10 und 5 Minuten. Tippen Sie auf den Pin, um direkt zurückzunavigieren.',
      ru: 'Свободное время всегда идет с точкой сбора на карте и обратным отсчетом вверху экрана, с напоминанием за 10 и 5 минут. Нажмите точку — навигатор приведет вас обратно.',
      it: 'Il tempo libero arriva sempre con il pin del punto di ritrovo e un conto alla rovescia in alto, con avviso a 10 e 5 minuti. Tocca il pin per tornare con la navigazione.',
    },
  },
  {
    key: 'meet_pin',
    emoji: '🤝',
    kinds: ['join', 'private'],
    title: {
      en: 'Lost? One button puts you on their map',
      ko: '길을 잃어도 버튼 하나면 찾아와요',
      ja: '迷っても、ボタン1つで迎えに来ます',
      es: '¿Perdido? Un botón te pone en su mapa',
      zh: '走散了?一键让他们找到您',
      'zh-TW': '走散了？一鍵讓他們找到您',
      fr: 'Perdu ? Un bouton vous place sur leur carte',
      de: 'Verlaufen? Ein Knopf setzt Sie auf ihre Karte',
      ru: 'Заблудились? Одна кнопка — и вас найдут',
      it: 'Perso? Un pulsante ti mette sulla loro mappa',
    },
    body: {
      en: 'Tap “📍 Meet me here” and your exact spot goes to your driver as a navigable pin — then add one photo of what you can see. A place name can be misheard; a pin and a photo cannot. It works even when you have no idea where you are.',
      ko: '“📍 여기서 만나요”를 누르면 정확한 위치가 기사님에게 내비 핀으로 전달돼요. 이어서 지금 보이는 풍경 사진 한 장을 더하면 완벽해요 — 장소 이름은 잘못 전달될 수 있어도 핀과 사진은 그렇지 않아요. 내가 어디인지 몰라도 됩니다.',
      ja: '「📍 ここで会いましょう」を押すと、正確な現在地がナビ用ピンとしてドライバーに届きます。見えている景色の写真を1枚添えれば完璧 — 地名は聞き違えても、ピンと写真は間違いません。自分の居場所が分からなくても大丈夫です。',
      es: 'Toca “📍 Encuéntrame aquí” y tu ubicación exacta llega al conductor como pin navegable; añade una foto de lo que ves. Un nombre puede entenderse mal; un pin y una foto, no. Funciona aunque no sepas dónde estás.',
      zh: '点击「📍 在这里见面」，准确位置会以可导航图钉发给司机，再补一张眼前照片就万无一失 — 地名可能听错，图钉和照片不会。就算您不知道自己在哪也没关系。',
      'zh-TW': '點一下「📍 在這裡見面」，精確位置就會以可導航的圖釘傳給司機，再補一張眼前的照片更保險 — 地名可能聽錯，圖釘和照片不會。就算您不知道自己在哪也沒關係。',
      fr: 'Touchez « 📍 Retrouvez-moi ici » : votre position exacte part vers le chauffeur en repère navigable, puis ajoutez une photo de ce que vous voyez. Un nom de lieu peut être mal compris ; un repère et une photo, non.',
      de: 'Tippen Sie auf „📍 Hier treffen“ — Ihr genauer Standort geht als navigierbarer Pin an den Fahrer; fügen Sie ein Foto Ihrer Umgebung hinzu. Ein Ortsname kann missverstanden werden, ein Pin mit Foto nicht.',
      ru: 'Нажмите «📍 Встретимся здесь» — точное место уйдет водителю точкой для навигатора; добавьте фото того, что видите. Название можно перепутать, точку и фото — нет. Работает, даже если вы не знаете, где находитесь.',
      it: 'Tocca «📍 Ci vediamo qui»: la tua posizione esatta arriva all’autista come pin navigabile, poi aggiungi una foto di ciò che vedi. Un nome si può fraintendere, un pin con foto no.',
    },
  },
  {
    key: 'plan',
    emoji: '🗓️',
    kinds: ['private'],
    title: {
      en: 'Your private tour, your schedule',
      ko: '프라이빗 투어, 일정은 손님이 정해요',
      ja: 'プライベートツアーは、予定もあなた次第',
      es: 'Tu tour privado, tu horario',
      zh: '私人团，行程由您决定',
      'zh-TW': '包車行程，由您決定',
      fr: 'Votre tour privé, votre programme',
      de: 'Ihre Privattour, Ihr Zeitplan',
      ru: 'Ваш частный тур — ваше расписание',
      it: 'Il tuo tour privato, i tuoi orari',
    },
    body: {
      en: 'The day before, pick the places you want from the planner link — or leave it to your guide. During the tour you set the meeting time and place yourself: choose a time, name the spot or attach your location, and your driver receives it as a pin. Changed your mind? Just set it again.',
      ko: '전날에는 플래너 링크에서 가고 싶은 곳을 고르거나, 가이드에게 맡기셔도 돼요. 투어 중에도 만남 시간·장소를 직접 정할 수 있어요 — 시간을 고르고 장소를 적거나 현재 위치를 붙이면 기사님에게 핀으로 전달돼요. 마음이 바뀌면 다시 정하면 그만이에요.',
      ja: '前日はプランナーのリンクで行きたい場所を選ぶか、ガイドにお任せでもOK。ツアー中も待ち合わせの時間と場所をご自身で設定できます — 時間を選び、場所を書くか現在地を添えれば、ドライバーにピンで届きます。気が変わればまた設定するだけ。',
      es: 'La víspera, elige tus lugares desde el enlace del planificador o déjalo en manos de tu guía. Durante el tour fijas tú la hora y el punto de encuentro: elige hora, escribe el lugar o adjunta tu ubicación, y le llega al conductor como pin. ¿Cambio de planes? Vuelve a fijarlo.',
      zh: '出发前一天，可在行程规划链接中挑选想去的地方，也可以交给导游安排。行程中您还能自己设定见面时间和地点 — 选好时间，写下地点或附上当前位置，司机就会收到定位。改主意了?再设一次即可。',
      'zh-TW': '出發前一天，可以在行程規劃連結中挑選想去的地方，也可以交給導遊安排。行程中您還能自己設定見面時間和地點 — 選好時間，寫下地點或附上目前位置，司機就會收到定位。改變主意了？再設定一次就好。',
      fr: 'La veille, choisissez vos lieux depuis le lien du planificateur — ou laissez faire votre guide. Pendant le tour, fixez vous-même l’heure et le lieu du rendez-vous : choisissez l’heure, nommez l’endroit ou joignez votre position, le chauffeur reçoit un repère. Changement d’avis ? Refixez.',
      de: 'Am Vortag wählen Sie Ihre Orte über den Planer-Link — oder überlassen es Ihrem Guide. Während der Tour legen Sie Treffzeit und -ort selbst fest: Zeit wählen, Ort nennen oder Standort anhängen, der Fahrer bekommt einen Pin. Umentschieden? Einfach neu festlegen.',
      ru: 'Накануне выберите места по ссылке планировщика — или доверьте это гиду. Во время тура вы сами назначаете время и место встречи: выберите время, укажите место или приложите геопозицию, и водитель получит точку. Передумали? Назначьте заново.',
      it: 'Il giorno prima scegli i luoghi dal link del planner — oppure lascia fare alla guida. Durante il tour fissi tu ora e luogo del ritrovo: scegli l’ora, scrivi il posto o allega la posizione, e l’autista riceve un pin. Cambio idea? Rifissa.',
    },
  },
  {
    key: 'signals',
    emoji: '⚡',
    kinds: ['join', 'private'],
    title: {
      en: 'One tap for the awkward asks',
      ko: '말 꺼내기 어려운 건 한 번만 누르면 돼요',
      ja: '言い出しにくいことはワンタップ',
      es: 'Un toque para lo que cuesta pedir',
      zh: '难开口的事，一键就好',
      'zh-TW': '難開口的事，一鍵就好',
      fr: 'Un geste pour les demandes gênantes',
      de: 'Ein Tipp für die unangenehmen Bitten',
      ru: 'Одно касание для неловких просьб',
      it: 'Un tocco per le richieste imbarazzanti',
    },
    body: {
      en: '“Running late”, “need a restroom stop”, “pick me up here” — one tap sends it, already translated, without interrupting anyone or explaining yourself. Your guide sees it immediately.',
      ko: '“늦어요”, “잠깐 서고 싶어요”, “여기로 픽업해 주세요” — 한 번 누르면 번역된 상태로 전달돼요. 누구의 말을 끊거나 길게 설명할 필요 없이 가이드가 바로 확인해요.',
      ja: '「遅れます」「トイレ休憩をお願いします」「ここに迎えに来て」 — ワンタップで翻訳済みのまま届きます。誰かの話を遮ったり説明したりする必要はありません。',
      es: '“Voy tarde”, “necesito una parada”, “recógeme aquí”: un toque lo envía ya traducido, sin interrumpir a nadie ni dar explicaciones. Tu guía lo ve al instante.',
      zh: '「我会迟到」「想上洗手间」「来这里接我」 — 一键发送并自动翻译，不用打断别人，也不必解释。导游立刻就能看到。',
      'zh-TW': '「我會遲到」「想上洗手間」「來這裡接我」 — 一鍵傳送並自動翻譯，不用打斷別人，也不必多做解釋。導遊馬上就會看到。',
      fr: '« Je suis en retard », « une pause toilettes », « venez me chercher ici » — un geste et c’est envoyé, déjà traduit, sans interrompre personne ni vous justifier.',
      de: '„Ich verspäte mich“, „Toilettenpause bitte“, „Holen Sie mich hier ab“ — ein Tipp, schon übersetzt unterwegs, ohne jemanden zu unterbrechen oder sich zu erklären.',
      ru: '«Опаздываю», «нужна остановка», «заберите меня здесь» — одно касание, и сообщение уходит уже переведенным, никого не перебивая и без объяснений.',
      it: '«Sono in ritardo», «serve una sosta», «vieni a prendermi qui» — un tocco e parte, già tradotto, senza interrompere nessuno né spiegarti.',
    },
  },
  {
    // Cash extras are the PRIVATE (charter) settlement model — join tours
    // collect admissions up front, so this section stays private-only
    // (pre-existing contract, pinned by the manual-content test).
    key: 'money',
    emoji: '💵',
    kinds: ['private'],
    title: {
      en: 'Extras stay written down',
      ko: '추가 비용은 기록으로 남아요',
      ja: '追加料金は記録に残ります',
      es: 'Los extras quedan por escrito',
      zh: '额外费用有据可查',
      'zh-TW': '額外費用有據可查',
      fr: 'Les extras restent écrits',
      de: 'Zusatzkosten bleiben schriftlich',
      ru: 'Доплаты остаются в записи',
      it: 'Gli extra restano scritti',
    },
    body: {
      en: 'Admission fees, an extra hour, anything paid in cash on the day is logged in the chat in your language — what it was, how much, and when. Nothing to remember, nothing to sort out later.',
      ko: '입장료, 연장 시간처럼 당일 현금으로 내는 항목은 채팅에 손님 언어로 기록돼요 — 무엇을, 얼마를, 언제 냈는지. 기억할 필요도, 나중에 다시 확인할 일도 없어요.',
      ja: '入場料や延長料金など、当日現金でお支払いする項目はチャットにあなたの言語で記録されます — 内容・金額・時刻まで。覚えておく必要も、後で確認し直す必要もありません。',
      es: 'Entradas, una hora extra, cualquier pago en efectivo del día queda registrado en el chat en tu idioma: qué fue, cuánto y cuándo. Nada que recordar ni que aclarar después.',
      zh: '门票、加时等当天现金支付的项目，都会以您的语言记录在聊天中 — 名目、金额、时间一清二楚。不用记，也不必事后核对。',
      'zh-TW': '門票、加時等當天以現金支付的項目，都會用您的語言記錄在聊天室 — 名目、金額、時間一清二楚。不用記，也不必事後對帳。',
      fr: 'Billets d’entrée, heure supplémentaire, tout paiement en espèces du jour est consigné dans le chat, dans votre langue : quoi, combien, quand. Rien à retenir, rien à régler ensuite.',
      de: 'Eintritte, eine Extrastunde, jede Barzahlung des Tages wird im Chat in Ihrer Sprache festgehalten: was, wie viel, wann. Nichts zu merken, nichts später zu klären.',
      ru: 'Билеты, дополнительный час, любая оплата наличными в этот день фиксируется в чате на вашем языке: что, сколько и когда. Ничего не нужно запоминать и уточнять потом.',
      it: 'Biglietti, un’ora extra, ogni pagamento in contanti della giornata resta annotato in chat nella tua lingua: cosa, quanto, quando. Niente da ricordare, niente da chiarire dopo.',
    },
  },
  {
    key: 'sos',
    emoji: '🆘',
    kinds: ['join', 'private'],
    title: {
      en: 'Emergency, all in one place',
      ko: '긴급 상황은 여기 한 곳에',
      ja: '緊急時はここにまとまっています',
      es: 'Emergencias, todo en un sitio',
      zh: '紧急情况，一处解决',
      'zh-TW': '緊急狀況，一處解決',
      fr: 'Urgences, au même endroit',
      de: 'Notfall — alles an einem Ort',
      ru: 'Экстренная помощь в одном месте',
      it: 'Emergenze, tutto in un posto',
    },
    body: {
      en: 'The 🛡️ button holds Korea’s emergency numbers (112 police, 119 fire/ambulance), the nearest hospital and pharmacy, and an SOS that alerts our operations team with your location. Hopefully never needed — but always one tap away.',
      ko: '🛡️ 버튼 안에 한국 긴급번호(112 경찰, 119 소방·구급), 가까운 응급실·약국, 그리고 위치와 함께 운영팀에 알리는 SOS가 있어요. 쓸 일이 없길 바라지만, 언제나 한 번만 누르면 닿아요.',
      ja: '🛡️ ボタンに韓国の緊急番号（112 警察・119 消防/救急）、最寄りの病院と薬局、位置情報つきで運営チームに知らせるSOSがまとまっています。使わずに済むのが一番ですが、いつでもワンタップです。',
      es: 'El botón 🛡️ reúne los números de emergencia de Corea (112 policía, 119 bomberos/ambulancia), el hospital y la farmacia más cercanos, y un SOS que avisa a nuestro equipo con tu ubicación. Ojalá no haga falta.',
      zh: '🛡️ 按钮内含韩国紧急电话（112 报警、119 消防/急救）、最近的医院和药店，以及带定位通知我们运营团队的 SOS。希望用不上，但一键即达。',
      'zh-TW': '🛡️ 按鈕裡有韓國緊急電話（112 報警、119 消防／救護）、最近的醫院和藥局，以及會附上定位通知營運團隊的 SOS。希望用不到，但一鍵就在。',
      fr: 'Le bouton 🛡️ regroupe les numéros d’urgence coréens (112 police, 119 pompiers/ambulance), l’hôpital et la pharmacie les plus proches, et un SOS qui alerte notre équipe avec votre position.',
      de: 'Der 🛡️-Knopf bündelt Koreas Notrufnummern (112 Polizei, 119 Feuerwehr/Rettung), das nächste Krankenhaus und die nächste Apotheke sowie einen SOS, der unser Team mit Ihrem Standort alarmiert.',
      ru: 'Кнопка 🛡️ собирает экстренные номера Кореи (112 полиция, 119 пожарные/скорая), ближайшую больницу и аптеку, а также SOS, который сообщит нашей команде ваше местоположение.',
      it: 'Il pulsante 🛡️ raccoglie i numeri d’emergenza coreani (112 polizia, 119 vigili/ambulanza), l’ospedale e la farmacia più vicini e un SOS che avvisa il nostro team con la tua posizione.',
    },
  },
  {
    key: 'roles',
    emoji: '🧭',
    kinds: ['join'],
    title: {
      en: 'Your staff on board + the Smart Guide',
      ko: '현장 스태프 + 스마트 가이드',
      ja: '現地スタッフ + スマートガイド',
      es: 'El personal a bordo + la Smart Guide',
      zh: '随车工作人员 + 智能导览',
      'zh-TW': '隨車工作人員 ＋ 智慧導覽',
      fr: 'Le personnel à bord + le Guide intelligent',
      de: 'Ihr Personal an Bord + der Smart Guide',
      ru: 'Сопровождающий + Умный гид',
      it: 'Lo staff a bordo + la Guida smart',
    },
    body: {
      en: 'The staff travelling with you take care of safety, timing and everything operational on the ground. Sightseeing commentary, background and your questions are handled by the Smart Guide in this app — so you always have both at once.',
      ko: '함께 이동하는 스태프는 안전·시간·현장 운영을 책임져요. 관광 해설과 배경 설명, 질문 답변은 이 앱의 스마트 가이드가 맡습니다 — 덕분에 둘 다 언제나 이용할 수 있어요.',
      ja: '同行スタッフは安全・時間・現場の運営を担当します。観光解説や背景、ご質問への回答はこのアプリのスマートガイドが担当 — どちらもいつでも利用できます。',
      es: 'El personal que viaja contigo se ocupa de la seguridad, los horarios y la operativa sobre el terreno. El comentario turístico y tus preguntas los atiende la Smart Guide de esta app: siempre tienes ambos.',
      zh: '随行工作人员负责安全、时间与现场运营；观光讲解、背景知识和您的提问由本应用的智能导览负责 — 两者随时都在。',
      'zh-TW': '隨行的工作人員負責安全、時間與現場運作；觀光解說、背景知識和您的提問則由 App 裡的智慧導覽負責 — 兩邊隨時都在。',
      fr: 'Le personnel qui vous accompagne gère la sécurité, les horaires et toute l’organisation sur place. Les commentaires touristiques et vos questions relèvent du Guide intelligent de cette app.',
      de: 'Das Personal an Bord kümmert sich um Sicherheit, Zeitplan und alles Organisatorische vor Ort. Reiseerläuterungen und Ihre Fragen übernimmt der Smart Guide in dieser App — beides ist jederzeit verfügbar.',
      ru: 'Сопровождающий отвечает за безопасность, тайминг и всю организацию на месте. Экскурсионные пояснения и ваши вопросы берет на себя Умный гид в приложении — доступны оба сразу.',
      it: 'Lo staff che viaggia con te si occupa di sicurezza, tempi e organizzazione sul posto. Il commento turistico e le tue domande sono affidati alla Guida smart di questa app.',
    },
  },
  {
    key: 'driver_role',
    emoji: '🚘',
    kinds: ['private'],
    title: {
      en: 'Your driver + the Smart Guide',
      ko: '기사님 + 스마트 가이드',
      ja: 'ドライバー + スマートガイド',
      es: 'Tu conductor + la Smart Guide',
      zh: '司机 + 智能导览',
      'zh-TW': '司機 ＋ 智慧導覽',
      fr: 'Votre chauffeur + le Guide intelligent',
      de: 'Ihr Fahrer + der Smart Guide',
      ru: 'Ваш водитель + Умный гид',
      it: 'Il tuo autista + la Guida smart',
    },
    body: {
      en: 'Your driver focuses on safe driving and the route — message them here anytime and they read it in Korean. Commentary, tips and answers come from the Smart Guide in this app, so nobody has to divide their attention.',
      ko: '기사님은 안전 운전과 이동에 집중해요 — 언제든 여기로 말을 걸면 한국어로 읽으십니다. 해설·팁·질문 답변은 이 앱의 스마트 가이드가 담당하니, 운전과 안내가 서로 방해하지 않아요.',
      ja: 'ドライバーは安全運転と移動に集中します — いつでもここから話しかければ韓国語で届きます。解説・ヒント・回答はこのアプリのスマートガイドが担当するので、運転と案内が競合しません。',
      es: 'Tu conductor se concentra en conducir con seguridad y en la ruta: escríbele aquí cuando quieras y lo leerá en coreano. El comentario, los consejos y las respuestas vienen de la Smart Guide de esta app.',
      zh: '司机专注于安全驾驶与路线 — 随时在这里跟他说话，他会以韩语阅读。讲解、贴士与答疑由本应用的智能导览负责，互不干扰。',
      'zh-TW': '司機專心開車與看路線 — 您隨時可以在這裡跟他說話，他會看到韓語版本。解說、小提醒和問答則交給 App 裡的智慧導覽，兩者互不干擾。',
      fr: 'Votre chauffeur se concentre sur la conduite et l’itinéraire — écrivez-lui ici à tout moment, il le lira en coréen. Commentaires, conseils et réponses viennent du Guide intelligent de cette app.',
      de: 'Ihr Fahrer konzentriert sich auf sicheres Fahren und die Route — schreiben Sie ihm hier jederzeit, er liest es auf Koreanisch. Erklärungen, Tipps und Antworten kommen vom Smart Guide in dieser App.',
      ru: 'Водитель сосредоточен на безопасной езде и маршруте — пишите ему здесь в любой момент, он прочитает по-корейски. Комментарии, советы и ответы дает Умный гид в приложении.',
      it: 'Il tuo autista si concentra sulla guida sicura e sul percorso — scrivigli qui quando vuoi, lo leggerà in coreano. Commenti, consigli e risposte arrivano dalla Guida smart di questa app.',
    },
  },
];

/** Sections for one manual shape, in display order. */
export function manualSections(kind: ManualKind): ManualSection[] {
  return MANUAL_SECTIONS.filter((section) => section.kinds.includes(kind));
}

/**
 * localStorage key — bump the suffix to re-show after a big manual change.
 * v2: 2026-07-27 feature-led rewrite (Smart Guide, meeting pin, private
 * schedule control) — returning guests should meet the new capabilities.
 */
export const MANUAL_SEEN_KEY = 'tr_manual_seen_v2';
