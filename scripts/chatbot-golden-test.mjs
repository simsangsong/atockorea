#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Chatbot golden test battery (§E of docs/chatbot-excellence-master-plan-2026-07-04.md)
//
// The exit gate for every chatbot wave: runs deterministic + content assertions
// against a live server (production by default) and prints a report card.
//
// Usage:
//   node --env-file=.env.local scripts/chatbot-golden-test.mjs [flags]
//   npm run chatbot:golden -- --base http://localhost:3000 --writes
//
// Flags:
//   --base <url>     Target origin (default https://www.atockorea.com)
//   --suite a,b      Run only these suites (default: all read-only suites)
//   --writes         Also run suites that WRITE to the live DB (quote booking,
//                    handoff ticket). Every artifact is cleaned up afterwards
//                    (bookings → cancelled, tickets → resolved) via the
//                    service-role key from the env.
//   --list           List suites and exit
//   --verbose        Print replies for failing (and --vv for all) cases
//
// Design notes:
//   • stream:false everywhere — the buffered JSON path is the assertion surface.
//   • Expected-failure tickets: a case may carry `expectFail: "W2.1"` meaning
//     "known-red until that wave ships". Those report as ⚠ EXPECTED-FAIL and
//     do NOT fail the gate; once green they report as 🎉 FIXED (flip the flag
//     off in the same PR that ships the wave).
//   • Cleanup NEVER silently skips: if a write suite ran and the service key is
//     missing, the run fails loudly with the artifact list.
// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};

const BASE = (opt("base", process.env.CHAT_GOLDEN_BASE_URL || "https://www.atockorea.com")).replace(/\/$/, "");
const RUN_WRITES = flag("writes");
const VERBOSE = flag("verbose") || flag("vv");
const VERY_VERBOSE = flag("vv");
const SUITE_FILTER = opt("suite", null)?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const RUN_TAG = `golden-${Date.now().toString(36)}`;
const TEST_EMAIL = `${RUN_TAG}@example.com`;

// ── HTTP helpers ─────────────────────────────────────────────────────────────

async function postChat(messages, extra = {}) {
  const t0 = Date.now();
  let res, json;
  const fire = async () => {
    res = await fetch(`${BASE}/api/tour-product/assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tourProductSlug: "__site__",
        assistantScope: "site",
        stream: false,
        messages,
        ...extra,
      }),
    });
    json = await res.json().catch(() => ({}));
  };
  try {
    await fire();
    // The battery itself can trip the 20/min IP throttle (it got faster than
    // the window). A 429 here is the runner racing the limiter, not a chatbot
    // defect — honor Retry-After once, then re-fire.
    if (res.status === 429) {
      const wait = Math.min(65, Math.max(5, Number(res.headers.get("Retry-After")) || 30));
      console.log(`   (429 from the battery's own rate — waiting ${wait}s, retrying once)`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      await fire();
    }
  } catch (e) {
    return { status: 0, json: { error: String(e) }, ms: Date.now() - t0 };
  }
  return { status: res.status, json, ms: Date.now() - t0 };
}

/** Multi-turn conversation runner: sends each user turn with accumulated history. */
async function conversation(userTurns) {
  const history = [];
  const turns = [];
  for (const turn of userTurns) {
    history.push({ role: "user", content: turn });
    const r = await postChat(history);
    turns.push(r);
    if (r.json?.reply) history.push({ role: "assistant", content: r.json.reply });
  }
  return turns;
}

// ── Supabase cleanup (service role) ─────────────────────────────────────────

const artifacts = { bookings: [], tickets: [] };

async function sbRest(method, path, body) {
  if (!SUPABASE_URL || !SERVICE_KEY) return { ok: false, reason: "no_service_key" };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

async function cleanupArtifacts() {
  const problems = [];
  // Bookings created by this run (unique test email) → cancelled.
  const bk = await sbRest(
    "PATCH",
    `bookings?contact_email=eq.${encodeURIComponent(TEST_EMAIL)}&status=eq.pending`,
    { status: "cancelled" },
  );
  if (bk.ok) {
    const rows = Array.isArray(bk.data) ? bk.data : [];
    if (rows.length) console.log(`🧹 cancelled ${rows.length} test booking(s): ${rows.map((r) => r.booking_reference ?? r.id).join(", ")}`);
  } else if (artifacts.bookings.length || RUN_WRITES) {
    problems.push(`bookings cleanup failed (${bk.reason ?? bk.status})`);
  }
  // Tickets recorded during the run → resolved.
  for (const id of artifacts.tickets) {
    const tk = await sbRest("PATCH", `support_tickets?id=eq.${id}`, { status: "resolved" });
    if (tk.ok) console.log(`🧹 resolved test ticket #${id}`);
    else problems.push(`ticket #${id} cleanup failed (${tk.reason ?? tk.status})`);
  }
  return problems;
}

// ── Assertion framework ──────────────────────────────────────────────────────

const results = [];

function record(suite, name, checks, resp, expectFail) {
  const failed = checks.filter((c) => !c.pass);
  const status = failed.length === 0 ? (expectFail ? "fixed" : "pass") : expectFail ? "xfail" : "fail";
  results.push({ suite, name, status, failed, expectFail, ms: resp?.ms ?? null });
  const icon = { pass: "✅", fail: "❌", xfail: "⚠️ ", fixed: "🎉" }[status];
  const ticket = expectFail ? ` [${expectFail}]` : "";
  console.log(`${icon} [${suite}] ${name}${ticket}${resp?.ms ? ` (${resp.ms}ms)` : ""}`);
  for (const c of failed) console.log(`     ↳ FAILED: ${c.label}`);
  if ((failed.length && VERBOSE) || VERY_VERBOSE) {
    console.log(`     ↳ status=${resp?.status} reply=${JSON.stringify(resp?.json?.reply ?? resp?.json ?? "").slice(0, 400)}`);
  }
}

const check = (label, pass) => ({ label, pass });
const containsAny = (text, terms) => terms.some((t) => (text ?? "").toLowerCase().includes(t.toLowerCase()));
const hasDigits = (text) => /\d/.test(text ?? "");

// ── Suites ───────────────────────────────────────────────────────────────────

const suites = {
  // §E 문의: 정책/픽업/회사 — RAG 정답 포함 여부.
  async inquiry() {
    {
      const r = await postChat([{ role: "user", content: "What is your refund policy if I cancel one day before the tour?" }]);
      record("inquiry", "refund policy (en)", [
        check("HTTP 200", r.status === 200),
        check("mentions 24h / refund", containsAny(r.json.reply, ["24", "refund"])),
        check("no self-negation ('cannot book')", !containsAny(r.json.reply, ["i cannot book", "unable to book", "cannot make bookings"])),
        check(
          "grounding sources returned (W4.6)",
          Array.isArray(r.json.sources) && r.json.sources.length > 0 && r.json.sources.every((s) => s.label),
        ),
      ], r);
    }
    {
      const r = await postChat([{ role: "user", content: "환불 정책이 어떻게 되나요?" }]);
      record("inquiry", "refund policy (ko)", [
        check("HTTP 200", r.status === 200),
        check("환불/24 언급", containsAny(r.json.reply, ["환불", "24"])),
        check("정보성 질문은 티켓 미생성 (C-20)", !r.json.escalated),
      ], r);
      if (r.json.ticket_id) artifacts.tickets.push(r.json.ticket_id);
    }
    {
      const r = await postChat([{ role: "user", content: "Where does the company operate from and what is the support email?" }]);
      record("inquiry", "company info (en)", [
        check("HTTP 200", r.status === 200),
        check("support email present", containsAny(r.json.reply, ["support@atockorea.com"])),
      ], r);
    }
  },

  // §E 추천: 활성 상품만, 카드 스키마(W4.1) + URL 전부 200.
  async recommend() {
    const r = await postChat([{ role: "user", content: "Recommend a private tour in Jeju for a family with kids" }]);
    const urls = [...new Set((r.json.reply ?? "").match(/\/tour-product\/[a-z0-9-]+/g) ?? [])];
    const cards = Array.isArray(r.json.cards) ? r.json.cards : [];
    const checks = [
      check("HTTP 200", r.status === 200),
      check("recommends products (cards or URLs)", cards.length > 0 || urls.length > 0),
      check("rich cards returned (W4.1)", cards.length > 0),
      check(
        "cards schema valid (W4.1)",
        cards.every(
          (c) =>
            typeof c.slug === "string" && c.slug &&
            typeof c.title === "string" && c.title &&
            typeof c.image_url === "string" && c.image_url &&
            typeof c.price_from_usd === "number" &&
            typeof c.href === "string" && c.href.startsWith("/tour-product/"),
        ),
      ),
    ];
    const liveTargets = [...new Set([...cards.map((c) => c.href), ...urls])].slice(0, 5);
    for (const u of liveTargets) {
      const page = await fetch(`${BASE}${u}`, { method: "HEAD", redirect: "follow" }).catch(() => null);
      checks.push(check(`URL live: ${u}`, Boolean(page && page.status === 200)));
    }
    record("recommend", "jeju family recommendation", checks, r);
  },

  // §E 가격: 가격 질문 응답에 숫자 필수 (C-12) — W2.1 price_question 라우팅으로 상시 게이트.
  async price() {
    {
      const r = await postChat([{ role: "user", content: "How much is the Pocheon day tour per person?" }]);
      record("price", "catalog price question has numbers (en)", [
        check("HTTP 200", r.status === 200),
        check("reply contains a number", hasDigits(r.json.reply)),
        check("not hijacked into private-quote interrogation (C-3)", !containsAny(r.json.reply, ["happy to price a private tour"])),
      ], r);
    }
    {
      const r = await postChat([{ role: "user", content: "제주 투어는 1인당 얼마인가요?" }]);
      record("price", "catalog price question has numbers (ko)", [
        check("HTTP 200", r.status === 200),
        check("숫자 포함", hasDigits(r.json.reply)),
      ], r);
    }
  },

  // §E 견적 멀티턴 (C-9 회귀 방지 핵심) — WRITES on the final turn.
  async quote() {
    // Multiturn: slots missing → prompt (+slot_request, W2.3) → price
    // (+confirm chips, W4.3) → separate-turn agreement → email prompt →
    // separate-turn email → email CONFIRM turn (W2.10) → booking + checkout.
    const turns = await conversation([
      "Can I get a quote for a private tour in Busan?",
      "October 10th 2026, 4 people, 8 hours",
      "네 진행해주세요",
      TEST_EMAIL,
      "Yes, that's the right email",
    ]);
    const [t1, t2, t3, t4, t5] = turns;
    record("quote", "turn1: slot prompt", [
      check("HTTP 200", t1.status === 200),
      check("asks for missing slots", containsAny(t1.json.reply, ["date", "people", "hours", "날짜", "인원"])),
      check(
        "slot_request structure (W2.3)",
        Array.isArray(t1.json.slot_request?.missing) &&
          t1.json.slot_request.missing.length > 0 &&
          typeof t1.json.slot_request.known === "object",
      ),
    ], t1);
    record("quote", "turn2: deterministic price", [
      check("HTTP 200", t2.status === 200),
      check("shows a ₩ price", containsAny(t2.json.reply, ["₩", "KRW"]) && hasDigits(t2.json.reply)),
      check("states the tour date (07-04 incident)", (t2.json.reply ?? "").includes("2026-10-10")),
      check("confirm chips returned (W4.3)", Array.isArray(t2.json.chips) && t2.json.chips.length > 0),
      check("trust badge flag (W4.6)", t2.json.quote_trust === true),
    ], t2);
    record("quote", "turn3: multiturn stickiness (C-9)", [
      check("HTTP 200", t3.status === 200),
      check("stays in quote flow (asks email or confirms)", containsAny(t3.json.reply, ["email", "이메일", "메일"])),
      check("no self-negation", !containsAny(t3.json.reply, ["i cannot", "unable to", "예약할 수 없", "예약을 못"])),
    ], t3);
    record("quote", "turn4: email confirmation turn (W2.10)", [
      check("HTTP 200", t4.status === 200),
      check("asks to confirm the exact email", (t4.json.reply ?? "").includes(TEST_EMAIL)),
      check("email_confirm field + chips", typeof t4.json.email_confirm === "string" && Array.isArray(t4.json.chips) && t4.json.chips.length > 0),
      check("no booking created yet", !t4.json.checkout_url),
    ], t4);
    record("quote", "turn5: booking + checkout link", [
      check("HTTP 200", t5.status === 200),
      check("checkout_url returned", typeof t5.json.checkout_url === "string" && t5.json.checkout_url.includes("/itinerary-builder/checkout")),
      // W2.2: masked variants (A2C-****8F52) count too — the customer sees the
      // full reference in the reply; only the LOG is masked.
      check("reply includes A2C reference (C-10)", /A2C-[A-F0-9]{8}/i.test(t5.json.reply ?? "")),
    ], t5);
    if (t5.json.checkout_url) artifacts.bookings.push(t5.json.checkout_url);
  },

  // §E 엣지 견적: 과거 날짜 거부 (C-18). No booking is ever created here.
  async "edge-quote"() {
    const turns = await conversation([
      "Quote for a private Jeju tour please, downtown pickup",
      "January 1st 2020, 4 people, 8 hours",
    ]);
    const t2 = turns[1];
    record("edge-quote", "past date rejected (C-18)", [
      check("HTTP 200", t2.status === 200),
      check("no price offered for a past date", !(containsAny(t2.json.reply, ["₩"]) && containsAny(t2.json.reply, ["checkout", "결제", "예약"]) && !containsAny(t2.json.reply, ["passed", "지난", "past"]))),
      check("explains the date problem", containsAny(t2.json.reply, ["passed", "지난", "already", "date"])),
    ], t2);

    // 07-04 incident regression: "tomorrow" must price for KST-tomorrow, never
    // loop on a stale/past date pulled from history.
    const kstTomorrow = new Date(Date.now() + (9 + 24) * 3600 * 1000).toISOString().slice(0, 10);
    const relTurns = await conversation([
      "Quote for a private Busan tour tomorrow please",
      "4 people, 8 hours",
    ]);
    const r2 = relTurns[1];
    record("edge-quote", `relative date "tomorrow" → ${kstTomorrow} (07-04 incident)`, [
      check("HTTP 200", r2.status === 200),
      check("prices instead of rejecting the date", containsAny(r2.json.reply, ["₩", "KRW"])),
      check("not treated as a past date", !containsAny(r2.json.reply, ["passed", "지난", "already passed"])),
      check(`quote states ${kstTomorrow}`, (r2.json.reply ?? "").includes(kstTomorrow)),
    ], r2);
  },

  // §E W1.2/W1.3 — stale-catalog blocking + price freshness.
  // Ground truth = /api/agent/v1/tours (deterministic active catalog + USD prices).
  async "catalog-freshness"() {
    const cat = await fetch(`${BASE}/api/agent/v1/tours`).then((r) => r.json()).catch(() => null);
    const tours = cat?.tours ?? [];
    record("catalog-freshness", "agent catalog reachable", [
      check("catalog lists active tours", tours.length > 0),
    ], { status: tours.length ? 200 : 0, json: { reply: `total=${cat?.total}` }, ms: null });

    // W1.2: deactivated tours must never appear in answers. This list is the
    // 2026-06-29 Klook deactivation set verified during the W1.4 reindex.
    const STALE_SLUGS = [
      "busan-cruise-shore-excursion-bus-tour",
      "busan-outskirts-tongdosa-amethyst-yeongnam-day-tour",
      "busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju",
      "busan-spring-cherry-blossom-gyeongju-highlights-day-tour",
      "east-signature-nature-core",
      "from-busan-gyeongju-ancient-capital-day-tour",
      "from-incheon-seoul-day-tour-cruise-guests",
      "jeju-cherry-blossom-tour-east-route",
      "jeju-cruise-shore-excursion-bus-tour",
      "jeju-eastern-unesco-spots-day-tour",
      "jeju-southern-top-unesco-spots-tour",
      "jeju-west-south-full-day-authentic-tour",
      "jeju-winter-southwest-tangerine-snow-camellia-tour",
      "seoul-dmz-private-3rd-tunnel-suspension-bridge",
      "seoul-seoraksan-naksansa-temple-naksan-beach-day-trip",
      "seoul-seoraksan-nami-island-morning-calm-day-tour",
      "seoul-suwon-hwaseong-folk-village-starfield-library",
      "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library",
      "seoul-suwon-hwaseong-waujeongsa-starfield",
      "southwest-hallasan-osulloc-aewol",
    ];
    const activeSlugs = new Set(tours.map((t) => t.slug));
    record("catalog-freshness", "stale slugs absent from active catalog", [
      check("no deactivated slug is active", STALE_SLUGS.every((s) => !activeSlugs.has(s))),
    ], { status: 200, json: {}, ms: null });

    // The C-4 reproduction: the bot used to recommend the deactivated DMZ tour.
    const probes = [
      "Is there a private DMZ tour from Seoul? What Seoul day tours do you have?",
      "제주 크루즈 기항지 투어 있어요? 추천해줘",
    ];
    for (const q of probes) {
      const r = await postChat([{ role: "user", content: q }]);
      const hit = STALE_SLUGS.find((s) => (r.json.reply ?? "").includes(s));
      record("catalog-freshness", `no stale tour in: "${q.slice(0, 30)}…"`, [
        check("HTTP 200", r.status === 200),
        check(`no deactivated slug in reply${hit ? ` (found ${hit})` : ""}`, !hit),
      ], r);
    }

    // W1.3: price freshness — sample 3 SKUs (rotating by day) against the
    // chatbot's answer. Full 12-SKU sweep would double battery runtime; three
    // per run still catches a catalog-wide price drift within days.
    const priced = tours.filter((t) => typeof t.price_usd === "number" && t.price_usd > 0);
    const dayOffset = new Date().getUTCDate() % Math.max(1, priced.length);
    const sample = [0, 1, 2].map((i) => priced[(dayOffset + i) % priced.length]).filter(Boolean);
    console.log(`   (price sample: ${sample.map((t) => t.slug).join(", ")})`);
    for (const t of sample) {
      const r = await postChat([{ role: "user", content: `How much is the "${t.title}" tour?` }]);
      const price = String(Math.round(t.price_usd));
      record("catalog-freshness", `price fresh: ${t.slug} ($${price})`, [
        check("HTTP 200", r.status === 200),
        check(`reply contains current price ${price}`, (r.json.reply ?? "").includes(price)),
      ], r);
    }
  },

  // §E Wave 6 — 결정론 즉답 (해녀쇼/가용성/날씨). LLM 무경유 경로.
  async instant() {
    {
      const r = await postChat([{ role: "user", content: "What time is the haenyeo diving show at Seongsan?" }]);
      record("instant", "haenyeo schedule states 14:00 once-daily (W6.7)", [
        check("HTTP 200", r.status === 200),
        check("contains 14:00", (r.json.reply ?? "").includes("14:00")),
        check("chips returned", Array.isArray(r.json.chips) && r.json.chips.length > 0),
      ], r);
    }
    {
      const r = await postChat([{ role: "user", content: "Do you have availability on 2026-10-10?" }]);
      record("instant", "availability instant answer (W6.1)", [
        check("HTTP 200", r.status === 200),
        check("echoes the date", (r.json.reply ?? "").includes("2026-10-10")),
        check("on-demand framing", containsAny(r.json.reply, ["on-demand", "온디맨드"])),
        check("quote chip present", Array.isArray(r.json.chips) && r.json.chips.length > 0),
      ], r);
    }
    {
      // Weather relies on Open-Meteo; on fetch failure the turn legitimately
      // falls through to the model, so assertions stay lenient.
      const r = await postChat([{ role: "user", content: "What's the weather in Jeju tomorrow?" }]);
      record("instant", "weather answer mentions the region (W6.6)", [
        check("HTTP 200", r.status === 200),
        check("mentions Jeju + weather-ish content", containsAny(r.json.reply, ["jeju", "제주"]) && containsAny(r.json.reply, ["°C", "rain", "weather", "forecast", "날씨", "비"])),
      ], r);
    }
  },

  // §E 예약조회: 무효 자격증명 → 정중 거부, 500 없음.
  async lookup() {
    const r = await postChat([
      { role: "user", content: "Where is my pickup? My booking reference is A2C-00000000 and my email is nobody@example.com" },
    ]);
    record("lookup", "invalid credentials politely refused", [
      check("HTTP 200 (no 5xx)", r.status === 200),
      check("does not leak booking data", !containsAny(r.json.reply, ["pickup at", "driver"])),
      check("mentions it couldn't verify / find", containsAny(r.json.reply, ["find", "match", "verify", "확인", "찾을 수 없"])),
    ], r);
  },

  // §E 장애: 초과 입력/깨진 페이로드가 깔끔한 4xx로.
  async guard() {
    {
      const r = await postChat([{ role: "user", content: "x".repeat(8001) }]);
      record("guard", "oversized message → 400", [check("HTTP 400", r.status === 400)], r);
    }
    {
      const r = await postChat([]);
      record("guard", "empty messages → 400", [check("HTTP 400", r.status === 400)], r);
    }
    {
      const long = Array.from({ length: 6 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "y".repeat(7000) }));
      const r = await postChat(long.concat([{ role: "user", content: "hello" }]));
      record("guard", "40k conversation cap → 413", [check("HTTP 413", r.status === 413)], r);
    }
  },

  // §E W3.1 — streaming TTFT probe (Wave 3 target: first token < 2.5s p75).
  // Reported as a number; hard-fails only past 10s so network variance never
  // flakes the gate. Skips cleanly when the server answers buffered JSON
  // (CHAT_STREAMING off).
  async perf() {
    const t0 = Date.now();
    let ttftMs = null;
    let totalMs = null;
    let streamed = false;
    try {
      const res = await fetch(`${BASE}/api/tour-product/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tourProductSlug: "__site__",
          assistantScope: "site",
          stream: true,
          messages: [{ role: "user", content: "What is included in your private tours?" }],
        }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("text/event-stream") && res.body) {
        streamed = true;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let bufText = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bufText += decoder.decode(value, { stream: true });
          if (ttftMs === null && bufText.includes("event: delta")) ttftMs = Date.now() - t0;
        }
        totalMs = Date.now() - t0;
      } else {
        await res.json().catch(() => ({}));
        totalMs = Date.now() - t0;
      }
    } catch {
      /* recorded below as failure */
    }
    if (!streamed) {
      record("perf", "streaming TTFT (skipped — server replied buffered JSON)", [
        check("HTTP reachable", totalMs !== null),
      ], { status: 200, json: { reply: `buffered total=${totalMs}ms` }, ms: totalMs });
      return;
    }
    record("perf", `streaming TTFT ${ttftMs}ms (target <2500ms) / total ${totalMs}ms`, [
      check("first token arrived", ttftMs !== null),
      check("TTFT under 10s hard ceiling", ttftMs !== null && ttftMs < 10_000),
    ], { status: 200, json: {}, ms: totalMs });
  },

  // §E 핸드오프 (WRITES a ticket) — created then resolved in cleanup.
  async handoff() {
    const r = await postChat(
      [{ role: "user", content: `Please connect me to a human agent. (automated golden test ${RUN_TAG} — safe to resolve)` }],
      { handoffRequested: true, handoffQuestion: `golden test ${RUN_TAG}` },
    );
    record("handoff", "human handoff creates ticket", [
      check("HTTP 200", r.status === 200),
      check("ticket created", typeof r.json.ticket_id === "number"),
    ], r);
    if (r.json.ticket_id) artifacts.tickets.push(r.json.ticket_id);
  },
};

const WRITE_SUITES = new Set(["quote", "handoff"]);

// ── Runner ───────────────────────────────────────────────────────────────────

async function main() {
  if (flag("list")) {
    console.log("Suites:", Object.keys(suites).join(", "), `(writes: ${[...WRITE_SUITES].join(", ")})`);
    return;
  }
  const selected = Object.keys(suites).filter((s) => {
    if (SUITE_FILTER) return SUITE_FILTER.includes(s);
    return RUN_WRITES || !WRITE_SUITES.has(s);
  });
  const runsWrites = selected.some((s) => WRITE_SUITES.has(s));
  if (runsWrites && (!SUPABASE_URL || !SERVICE_KEY)) {
    console.error("✋ write suites need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for cleanup — run via `node --env-file=.env.local …`");
    process.exit(1);
  }

  console.log(`\n🎯 chatbot golden battery → ${BASE}`);
  console.log(`   suites: ${selected.join(", ")}${runsWrites ? ` · test email ${TEST_EMAIL}` : ""}\n`);

  for (const s of selected) {
    try {
      await suites[s]();
    } catch (e) {
      results.push({ suite: s, name: "(suite crashed)", status: "fail", failed: [{ label: String(e) }], ms: null });
      console.log(`❌ [${s}] suite crashed: ${e}`);
    }
  }

  let cleanupProblems = [];
  if (runsWrites) cleanupProblems = await cleanupArtifacts();

  // ── Report card ──
  const count = (st) => results.filter((r) => r.status === st).length;
  const slow = results.filter((r) => r.ms && r.ms > 15000).length;
  console.log("\n──────── report card ────────");
  console.log(`   ✅ pass: ${count("pass")}   ❌ fail: ${count("fail")}   ⚠️ expected-fail: ${count("xfail")}   🎉 fixed-flip-the-flag: ${count("fixed")}`);
  if (slow) console.log(`   🐢 ${slow} case(s) over 15s`);
  for (const r of results.filter((x) => x.status === "fixed")) {
    console.log(`   🎉 ${r.suite}/${r.name} now passes — remove expectFail:"${r.expectFail}"`);
  }
  for (const p of cleanupProblems) console.log(`   🚨 CLEANUP: ${p}`);
  const gate = count("fail") === 0 && cleanupProblems.length === 0;
  console.log(gate ? "\n🟢 GATE: GREEN\n" : "\n🔴 GATE: RED\n");
  process.exit(gate ? 0 : 1);
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
