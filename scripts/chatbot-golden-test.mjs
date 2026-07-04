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
  try {
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
      ], r);
    }
    {
      const r = await postChat([{ role: "user", content: "환불 정책이 어떻게 되나요?" }]);
      record("inquiry", "refund policy (ko)", [
        check("HTTP 200", r.status === 200),
        check("환불/24 언급", containsAny(r.json.reply, ["환불", "24"])),
        check("정보성 질문은 티켓 미생성 (C-20)", !r.json.escalated),
      ], r, "W1.5.1");
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

  // §E 추천: 활성 상품만, URL 전부 200.
  async recommend() {
    const r = await postChat([{ role: "user", content: "Recommend a private tour in Jeju for a family with kids" }]);
    const urls = [...new Set((r.json.reply ?? "").match(/\/tour-product\/[a-z0-9-]+/g) ?? [])];
    const checks = [
      check("HTTP 200", r.status === 200),
      check("recommends at least one product URL", urls.length > 0),
    ];
    for (const u of urls.slice(0, 5)) {
      const page = await fetch(`${BASE}${u}`, { method: "HEAD", redirect: "follow" }).catch(() => null);
      checks.push(check(`URL live: ${u}`, Boolean(page && page.status === 200)));
    }
    record("recommend", "jeju family recommendation", checks, r);
  },

  // §E 가격: 가격 질문 응답에 숫자 필수 (C-12) — W2.1 착륙 전까지 expected-fail.
  async price() {
    {
      const r = await postChat([{ role: "user", content: "How much is the Pocheon day tour per person?" }]);
      record("price", "catalog price question has numbers (en)", [
        check("HTTP 200", r.status === 200),
        check("reply contains a number", hasDigits(r.json.reply)),
        check("not hijacked into private-quote interrogation (C-3)", !containsAny(r.json.reply, ["happy to price a private tour"])),
      ], r, "W2.1");
    }
    {
      const r = await postChat([{ role: "user", content: "제주 투어는 1인당 얼마인가요?" }]);
      record("price", "catalog price question has numbers (ko)", [
        check("HTTP 200", r.status === 200),
        check("숫자 포함", hasDigits(r.json.reply)),
      ], r, "W2.1");
    }
  },

  // §E 견적 멀티턴 (C-9 회귀 방지 핵심) — WRITES on the final turn.
  async quote() {
    // Multiturn: slots missing → prompt → price → separate-turn agreement →
    // email prompt → separate-turn email → booking + checkout URL.
    const turns = await conversation([
      "Can I get a quote for a private tour in Busan?",
      "October 10th 2026, 4 people, 8 hours",
      "네 진행해주세요",
      TEST_EMAIL,
    ]);
    const [t1, t2, t3, t4] = turns;
    record("quote", "turn1: slot prompt", [
      check("HTTP 200", t1.status === 200),
      check("asks for missing slots", containsAny(t1.json.reply, ["date", "people", "hours", "날짜", "인원"])),
    ], t1);
    record("quote", "turn2: deterministic price", [
      check("HTTP 200", t2.status === 200),
      check("shows a ₩ price", containsAny(t2.json.reply, ["₩", "KRW"]) && hasDigits(t2.json.reply)),
    ], t2);
    record("quote", "turn3: multiturn stickiness (C-9)", [
      check("HTTP 200", t3.status === 200),
      check("stays in quote flow (asks email or confirms)", containsAny(t3.json.reply, ["email", "이메일", "메일"])),
      check("no self-negation", !containsAny(t3.json.reply, ["i cannot", "unable to", "예약할 수 없", "예약을 못"])),
    ], t3);
    record("quote", "turn4: booking + checkout link", [
      check("HTTP 200", t4.status === 200),
      check("checkout_url returned", typeof t4.json.checkout_url === "string" && t4.json.checkout_url.includes("/itinerary-builder/checkout")),
      check("reply includes A2C reference (C-10)", /A2C-[A-F0-9]{8}/i.test(t4.json.reply ?? "")),
    ], t4, /A2C/.test(t4.json.reply ?? "") ? undefined : "W2.2");
    if (t4.json.checkout_url) artifacts.bookings.push(t4.json.checkout_url);
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
