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
};

export const MANUAL_CTA: Record<RoomLocale, string> = {
  en: 'Got it',
  ko: '확인했어요',
  ja: 'わかりました',
  es: 'Entendido',
  zh: '知道了',
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
    },
    body: {
      en: 'Everything here translates automatically — text, photos, and voice messages all reach the team in Korean, and replies come back in your language.',
      ko: '모든 메시지는 자동으로 번역돼요 — 텍스트·사진·음성이 한국어로 전달되고, 답장은 내 언어로 돌아옵니다.',
      ja: 'すべてのメッセージは自動翻訳されます — テキスト・写真・音声が韓国語で伝わり、返信はあなたの言語で届きます。',
      es: 'Todo se traduce automáticamente: texto, fotos y mensajes de voz llegan al equipo en coreano y las respuestas vuelven en tu idioma.',
      zh: '所有消息都会自动翻译 — 文字、照片和语音以韩语传达给团队，回复则以您的语言送达。',
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
    },
    body: {
      en: "When you arrive somewhere, a card lands here with the meeting time, a restroom map, the parking pin, and a mini guide to the spot — check it before you wander off.",
      ko: '어딘가에 도착하면 집합 시간·화장실 지도·주차 위치·미니 가이드가 담긴 카드가 도착해요 — 둘러보기 전에 꼭 확인하세요.',
      ja: '到着すると、集合時間・トイレ地図・駐車位置・ミニガイドが入ったカードが届きます — 散策の前にご確認ください。',
      es: 'Al llegar a un lugar, aquí aparece una tarjeta con la hora de reunión, el mapa de baños, el pin del aparcamiento y una mini guía: revísala antes de explorar.',
      zh: '到达景点后，这里会收到一张卡片，包含集合时间、洗手间地图、停车位置和小导览 — 游览前请先查看。',
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
    },
    body: {
      en: 'Your phone nudges you 10 and 5 minutes before the meeting time, and a live countdown appears at the top for the last 3 minutes. Please keep notifications on and come back a little early.',
      ko: '집합 10분·5분 전에 알림이 오고, 3분 전부터 화면 상단에 카운트다운이 떠요. 알림을 켜두고 조금 일찍 돌아와 주세요.',
      ja: '集合の10分前と5分前に通知が届き、3分前からは画面上部にカウントダウンが表示されます。通知をオンにして少し早めにお戻りください。',
      es: 'El teléfono te avisa 10 y 5 minutos antes de la hora de reunión, y en los últimos 3 minutos aparece una cuenta regresiva arriba. Mantén las notificaciones activadas y vuelve con antelación.',
      zh: '集合前 10 分钟和 5 分钟手机会提醒您，最后 3 分钟屏幕顶部会显示倒计时。请开启通知并提前返回。',
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
    },
    body: {
      en: "Above the chat box: I'm running late · need a stop · I'm lost · pick me up here (shares your location once) · change my drop-off. One tap reaches the team instantly.",
      ko: '채팅창 위 버튼들: 늦어요 · 잠깐 서고 싶어요 · 길을 잃었어요 · 여기로 픽업(위치 1회 공유) · 드랍 변경. 한 번의 탭으로 팀에 바로 전달돼요.',
      ja: 'チャット欄の上のボタン：遅れています・少し止まりたい・道に迷いました・ここに迎えに来て（現在地を1回共有）・降車地点を変更。ワンタップでチームに届きます。',
      es: 'Sobre el chat: voy tarde · necesito parar · estoy perdido · recógeme aquí (comparte tu ubicación una vez) · cambiar bajada. Un toque y el equipo lo recibe al instante.',
      zh: '聊天框上方的按钮：我会迟到 · 想停一下 · 我迷路了 · 来这里接我（一次性共享位置）· 更改下车点。一键即可传达给团队。',
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
    },
    body: {
      en: 'The SOS button alerts the driver/staff AND the operations center at the same time. For medical emergencies in Korea, dial 119.',
      ko: 'SOS 버튼은 기사/스태프와 관제센터에 동시에 알립니다. 의료 응급 상황은 119로 전화하세요.',
      ja: 'SOSボタンはドライバー/スタッフと運営センターへ同時に通知します。医療緊急時は119へ電話してください。',
      es: 'El botón SOS avisa al conductor/personal Y al centro de operaciones a la vez. Para emergencias médicas en Corea, marca 119.',
      zh: 'SOS 按钮会同时通知司机/工作人员和运营中心。医疗紧急情况请拨打 119。',
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
    },
    body: {
      en: 'Tickets the driver buys for you, parking, or overtime appear here as cards — confirm each one with a tap, then settle in cash at the end of the day. Receipts attach to the card.',
      ko: '기사님이 대신 구매한 입장권·주차비·초과시간은 카드로 표시돼요 — 탭으로 확인하고, 하루가 끝날 때 현금으로 정산합니다. 영수증도 카드에 첨부돼요.',
      ja: 'ドライバーが立て替えたチケット・駐車料金・延長料金はカードで表示されます — タップで確認し、1日の終わりに現金で精算します。領収書もカードに添付されます。',
      es: 'Las entradas que compra el conductor, el parking o las horas extra aparecen aquí como tarjetas: confírmalas con un toque y liquida en efectivo al final del día. Los recibos se adjuntan.',
      zh: '司机代买的门票、停车费或超时费会以卡片形式显示 — 点击确认，当天结束时以现金结算。收据也会附在卡片上。',
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
    },
    body: {
      en: 'The on-site staff takes care of your SAFETY and the day’s operations — boarding, meeting times, emergencies. The sightseeing commentary comes from the Smart Guide right here in the app, in your language.',
      ko: '현장 스태프는 안전과 운영(승하차·집합·긴급 대응)을 담당해요. 관광지 해설은 이 앱의 스마트 가이드가 여러분의 언어로 제공합니다.',
      ja: '現場スタッフは安全と運営（乗降・集合・緊急対応）を担当します。観光解説はこのアプリのスマートガイドが、あなたの言語でお届けします。',
      es: 'El personal en el lugar se ocupa de tu SEGURIDAD y de la operación del día: abordaje, horas de reunión, emergencias. El comentario turístico lo ofrece la Smart Guide aquí en la app, en tu idioma.',
      zh: '现场工作人员负责您的安全与当日运营 — 上下车、集合时间、紧急应对。景点讲解由本应用的智能导览以您的语言提供。',
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
    },
    body: {
      en: 'Your driver focuses on safe driving and the route. Commentary, tips, and answers come from the Smart Guide in this app — ask anything by text, photo, or voice.',
      ko: '기사님은 안전 운전과 이동에 집중해요. 해설·팁·질문 답변은 이 앱의 스마트 가이드가 담당하니 텍스트·사진·음성으로 무엇이든 물어보세요.',
      ja: 'ドライバーは安全運転と移動に集中します。解説・ヒント・質問への回答はこのアプリのスマートガイドが担当 — テキスト・写真・音声で何でも聞いてください。',
      es: 'Tu conductor se concentra en conducir con seguridad. El comentario, los consejos y las respuestas vienen de la Smart Guide de esta app: pregunta lo que sea por texto, foto o voz.',
      zh: '司机专注于安全驾驶和路线。讲解、贴士和答疑由本应用的智能导览负责 — 可以用文字、照片或语音随时提问。',
    },
  },
];

/** Sections for one manual shape, in display order. */
export function manualSections(kind: ManualKind): ManualSection[] {
  return MANUAL_SECTIONS.filter((section) => section.kinds.includes(kind));
}

/** localStorage key — bump the suffix to re-show after a big manual change. */
export const MANUAL_SEEN_KEY = 'tr_manual_seen_v1';
