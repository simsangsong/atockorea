/**
 * C-16 card ⑤ — manners + punctuality (`briefing_etiquette`).
 *
 * The three things a Korean day-tour actually needs a foreign guest to know
 * (v1.2 §5.5 cards 6/7/8, folded into one card so the stack stays scannable):
 *   - attraction etiquette (every tourist site is non-smoking, temples and
 *     royal tombs are working religious/heritage sites, bins are rare);
 *   - punctuality at the rally point (the countdown at the top of the screen
 *     is the contract — the whole vehicle waits for the last person);
 *   - how to talk to the driver: not while the vehicle is moving. The room
 *     already ships one-tap, pre-translated guest presets
 *     (lib/tour-room/quickReplies.ts, `customer` set) — this card points at
 *     them rather than inventing a second phrasebook.
 *
 * Pre-translated 5-locale constants, zero LLM at send time.
 */

import { capsuleFrom, joinLocaleLines, type ComposedBriefingCard } from '@/lib/ops/seating/cards/types';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

/** The `metadata` contract of a `briefing_etiquette` message row. */
export interface BriefingEtiquetteMeta {
  kind: 'briefing_etiquette';
  /** The card renders a pointer to the composer's quick-reply presets. */
  preset_hint: boolean;
  tour_date?: string | null;
  [key: string]: unknown;
}

const ETIQUETTE_LINES: Array<Record<RoomLocale, string>> = [
  {
    en: 'A few local manners — they make the day smoother for everyone. 🏞',
    ko: '현지 매너 안내 — 모두가 편안한 하루를 위해 부탁드려요. 🏞',
    ja: '現地でのマナーについて — 皆さまが気持ちよく過ごせるように。🏞',
    es: 'Algunas normas locales: hacen el día más fácil para todos. 🏞',
    zh: '几点当地礼仪 — 让大家的一天都更顺利。🏞',
  },
  {
    en: 'Korean tourist sites are entirely non-smoking, including outdoor areas — fines reach ₩100,000.',
    ko: '한국의 관광지는 실외를 포함해 전면 금연이에요 — 과태료가 최대 10만원입니다.',
    ja: '韓国の観光地は屋外を含め全面禁煙です — 過料は最大10万ウォンです。',
    es: 'Los lugares turísticos coreanos son totalmente libres de humo, incluso al aire libre: la multa llega a ₩100.000.',
    zh: '韩国景区全面禁烟，包括户外区域 — 罚款最高10万韩元。',
  },
  {
    en: 'At temples and royal tombs, keep your voice low, stay on the marked paths, and ask before photographing people.',
    ko: '사찰과 왕릉에서는 목소리를 낮추고 지정된 길로만 이동해 주세요. 사람을 촬영할 때는 먼저 양해를 구해주세요.',
    ja: '寺院や王陵では声を抑え、指定された道を通り、人を撮影する際はひと言お声がけください。',
    es: 'En templos y tumbas reales, hablen bajo, sigan los caminos señalizados y pidan permiso antes de fotografiar a alguien.',
    zh: '在寺庙与王陵请放低音量、沿指定路线参观，拍摄他人前请先征得同意。',
  },
  {
    en: 'Public bins are rare in Korea — please carry your rubbish back to the vehicle.',
    ko: '한국은 길거리 쓰레기통이 드물어요 — 쓰레기는 차량으로 가져와 주세요.',
    ja: '韓国は街のゴミ箱が少ないです — ゴミは車両までお持ちください。',
    es: 'Las papeleras públicas escasean en Corea: traigan su basura de vuelta al vehículo.',
    zh: '韩国街头垃圾桶很少 — 请将垃圾带回车上。',
  },
  {
    en: 'Please be back at the meeting point before the countdown at the top of your screen runs out — the whole group waits for the last person.',
    ko: '화면 위 카운트다운이 끝나기 전에 집합 장소로 돌아와 주세요 — 마지막 한 분을 일행 전체가 기다리게 됩니다.',
    ja: '画面上部のカウントダウンが終わる前に集合場所へお戻りください — 最後のお一人を全員でお待ちすることになります。',
    es: 'Vuelvan al punto de encuentro antes de que acabe la cuenta atrás de la parte superior: todo el grupo espera al último.',
    zh: '请在屏幕顶部倒计时结束前回到集合点 — 全团都会等待最后一位。',
  },
  {
    en: 'Please do not talk to the driver while the vehicle is moving (Korean traffic law). Use the one-tap phrases in the message box instead — "restroom", "too cold", "carsick" and more are already translated.',
    ko: '주행 중에는 기사님과 직접 대화하지 말아 주세요 (도로교통법). 대신 메시지 입력창의 원탭 문구를 사용해 주세요 — 화장실·추워요·멀미 등 이미 번역되어 있습니다.',
    ja: '走行中は運転手に話しかけないでください（道路交通法）。代わりにメッセージ入力欄のワンタップ定型文をご利用ください — トイレ・寒い・車酔いなど翻訳済みです。',
    es: 'No hablen con el conductor en marcha (ley de tráfico coreana). Usen las frases de un toque del cuadro de mensajes: «baño», «hace frío», «mareo» y más ya están traducidas.',
    zh: '行驶中请勿与司机交谈（道路交通法）。请改用消息输入框里的一键短语 — 洗手间、太冷、晕车等都已翻译好。',
  },
];

/** Card chrome — the 5-locale labels the guest component renders. */
export const ETIQUETTE_COPY: Record<
  RoomLocale,
  { title: string; sites: string; time: string; driver: string; presetHint: string }
> = {
  en: {
    title: 'Manners & timing',
    sites: 'At the sites',
    time: 'Meeting times',
    driver: 'Talking to the driver',
    presetHint: 'One-tap phrases live in the message box below.',
  },
  ko: {
    title: '매너·시간 안내',
    sites: '관광지에서',
    time: '집합 시간',
    driver: '기사님과 소통',
    presetHint: '아래 메시지 입력창에 원탭 문구가 준비되어 있어요.',
  },
  ja: {
    title: 'マナーと時間',
    sites: '観光地では',
    time: '集合時間',
    driver: 'ドライバーとの連絡',
    presetHint: '下のメッセージ入力欄にワンタップ定型文があります。',
  },
  es: {
    title: 'Normas y horarios',
    sites: 'En los lugares',
    time: 'Horas de encuentro',
    driver: 'Hablar con el conductor',
    presetHint: 'Las frases de un toque están en el cuadro de mensajes.',
  },
  zh: {
    title: '礼仪与时间',
    sites: '在景点',
    time: '集合时间',
    driver: '与司机沟通',
    presetHint: '一键短语就在下方的消息输入框里。',
  },
};

export interface ComposeEtiquetteArgs {
  tourDate?: string | null;
}

export function composeEtiquetteTranslations(): Record<RoomLocale, string> {
  return joinLocaleLines(ETIQUETTE_LINES);
}

export function composeEtiquette(args: ComposeEtiquetteArgs = {}): ComposedBriefingCard {
  const meta: BriefingEtiquetteMeta = {
    kind: 'briefing_etiquette',
    preset_hint: true,
    tour_date: args.tourDate ?? null,
  };
  return capsuleFrom(composeEtiquetteTranslations(), meta as unknown as Record<string, unknown>);
}
