import { buildInstantAnswer } from "@/lib/chatbot/instantAnswers";

const TODAY = "2026-07-05";

const base = { locale: "en" as const, tourSlug: null, todayISO: TODAY, intent: "unknown" };

describe("W6.7 haenyeo instant answer", () => {
  it("answers the schedule deterministically with 14:00 (en/ko)", async () => {
    const en = await buildInstantAnswer({ ...base, message: "What time is the haenyeo show at Seongsan?" });
    expect(en?.kind).toBe("haenyeo");
    expect(en?.reply).toContain("14:00");
    const ko = await buildInstantAnswer({ ...base, locale: "ko", message: "해녀 공연 몇 시에 해요?" });
    expect(ko?.reply).toContain("매일 14:00");
    expect(ko?.chips.length).toBeGreaterThan(0);
  });

  it("does not hijack a general haenyeo culture question", async () => {
    const r = await buildInstantAnswer({ ...base, message: "Tell me about haenyeo history and culture" });
    expect(r).toBeNull();
  });
});

describe("W6.1 availability instant answer", () => {
  it("confirms on-demand availability and echoes a future date", async () => {
    const r = await buildInstantAnswer({ ...base, message: "Do you have availability on 2026-10-10?" });
    expect(r?.kind).toBe("availability");
    expect(r?.reply).toContain("2026-10-10");
    expect(r?.reply.toLowerCase()).toContain("on-demand");
    expect(r?.chips.length).toBeGreaterThan(0);
  });

  it("works in Korean and resolves relative dates in KST", async () => {
    const r = await buildInstantAnswer({ ...base, locale: "ko", message: "내일 자리 있나요?" });
    expect(r?.kind).toBe("availability");
    expect(r?.reply).toContain("2026-07-06");
  });

  it("never echoes a past date", async () => {
    const r = await buildInstantAnswer({ ...base, message: "Was 2020-01-01 available?" });
    expect(r?.kind).toBe("availability");
    expect(r?.reply).not.toContain("2020-01-01");
  });

  it("stays silent on unrelated messages", async () => {
    expect(await buildInstantAnswer({ ...base, message: "Recommend a relaxed tour for seniors" })).toBeNull();
  });
});

describe("W6.6 weather instant answer", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  function mockForecast(days: number) {
    const time = Array.from({ length: days }, (_, i) => {
      const d = new Date(`${TODAY}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i);
      return d.toISOString().slice(0, 10);
    });
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        daily: {
          time,
          weather_code: time.map(() => 3),
          temperature_2m_max: time.map(() => 29),
          temperature_2m_min: time.map(() => 23),
          precipitation_probability_max: time.map(() => 40),
        },
      }),
    })) as unknown as typeof fetch;
  }

  it("summarizes the requested relative date for a region anchor", async () => {
    mockForecast(16);
    const r = await buildInstantAnswer({ ...base, message: "What's the weather in Jeju tomorrow?" });
    expect(r?.kind).toBe("weather");
    expect(r?.reply).toContain("2026-07-06");
    expect(r?.reply).toContain("°C");
    expect(r?.reply).toContain("Jeju");
  });

  it("is honest beyond the 16-day window", async () => {
    mockForecast(16);
    const r = await buildInstantAnswer({ ...base, message: "Weather in Busan on 2026-09-20?" });
    expect(r?.kind).toBe("weather");
    expect(r?.reply).toContain("2026-09-20");
    expect(r?.reply.toLowerCase()).toContain("forecast window");
  });

  it("falls through (null) when the forecast fetch fails", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const r = await buildInstantAnswer({ ...base, message: "Will it rain in Seoul tomorrow?" });
    expect(r).toBeNull();
  });

  it("needs region context — no region and no tour slug stays silent", async () => {
    mockForecast(16);
    const r = await buildInstantAnswer({ ...base, message: "What's the weather like tomorrow?" });
    expect(r).toBeNull();
  });

  it("uses the tour anchor when asked on a tour page", async () => {
    mockForecast(16);
    const r = await buildInstantAnswer({
      ...base,
      tourSlug: "seoul-dmz-private-3rd-tunnel-suspension-bridge",
      message: "what will the weather be like tomorrow?",
    });
    expect(r?.kind).toBe("weather");
    expect(r?.reply).toContain("DMZ");
  });
});

describe("intent gating (post-batch12)", () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it("weather fires for policy-classified forecast questions without policy words", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ daily: { time: ["2026-07-05", "2026-07-06"], weather_code: [1, 1], temperature_2m_max: [30, 30], temperature_2m_min: [24, 24], precipitation_probability_max: [10, 10] } }),
    })) as unknown as typeof fetch;
    const r = await buildInstantAnswer({ ...base, intent: "policy", message: "What's the weather in Jeju tomorrow?" });
    expect(r?.kind).toBe("weather");
  });

  it("weather stays silent on rain-cancellation POLICY questions", async () => {
    const r = await buildInstantAnswer({ ...base, intent: "policy", message: "If it rains in Jeju do I get a refund or can I cancel?" });
    expect(r).toBeNull();
  });

  it("availability does not fire for recommendation-classified turns", async () => {
    const r = await buildInstantAnswer({ ...base, intent: "tour_recommendation", message: "which tours are available?" });
    expect(r).toBeNull();
  });
});
