/**
 * B6 — tour-day weather line + rule-based clothing hint.
 * (docs/smart-guide-ops-detail-audit-2026-07-21.md)
 */
import { cityCoords, fetchDayWeather, renderWeatherLines } from '@/lib/tour-room/weather';

describe('cityCoords', () => {
  it('matches Korean and English city spellings; unknown → null', () => {
    expect(cityCoords('Jeju')).not.toBeNull();
    expect(cityCoords('제주')).not.toBeNull();
    expect(cityCoords('부산')).not.toBeNull();
    expect(cityCoords('Atlantis')).toBeNull();
    expect(cityCoords(null)).toBeNull();
  });
});

describe('renderWeatherLines', () => {
  it('interpolates the numbers into all locales', () => {
    const lines = renderWeatherLines({ tminC: 21, tmaxC: 27, rainProbPct: 20, windMaxMs: 4 });
    expect(lines.ko).toBe('🌤️ 오늘 날씨: 21–27°C, 강수확률 20%.');
    expect(lines.en).toContain('21–27°C');
  });

  it('rain ≥ 50% wins the hint over cold and wind', () => {
    const lines = renderWeatherLines({ tminC: 2, tmaxC: 8, rainProbPct: 70, windMaxMs: 15 });
    expect(lines.ko).toContain('우산');
    expect(lines.ko).not.toContain('겉옷');
  });

  it('cold and wind hints fire in order', () => {
    expect(renderWeatherLines({ tminC: 1, tmaxC: 8, rainProbPct: 0, windMaxMs: 2 }).ko).toContain('겉옷');
    expect(renderWeatherLines({ tminC: 15, tmaxC: 20, rainProbPct: 0, windMaxMs: 12 }).ko).toContain('바람막이');
    expect(renderWeatherLines({ tminC: 20, tmaxC: 26, rainProbPct: 10, windMaxMs: 3 }).ko).not.toContain('—');
  });
});

describe('fetchDayWeather', () => {
  it('parses the Open-Meteo daily shape', async () => {
    const fetcher = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        daily: {
          temperature_2m_min: [20.6],
          temperature_2m_max: [27.4],
          precipitation_probability_max: [55],
          wind_speed_10m_max: [8.2],
        },
      }),
    })) as unknown as typeof fetch;
    const weather = await fetchDayWeather({ lat: 33.5, lng: 126.5 }, '2099-07-21', fetcher);
    expect(weather).toEqual({ tminC: 21, tmaxC: 27, rainProbPct: 55, windMaxMs: 8 });
  });

  it('null on HTTP failure or malformed payload', async () => {
    const bad = jest.fn(async () => ({ ok: false })) as unknown as typeof fetch;
    expect(await fetchDayWeather({ lat: 1, lng: 1 }, '2099-01-01', bad)).toBeNull();
    const empty = jest.fn(async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch;
    expect(await fetchDayWeather({ lat: 1, lng: 1 }, '2099-01-01', empty)).toBeNull();
  });
});
