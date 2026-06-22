/**
 * Chatbot RAG pressure test — calls the REAL assistant route handler (no server)
 * with a multilingual battery, grades answers with an LLM judge, and verifies
 * the learning loop + key features.
 *
 *   node --env-file=.env.local --import tsx scripts/chatbot-pressure-test.ts [--rounds=3]
 *
 * Safe by design: chat audit logging stays OFF (no ticket/telegram side effects)
 * and handoff probes use debugNoSideEffects. The learning test writes one tagged
 * Q&A and removes it afterward.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { POST as assistantPOST } from "@/app/api/tour-product/assistant/route";
import { POST as feedbackPOST } from "@/app/api/tour-product/assistant/feedback/route";
import { retrieveKnowledge, buildRagContextText } from "@/lib/rag/retrieve";
import { buildTourCatalogContextText } from "@/lib/chatbot/tourCatalogKnowledge";
import { syncQaPairToIndex } from "@/lib/rag/qa-index";

const ROUNDS = Number(process.argv.find((a) => a.startsWith("--rounds="))?.split("=")[1] ?? 3);

type Battery = {
  id: string;
  q: string;
  lang: string;
  category: string;
  /** Expected routing behavior for deterministic checks. */
  expect?: "answer" | "handoff" | "booking_defer" | "graceful_unknown";
  debugNoSideEffects?: boolean;
};

const BATTERY: Battery[] = [
  { id: "rec-seniors", q: "Recommend a relaxed Jeju tour for elderly travelers with hotel pickup.", lang: "en", category: "recommendation", expect: "answer" },
  { id: "refund-typhoon", q: "If a typhoon cancels my tour, do I get a refund?", lang: "en", category: "refund", expect: "answer" },
  { id: "pickup-busan-ko", q: "부산 크루즈 기항지 투어는 어디서 픽업하나요?", lang: "ko", category: "pickup", expect: "answer" },
  { id: "access-ja", q: "車椅子で参加できるツアーはありますか？", lang: "ja", category: "accessibility", expect: "answer" },
  { id: "poi-hours", q: "What can you tell me about visiting Haedong Yonggungsa Temple?", lang: "en", category: "poi", expect: "answer" },
  { id: "company-addr", q: "What is AtoC Korea's operating address and support email?", lang: "en", category: "company", expect: "answer" },
  { id: "legal-privacy", q: "How do I request deletion of my personal data?", lang: "en", category: "legal", expect: "answer" },
  { id: "family-es", q: "¿Recomiendan un tour en Seúl para una familia con niños?", lang: "es", category: "recommendation", expect: "answer" },
  { id: "family-zh", q: "济州岛有适合家庭带小孩的一日游吗？", lang: "zh", category: "recommendation", expect: "answer" },
  { id: "child-seat-ko", q: "아이랑 같이 가는데 카시트 제공되나요? 추가 요금 있어요?", lang: "ko", category: "children", expect: "answer" },
  { id: "human", q: "I want to talk to a real human agent please.", lang: "en", category: "support", expect: "handoff", debugNoSideEffects: true },
  { id: "booking", q: "Please change the pickup time for my booking ABC1234.", lang: "en", category: "booking_specific", expect: "booking_defer", debugNoSideEffects: true },
  { id: "oos", q: "What's the weather forecast in Tokyo next week?", lang: "en", category: "out_of_scope", expect: "graceful_unknown" },
];

function client() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

function makeAssistantReq(item: Battery): NextRequest {
  return new NextRequest("http://localhost:3000/api/tour-product/assistant", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `NEXT_LOCALE=${item.lang === "zh" ? "zh" : item.lang}` },
    body: JSON.stringify({
      assistantScope: "site",
      tourProductSlug: "__site__",
      messages: [{ role: "user", content: item.q }],
      debugNoSideEffects: item.debugNoSideEffects ?? false,
    }),
  });
}

type AssistantData = {
  reply?: string;
  escalated?: boolean;
  escalation_reason?: string | null;
  handoff_offered?: boolean;
  ticket_id?: number | null;
  error?: string;
};

type Judgement = { accuracy: number; grounded: boolean; language_ok: boolean; routing_ok: boolean; note: string };

async function judge(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  item: Battery,
  reply: string,
  ragContext: string,
): Promise<Judgement> {
  const prompt = [
    "You are a strict QA grader for a Korea tour booking site assistant.",
    "Grade the assistant ANSWER to the USER question, given the RETRIEVED CONTEXT the assistant had.",
    "- accuracy: 0-5 (5 = fully correct, helpful, specific; 0 = wrong/empty).",
    "- grounded: true if the answer's factual claims are supported by the retrieved context or are safe general travel guidance; false if it hallucinates specifics not in context.",
    "- language_ok: true if the answer is written in the same language as the question.",
    `- routing_ok: the EXPECTED behavior is "${item.expect}". For "handoff"/"booking_defer", a good answer offers to connect a human / defers booking-specifics to staff instead of inventing details. For "graceful_unknown", a good answer admits it cannot answer and offers help. For "answer", it should directly answer. true if behavior matches.`,
    'Respond ONLY as JSON: {"accuracy": number, "grounded": boolean, "language_ok": boolean, "routing_ok": boolean, "note": string}.',
    "",
    `USER (${item.lang}, ${item.category}): ${item.q}`,
    `RETRIEVED CONTEXT:\n${ragContext.slice(0, 6000) || "(none)"}`,
    `ASSISTANT ANSWER:\n${reply}`,
  ].join("\n");
  const res = await model.generateContent(prompt);
  const text = res.response.text()?.trim() ?? "";
  try {
    return JSON.parse(text) as Judgement;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    return m ? (JSON.parse(m[0]) as Judgement) : { accuracy: 0, grounded: false, language_ok: false, routing_ok: false, note: "unparseable" };
  }
}

async function runBattery(sb: ReturnType<typeof client>, model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>) {
  const agg: Record<string, { acc: number[]; grounded: number; routing: number; lang: number; n: number }> = {};
  for (let round = 1; round <= ROUNDS; round += 1) {
    console.log(`\n━━━ ROUND ${round}/${ROUNDS} ━━━`);
    for (const item of BATTERY) {
      const t0 = Date.now();
      let data: AssistantData = {};
      try {
        const res = await assistantPOST(makeAssistantReq(item));
        data = (await res.json()) as AssistantData;
      } catch (e) {
        console.log(`  ✗ ${item.id}: route threw ${(e as Error).message}`);
        continue;
      }
      const reply = data.reply ?? `(error: ${data.error ?? "no reply"})`;
      const ms = Date.now() - t0;
      // Retrieve the same context the route used, for groundedness grading.
      let ragContext = "";
      try {
        const chunks = await retrieveKnowledge(sb, { query: item.q, locale: item.lang, sourceTypes: ["poi", "tour_product", "site", "policy", "qa"], limit: 8 });
        ragContext = buildRagContextText(chunks, { maxChars: 6000 });
        // The route also feeds the keyword tour catalogue for recommendations —
        // include it so groundedness grading is fair on recommendation prompts.
        const catalog = buildTourCatalogContextText({ locale: item.lang, query: item.q, limit: 10, maxChars: 3500 });
        if (catalog) ragContext += `\n\n--- TOUR CATALOGUE ---\n${catalog}`;
      } catch { /* ignore */ }

      const v = await judge(model, item, reply, ragContext);
      const a = (agg[item.id] ??= { acc: [], grounded: 0, routing: 0, lang: 0, n: 0 });
      a.acc.push(v.accuracy);
      a.grounded += v.grounded ? 1 : 0;
      a.routing += v.routing_ok ? 1 : 0;
      a.lang += v.language_ok ? 1 : 0;
      a.n += 1;
      const flags = [
        data.escalated ? "ESC" : "",
        data.handoff_offered ? "HANDOFF" : "",
        data.escalation_reason ? `reason=${data.escalation_reason}` : "",
      ].filter(Boolean).join(" ");
      console.log(`  ${v.accuracy}/5 ${v.grounded ? "G" : "g"}${v.routing_ok ? "R" : "r"}${v.language_ok ? "L" : "l"} ${ms}ms  [${item.id}] ${flags}`);
      if (v.accuracy <= 2 || !v.routing_ok) console.log(`        ↳ ${v.note}`);
    }
  }
  return agg;
}

function report(agg: Awaited<ReturnType<typeof runBattery>>) {
  console.log(`\n━━━ ACCURACY REPORT (avg over ${ROUNDS} rounds) ━━━`);
  let totAcc = 0, totN = 0, totG = 0, totR = 0, totL = 0;
  for (const item of BATTERY) {
    const a = agg[item.id];
    if (!a) continue;
    const avg = a.acc.reduce((x, y) => x + y, 0) / a.acc.length;
    totAcc += a.acc.reduce((x, y) => x + y, 0); totN += a.n; totG += a.grounded; totR += a.routing; totL += a.lang;
    console.log(`  ${avg.toFixed(2)}/5  grounded ${a.grounded}/${a.n}  routing ${a.routing}/${a.n}  [${item.category}] ${item.id}`);
  }
  console.log(`\n  OVERALL  accuracy ${(totAcc / totN).toFixed(2)}/5 · grounded ${totG}/${totN} (${Math.round((totG/totN)*100)}%) · routing ${totR}/${totN} (${Math.round((totR/totN)*100)}%) · language ${totL}/${totN} (${Math.round((totL/totN)*100)}%)`);
}

async function learningTest(sb: ReturnType<typeof client>, model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>) {
  console.log(`\n━━━ LEARNING LOOP TEST ━━━`);
  // Non-recommendation phrasing so the route's recommendation override doesn't
  // clobber the RAG/Q&A answer.
  const marker = "If you leave an item behind, AtoC Korea keeps lost property at the Jeju office for 30 days; email support@atockorea.com with your booking to arrange return shipping at cost.";
  const q = "If I forget a bag, is there a lost and found service to get it back?";
  const ask = async () => {
    const res = await assistantPOST(makeAssistantReq({ id: "learn", q, lang: "en", category: "policy" }));
    return ((await res.json()) as AssistantData).reply ?? "";
  };

  // Distinctive injected facts only — NOT "lost and found" (the question echoes it).
  const knows = (s: string) => /lost property|30 days|return shipping|jeju office/i.test(s);
  const before = await ask();
  const beforeKnows = knows(before);
  console.log(`  BEFORE: knows=${beforeKnows}`);
  console.log(`    ↳ ${before.slice(0, 160)}…`);

  // Inject an approved Q&A and embed it.
  const { data: ins } = await sb.from("qa_pairs").insert({
    source: "manual",
    question: q,
    answer: marker,
    question_locale: "en",
    answer_locale: "en",
    category: "general",
    tags: ["pressure_test_temp"],
    review_status: "approved",
    is_active: true,
  }).select("id").single();
  const qaId = ins!.id as number;
  await syncQaPairToIndex(sb, qaId);
  console.log(`  injected + embedded approved Q&A #${qaId}`);

  const after = await ask();
  const afterKnows = knows(after);
  console.log(`  AFTER: knows=${afterKnows}`);
  console.log(`    ↳ ${after.slice(0, 200)}…`);

  // Cleanup.
  await sb.from("knowledge_chunks").delete().eq("source_type", "qa").eq("source_id", String(qaId));
  await sb.from("qa_pairs").delete().eq("id", qaId);
  console.log(`  cleaned up test Q&A #${qaId}`);
  console.log(`  RESULT: ${!beforeKnows && afterKnows ? "✅ LEARNED (gap → answered after approval)" : afterKnows ? "⚠ already knew / partial" : "✗ did not pick up"}`);
}

async function featureTests(sb: ReturnType<typeof client>) {
  console.log(`\n━━━ FEATURE TESTS ━━━`);
  // Feedback round-trip via the real route.
  const fres = await feedbackPOST(new NextRequest("http://localhost:3000/api/tour-product/assistant/feedback", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "atc_chat_sid=pressure-test-session" },
    body: JSON.stringify({ rating: 1, answer: "PRESSURE_TEST feedback answer", question: "pressure test q", tourProductSlug: "__site__" }),
  }));
  const fok = (await fres.json()) as { ok?: boolean };
  const { count } = await sb.from("chat_feedback").select("id", { count: "exact", head: true }).eq("answer", "PRESSURE_TEST feedback answer");
  await sb.from("chat_feedback").delete().eq("answer", "PRESSURE_TEST feedback answer");
  console.log(`  feedback API: ok=${fok.ok} persisted=${count} → ${fok.ok && count ? "✅" : "✗"}`);
}

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY required (RAG)");
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY required");
  // Hard-disable chat audit logging so the test NEVER creates real tickets /
  // chat logs / Telegram notifications, regardless of .env.local.
  delete process.env.CHAT_AUDIT_LOG;
  delete process.env.TOUR_MATCH_AUDIT_LOG;
  const sb = client();
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_TOUR_PRODUCT_ASSISTANT_MODEL?.trim() || "gemini-2.5-flash",
    generationConfig: { temperature: 0, responseMimeType: "application/json" },
  });

  console.log(`Chatbot pressure test · ${BATTERY.length} prompts × ${ROUNDS} rounds · RAG=${process.env.CHAT_RAG !== "0"}`);
  const agg = await runBattery(sb, model);
  report(agg);
  await learningTest(sb, model);
  await featureTests(sb);
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
