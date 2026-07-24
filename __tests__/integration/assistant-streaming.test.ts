/**
 * @jest-environment node
 *
 * Track 2 integration acceptance (master plan §6): with the Gemini stream
 * mocked, the assistant route must
 *  - return Content-Type: text/event-stream for a free-form model answer,
 *  - emit >= 1 `delta` and exactly one `done`, with done.reply === the buffer,
 *  - keep returning application/json for a deterministic gate (privacy request)
 *    even when stream:true is requested (D-T2-2).
 */
import {
  Request as UndiciRequest,
  Response as UndiciResponse,
  Headers as UndiciHeaders,
} from "undici";

// jest.setup.js replaces global Request/Response/Headers with dumb stubs (for
// jsdom). Restore the real web primitives so Next's NextRequest/NextResponse
// and our SSE ReadableStream Response work in this node-env test.
/* eslint-disable @typescript-eslint/no-explicit-any */
(global as any).Request = UndiciRequest;
(global as any).Response = UndiciResponse;
(global as any).Headers = UndiciHeaders;
/* eslint-enable @typescript-eslint/no-explicit-any */

import type { NextRequest } from "next/server";

import { parseSseBuffer } from "@/lib/chatbot/clientSse";

/**
 * 🔴 A4.6 — 이 스위트는 두 가지가 겹쳐 빨간 채로 방치돼 있었다.
 *
 * (1) **프롬프트가 게이트에 먹혔다.** 원래 질문("What is the weather like in Jeju
 *     in summer?")은 이 테스트가 쓰인 뒤에 생긴 **결정적 날씨 즉답**에 걸려
 *     모델을 아예 호출하지 않는다. 스트리밍을 검증할 수가 없다.
 *     → 게이트에 걸리지 않는 자유서술 질문으로 바꿨다.
 *
 * (2) **목업 답이 비현실적으로 짧았다.** 아래 참조.
 */

/**
 * 🔴 이 배열은 원래 41자짜리("The sunset time shifts through the seasons.")
 * 였고, 그래서 이 스위트가 오래 빨간 채로 방치돼 있었다.
 *
 * 원인은 스트리밍이 아니라 **후처리**다: `finalizeAssistantTurn`은 추천 의도에서
 * 모델 답이 180자 미만이고 상품 URL도 없으면 "모델이 쓸 만한 걸 못 냈다"로 보고
 * 카탈로그 top-3으로 갈아끼운다. 41자 목업은 항상 그 조건에 걸렸다 — 실제 모델
 * 답변은 그렇게 짧지 않으므로, 목업이 현실과 달랐던 것이다.
 *
 * 그래서 프롬프트를 이리저리 바꿔 게이트 사이를 통과시키는 대신(그건 게이트가
 * 하나 늘 때마다 다시 깨진다) **목업을 현실적인 길이로** 만든다(180자 이상).
 * 이러면 의도 분류가 어떻게 바뀌어도 이 테스트는 스트리밍만 검증한다.
 *
 * ⚠ URL은 넣지 않는다 — 후처리가 끝에 붙은 맨 URL을 떼어내서, 목업 문자열과
 * 최종 답이 어긋난다. 길이 조건만으로 이미 보존되므로 URL은 불필요하다.
 */
const MODEL_CHUNKS = [
  "Jeju's sunset time shifts noticeably through the seasons, ",
  "from about 17:40 in midwinter to past 19:40 in midsummer, ",
  "which is why the same itinerary feels quite different in January and July. ",
  "If you are planning around the light, that difference is worth building the day around.",
];

jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return {
        startChat() {
          return {
            async sendMessageStream() {
              async function* gen() {
                for (const c of MODEL_CHUNKS) yield { text: () => c };
              }
              return {
                stream: gen(),
                response: Promise.resolve({ text: () => MODEL_CHUNKS.join("") }),
              };
            },
            async sendMessage() {
              return { response: { text: () => MODEL_CHUNKS.join("") } };
            },
          };
        },
      };
    }
  },
}));

// Minimal stand-in for NextRequest exposing only what the route reads. We can't
// construct a real NextRequest here: jest.setup's stub Request is captured as
// NextRequest's superclass before our global restore runs, so `new NextRequest`
// throws. The route only touches cookies/headers/signal/json.
function makeReq(body: unknown): NextRequest {
  const headers = new UndiciHeaders({
    "content-type": "application/json",
    "x-forwarded-for": "203.0.113.7",
  });
  return {
    url: "https://test.local/api/tour-product/assistant",
    method: "POST",
    headers,
    cookies: { get: () => undefined },
    signal: { aborted: false },
    json: async () => body,
    nextUrl: new URL("https://test.local/api/tour-product/assistant"),
  } as unknown as NextRequest;
}

describe("assistant route — SSE streaming (integration)", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV, GEMINI_API_KEY: "test-key" };
    process.env.CHAT_STREAMING = "1"; // kill switch defaults OFF; enable for these tests
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.CHAT_AUDIT_LOG;
    delete process.env.TOUR_MATCH_AUDIT_LOG;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("streams delta tokens then a single authoritative done", async () => {
    const { POST } = await import("@/app/api/tour-product/assistant/route");
    const res = await POST(
      makeReq({
        assistantScope: "site",
        tourProductSlug: "__site__",
        messages: [{ role: "user", content: "Tell me about the haenyeo diving tradition on Jeju." }],
        stream: true,
      }),
    );

    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("x-accel-buffering")).toBe("no");

    const { events } = parseSseBuffer(await res.text());
    const deltas = events.filter((e) => e.event === "delta");
    const dones = events.filter((e) => e.event === "done");
    const errors = events.filter((e) => e.event === "error");

    expect(deltas.length).toBeGreaterThanOrEqual(1);
    expect(dones).toHaveLength(1);
    expect(errors).toHaveLength(0);

    // delta payloads concatenate to the model buffer...
    const streamed = deltas.map((e) => (JSON.parse(e.data) as { text: string }).text).join("");
    expect(streamed).toBe(MODEL_CHUNKS.join(""));

    // ...and done.reply is that same (trimmed) buffer — the authority (D-T2-4).
    const done = JSON.parse(dones[0].data) as { reply: string; handoff_offered: boolean };
    expect(done.reply).toBe(MODEL_CHUNKS.join("").trim());
  });

  it("ships dark: with the kill switch unset, stream:true still returns buffered JSON (D-T2-5)", async () => {
    delete process.env.CHAT_STREAMING; // default OFF
    const { POST } = await import("@/app/api/tour-product/assistant/route");
    const res = await POST(
      makeReq({
        assistantScope: "site",
        tourProductSlug: "__site__",
        messages: [{ role: "user", content: "Tell me about the haenyeo diving tradition on Jeju." }],
        stream: true,
      }),
    );

    expect(res.headers.get("content-type")).toContain("application/json");
    const body = (await res.json()) as { reply?: string };
    expect(body.reply).toBe(MODEL_CHUNKS.join("").trim());
  });

  it("keeps deterministic gates on buffered JSON even with stream:true (D-T2-2)", async () => {
    const { POST } = await import("@/app/api/tour-product/assistant/route");
    const res = await POST(
      makeReq({
        assistantScope: "site",
        tourProductSlug: "__site__",
        messages: [
          { role: "user", content: "I want to submit a privacy request to delete my personal data." },
        ],
        stream: true,
      }),
    );

    expect(res.headers.get("content-type")).toContain("application/json");
    const body = (await res.json()) as { reply?: string };
    expect(typeof body.reply).toBe("string");
    expect(body.reply).toMatch(/legal@atockorea\.com/i);
  });
});
