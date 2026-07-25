/**
 * 다음날 예보 → 안내 문구 — M1.
 *
 * 지켜야 하는 것: **지어내지 않는다.** 예보를 못 가져오면 null이어야 하고,
 * 부분 데이터로 그럴듯한 문구를 만들면 안 된다 — 손님이 그 문구를 보고 옷을 고른다.
 */

import {
  CITY_COORDS,
  clothingAdvice,
  fetchDailyForecast,
  parseOpenMeteo,
  resolveCity,
  skyFromCode,
  temperatureBand,
  weatherLine,
  weatherLocaleOf,
  type DailyForecast,
} from '../forecast';

function forecast(over: Partial<DailyForecast> = {}): DailyForecast {
  return {
    city: 'Seoul',
    date: '2026-08-03',
    tempMinC: 22,
    tempMaxC: 29,
    precipProbability: 10,
    precipMm: 0,
    weatherCode: 1,
    windMaxKph: 8,
    ...over,
  };
}

describe('resolveCity', () => {
  it('resolves the three cities that actually exist in tours.city', () => {
    expect(resolveCity('Seoul')).toBe('seoul');
    expect(resolveCity('busan')).toBe('busan');
    expect(resolveCity('  Jeju ')).toBe('jeju');
  });

  it('accepts the Korean spellings a human might type', () => {
    expect(resolveCity('서울')).toBe('seoul');
    expect(resolveCity('제주도')).toBe('jeju');
  });

  it('returns null for a city we have no coordinates for', () => {
    // 모르는 도시에 서울 좌표를 붙이면 틀린 날씨를 자신 있게 보내게 된다.
    expect(resolveCity('Gyeongju')).toBeNull();
    expect(resolveCity(null)).toBeNull();
    expect(resolveCity('')).toBeNull();
  });

  it('has coordinates for every city it claims to resolve', () => {
    for (const key of ['seoul', 'busan', 'jeju']) {
      expect(CITY_COORDS[key]).toBeDefined();
      expect(Math.abs(CITY_COORDS[key].lat)).toBeGreaterThan(0);
    }
  });
});

describe('skyFromCode', () => {
  it('maps the WMO bands we act on', () => {
    expect(skyFromCode(0)).toBe('clear');
    expect(skyFromCode(3)).toBe('cloudy');
    expect(skyFromCode(48)).toBe('fog');
    expect(skyFromCode(61)).toBe('rain');
    expect(skyFromCode(73)).toBe('snow');
    expect(skyFromCode(86)).toBe('snow');
    expect(skyFromCode(95)).toBe('storm');
  });
});

describe('temperatureBand', () => {
  it('decides on the morning low, not the afternoon high', () => {
    // 집합은 아침이다 — 최고 25도라도 아침이 5도면 외투가 필요하다.
    expect(temperatureBand(5, 25)).toBe('cold');
    expect(temperatureBand(-2, 6)).toBe('freezing');
    expect(temperatureBand(12, 20)).toBe('cool');
    expect(temperatureBand(20, 27)).toBe('warm');
    expect(temperatureBand(24, 33)).toBe('hot');
    expect(temperatureBand(18, 22)).toBe('mild');
  });
});

describe('weatherLine', () => {
  it('always carries the temperature range', () => {
    expect(weatherLine(forecast(), 'ko')).toContain('22–29°C');
    expect(weatherLine(forecast(), 'en')).toContain('22–29°C');
  });

  it('mentions rain only when it is worth mentioning', () => {
    // 20%를 매일 적으면 아무도 안 읽는다.
    expect(weatherLine(forecast({ precipProbability: 20 }), 'ko')).not.toContain('강수확률');
    expect(weatherLine(forecast({ precipProbability: 60 }), 'ko')).toContain('강수확률 60%');
  });

  it('renders in each supported locale', () => {
    expect(weatherLine(forecast(), 'ja')).toContain('晴れ');
    expect(weatherLine(forecast({ weatherCode: 61 }), 'zh-TW')).toContain('有雨');
    expect(weatherLine(forecast(), 'es')).toContain('despejado');
  });
});

describe('clothingAdvice', () => {
  it('adds a rain sentence when rain is likely', () => {
    const advice = clothingAdvice(forecast({ weatherCode: 61, precipProbability: 70 }), 'ko');
    expect(advice).toContain('우산');
  });

  it('adds a slip warning for snow instead of the rain one', () => {
    const advice = clothingAdvice(forecast({ weatherCode: 73, tempMinC: -3, tempMaxC: 2 }), 'ko');
    expect(advice).toContain('미끄');
    expect(advice).not.toContain('우산');
  });

  it('mentions wind only when it is actually strong', () => {
    expect(clothingAdvice(forecast({ windMaxKph: 10 }), 'ko')).not.toContain('바람');
    expect(clothingAdvice(forecast({ windMaxKph: 45 }), 'ko')).toContain('바람');
  });

  it('never runs past two sentences', () => {
    // 안내가 길면 정작 중요한 집합 시간이 밀려 안 읽힌다.
    const advice = clothingAdvice(
      forecast({ weatherCode: 95, precipProbability: 90, windMaxKph: 60, tempMinC: -5, tempMaxC: 1 }),
      'ko',
    );
    expect(advice.split(/[.。]/).filter((s) => s.trim()).length).toBeLessThanOrEqual(2);
  });
});

describe('parseOpenMeteo', () => {
  const payload = {
    daily: {
      time: ['2026-08-02', '2026-08-03'],
      temperature_2m_min: [21, 22],
      temperature_2m_max: [28, 29],
      precipitation_probability_max: [5, 40],
      precipitation_sum: [0, 3.2],
      weathercode: [1, 61],
      windspeed_10m_max: [7, 12],
    },
  };

  it('picks the row matching the requested date, not the first one', () => {
    const parsed = parseOpenMeteo(payload, 'Seoul', '2026-08-03');
    expect(parsed?.tempMinC).toBe(22);
    expect(parsed?.weatherCode).toBe(61);
    expect(parsed?.precipProbability).toBe(40);
  });

  it('returns null when the date is not in the response', () => {
    expect(parseOpenMeteo(payload, 'Seoul', '2026-09-01')).toBeNull();
  });

  it('returns null when the temperature is missing — a forecast without it is not a forecast', () => {
    const broken = { daily: { ...payload.daily, temperature_2m_min: [null as unknown as number, null as unknown as number] } };
    expect(parseOpenMeteo(broken, 'Seoul', '2026-08-03')).toBeNull();
  });

  it('defaults the optional fields rather than dropping the whole forecast', () => {
    const partial = { daily: { time: ['2026-08-03'], temperature_2m_min: [10], temperature_2m_max: [18] } };
    const parsed = parseOpenMeteo(partial, 'Seoul', '2026-08-03');
    expect(parsed).not.toBeNull();
    expect(parsed?.precipProbability).toBe(0);
  });

  it('returns null for a malformed body', () => {
    expect(parseOpenMeteo(null, 'Seoul', '2026-08-03')).toBeNull();
    expect(parseOpenMeteo({}, 'Seoul', '2026-08-03')).toBeNull();
  });
});

describe('fetchDailyForecast', () => {
  it('does not call the network for a city it has no coordinates for', async () => {
    const spy = jest.fn();
    expect(await fetchDailyForecast('Gyeongju', '2026-08-03', { fetchImpl: spy as unknown as typeof fetch })).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns null instead of throwing when the request fails', async () => {
    const failing = (() => Promise.reject(new Error('network down'))) as unknown as typeof fetch;
    expect(await fetchDailyForecast('Seoul', '2026-08-03', { fetchImpl: failing })).toBeNull();
  });

  it('returns null on a non-ok response', async () => {
    const notOk = (() => Promise.resolve({ ok: false } as Response)) as unknown as typeof fetch;
    expect(await fetchDailyForecast('Seoul', '2026-08-03', { fetchImpl: notOk })).toBeNull();
  });

  it('parses a good response', async () => {
    const good = (() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          daily: {
            time: ['2026-08-03'],
            temperature_2m_min: [22],
            temperature_2m_max: [29],
            precipitation_probability_max: [40],
            precipitation_sum: [3],
            weathercode: [61],
            windspeed_10m_max: [12],
          },
        }),
      } as unknown as Response)) as unknown as typeof fetch;
    const result = await fetchDailyForecast('Seoul', '2026-08-03', { fetchImpl: good });
    expect(result?.city).toBe('Seoul');
    expect(result?.tempMaxC).toBe(29);
  });

  it('rejects a malformed date without calling out', async () => {
    const spy = jest.fn();
    expect(await fetchDailyForecast('Seoul', '2026-8-3', { fetchImpl: spy as unknown as typeof fetch })).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('weatherLocaleOf', () => {
  it('keeps the two Chinese variants apart', () => {
    expect(weatherLocaleOf('zh-TW')).toBe('zh-TW');
    expect(weatherLocaleOf('zh-Hant')).toBe('zh-TW');
    expect(weatherLocaleOf('zh-CN')).toBe('zh');
  });

  it('falls back to English for a locale it has no copy for', () => {
    expect(weatherLocaleOf('de')).toBe('en');
    expect(weatherLocaleOf(null)).toBe('en');
  });

  it('strips the region from ordinary locales', () => {
    expect(weatherLocaleOf('en-GB')).toBe('en');
    expect(weatherLocaleOf('ja_JP')).toBe('ja');
  });
});
