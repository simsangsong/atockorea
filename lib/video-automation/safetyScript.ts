/**
 * The 30-second safety video script — 10 languages, as data (plan §5.6/§5.7).
 *
 * The film itself is a human deliverable that does not exist yet: a silent,
 * 1080×1920 pictogram render with the chapter structure below (§5.7.1). What
 * DOES exist is this script and the `.vtt` tracks generated from it
 * (`npm run safety:vtt` → public/videos/safety-intro-30s/subtitles/), so the
 * day the MP4 lands it plays with subtitles in all ten languages with no code
 * change.
 *
 * Tone rule: factual and sober. These are three legal/safety obligations, not
 * marketing copy. Every claim here is one we can stand behind:
 *   - seatbelts on all seats — Korean Road Traffic Act;
 *   - tourist sites are non-smoking, fines up to ₩100,000;
 *   - do not talk to the driver while the vehicle is moving — use the app chat.
 *
 * Wording is the plan's §5.7.2–§5.7.11 text, kept verbatim so the audited
 * translations are not silently re-authored here.
 */

/** Subtitle languages, matching lib/tour-room/safetyVideo.ts. */
export const SAFETY_SCRIPT_LOCALES = [
  'en',
  'ko',
  'zh-TW',
  'zh-CN',
  'ja',
  'es',
  'de',
  'fr',
  'it',
  'ru',
] as const;

export type SafetyScriptLocale = (typeof SAFETY_SCRIPT_LOCALES)[number];

export interface SafetyCue {
  /** Chapter id (also the WebVTT cue identifier). */
  id: string;
  /** Seconds from the start of the render. */
  start: number;
  end: number;
  /** What the pictogram shows — the brief for whoever produces the film. */
  visual: string;
  text: Record<SafetyScriptLocale, string>;
}

export const SAFETY_VIDEO_DURATION_SECONDS = 30;

/** §5.7.1 chapter structure + §5.7.2–11 subtitle text. */
export const SAFETY_SCRIPT_CUES: readonly SafetyCue[] = [
  {
    id: 'opening',
    start: 0,
    end: 3,
    visual: 'AtoC logo fade-in',
    text: {
      en: 'Welcome — 3 quick rules for a smooth ride',
      ko: '환영합니다 — 편안한 여행을 위한 3가지 안내',
      'zh-TW': '歡迎 — 舒適旅程的3項提醒',
      'zh-CN': '欢迎 — 舒适旅程的3项提醒',
      ja: 'ようこそ — 快適な旅のための3つのお願い',
      es: 'Bienvenido — 3 reglas para un viaje cómodo',
      de: 'Willkommen — 3 Regeln für eine entspannte Fahrt',
      fr: 'Bienvenue — 3 règles pour un trajet agréable',
      it: 'Benvenuto — 3 regole per un viaggio confortevole',
      ru: 'Добро пожаловать — 3 правила для комфортной поездки',
    },
  },
  {
    id: 'rule-seatbelt',
    start: 3,
    end: 10,
    visual: 'Rule 1 — seatbelt pictogram, front and rear seats',
    text: {
      en: 'Seatbelts on — all seats, front and back\n(Korean law)',
      ko: '안전벨트 착용 — 앞·뒷좌석 모두\n(한국 법규)',
      'zh-TW': '全程繫上安全帶 — 前後座皆須\n(韓國法規)',
      'zh-CN': '全程系上安全带 — 前后座都需要\n(韩国法规)',
      ja: '全席シートベルト着用\n(韓国の法律)',
      es: 'Cinturones abrochados — todos los asientos\n(Ley coreana)',
      de: 'Bitte anschnallen — auf allen Sitzen\n(Koreanisches Gesetz)',
      fr: 'Ceintures attachées — à toutes les places\n(Loi coréenne)',
      it: 'Cinture allacciate — su tutti i sedili\n(Legge coreana)',
      ru: 'Пристегните ремни — на всех сиденьях\n(Закон Кореи)',
    },
  },
  {
    id: 'rule-no-smoking',
    start: 10,
    end: 18,
    visual: 'Rule 2 — no-smoking pictogram, vehicle + tourist site',
    text: {
      en: 'No smoking — in the car and at all tourist sites\n(Fine up to ₩100,000)',
      ko: '차내·전 관광지 금연\n(과태료 최대 10만원)',
      'zh-TW': '車內與所有景點禁止吸煙\n(最高罰款10萬韓元)',
      'zh-CN': '车内与所有景点禁止吸烟\n(最高罚款10万韩元)',
      ja: '車内・全観光地で禁煙\n(最大10万ウォンの罰金)',
      es: 'No fumar — en el vehículo y en sitios turísticos\n(Multa hasta ₩100.000)',
      de: 'Rauchen verboten — im Fahrzeug und an allen Sehenswürdigkeiten\n(Bußgeld bis ₩100.000)',
      fr: 'Interdiction de fumer — dans le véhicule et sur tous les sites\n(Amende jusqu’à 100 000 ₩)',
      it: 'Vietato fumare — in auto e in tutti i siti turistici\n(Multa fino a ₩100.000)',
      ru: 'Курение запрещено — в машине и на всех достопримечательностях\n(Штраф до ₩100 000)',
    },
  },
  {
    id: 'rule-driver-chat',
    start: 18,
    end: 26,
    visual: 'Rule 3 — no talking to the driver while moving; use the app chat',
    text: {
      en: "Please don't talk to the driver while moving — use the app chat\n(Korean traffic law)",
      ko: '주행 중 기사님과 직접 대화 금지 — 앱 채팅 사용\n(도로교통법)',
      'zh-TW': '行駛中請勿與司機交談 — 請使用APP聊天\n(道路交通法)',
      'zh-CN': '行驶中请勿与司机交谈 — 请使用APP聊天\n(道路交通法)',
      ja: '走行中は運転手と直接会話しない — アプリチャットをご利用\n(道路交通法)',
      es: 'No hable con el conductor en marcha — use el chat\n(Ley de tráfico coreana)',
      de: 'Bitte sprechen Sie während der Fahrt nicht mit dem Fahrer — nutzen Sie den App-Chat\n(Straßenverkehrsordnung)',
      fr: "Ne parlez pas au chauffeur en roulant — utilisez le chat de l’app\n(Code de la route)",
      it: "Non parli con l'autista in movimento — usi la chat dell'app\n(Codice della strada)",
      ru: 'Не разговаривайте с водителем во время движения — используйте чат приложения\n(ПДД Кореи)',
    },
  },
  {
    id: 'confirm',
    start: 26,
    end: 29,
    visual: 'Large seatbelt icon — the confirm gesture',
    text: {
      en: 'Tap the seatbelt to continue',
      ko: '안전벨트를 눌러 계속하세요',
      'zh-TW': '點擊安全帶繼續',
      'zh-CN': '点击安全带继续',
      ja: 'シートベルトをタップして続行',
      es: 'Toque el cinturón para continuar',
      de: 'Zum Fortfahren auf den Gurt tippen',
      fr: 'Touchez la ceinture pour continuer',
      it: 'Tocchi la cintura per continuare',
      ru: 'Нажмите на ремень безопасности для продолжения',
    },
  },
  {
    id: 'closing',
    start: 29,
    end: 30,
    visual: 'AtoC logo fade-out',
    text: {
      en: 'Enjoy your day 🌿',
      ko: '즐거운 하루 되세요 🌿',
      'zh-TW': '祝您旅途愉快 🌿',
      'zh-CN': '祝您旅途愉快 🌿',
      ja: '良い一日を 🌿',
      es: 'Disfrute su día 🌿',
      de: 'Genießen Sie Ihren Tag 🌿',
      fr: 'Bonne journée 🌿',
      it: 'Buona giornata 🌿',
      ru: 'Хорошего дня 🌿',
    },
  },
];

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

/** Seconds → "HH:MM:SS.mmm" (same format as lib/video-automation/subtitles.ts). */
export function safetyVttTime(totalSeconds: number): string {
  const millis = Math.round((totalSeconds % 1) * 1000);
  const whole = Math.floor(totalSeconds);
  return `${pad(Math.floor(whole / 3600))}:${pad(Math.floor(whole / 60) % 60)}:${pad(whole % 60)}.${pad(millis, 3)}`;
}

/** One locale's complete WebVTT document. */
export function buildSafetyVtt(locale: SafetyScriptLocale): string {
  const cues = SAFETY_SCRIPT_CUES.map((cue) =>
    [cue.id, `${safetyVttTime(cue.start)} --> ${safetyVttTime(cue.end)}`, cue.text[locale]].join('\n'),
  );
  return ['WEBVTT', ...cues].join('\n\n') + '\n';
}

/** Chapter/duration sidecar written next to the tracks (§5.6.2 metadata.json). */
export function safetyVideoMetadata(): {
  duration: number;
  resolution: { width: number; height: number };
  audio: 'silent';
  locales: string[];
  chapters: Array<{ id: string; start: number; end: number; visual: string }>;
} {
  return {
    duration: SAFETY_VIDEO_DURATION_SECONDS,
    resolution: { width: 1080, height: 1920 },
    audio: 'silent',
    locales: [...SAFETY_SCRIPT_LOCALES],
    chapters: SAFETY_SCRIPT_CUES.map(({ id, start, end, visual }) => ({ id, start, end, visual })),
  };
}
