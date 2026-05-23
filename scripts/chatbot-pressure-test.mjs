import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.CHATBOT_TEST_BASE_URL ?? "http://127.0.0.1:3000";
const CONCURRENCY = Number(process.env.CHATBOT_TEST_CONCURRENCY ?? 4);
const LIMIT = Number(process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ?? 0);

const recommendationTargets = [
  {
    id: "jeju_parents_relaxed",
    region: "jeju",
    ko: "제주에서 부모님이랑 너무 힘들지 않게 갈 만한 투어 추천해줘.",
    en: "Recommend a relaxed Jeju tour for my parents with minimal walking.",
  },
  {
    id: "jeju_cruise_port",
    region: "jeju",
    ko: "제주 크루즈 항구에서 내리는 손님에게 맞는 투어 있어?",
    en: "What Jeju shore excursion works for cruise passengers arriving at port?",
  },
  {
    id: "jeju_hydrangea",
    region: "jeju",
    ko: "제주 수국 시즌에 사진 예쁜 투어를 찾고 있어.",
    en: "I want a photogenic Jeju hydrangea-season tour.",
  },
  {
    id: "jeju_winter",
    region: "jeju",
    ko: "겨울 제주에서 눈, 동백, 귤 체험 느낌의 투어 추천해줘.",
    en: "Recommend a winter Jeju tour with snow, camellias, or tangerines.",
  },
  {
    id: "busan_cruise",
    region: "busan",
    ko: "부산 크루즈 승객이 당일로 다녀올 만한 투어가 있어?",
    en: "Which Busan day tour fits cruise passengers?",
  },
  {
    id: "busan_city_budget",
    region: "busan",
    ko: "부산 핵심 명소를 저렴하게 보는 투어 추천해줘.",
    en: "Recommend an affordable Busan highlights tour.",
  },
  {
    id: "gyeongju_unesco",
    region: "gyeongju",
    ko: "부산 출발로 경주 유네스코 유적 보는 투어가 있을까?",
    en: "Do you have a Gyeongju UNESCO day tour from Busan?",
  },
  {
    id: "incheon_cruise_seoul",
    region: "seoul",
    ko: "인천항 크루즈 손님이 서울 당일치기로 갈 수 있는 투어 알려줘.",
    en: "Recommend a Seoul day trip for cruise guests docking in Incheon.",
  },
  {
    id: "seoul_dmz_private",
    region: "seoul",
    ko: "서울에서 DMZ를 프라이빗하게 다녀오는 투어 있나?",
    en: "Do you have a private DMZ tour from Seoul?",
  },
  {
    id: "seoul_nami_private",
    region: "seoul",
    ko: "서울 근교 남이섬이나 아침고요수목원 프라이빗 투어 추천해줘.",
    en: "Recommend a private Nami Island or Garden of Morning Calm tour near Seoul.",
  },
];

const recommendationAngles = [
  { id: "low_walking", ko: "많이 걷지 않는 쪽이면 좋아.", en: "I prefer low walking." },
  { id: "family", ko: "초등학생 아이도 같이 가.", en: "A child will join us." },
  { id: "senior", ko: "어르신이 있어서 일정이 빡세지 않았으면 해.", en: "A senior traveler is coming, so avoid a rushed itinerary." },
  { id: "photos", ko: "사진 찍기 좋은 코스 위주로 보고 싶어.", en: "Prioritize photogenic stops." },
  { id: "budget", ko: "가격은 너무 비싸지 않은 옵션부터 보여줘.", en: "Start with reasonably priced options." },
  { id: "private", ko: "가능하면 프라이빗이나 소규모가 좋아.", en: "Private or small-group options are preferred." },
  { id: "pickup", ko: "호텔 픽업이 편한지 같이 알려줘.", en: "Mention whether pickup is convenient." },
];

const catalogPrompts = [
  "지금 공개된 전체 투어 상품 중 제주 상품만 추려줘.",
  "현재 판매 중인 부산 투어 목록을 간단히 보여줘.",
  "서울 출발 당일 투어 상품은 어떤 게 있어?",
  "크루즈 승객에게 맞는 투어 상품만 모아서 알려줘.",
  "프라이빗 차량 투어가 있는 지역을 알려줘.",
  "소그룹 투어 중 리뷰가 많은 상품을 추천해줘.",
  "유네스코 테마 투어는 어떤 상품이 있어?",
  "아이와 같이 가기 좋은 상품을 공개 상품 기준으로 보여줘.",
  "부모님 모시고 가기 편한 투어 상품을 골라줘.",
  "봄 시즌 꽃 관련 투어를 찾고 있어.",
  "여름 한정 상품은 뭐가 있어?",
  "겨울 제주 시즌 상품이 있으면 보여줘.",
  "쇼핑 강요 없는 투어 위주로 추천해줘.",
  "하루 안에 다녀오는 투어만 알려줘.",
  "공항이나 항구에서 시작하기 편한 상품 있어?",
  "AtoC Korea public tour catalogue에서 private 옵션만 보여줘.",
  "Which listed tours are best for UNESCO sites?",
  "Show me available shore excursions in the catalogue.",
  "Which tours are under about 60 USD?",
  "What small-group Korea tours do you currently list?",
];

const policyPrompts = [
  "환불 규정 알려줘. 전날 취소하면 어떻게 돼?",
  "투어 당일 노쇼면 환불 받을 수 있어?",
  "24시간 전에 취소하면 무료 취소야?",
  "48시간 전 취소와 24시간 전 취소가 달라?",
  "비가 많이 와서 투어가 취소되면 환불돼?",
  "최소 인원이 안 모이면 자동 취소되고 전액 환불돼?",
  "플랫폼 수수료도 환불되나?",
  "투어 제공자가 취소하면 어떻게 처리돼?",
  "카드 결제 실패하면 예약은 어떻게 돼?",
  "차지백 넣기 전에 어떻게 해야 해?",
  "결제는 언제 청구돼?",
  "예약 확정 전에는 카드에 돈이 빠져나가?",
  "아이 카시트 제공 정책이 있어?",
  "여행자 보험은 포함돼?",
  "포함사항이 아닌 비용은 어떻게 확인해?",
  "늦게 도착해서 일부만 참여하면 환불돼?",
  "픽업 시간 놓치면 노쇼 처리돼?",
  "상품 페이지와 확인서의 취소 조건이 다르면 뭐가 우선이야?",
  "환불 승인되면 며칠 안에 들어와?",
  "부분 환불이 가능한 상황을 알려줘.",
  "예약 변경 수수료가 있어?",
  "날씨 때문에 코스가 바뀌면 보상돼?",
  "투어 중 안전사고 책임은 누가 져?",
  "AtoC Korea가 직접 투어 운영사야?",
  "서비스 약관에서 중개자라는 말이 무슨 뜻이야?",
  "개인정보 처리방침 핵심만 알려줘.",
  "내 개인정보 삭제 요청은 어떻게 해?",
  "쿠키 정책에서 필수 쿠키는 뭐야?",
  "결제 제공자에게 어떤 정보가 공유돼?",
  "법적 분쟁은 어디 기준으로 처리돼?",
  "DSA 연락 이메일이 뭐야?",
  "Privacy request를 어디로 보내야 해?",
  "Terms of Service에서 사용자가 지켜야 할 행동은 뭐야?",
  "환불 요청할 때 예약번호가 꼭 필요해?",
  "예약자가 아닌 사람이 환불 신청해도 돼?",
  "예약 후 가격이 바뀌면 차액 환불돼?",
  "투어 제공자 정책을 AtoC가 바꿀 수 있어?",
  "예약 확정 이메일에 취소 조건이 들어가?",
  "현장 결제 가능한가?",
  "PayPal이나 Stripe 같은 결제사는 누가 관리해?",
  "Do I get a refund if I cancel the day before?",
  "What is your no-show policy?",
  "Can I delete my personal data?",
  "Do you sell customer personal information?",
  "Who is liable if a third-party tour provider changes the route?",
];

const bookingPrompts = [
  "내 호텔 픽업 시간이 정확히 몇 시야?",
  "내 예약번호가 기억 안 나는데 찾아줄 수 있어?",
  "기사님 연락처 알려줘.",
  "내 결제가 성공했는지 확인해줘.",
  "확정 메일이 안 왔는데 예약 됐어?",
  "예약 날짜를 내일로 바꿔줘.",
  "내 환불 처리됐는지 상태 확인해줘.",
  "호텔을 바꿨는데 픽업 장소 수정해줘.",
  "참가자 한 명 추가하고 싶어.",
  "아이 나이를 잘못 입력했는데 바꿔줘.",
  "내 영수증 다시 보내줘.",
  "내 예약에 포함된 옵션이 뭔지 확인해줘.",
  "내 투어가 오늘 정상 출발하는지 확인해줘.",
  "픽업 차량 번호 알려줘.",
  "드라이버가 어디쯤 왔는지 확인해줘.",
  "예약자 이름을 바꾸고 싶어.",
  "내 주문이 두 번 결제된 것 같아 확인해줘.",
  "예약 확정서에 나온 미팅 장소가 맞는지 확인해줘.",
  "내 쿠폰이 적용됐는지 봐줘.",
  "출발 시간이 바뀌었는지 내 예약 기준으로 알려줘.",
  "Can you check my exact pickup time?",
  "I did not receive my confirmation email. Is my booking confirmed?",
  "Please resend my receipt.",
  "Can you change my booking date?",
  "Did my refund already go through?",
  "I changed hotels. Can you update my pickup location?",
  "What is my driver's phone number?",
  "My card was charged twice. Can you check?",
  "Can you add one more traveler to my reservation?",
  "Please confirm my booking reference.",
];

const companySupportPrompts = [
  { prompt: "회사 주소와 연락처 알려줘.", expectedIntents: ["company"], noTourUrl: true },
  { prompt: "고객센터 이메일이 뭐야?", expectedIntents: ["company"], noTourUrl: true },
  { prompt: "AtoC Korea는 어떤 회사야?", expectedIntents: ["company"], noTourUrl: true },
  { prompt: "ATOC KOREA LLC 운영 주소 알려줘.", expectedIntents: ["company"], noTourUrl: true },
  { prompt: "파트너십 문의는 어디로 보내?", expectedIntents: ["company"], noTourUrl: true },
  { prompt: "법무 관련 연락 이메일 알려줘.", expectedIntents: ["legal", "company"], noTourUrl: true },
  { prompt: "운영사가 직접 투어를 진행하는지 회사 역할을 알려줘.", expectedIntents: ["company", "legal"], noTourUrl: true },
  { prompt: "고객 지원은 몇 시에 답변해?", expectedIntents: ["company"], noTourUrl: true },
  { prompt: "support@atockorea.com이 맞아?", expectedIntents: ["company"], noTourUrl: true },
  { prompt: "Where is AtoC Korea located?", expectedIntents: ["company"], noTourUrl: true },
  { prompt: "상담원 연결해줘.", expectedIntents: ["support"], supportAck: true },
  { prompt: "담당자가 연락해줘.", expectedIntents: ["support"], supportAck: true },
  { prompt: "텔레그램으로 연락줘.", expectedIntents: ["support"], supportAck: true },
  { prompt: "카카오톡으로 연락받고 싶어.", expectedIntents: ["support"], supportAck: true },
  { prompt: "문자 보내줘. 내가 물어볼 게 있어.", expectedIntents: ["support"], supportAck: true },
  { prompt: "전화줘. 예약 문제야.", expectedIntents: ["support"], supportAck: true },
  { prompt: "Please connect me with customer support.", expectedIntents: ["support"], supportAck: true },
  { prompt: "I want to talk to a human agent.", expectedIntents: ["support"], supportAck: true },
  { prompt: "Can staff message me about this?", expectedIntents: ["support"], supportAck: true },
  { prompt: "Need a representative, not the AI.", expectedIntents: ["support"], supportAck: true },
];

const poiPrompts = [
  "성산일출봉 입장료와 주차 가능 여부 알려줘.",
  "한라산 어리목 탐방로 운영 시간은 어떻게 돼?",
  "오설록 티뮤지엄 주차와 화장실 정보 있어?",
  "주상절리대 입장료가 있어?",
  "천제연폭포 관람 시간이 얼마나 걸려?",
  "감천문화마을은 유모차로 다니기 괜찮아?",
  "해동용궁사 주차가 편해?",
  "Starfield 수원 별마당도서관은 무료 입장이야?",
  "수원화성 성곽길은 밤에도 열려?",
  "에버랜드와 한국민속촌을 하루에 둘 다 보기 빡세?",
  "용두암은 휠체어 접근이 쉬워?",
  "함덕해변 근처 화장실이나 편의시설 알려줘.",
  "카멜리아힐은 비 오는 날에도 갈 만해?",
  "Hallasan Eorimok trail opening hours and parking?",
  "Does Seongsan Ilchulbong have admission and parking?",
];

function makeCase(id, theme, prompt, expected) {
  return { id, theme, prompt, expected };
}

const recommendationCases = recommendationTargets.flatMap((target) =>
  recommendationAngles.map((angle, angleIndex) =>
    makeCase(
      `rec_${target.id}_${angle.id}`,
      "tour_recommendation",
      angleIndex % 2 === 0 ? `${target.ko} ${angle.ko}` : `${target.en} ${angle.en}`,
      {
        expectedIntents: ["tour_recommendation", "tour_catalog"],
        mustHaveTourUrl: true,
        region: target.region,
      },
    ),
  ),
);

const cases = [
  ...recommendationCases,
  ...catalogPrompts.map((prompt, index) =>
    makeCase(`catalog_${String(index + 1).padStart(2, "0")}`, "tour_catalog", prompt, {
      expectedIntents: ["tour_recommendation", "tour_catalog"],
      mustHaveTourUrl: true,
    }),
  ),
  ...policyPrompts.map((prompt, index) =>
    makeCase(`policy_${String(index + 1).padStart(2, "0")}`, "policy_legal", prompt, {
      expectedIntents: ["policy", "legal", "company"],
      noTourUrl: true,
      mustContainAny: [
        "환불",
        "취소",
        "정책",
        "개인정보",
        "약관",
        "법",
        "결제",
        "청구",
        "중개자",
        "제3자",
        "제공자",
        "책임",
        "보험",
        "포함",
        "legal@",
        "dsa",
        "refund",
        "cancel",
        "policy",
        "privacy",
        "terms",
        "payment",
        "charge",
        "intermediary",
        "provider",
        "liability",
        "responsibility",
        "insurance",
        "included",
        "personal information",
        "sell",
        "share",
      ],
    }),
  ),
  ...bookingPrompts.map((prompt, index) =>
    makeCase(`booking_${String(index + 1).padStart(2, "0")}`, "booking_specific", prompt, {
      expectedIntents: ["booking_specific"],
      handoffOffered: true,
      noTourUrl: true,
      mustContainAny: ["예약", "확인", "담당자", "support", "booking", "record", "customer support"],
    }),
  ),
  ...companySupportPrompts.map((item, index) =>
    makeCase(`company_support_${String(index + 1).padStart(2, "0")}`, "company_support", item.prompt, item),
  ),
  ...poiPrompts.map((prompt, index) =>
    makeCase(`poi_${String(index + 1).padStart(2, "0")}`, "poi", prompt, {
      expectedIntents: ["poi"],
      noTourUrl: true,
    }),
  ),
];

if (cases.length !== 200) {
  throw new Error(`Expected exactly 200 pressure-test cases, got ${cases.length}`);
}

const selectedCases = LIMIT > 0 ? cases.slice(0, LIMIT) : cases;

const regionTerms = {
  jeju: ["jeju", "제주"],
  busan: ["busan", "부산"],
  gyeongju: ["gyeongju", "경주"],
  seoul: ["seoul", "서울", "incheon", "인천", "dmz", "nami", "남이섬"],
};

function includesAny(text, terms = []) {
  const value = text.toLocaleLowerCase();
  return terms.some((term) => value.includes(term.toLocaleLowerCase()));
}

function gradeResult(testCase, response) {
  const failures = [];
  const expected = testCase.expected;
  const reply = String(response.body?.reply ?? "");
  const lowerReply = reply.toLocaleLowerCase();
  const intent = response.body?.debug_intent?.intent;

  if (response.status !== 200) {
    failures.push(`HTTP ${response.status}`);
  }
  if (expected.expectedIntents && !expected.expectedIntents.includes(intent)) {
    failures.push(`intent ${intent ?? "missing"} not in [${expected.expectedIntents.join(", ")}]`);
  }
  if (expected.mustHaveTourUrl && !/\/tour-product\/[a-z0-9-]+/i.test(reply)) {
    failures.push("missing listed tour URL");
  }
  if (expected.noTourUrl && /\/tour-product\/[a-z0-9-]+/i.test(reply)) {
    failures.push("unexpected tour URL in non-tour answer");
  }
  if (expected.handoffOffered !== undefined && Boolean(response.body?.handoff_offered) !== expected.handoffOffered) {
    failures.push(`handoff_offered expected ${expected.handoffOffered}, got ${response.body?.handoff_offered}`);
  }
  if (expected.supportAck) {
    if (response.body?.ticket_id !== null) failures.push("debug support request should not create a ticket");
    if (response.body?.escalation_reason !== "user_requested_human") {
      failures.push(`support escalation reason expected user_requested_human, got ${response.body?.escalation_reason}`);
    }
  }
  if (expected.mustContainAny && !includesAny(reply, expected.mustContainAny)) {
    failures.push(`reply missing any of: ${expected.mustContainAny.join(", ")}`);
  }
  if (expected.region && !includesAny(reply, regionTerms[expected.region] ?? [])) {
    failures.push(`reply missing region signal: ${expected.region}`);
  }
  if (testCase.theme === "policy_legal") {
    const tourish = ["/tour-product/", "추천 투어", "day tour", "public tour catalogue"].some((term) =>
      lowerReply.includes(term),
    );
    if (tourish) failures.push("policy/legal answer drifted into tour recommendation");
  }

  return failures;
}

async function callCase(testCase) {
  const startedAt = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/api/tour-product/assistant`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: "NEXT_LOCALE=ko" },
      body: JSON.stringify({
        tourProductSlug: "__site__",
        assistantScope: "site",
        debugNoSideEffects: true,
        messages: [{ role: "user", content: testCase.prompt }],
        pageContext: { url: "/ko", title: "AtoC Korea" },
      }),
    });
    const body = await res.json().catch(async () => ({ raw: await res.text() }));
    const result = {
      ...testCase,
      status: res.status,
      elapsedMs: Date.now() - startedAt,
      body,
    };
    return { ...result, failures: gradeResult(testCase, result) };
  } catch (error) {
    const result = {
      ...testCase,
      status: 0,
      elapsedMs: Date.now() - startedAt,
      body: { error: error instanceof Error ? error.message : String(error) },
    };
    return { ...result, failures: gradeResult(testCase, result) };
  }
}

async function runWithConcurrency(items, worker, concurrency) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function runWorker() {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await worker(items[current], current);
      const done = results.filter(Boolean).length;
      if (done % 10 === 0 || done === items.length) {
        process.stdout.write(`progress ${done}/${items.length}\n`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, runWorker));
  return results;
}

const results = await runWithConcurrency(selectedCases, callCase, CONCURRENCY);
const failures = results.filter((result) => result.failures.length > 0);
const byTheme = results.reduce((acc, result) => {
  const bucket = (acc[result.theme] ??= { total: 0, failed: 0 });
  bucket.total += 1;
  if (result.failures.length > 0) bucket.failed += 1;
  return acc;
}, {});

const outputDir = path.join(process.cwd(), ".tmp");
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, `chatbot-pressure-test-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(
  outputPath,
  JSON.stringify(
    {
      baseUrl: BASE_URL,
      total: results.length,
      failed: failures.length,
      byTheme,
      results,
    },
    null,
    2,
  ),
);

console.log(JSON.stringify({ total: results.length, failed: failures.length, byTheme, outputPath }, null, 2));
if (failures.length > 0) {
  console.log("Top failures:");
  for (const failure of failures.slice(0, 25)) {
    const reply = String(failure.body?.reply ?? failure.body?.error ?? "").replace(/\s+/g, " ").slice(0, 220);
    console.log(`- ${failure.id} [${failure.theme}] ${failure.failures.join("; ")} :: ${failure.prompt} :: ${reply}`);
  }
  process.exitCode = 1;
}
