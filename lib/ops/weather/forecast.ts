/**
 * 다음날 날씨 예보 → 손님 안내 문구 — M1
 * (`docs/ops-center-settlement-upgrade-plan-2026-07-25.md` §13.1).
 *
 * **Open-Meteo를 쓰는 이유**: 키가 없다. 신규 credential을 만들면 Vercel 환경변수
 * 관리가 하나 늘고, 그 하나가 비어 있는 채로 배포되면 안내 문구가 조용히 사라진다.
 *
 * **좌표를 상수로 두는 이유**: 라이브 `tours.city`는 Jeju·Seoul·Busan **3개뿐**이다.
 * 지오코딩을 붙이는 것은 지금 없는 문제를 푸는 일이고, 실패 지점만 하나 늘린다.
 * 도시가 늘면 여기 한 줄을 추가한다.
 *
 * 🔴 **예보를 못 가져오면 그 줄을 통째로 뺀다.** 빈 `{weather}`가 남은 메시지보다
 * 낫고, 지어낸 날씨는 최악이다 — 손님이 그 문구를 보고 옷을 고른다.
 *
 * 순수 계층(문구 생성)과 IO 계층(fetch)을 나눠 둔다. 문구는 네트워크 없이 테스트된다.
 */

/**
 * G1 후속(2026-07-27) — 룸이 9로케일인데 여기는 6이었다. `weatherLocaleOf`가
 * fr/de/ru/it를 en으로 폴백해서, **프랑스어 안내문 안에 영어 날씨 한 줄**이
 * 섞여 나갔다. 손님이 이 문장을 보고 옷을 고르는데 읽지 못하면 문장이 없는 것만
 * 못하다. 크루즈 서구권(fr/de/it)이 지금 실제 타깃이라 더 미룰 이유가 없다.
 * `zh-TW`는 룸 로케일이 아니지만 번체 손님을 위해 유지한다.
 */
export const WEATHER_LOCALES = ['en', 'ko', 'zh', 'zh-TW', 'es', 'ja', 'fr', 'de', 'ru', 'it'] as const;
export type WeatherLocale = (typeof WEATHER_LOCALES)[number];

/** 라이브에 존재하는 도시. 없는 도시는 예보를 만들지 않는다(지어내지 않는다). */
export const CITY_COORDS: Record<string, { lat: number; lon: number; label: string }> = {
  seoul: { lat: 37.5665, lon: 126.978, label: 'Seoul' },
  busan: { lat: 35.1796, lon: 129.0756, label: 'Busan' },
  jeju: { lat: 33.4996, lon: 126.5312, label: 'Jeju' },
};

export function resolveCity(city: string | null | undefined): keyof typeof CITY_COORDS | null {
  if (!city) return null;
  const key = city.trim().toLowerCase();
  if (key in CITY_COORDS) return key as keyof typeof CITY_COORDS;
  // 한국어 표기도 받는다 — tours.city 는 영문이지만 사람이 넣는 값이 섞일 수 있다.
  if (key.includes('서울')) return 'seoul';
  if (key.includes('부산')) return 'busan';
  if (key.includes('제주')) return 'jeju';
  return null;
}

export interface DailyForecast {
  city: string;
  /** 'YYYY-MM-DD' (KST). */
  date: string;
  tempMinC: number;
  tempMaxC: number;
  /** 강수확률 최대치 (%). */
  precipProbability: number;
  /** 강수량 합 (mm). */
  precipMm: number;
  /** WMO weather code. */
  weatherCode: number;
  /** 최대 풍속 (km/h). */
  windMaxKph: number;
}

// ---------------------------------------------------------------------------
// 순수 — 코드 → 상태, 상태 + 기온 → 문구
// ---------------------------------------------------------------------------

export type SkyState = 'clear' | 'cloudy' | 'rain' | 'snow' | 'storm' | 'fog';

/** WMO code → 상태. https://open-meteo.com/en/docs (weathercode 표) */
export function skyFromCode(code: number): SkyState {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2 || code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 85 && code <= 86) return 'snow';
  if (code >= 95) return 'storm';
  if (code >= 51) return 'rain';
  return 'cloudy';
}

const SKY_LABEL: Record<SkyState, Record<WeatherLocale, string>> = {
  clear: { en: 'clear', ko: '맑음', zh: '晴', 'zh-TW': '晴', es: 'despejado', ja: '晴れ', fr: 'ciel dégagé', de: 'klar', ru: 'ясно', it: 'sereno' },
  cloudy: { en: 'cloudy', ko: '흐림', zh: '多云', 'zh-TW': '多雲', es: 'nublado', ja: 'くもり', fr: 'nuageux', de: 'bewölkt', ru: 'облачно', it: 'nuvoloso' },
  rain: { en: 'rain', ko: '비', zh: '有雨', 'zh-TW': '有雨', es: 'lluvia', ja: '雨', fr: 'pluie', de: 'Regen', ru: 'дождь', it: 'pioggia' },
  snow: { en: 'snow', ko: '눈', zh: '有雪', 'zh-TW': '有雪', es: 'nieve', ja: '雪', fr: 'neige', de: 'Schnee', ru: 'снег', it: 'neve' },
  storm: { en: 'thunderstorms', ko: '뇌우', zh: '雷雨', 'zh-TW': '雷雨', es: 'tormenta', ja: '雷雨', fr: 'orages', de: 'Gewitter', ru: 'гроза', it: 'temporali' },
  fog: { en: 'fog', ko: '안개', zh: '有雾', 'zh-TW': '有霧', es: 'niebla', ja: '霧', fr: 'brouillard', de: 'Nebel', ru: 'туман', it: 'nebbia' },
};

const RAIN_NOTE: Record<WeatherLocale, (p: number) => string> = {
  en: (p) => `${p}% chance of rain`,
  ko: (p) => `강수확률 ${p}%`,
  zh: (p) => `降雨概率 ${p}%`,
  'zh-TW': (p) => `降雨機率 ${p}%`,
  es: (p) => `${p}% de probabilidad de lluvia`,
  ja: (p) => `降水確率 ${p}%`,
  fr: (p) => `${p} % de risque de pluie`,
  de: (p) => `${p} % Regenwahrscheinlichkeit`,
  ru: (p) => `вероятность дождя ${p}%`,
  it: (p) => `${p}% di probabilità di pioggia`,
};

/**
 * 한 줄 예보. 기온은 항상 넣는다 — 손님이 실제로 쓰는 정보가 그것이다.
 * 강수확률은 30% 이상일 때만. 20%를 적어 두면 매일 붙어서 아무도 안 읽는다.
 */
export function weatherLine(forecast: DailyForecast, locale: WeatherLocale): string {
  const sky = SKY_LABEL[skyFromCode(forecast.weatherCode)][locale];
  const min = Math.round(forecast.tempMinC);
  const max = Math.round(forecast.tempMaxC);
  const rain = forecast.precipProbability >= 30 ? `, ${RAIN_NOTE[locale](Math.round(forecast.precipProbability))}` : '';
  return `${sky} ${min}–${max}°C${rain}`;
}

const CLOTHING: Record<WeatherLocale, Record<string, string>> = {
  en: {
    freezing: 'Heavy winter coat, gloves and a hat — it will be below freezing.',
    cold: 'A warm coat and layers you can add or remove.',
    cool: 'A jacket or cardigan — mornings and evenings are chilly.',
    mild: 'Light layers are enough.',
    warm: 'Light, breathable clothes and sunscreen.',
    hot: 'Light clothes, a hat and plenty of water — it will be hot.',
    rain: 'Bring an umbrella or a rain jacket, and shoes that handle wet ground.',
    snow: 'Wear shoes with grip — the ground may be slippery.',
    wind: 'It will be windy, so a windproof layer helps.',
  },
  ko: {
    freezing: '영하권입니다 — 두꺼운 외투와 장갑, 모자를 준비해 주세요.',
    cold: '따뜻한 외투와 겹쳐 입을 수 있는 옷을 권합니다.',
    cool: '아침저녁으로 쌀쌀합니다 — 얇은 겉옷을 챙겨 주세요.',
    mild: '가벼운 겉옷 하나면 충분합니다.',
    warm: '가볍고 통풍 좋은 옷과 자외선 차단제를 준비해 주세요.',
    hot: '더운 날씨입니다 — 가벼운 옷, 모자, 충분한 물을 준비해 주세요.',
    rain: '우산이나 우비, 그리고 젖어도 괜찮은 신발을 준비해 주세요.',
    snow: '바닥이 미끄러울 수 있으니 미끄럼 방지 신발을 권합니다.',
    wind: '바람이 강합니다 — 바람막이가 있으면 좋습니다.',
  },
  zh: {
    freezing: '气温零下，请准备厚外套、手套和帽子。',
    cold: '建议穿保暖外套，方便增减的多层衣物。',
    cool: '早晚偏凉，请带一件薄外套。',
    mild: '一件轻薄外套即可。',
    warm: '建议轻便透气的衣物和防晒霜。',
    hot: '天气炎热，请准备轻便衣物、帽子和充足饮水。',
    rain: '请携带雨伞或雨衣，并穿防水的鞋子。',
    snow: '地面可能湿滑，建议穿防滑鞋。',
    wind: '风较大，建议携带防风外套。',
  },
  'zh-TW': {
    freezing: '氣溫零下，請準備厚外套、手套與帽子。',
    cold: '建議穿保暖外套，方便增減的多層衣物。',
    cool: '早晚偏涼，請帶一件薄外套。',
    mild: '一件輕薄外套即可。',
    warm: '建議輕便透氣的衣物與防曬乳。',
    hot: '天氣炎熱，請準備輕便衣物、帽子與充足飲水。',
    rain: '請攜帶雨傘或雨衣，並穿防水的鞋子。',
    snow: '地面可能濕滑，建議穿防滑鞋。',
    wind: '風較大，建議攜帶防風外套。',
  },
  es: {
    freezing: 'Abrigo de invierno, guantes y gorro — estará bajo cero.',
    cold: 'Un abrigo cálido y capas que pueda quitarse.',
    cool: 'Una chaqueta ligera — las mañanas y noches son frescas.',
    mild: 'Basta con ropa ligera en capas.',
    warm: 'Ropa ligera y transpirable, y protector solar.',
    hot: 'Ropa ligera, sombrero y mucha agua — hará calor.',
    rain: 'Traiga paraguas o chubasquero y calzado resistente al agua.',
    snow: 'Use calzado antideslizante — el suelo puede estar resbaladizo.',
    wind: 'Hará viento; un cortavientos ayuda.',
  },
  ja: {
    freezing: '氷点下です — 厚手のコート、手袋、帽子をご用意ください。',
    cold: '暖かいコートと重ね着できる服をおすすめします。',
    cool: '朝晩は冷えます — 薄手の上着をお持ちください。',
    mild: '軽い上着が一枚あれば十分です。',
    warm: '軽く通気性のよい服と日焼け止めをご用意ください。',
    hot: '暑くなります — 軽装、帽子、十分な水分をご用意ください。',
    rain: '傘またはレインウェアと、濡れても平気な靴をご用意ください。',
    snow: '足元が滑りやすいため、滑りにくい靴をおすすめします。',
    wind: '風が強めです — ウインドブレーカーがあると安心です。',
  },
  fr: {
    freezing: 'Manteau d’hiver, gants et bonnet — il fera en dessous de zéro.',
    cold: 'Un manteau chaud et plusieurs couches que vous pourrez retirer.',
    cool: 'Une veste ou un cardigan — les matinées et les soirées sont fraîches.',
    mild: 'Quelques couches légères suffisent.',
    warm: 'Des vêtements légers et respirants, et de la crème solaire.',
    hot: 'Vêtements légers, chapeau et beaucoup d’eau — il fera chaud.',
    rain: 'Prenez un parapluie ou un imperméable, et des chaussures qui supportent le sol mouillé.',
    snow: 'Portez des chaussures antidérapantes — le sol peut être glissant.',
    wind: 'Il y aura du vent : un coupe-vent est utile.',
  },
  de: {
    freezing: 'Dicker Wintermantel, Handschuhe und Mütze — es wird unter null Grad.',
    cold: 'Ein warmer Mantel und Schichten, die Sie an- und ausziehen können.',
    cool: 'Eine Jacke oder Strickjacke — morgens und abends ist es kühl.',
    mild: 'Leichte Schichten genügen.',
    warm: 'Leichte, atmungsaktive Kleidung und Sonnenschutz.',
    hot: 'Leichte Kleidung, ein Hut und viel Wasser — es wird heiß.',
    rain: 'Nehmen Sie Regenschirm oder Regenjacke mit, und Schuhe für nassen Boden.',
    snow: 'Tragen Sie Schuhe mit gutem Profil — der Boden kann rutschig sein.',
    wind: 'Es wird windig, eine winddichte Schicht hilft.',
  },
  ru: {
    freezing: 'Тёплое зимнее пальто, перчатки и шапка — будет ниже нуля.',
    cold: 'Тёплое пальто и несколько слоёв, которые можно снять.',
    cool: 'Куртка или кардиган — утром и вечером прохладно.',
    mild: 'Достаточно лёгких слоёв одежды.',
    warm: 'Лёгкая дышащая одежда и солнцезащитный крем.',
    hot: 'Лёгкая одежда, головной убор и много воды — будет жарко.',
    rain: 'Возьмите зонт или дождевик и обувь для мокрой погоды.',
    snow: 'Наденьте обувь с нескользящей подошвой — может быть скользко.',
    wind: 'Будет ветрено, пригодится ветрозащитный слой.',
  },
  it: {
    freezing: 'Cappotto invernale pesante, guanti e cappello — si andrà sotto zero.',
    cold: 'Un cappotto caldo e strati che può togliere o aggiungere.',
    cool: 'Una giacca o un cardigan — mattina e sera sono fresche.',
    mild: 'Bastano capi leggeri a strati.',
    warm: 'Abiti leggeri e traspiranti, e crema solare.',
    hot: 'Abiti leggeri, cappello e molta acqua — farà caldo.',
    rain: 'Porti ombrello o giacca impermeabile e scarpe adatte al bagnato.',
    snow: 'Indossi scarpe con buona presa — il terreno può essere scivoloso.',
    wind: 'Ci sarà vento: uno strato antivento aiuta.',
  },
};

/** 기온 밴드. 최고기온이 아니라 **최저기온**이 옷차림을 결정한다(아침 집합). */
export function temperatureBand(tempMinC: number, tempMaxC: number): string {
  if (tempMinC <= 0) return 'freezing';
  if (tempMinC <= 8) return 'cold';
  if (tempMinC <= 15) return 'cool';
  if (tempMaxC >= 30) return 'hot';
  if (tempMaxC >= 25) return 'warm';
  return 'mild';
}

/**
 * 착장 안내. 기온 문장 + (필요하면) 비/눈/바람 한 문장. 두 문장을 넘기지 않는다 —
 * 안내가 길면 정작 중요한 집합 시간이 밀려 안 읽힌다.
 */
export function clothingAdvice(forecast: DailyForecast, locale: WeatherLocale): string {
  const copy = CLOTHING[locale];
  const parts = [copy[temperatureBand(forecast.tempMinC, forecast.tempMaxC)]];
  const sky = skyFromCode(forecast.weatherCode);
  if (sky === 'rain' || sky === 'storm' || forecast.precipProbability >= 50) parts.push(copy.rain);
  else if (sky === 'snow') parts.push(copy.snow);
  else if (forecast.windMaxKph >= 35) parts.push(copy.wind);
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// IO — Open-Meteo
// ---------------------------------------------------------------------------

export const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

/** Open-Meteo 응답에서 필요한 부분만. 스키마가 늘어도 여기만 본다. */
interface OpenMeteoDaily {
  time?: string[];
  temperature_2m_min?: number[];
  temperature_2m_max?: number[];
  precipitation_probability_max?: number[];
  precipitation_sum?: number[];
  weathercode?: number[];
  windspeed_10m_max?: number[];
}

export function parseOpenMeteo(
  json: { daily?: OpenMeteoDaily } | null | undefined,
  city: string,
  date: string,
): DailyForecast | null {
  const daily = json?.daily;
  if (!daily?.time) return null;
  const i = daily.time.indexOf(date);
  if (i === -1) return null;

  const num = (arr: number[] | undefined, fallback: number | null): number | null => {
    const v = arr?.[i];
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  };

  const tempMinC = num(daily.temperature_2m_min, null);
  const tempMaxC = num(daily.temperature_2m_max, null);
  // 기온이 없으면 예보가 아니다 — 부분 데이터로 문구를 만들지 않는다.
  if (tempMinC == null || tempMaxC == null) return null;

  return {
    city,
    date,
    tempMinC,
    tempMaxC,
    precipProbability: num(daily.precipitation_probability_max, 0) ?? 0,
    precipMm: num(daily.precipitation_sum, 0) ?? 0,
    weatherCode: num(daily.weathercode, 3) ?? 3,
    windMaxKph: num(daily.windspeed_10m_max, 0) ?? 0,
  };
}

/**
 * 예보 1일치. 실패하면 **null** — 호출부는 그 줄을 빼야지 빈 값을 넣으면 안 된다.
 * 타임아웃을 두는 이유: 안내 메시지 화면이 외부 API 때문에 멈추면 안 된다.
 */
export async function fetchDailyForecast(
  city: string | null | undefined,
  date: string,
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<DailyForecast | null> {
  const key = resolveCity(city);
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const coords = CITY_COORDS[key];

  const url =
    `${OPEN_METEO_URL}?latitude=${coords.lat}&longitude=${coords.lon}` +
    '&daily=temperature_2m_min,temperature_2m_max,precipitation_probability_max,precipitation_sum,weathercode,windspeed_10m_max' +
    `&timezone=Asia%2FSeoul&start_date=${date}&end_date=${date}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 6000);
  try {
    const doFetch = opts.fetchImpl ?? fetch;
    const res = await doFetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) return null;
    const json = (await res.json()) as { daily?: OpenMeteoDaily };
    return parseOpenMeteo(json, coords.label, date);
  } catch {
    // 네트워크·타임아웃·파싱 실패 전부 "예보 없음"이다.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 로케일 정규화 — 계약에 없는 코드는 영어로. */
export function weatherLocaleOf(locale: string | null | undefined): WeatherLocale {
  const code = (locale ?? 'en').trim().toLowerCase();
  if (code.startsWith('zh')) return code.includes('tw') || code.includes('hant') ? 'zh-TW' : 'zh';
  const base = code.split(/[-_]/)[0];
  return (WEATHER_LOCALES as readonly string[]).includes(base) ? (base as WeatherLocale) : 'en';
}
