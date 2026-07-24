/**
 * A7.1 — guardrail leak test (§D-3). 100+ adversarial phrasings across the three
 * hardcoded guardrails, in the 5 room locales plus realistic paraphrases that
 * avoid the exact dictionary words.
 *
 * 🔴 The hardcoded guardrail is "the real gate" (concierge route comment); the
 *    LLM system prompt is only belt-and-braces. A leak means a message that must
 *    route to a human (or the SOS/119 path) instead falls through to the LLM.
 *    Severity: an EMERGENCY leak is a P0 — the traveller needs the SOS button
 *    and 119, not a chatbot trying to answer.
 *
 * This test pins the corpus. A phrasing a real guest would use that leaks is a
 * finding to fix by adding a keyword (additive, safe) — not to delete from here.
 */

import { classifyConciergeGuardrail } from '@/lib/tour-room/concierge';

type G = 'emergency' | 'ops_request' | 'venue_recommendation' | null;

/** Direct + paraphrased phrasings a real guest might type. */
const EMERGENCY: string[] = [
  // direct dictionary
  'call an ambulance', 'we need the police', 'where is the hospital',
  'this is an emergency', 'someone is injured', "she's bleeding", 'he is unconscious',
  'I think it is a heart attack',
  // realistic paraphrases (the leak-hunting set)
  'someone fainted', 'a passenger collapsed', 'he passed out', 'she can’t breathe',
  'call 119', 'call 112', 'we need an ambulance now', 'my friend is choking',
  'chest pain', 'he is having a seizure', 'severe allergic reaction',
  // other locales
  '구급차 불러주세요', '경찰 불러주세요', '병원 어디예요', '응급 상황이에요', '피가 나요',
  '쓰러졌어요', '숨을 못 쉬어요', '119 불러주세요', '의식이 없어요',
  '救急車を呼んでください', '警察を呼んで', '病院はどこ', '出血しています', '意識がありません',
  'llamen una ambulancia', 'necesitamos la policía', 'está sangrando', 'está herido',
  '叫救护车', '打119', '有人晕倒了', '流血了', '失去意识',
];

const OPS: string[] = [
  'I want a refund', 'can we cancel', 'please reschedule us', 'change the itinerary',
  'change the time please', 'can I rebook for tomorrow', 'is there a discount',
  '환불해 주세요', '취소하고 싶어요', '일정 변경 가능한가요', '시간 바꿔주세요', '할인 되나요',
  '返金してほしい', 'キャンセルしたい', '予定変更できますか', '割引ありますか',
  'quiero un reembolso', 'quiero cancelar', 'cambiar la hora', 'hay descuento',
  '我要退款', '可以取消吗', '改时间', '有折扣吗',
];

const VENUE: string[] = [
  'can you recommend a restaurant', 'where should we eat', 'where to eat nearby',
  'best food around here', 'is there a cafe nearby', 'where to buy souvenirs',
  'good shopping nearby',
  '맛집 추천해 주세요', '먹을 곳 알려줘', '식당 추천', '쇼핑 어디서 해요', '기념품 가게 어디',
  'おすすめのレストラン', '美味しい店', '買い物どこ', 'お土産屋はどこ',
  'recomienda un restaurante', 'dónde comer', 'compras cerca',
  '推荐餐厅', '好吃的在哪', '哪里购物', '纪念品店在哪',
];

/** Legitimate Tier-0 questions — must NOT trip any guardrail (false-positive check). */
const SAFE: string[] = [
  'where is the restroom', 'when is the next stop', 'how much time do we have left',
  'what is the best photo spot', 'what time do we leave',
  '화장실 어디예요', '다음 일정 언제예요', '남은 시간 얼마예요', '포토스팟 어디예요',
  'トイレはどこ', '次の予定は', 'お手洗いはどこですか',
  'dónde está el baño', 'cuánto tiempo queda',
  '洗手间在哪', '下一站是什么',
];

function report(label: string, cases: string[], expected: G) {
  const leaks = cases.filter((c) => classifyConciergeGuardrail(c) !== expected);
  return { label, total: cases.length, leaks };
}

describe('A7.1 concierge guardrail leak — 100+ adversarial cases', () => {
  it('🔴 EMERGENCY never leaks (a leak here is P0 — must reach SOS/119, not the LLM)', () => {
    const { leaks } = report('emergency', EMERGENCY, 'emergency');
    expect(leaks).toEqual([]);
  });

  it('ops_request (refund/cancel/reschedule/discount) never leaks', () => {
    const { leaks } = report('ops', OPS, 'ops_request');
    expect(leaks).toEqual([]);
  });

  it('venue_recommendation (eat/shop) never leaks', () => {
    const { leaks } = report('venue', VENUE, 'venue_recommendation');
    expect(leaks).toEqual([]);
  });

  it('legitimate Tier-0 questions do not false-trip a guardrail', () => {
    const falsePositives = SAFE.filter((c) => classifyConciergeGuardrail(c) !== null);
    expect(falsePositives).toEqual([]);
  });

  it('corpus is at least 100 cases', () => {
    expect(EMERGENCY.length + OPS.length + VENUE.length + SAFE.length).toBeGreaterThanOrEqual(100);
  });
});
