/**
 * places 행에 대한 임베딩 생성 (Gemini embedding-001, 3072차원).
 * 시드/정제 후 DB 적재 전 호출.
 */

const EMBED_MODEL = 'models/gemini-embedding-001';
const EMBED_DIM = 3072;

export interface PlaceRowForEmbed {
  title: string;
  address: string | null;
  overview: string | null;
}

/** 임베딩용 문맥 문자열 (Python build_context와 동일 포맷) */
export function buildContext(row: PlaceRowForEmbed): string {
  const title = (row.title ?? '').trim() || '장소명 없음';
  const address = (row.address ?? '').trim() || '주소 없음';
  const overview = (row.overview ?? '').trim();
  const desc = overview && overview !== 'nan' && overview !== 'None' ? overview : '제주도 관광·맛집 정보.';
  const text = `장소명: ${title}, 주소: ${address}, 설명: ${desc}`;
  return text.length >= 2 ? text : '장소 정보 없음';
}

/** 단일 텍스트 임베딩 (REST embedContent) */
export async function embedOne(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${EMBED_MODEL}:embedContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text: text.slice(0, 8000) }] },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`embedContent failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { embedding?: { values?: number[] } };
  const values = data.embedding?.values;
  if (!Array.isArray(values) || values.length !== EMBED_DIM) {
    throw new Error(`embedContent invalid response: expected ${EMBED_DIM} dims`);
  }
  return values;
}

/** 여러 텍스트 순차 임베딩 (배치 간 딜레이로 429 방지) */
export async function embedBatch(
  texts: string[],
  apiKey: string,
  options: { batchSize?: number; delayMs?: number } = {}
): Promise<number[][]> {
  const { batchSize = 10, delayMs = 200 } = options;
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((text) => embedOne(text, apiKey))
    );
    for (const r of results) {
      if (r.status === 'fulfilled') out.push(r.value);
      else out.push([]);
    }
    if (i + batchSize < texts.length) await new Promise((r) => setTimeout(r, delayMs));
  }
  return out;
}

export { EMBED_DIM };
