/**
 * §L L4 — Tier 0 커버리지 루프. 순수부.
 *
 * Tier 0 사전에 걸리는 질문은 **네트워크도 LLM도 쓰지 않는다**(< 100ms).
 * Tier 1로 새는 질문은 매번 LLM 호출이다. 그래서 "무엇이 새고 있나"를 아는
 * 것이 §L에서 가장 값싼 절감원이다 — 캐시(L2)는 같은 질문의 **두 번째**부터
 * 아끼지만, 사전은 **첫 번째부터** 아낀다.
 *
 * 🔴 **자동으로 사전에 추가하지 않는다.** 빈도만 보고 키워드를 넣으면 오답이
 * 사전에 굳고, 그때부터 그 질문은 영원히 틀린 답을 즉답으로 받는다 —
 * 되돌리려면 누군가 그게 틀렸다는 걸 먼저 알아채야 한다. 이 모듈은
 * **후보 목록만** 만들고, 채택은 사람이 한다.
 *
 * 🔴 질문 원문에는 손님 자유 텍스트가 들어간다. 이 모듈은 순수 계산만 하고,
 * 저장하거나 전송하지 않는다(호출부가 콘솔에만 찍는다).
 */

/** 군집 키. 조사·어미까지 지우지 않는다 — 다른 질문이 한 덩어리가 되면 후보가 거짓말이 된다. */
export function normalizeForCluster(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[?？!！.,。、~～]+/gu, '')
    .trim();
}

export interface QuestionSample {
  question: string;
  /** 이 질문이 어느 로케일에서 왔나. 사전은 로케일별로 산다. */
  locale?: string | null;
}

export interface Tier0Candidate {
  /** 정규화 키(군집 대표). */
  key: string;
  /** 원문 예시 — 사람이 판단하려면 실제 문장이 필요하다. */
  samples: string[];
  count: number;
  locales: string[];
}

/**
 * Tier 1로 샌 질문들을 빈도순 후보로 묶는다.
 *
 * `alreadyMatched`는 Tier 0 매처다 — 이미 잡히는 질문은 후보가 아니다.
 * (그런 게 섞여 있다면 Tier 1로 샌 이유가 사전이 아니라 다른 데 있다는 뜻이고,
 *  그건 사전을 늘려도 안 고쳐진다.)
 */
export function rankTier0Candidates(
  samples: QuestionSample[],
  options: { alreadyMatched?: (text: string) => boolean; minCount?: number; limit?: number } = {},
): Tier0Candidate[] {
  const minCount = options.minCount ?? 2;
  const limit = options.limit ?? 20;

  const buckets = new Map<string, { samples: string[]; count: number; locales: Set<string> }>();
  for (const s of samples) {
    const text = (s.question ?? '').trim();
    if (!text) continue;
    // 이미 Tier 0가 잡는 질문은 후보가 아니다.
    if (options.alreadyMatched?.(text)) continue;
    const key = normalizeForCluster(text);
    if (key.length < 3) continue; // 감탄사·오타

    const bucket = buckets.get(key) ?? { samples: [], count: 0, locales: new Set<string>() };
    bucket.count += 1;
    if (bucket.samples.length < 3 && !bucket.samples.includes(text)) bucket.samples.push(text);
    if (s.locale) bucket.locales.add(s.locale);
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .map(([key, b]) => ({ key, samples: b.samples, count: b.count, locales: [...b.locales].sort() }))
    // 🔴 한 번만 나온 질문은 후보가 아니다. 사전은 반복되는 것에만 값어치가 있고,
    // 일회성 질문을 넣으면 사전이 부풀어 매칭이 느려지고 오탐이 는다.
    .filter((c) => c.count >= minCount)
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);
}

/**
 * 아낄 수 있었던 LLM 호출 수. 후보를 전부 채택했다면 사라졌을 Tier 1 호출이다.
 * 실제 절감액이 아니라 **상한**이다 — 사람이 일부만 채택할 것이므로.
 */
export function potentialCallsSaved(candidates: Tier0Candidate[]): number {
  return candidates.reduce((sum, c) => sum + c.count, 0);
}
