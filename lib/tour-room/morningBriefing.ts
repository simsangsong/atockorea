/**
 * A1 — morning briefing (docs/smart-guide-ops-detail-audit-2026-07-21.md).
 *
 * The tour's "opening speech", one operator tap at pickup. Two shapes:
 *   join    — bus / small-group: greeting · how-the-app-works · schedule tab ·
 *             lunch pointer · keep-notifications-on;
 *   private — charter: greeting · included hours (Jeju 9h / Busan 8h) ·
 *             overtime ₩30,000/h cash · one-direction route rule · ask-anytime.
 *
 * Every line is a pre-translated 5-locale constant (zero-LLM); the only
 * interpolations are the numeric charter hours and the formatted overtime
 * rate — both from lib/tour-room/overtime.ts constants, so the briefing can
 * never drift from the actual settlement arithmetic.
 */

import { ROOM_LOCALES, type RoomLocale } from '@/lib/tour-room/snapshot';

export type BriefingKind = 'join' | 'private';

const JOIN_LINES: Array<Record<RoomLocale, string>> = [
  {
    en: 'Good morning, and welcome aboard! 🚌',
    ko: '좋은 아침입니다, 오늘 투어에 오신 것을 환영합니다! 🚌',
    ja: 'おはようございます。本日のツアーへようこそ！🚌',
    es: '¡Buenos días y bienvenidos a bordo! 🚌',
    zh: '早上好，欢迎参加今天的行程！🚌',
  },
  {
    en: 'This chat translates automatically — write in your own language and the staff will understand.',
    ko: '이 채팅은 자동으로 번역돼요 — 여러분의 언어로 쓰시면 스태프가 이해합니다.',
    ja: 'このチャットは自動翻訳されます — ご自身の言語で書けばスタッフに伝わります。',
    es: 'Este chat se traduce automáticamente: escriban en su idioma y el personal lo entenderá.',
    zh: '本聊天会自动翻译 — 用您的语言输入，工作人员就能看懂。',
  },
  {
    en: "Today's route is in the Schedule tab. At each stop we'll send the meeting time, restroom map, and a mini guide right here.",
    ko: '오늘 일정은 일정 탭에 있어요. 각 장소마다 집합 시간·화장실 지도·미니 가이드를 여기로 보내드립니다.',
    ja: '本日のルートはスケジュールタブにあります。各スポットで集合時間・トイレ地図・ミニガイドをここへお送りします。',
    es: 'La ruta de hoy está en la pestaña de itinerario. En cada parada enviaremos aquí la hora de reunión, el mapa de baños y una mini guía.',
    zh: '今日路线在行程标签页。每到一站，我们都会在这里发送集合时间、洗手间地图和小导览。',
  },
  {
    en: 'Lunch details will be announced before the lunch stop.',
    ko: '점심 안내는 점심 장소 도착 전에 알려드릴게요.',
    ja: '昼食のご案内はランチ前にお知らせします。',
    es: 'Los detalles del almuerzo se anunciarán antes de la parada para comer.',
    zh: '午餐信息将在午餐停靠点之前通知。',
  },
  {
    en: 'Meeting times always appear at the top with a countdown — please keep notifications on and be back a little early. 🙏',
    ko: '집합 시간은 항상 화면 위 카운트다운으로 표시돼요 — 알림을 켜두시고 조금 일찍 돌아와 주세요. 🙏',
    ja: '集合時間は常に画面上部にカウントダウン表示されます — 通知をオンにして少し早めにお戻りください。🙏',
    es: 'Las horas de reunión aparecen arriba con cuenta regresiva: mantengan las notificaciones activadas y vuelvan con algo de antelación. 🙏',
    zh: '集合时间始终显示在屏幕顶部并倒计时 — 请开启通知，并提前一点返回。🙏',
  },
];

const PRIVATE_LINES: Array<Record<RoomLocale, string>> = [
  {
    en: "Good morning! I'm your driver today. This chat translates automatically — feel free to write in your language. 🚐",
    ko: '좋은 아침입니다! 오늘 모실 기사입니다. 이 채팅은 자동 번역되니 편하게 여러분의 언어로 써주세요. 🚐',
    ja: 'おはようございます！本日担当のドライバーです。このチャットは自動翻訳されるので、ご自身の言語でお気軽にどうぞ。🚐',
    es: '¡Buenos días! Soy su conductor de hoy. Este chat se traduce automáticamente: escriban con confianza en su idioma. 🚐',
    zh: '早上好！我是今天的司机。本聊天自动翻译，请放心用您的语言交流。🚐',
  },
  {
    en: "Today's charter includes {hours} hours of service.",
    ko: '오늘 차터는 기본 {hours}시간 이용이 포함되어 있습니다.',
    ja: '本日のチャーターには基本{hours}時間のサービスが含まれます。',
    es: 'El servicio de hoy incluye {hours} horas.',
    zh: '今日包车包含{hours}小时的服务。',
  },
  {
    en: 'Beyond that, overtime is {rate} per hour, payable in cash on the day.',
    ko: '초과 시에는 시간당 {rate}이 당일 현금으로 정산됩니다.',
    ja: '超過分は1時間あたり{rate}、当日現金でのお支払いです。',
    es: 'Las horas extra cuestan {rate} por hora, a pagar en efectivo el mismo día.',
    zh: '超时费用为每小时{rate}，当天以现金结算。',
  },
  {
    en: "The route runs one direction only — back-and-forth detours aren't possible, so we'll confirm the stop order before departing.",
    ko: '경로는 한 방향으로만 진행됩니다 — 왔다 갔다 하는 왕복 경유는 어려워서, 출발 전에 방문 순서를 확정할게요.',
    ja: 'ルートは一方向のみの進行です — 行き来する迂回はできないため、出発前に訪問順を確定します。',
    es: 'La ruta va en una sola dirección: no es posible ir y volver, así que confirmaremos el orden de las paradas antes de salir.',
    zh: '路线只按单一方向行进 — 无法来回绕行，出发前我们会确认游览顺序。',
  },
  {
    en: 'Questions anytime — send text, a photo, or a voice message here and it reaches me in Korean instantly.',
    ko: '궁금한 건 언제든지 — 텍스트·사진·음성을 여기로 보내시면 한국어로 바로 전달됩니다.',
    ja: 'ご質問はいつでも — テキスト・写真・音声をここへ送れば、すぐに韓国語で伝わります。',
    es: 'Pregunten cuando quieran: envíen texto, foto o audio aquí y me llega en coreano al instante.',
    zh: '有问题随时问 — 在这里发送文字、照片或语音，都会立即以韩语传达给我。',
  },
];

/** ₩30,000-style formatting per locale (won symbol reads everywhere). */
function formatRate(rateKrw: number): string {
  return `₩${rateKrw.toLocaleString('en-US')}`;
}

export function composeMorningBriefing(args: {
  kind: BriefingKind;
  baseHours: number;
  rateKrw: number;
}): { source_locale: string; source_text: string; translations: Record<string, string> } {
  const lines = args.kind === 'join' ? JOIN_LINES : PRIVATE_LINES;
  const translations: Record<string, string> = {};
  for (const locale of ROOM_LOCALES) {
    translations[locale] = lines
      .map((line) =>
        line[locale]
          .replaceAll('{hours}', String(args.baseHours))
          .replaceAll('{rate}', formatRate(args.rateKrw)),
      )
      .join('\n');
  }
  return { source_locale: 'en', source_text: translations.en, translations };
}
