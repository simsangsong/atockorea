/**
 * i18n 파이프라인 [0단] — 추출·세그먼테이션.
 *
 * `tour_product_pages.detail_payload`(jsonb)를 재귀 순회해 **번역 대상 리프만** 뽑는다.
 * 플랜 v3 §5. 화이트리스트가 1차, 휴리스틱은 그 안에서만 보조로 작동한다.
 *
 * 🔴 FORBIDDEN 등급 키는 순회 자체를 하지 않는다 — `matching_profile`이 번역되면
 * 매칭 엔진이, `slug`/`locale`/`product_id`가 번역되면 라우팅이 깨진다.
 */

export type Tier = 'A1' | 'A2' | 'B' | 'FORBIDDEN' | 'HOLD';

/**
 * `detail_payload` top-level 키 등급 (2026-07-25 라이브 실측 30키 기준).
 *
 * 미등록 키는 `UNKNOWN_KEY_TIER`로 떨어진다 — 스키마가 자라도 조용히 번역되지
 * 않고 리포트에 뜬다. 새 키를 발견하면 여기에 등급을 부여하는 것이 절차다.
 */
export const TOP_LEVEL_TIERS: Record<string, Tier> = {
  // A-1 — 사람 100% 감수. 오픈 게이트 필수 항목.
  hero: 'A1',
  headlineLine1: 'A1',
  headlineLine2: 'A1',
  glanceItems: 'A1',
  catalog_card: 'A1',
  seo: 'A1',
  pickup_dropoff: 'A1',
  practicalAccordionItems: 'A1',
  subnavItems: 'A1',

  // A-2 — 자동 검증 + 20% 표본.
  whyTourWorks: 'A2',
  staticQuestions: 'A2',
  bookingTrustItems: 'A2',
  seasonalVariations: 'A2',
  bookingSupportSteps: 'A2',
  practicalWeatherStatic: 'A2',
  routeShapeIntro: 'A2',

  // B — 자동 검증 전량 + 슬러그당 표본. 최대 물량.
  itineraryStops: 'B',
  routePhases: 'B',
  routeFlowStops: 'B',
  galleryItems: 'B',

  // 🚫 금지 — 파이프라인이 건드리면 실패로 간주.
  slug: 'FORBIDDEN',
  locale: 'FORBIDDEN',
  product_id: 'FORBIDDEN',
  document_kind: 'FORBIDDEN',
  schema_version: 'FORBIDDEN',
  matching_profile: 'FORBIDDEN',
  matching_metadata: 'FORBIDDEN',
  price: 'FORBIDDEN',

  // ⚠ 보류 — 플랜 v3 §7 Q8. 실고객 리뷰 번역의 진실성 문제가 미결.
  guestReviews: 'HOLD',
  reviewsSummary: 'HOLD',
};

/** 등급 미부여 키의 기본값 — 번역하지 않고 리포트에 남긴다. */
export const UNKNOWN_KEY_TIER: Tier = 'HOLD';

export function tierOfTopLevelKey(key: string): Tier {
  return TOP_LEVEL_TIERS[key] ?? UNKNOWN_KEY_TIER;
}

/** 번역 대상 등급인가. */
export function isTranslatableTier(tier: Tier): boolean {
  return tier === 'A1' || tier === 'A2' || tier === 'B';
}

// ── JSON Pointer (RFC 6901) ───────────────────────────────────────────────────

export function escapePointerToken(token: string): string {
  return token.replace(/~/g, '~0').replace(/\//g, '~1');
}

export function unescapePointerToken(token: string): string {
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

export function joinPointer(parent: string, token: string | number): string {
  return `${parent}/${escapePointerToken(String(token))}`;
}

/** 포인터로 값을 읽는다. 없으면 undefined. */
export function getAtPointer(root: unknown, pointer: string): unknown {
  if (pointer === '') return root;
  let cur: unknown = root;
  for (const raw of pointer.split('/').slice(1)) {
    const token = unescapePointerToken(raw);
    if (Array.isArray(cur)) {
      const idx = Number(token);
      if (!Number.isInteger(idx)) return undefined;
      cur = cur[idx];
    } else if (cur && typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[token];
    } else {
      return undefined;
    }
    if (cur === undefined) return undefined;
  }
  return cur;
}

/** 포인터 위치에 값을 쓴다. 중간 경로가 없으면 아무것도 하지 않고 false. */
export function setAtPointer(root: unknown, pointer: string, value: unknown): boolean {
  const tokens = pointer.split('/').slice(1).map(unescapePointerToken);
  if (tokens.length === 0) return false;
  let cur: unknown = root;
  for (const token of tokens.slice(0, -1)) {
    if (Array.isArray(cur)) {
      const idx = Number(token);
      if (!Number.isInteger(idx)) return false;
      cur = cur[idx];
    } else if (cur && typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[token];
    } else {
      return false;
    }
    if (cur === undefined || cur === null) return false;
  }
  const last = tokens[tokens.length - 1];
  if (Array.isArray(cur)) {
    const idx = Number(last);
    if (!Number.isInteger(idx) || idx < 0 || idx >= cur.length) return false;
    cur[idx] = value;
    return true;
  }
  if (cur && typeof cur === 'object') {
    if (!(last in (cur as Record<string, unknown>))) return false;
    (cur as Record<string, unknown>)[last] = value;
    return true;
  }
  return false;
}

// ── 리프 번역 대상성 휴리스틱 ─────────────────────────────────────────────────

/** 문자열 리프 중 "번역하면 안 되는 것"을 걸러낸다. 화이트리스트 안에서만 작동. */
export function isTranslatableLeaf(text: string, keyHint = ''): boolean {
  const s = text.trim();
  if (s.length === 0) return false;

  // 글자가 하나도 없으면(숫자·기호뿐) 번역 대상 아님.
  if (!/\p{L}/u.test(s)) return false;

  // URL·경로·이메일·미디어 파일.
  if (/^(https?:\/\/|\/\/|\/[\w.-]*\/|mailto:|tel:)/i.test(s)) return false;
  if (/^[\w.-]+@[\w.-]+\.\w+$/.test(s)) return false;
  if (/\.(png|jpe?g|webp|avif|svg|gif|mp4|webm|vtt|json|css|js)$/i.test(s)) return false;

  // 색상 토큰·CSS 값.
  if (/^#[0-9a-f]{3,8}$/i.test(s)) return false;
  if (/^-?\d+(\.\d+)?(px|rem|em|vh|vw|%|s|ms)$/i.test(s)) return false;

  // ISO 날짜·시각.
  if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?/.test(s)) return false;

  // enum·slug·식별자: 공백 없는 snake_case / kebab-case / dot.path.
  //   "small_group" "zh-TW" "hero.title" 같은 값은 데이터이고 문구가 아니다.
  if (!/\s/.test(s) && /^[a-z0-9]+([._-][a-z0-9]+)+$/i.test(s)) return false;

  // 키 이름 자체가 식별자성이면 제외 (id, key, slug, url, icon, image, ...).
  if (/(^|_|\.)(id|ids|key|keys|slug|url|href|src|icon|image|images|photo|code|type|kind|variant|token|ref|anchor|tag|color|locale|lang)$/i.test(keyHint)) {
    return false;
  }

  return true;
}

// ── 재귀 순회 ─────────────────────────────────────────────────────────────────

export interface Leaf {
  /** RFC 6901 JSON Pointer. `detail_payload` 루트 기준. */
  pointer: string;
  /** 원문. */
  text: string;
  /** 이 리프가 속한 top-level 키. */
  topLevelKey: string;
  /** 등급. */
  tier: Tier;
}

export interface ExtractReport {
  leaves: Leaf[];
  /** 등급 미부여로 건너뛴 top-level 키 — 스키마 성장 감지용. */
  unknownKeys: string[];
  /** 건너뛴 리프 수 (휴리스틱 제외분). */
  skippedLeaves: number;
}

export interface ExtractOptions {
  /** 이 등급만 추출. 기본 = A1·A2·B 전부. */
  tiers?: Tier[];
}

/**
 * `detail_payload` → 번역 대상 리프 목록.
 *
 * FORBIDDEN·HOLD 키는 하위 순회를 아예 하지 않는다(비용 절감이 아니라 안전 장치 —
 * 실수로 포인터가 새어나가는 경로를 없앤다).
 */
export function extractLeaves(payload: unknown, options: ExtractOptions = {}): ExtractReport {
  const allowed = new Set<Tier>(options.tiers ?? ['A1', 'A2', 'B']);
  const leaves: Leaf[] = [];
  const unknownKeys: string[] = [];
  let skippedLeaves = 0;

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { leaves, unknownKeys, skippedLeaves };
  }

  for (const [topKey, value] of Object.entries(payload as Record<string, unknown>)) {
    const tier = tierOfTopLevelKey(topKey);
    if (!(topKey in TOP_LEVEL_TIERS)) unknownKeys.push(topKey);
    if (!isTranslatableTier(tier) || !allowed.has(tier)) continue;

    walk(value, joinPointer('', topKey), topKey);
  }

  function walk(node: unknown, pointer: string, topKey: string): void {
    if (typeof node === 'string') {
      const keyHint = pointer.slice(pointer.lastIndexOf('/') + 1);
      if (isTranslatableLeaf(node, keyHint)) {
        leaves.push({ pointer, text: node, topLevelKey: topKey, tier: tierOfTopLevelKey(topKey) });
      } else {
        skippedLeaves += 1;
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, joinPointer(pointer, i), topKey));
      return;
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        walk(v, joinPointer(pointer, k), topKey);
      }
    }
    // number·boolean·null 은 번역 대상이 아니다.
  }

  return { leaves, unknownKeys, skippedLeaves };
}

/**
 * 청크 분할 — unit = 슬러그 1 × 로케일 1 × 청크 1 (플랜 §3-[2]).
 *
 * top-level 키 경계를 넘지 않게 묶는다. 한 unit이 한 섹션만 다루면 서브에이전트
 * 프롬프트가 짧아지고, 실패 시 재큐 범위도 그 섹션으로 국한된다.
 */
export function chunkLeaves(leaves: Leaf[], maxCharsPerChunk = 6000): Leaf[][] {
  const byKey = new Map<string, Leaf[]>();
  for (const leaf of leaves) {
    const list = byKey.get(leaf.topLevelKey);
    if (list) list.push(leaf);
    else byKey.set(leaf.topLevelKey, [leaf]);
  }

  const chunks: Leaf[][] = [];
  for (const group of byKey.values()) {
    let current: Leaf[] = [];
    let size = 0;
    for (const leaf of group) {
      if (current.length > 0 && size + leaf.text.length > maxCharsPerChunk) {
        chunks.push(current);
        current = [];
        size = 0;
      }
      current.push(leaf);
      size += leaf.text.length;
    }
    if (current.length > 0) chunks.push(current);
  }
  return chunks;
}

/** TM 캐시 키 재료 — 중복 제거의 기준 (플랜 §3-[0]). */
export function sourceHash(text: string): string {
  // Node 내장 crypto를 쓰지 않고 순수 함수로 두어 브라우저/테스트 환경 모두에서 동작.
  // FNV-1a 64bit 변형 — 충돌 확률이 TM 캐시 용도로 충분히 낮다.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ ((c << 3) | (c >>> 5)), 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}
