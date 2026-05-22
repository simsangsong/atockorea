import enMessages from "@/messages/en.json";
import koMessages from "@/messages/ko.json";
import jaMessages from "@/messages/ja.json";
import esMessages from "@/messages/es.json";
import zhMessages from "@/messages/zh.json";
import zhTwMessages from "@/messages/zh-TW.json";
import poiKnowledgeBase from "@/data/poi_kb/poi_knowledge_base_v1.29.json";
import matchPoiNameSnapshot from "@/scripts/seed-match-pois-snapshot.json";
import globalPolicies from "@/data/tour-policies/global-policies.json";
import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";

type JsonRecord = Record<string, unknown>;

export type SiteKnowledgeChunk = {
  id: string;
  source: string;
  locale: TourProductPageLocale | "all";
  category: "footer" | "about" | "legal" | "policy" | "poi";
  title: string;
  text: string;
  tags: string[];
  priority?: number;
};

type MatchPoiNameRow = {
  poi_key?: string;
  name_en?: string;
  name_ko?: string;
  names_other_locales?: Partial<Record<TourProductPageLocale, string>>;
  region?: string;
  category?: string;
};

type GlobalPolicy = {
  id: string;
  category: string;
  applies_to?: string[];
  title: string;
  text: string;
};

const MESSAGES_BY_LOCALE: Record<TourProductPageLocale, JsonRecord> = {
  en: enMessages as JsonRecord,
  ko: koMessages as JsonRecord,
  ja: jaMessages as JsonRecord,
  es: esMessages as JsonRecord,
  zh: zhMessages as JsonRecord,
  "zh-TW": zhTwMessages as JsonRecord,
};

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "can",
  "could",
  "for",
  "from",
  "how",
  "i",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "please",
  "the",
  "this",
  "to",
  "what",
  "when",
  "where",
  "with",
  "you",
  "your",
]);

const CATEGORY_BOOSTS: Array<{ category: SiteKnowledgeChunk["category"]; tokens: string[]; boost: number }> = [
  {
    category: "legal",
    tokens: ["legal", "terms", "privacy", "cookie", "cookies", "dsa", "law", "liability", "약관", "개인정보", "쿠키", "법무"],
    boost: 16,
  },
  {
    category: "policy",
    tokens: ["refund", "cancel", "cancellation", "payment", "child", "seat", "환불", "취소", "결제", "아동", "좌석"],
    boost: 18,
  },
  {
    category: "footer",
    tokens: ["company", "contact", "email", "address", "support", "atoc", "atockorea", "회사", "주소", "연락", "이메일", "고객"],
    boost: 18,
  },
  {
    category: "about",
    tokens: ["about", "story", "partner", "career", "intermediary", "operator", "소개", "회사", "파트너", "채용", "중개"],
    boost: 14,
  },
  {
    category: "poi",
    tokens: ["poi", "place", "spot", "attraction", "hours", "admission", "parking", "restroom", "명소", "장소", "입장료", "운영", "주차", "화장실"],
    boost: 14,
  },
];

const STATIC_LEGAL_OVERVIEW: Array<Omit<SiteKnowledgeChunk, "locale">> = [
  {
    id: "legal-overview:terms",
    source: "/legal",
    category: "legal",
    title: "Legal overview - Terms of Service",
    text:
      "The Terms of Service cover the user agreement, definitions, bookings, payments, cancellations and refunds, user conduct, disclaimers, limitation of liability, dispute resolution, and related matters for the ATOC KOREA LLC tour booking intermediary platform in the Republic of Korea and United States. ATOC KOREA LLC operates only as a booking intermediary and does not operate tours. Independent third parties deliver tour services; execution, safety, and quality are the tour provider's responsibility.",
    tags: ["legal", "terms", "intermediary", "tour provider", "liability"],
    priority: 2,
  },
  {
    id: "legal-overview:privacy",
    source: "/legal",
    category: "legal",
    title: "Legal overview - Privacy Policy",
    text:
      "The Privacy Policy is designed to align with Korea's Personal Information Protection Act (PIPA) and U.S. state privacy laws, including California CCPA/CPRA where applicable. ATOC KOREA LLC collects data as needed for bookings, communications, and legal compliance; shares data with payment processors and tour providers for fulfillment; and does not sell personal data.",
    tags: ["legal", "privacy", "PIPA", "CCPA", "CPRA", "data"],
    priority: 2,
  },
  {
    id: "legal-overview:cookies",
    source: "/legal",
    category: "legal",
    title: "Legal overview - Cookie Policy",
    text:
      "The Cookie Policy explains use of cookies and similar technologies for essential functionality, security, fraud prevention, payments, and preferences. Necessary cookies include session, authentication, and security cookies. Functional cookies may remember preferences such as language. Performance or analytics cookies may be used. Payment providers may set cookies during checkout; blocking essential or payment-related cookies can affect login or checkout.",
    tags: ["legal", "cookies", "payments", "checkout", "security"],
    priority: 2,
  },
  {
    id: "legal-overview:dsa",
    source: "/dsa",
    category: "legal",
    title: "DSA information",
    text:
      "ATOC KOREA LLC operates this website as an online travel booking platform and facilitates reservations between users and independent third-party tour providers. ATOC KOREA LLC does not provide tour services directly. The DSA contact email for authorities and users is legal@atockorea.com, and the language of communication is English. The platform is below the EU Very Large Online Platform threshold under Article 33 DSA.",
    tags: ["legal", "DSA", "EU", "legal@atockorea.com", "intermediary"],
    priority: 1,
  },
];

const chunkCache = new Map<TourProductPageLocale, SiteKnowledgeChunk[]>();

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripMarkdown(value: string): string {
  return value
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1");
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function titleFromKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();
}

function humanizePoiKey(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function collectText(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") {
    const text = compactWhitespace(stripMarkdown(value));
    if (!text || text.startsWith("/images/")) return [];
    return [prefix ? `${prefix}: ${text}` : text];
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return [prefix ? `${prefix}: ${String(value)}` : String(value)];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectText(item, prefix));
  }
  const record = asRecord(value);
  if (!record) return [];
  const lines: string[] = [];
  for (const [key, child] of Object.entries(record)) {
    if (key === "image" || key === "images" || key === "icon" || key === "src") continue;
    const label = /^p\d|^li\d|^h3\d|title$|intro/.test(key) ? "" : titleFromKey(key);
    lines.push(...collectText(child, label));
  }
  return lines;
}

function getNested(record: JsonRecord, path: string): unknown {
  let current: unknown = record;
  for (const part of path.split(".")) {
    const next = asRecord(current);
    if (!next) return undefined;
    current = next[part];
  }
  return current;
}

function addChunk(chunks: SiteKnowledgeChunk[], chunk: SiteKnowledgeChunk): void {
  const text = compactWhitespace(stripMarkdown(chunk.text));
  if (!text) return;
  chunks.push({
    ...chunk,
    text,
    tags: Array.from(new Set(chunk.tags.map((tag) => compactWhitespace(tag)).filter(Boolean))),
  });
}

function addMessageChunk(
  chunks: SiteKnowledgeChunk[],
  locale: TourProductPageLocale,
  category: SiteKnowledgeChunk["category"],
  id: string,
  source: string,
  title: string,
  value: unknown,
  tags: string[],
  priority?: number,
): void {
  const lines = collectText(value);
  addChunk(chunks, {
    id: `${locale}:${id}`,
    source,
    locale,
    category,
    title,
    text: lines.join(" "),
    tags,
    priority,
  });
}

function sortedSectionKeys(record: JsonRecord): string[] {
  return Object.keys(record)
    .filter((key) => /^s\d+$/.test(key))
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
}

function buildLegalPolicyChunks(
  chunks: SiteKnowledgeChunk[],
  locale: TourProductPageLocale,
  messages: JsonRecord,
  namespace: "terms" | "privacy" | "refund" | "cookiePolicy",
  source: string,
): void {
  const section = asRecord(messages[namespace]);
  if (!section) return;
  const title = typeof section.title === "string" ? section.title : titleFromKey(namespace);
  const intro: JsonRecord = {};
  for (const [key, value] of Object.entries(section)) {
    if (/^s\d+$/.test(key) || key === "backToLegal") continue;
    intro[key] = value;
  }
  addMessageChunk(chunks, locale, namespace === "refund" ? "policy" : "legal", `${namespace}:intro`, source, title, intro, [
    namespace,
    title,
    "legal",
  ], 2);

  for (const key of sortedSectionKeys(section)) {
    const child = section[key];
    const childRecord = asRecord(child);
    const childTitle = typeof childRecord?.title === "string" ? childRecord.title : `${title} ${key.toUpperCase()}`;
    addMessageChunk(
      chunks,
      locale,
      namespace === "refund" ? "policy" : "legal",
      `${namespace}:${key}`,
      source,
      childTitle,
      child,
      [namespace, title, childTitle, "legal"],
    );
  }

  if (namespace === "privacy") {
    const googleApi = asRecord(section.googleApi);
    if (googleApi) {
      addMessageChunk(
        chunks,
        locale,
        "legal",
        "privacy:google-api",
        source,
        typeof googleApi.title === "string" ? googleApi.title : "Google API Data Use",
        googleApi,
        ["privacy", "google", "api", "data"],
      );
    }
  }
}

function buildMessageChunks(locale: TourProductPageLocale): SiteKnowledgeChunk[] {
  const messages = MESSAGES_BY_LOCALE[locale] ?? MESSAGES_BY_LOCALE.en;
  const chunks: SiteKnowledgeChunk[] = [];
  const footer = asRecord(getNested(messages, "home.footer"));
  const footerKnowledge = {
    customerServiceEmailAddress: "support@atockorea.com",
    legalContactEmailAddress: "legal@atockorea.com",
    operatingAddress: "302, 32, Doryeong-ro 7-gil, Jeju-si, Jeju-do, Republic of Korea",
    supportPage: "/support",
    contactPage: "/contact",
    legalPages: "/terms, /privacy, /cookies, /refund-policy, /legal, /dsa",
    ...(footer ?? {}),
  };

  addMessageChunk(
    chunks,
    locale,
    "footer",
    "footer",
    "components/Footer.tsx",
    "Footer company, contact, support, and legal links",
    footerKnowledge,
    ["footer", "company", "contact", "support", "legal", "email", "address", "AtoC Korea", "ATOC KOREA LLC"],
    3,
  );

  const about = asRecord(messages.about);
  if (about) {
    for (const key of ["ourStory", "whyChooseUs", "trust", "partners", "careers"]) {
      const section = asRecord(about[key]);
      if (!section) continue;
      addMessageChunk(
        chunks,
        locale,
        "about",
        `about:${key}`,
        "/about",
        typeof section.title === "string" ? section.title : `About - ${titleFromKey(key)}`,
        section,
        ["about", key, "company", "intermediary", "AtoC Korea"],
        key === "ourStory" || key === "trust" ? 2 : 0,
      );
    }
  }

  buildLegalPolicyChunks(chunks, locale, messages, "terms", "/terms");
  buildLegalPolicyChunks(chunks, locale, messages, "privacy", "/privacy");
  buildLegalPolicyChunks(chunks, locale, messages, "refund", "/refund-policy");
  buildLegalPolicyChunks(chunks, locale, messages, "cookiePolicy", "/cookies");

  return chunks;
}

function buildGlobalPolicyChunks(locale: TourProductPageLocale): SiteKnowledgeChunk[] {
  const policies = ((globalPolicies as JsonRecord).policies as GlobalPolicy[] | undefined) ?? [];
  return policies.map((policy) => ({
    id: `${locale}:global-policy:${policy.id}`,
    source: "data/tour-policies/global-policies.json",
    locale,
    category: "policy" as const,
    title: policy.title,
    text: [
      policy.text,
      policy.applies_to?.length ? `Applies to: ${policy.applies_to.join(", ")}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    tags: ["global policy", policy.category, policy.id, policy.title],
    priority: 2,
  }));
}

function buildPoiChunks(): SiteKnowledgeChunk[] {
  const nameRows = (matchPoiNameSnapshot as MatchPoiNameRow[]).filter((row) => row.poi_key);
  const namesByKey = new Map(nameRows.map((row) => [row.poi_key, row]));
  const chunks: SiteKnowledgeChunk[] = [];
  const kb = poiKnowledgeBase as JsonRecord;

  for (const [poiKey, raw] of Object.entries(kb)) {
    if (poiKey.startsWith("_")) continue;
    const record = asRecord(raw);
    if (!record) continue;

    const nameRow = namesByKey.get(poiKey);
    const otherNames = nameRow?.names_other_locales ?? {};
    const names = [
      nameRow?.name_en,
      nameRow?.name_ko,
      otherNames.ja,
      otherNames.zh,
      otherNames["zh-TW"],
      otherNames.es,
      humanizePoiKey(poiKey),
    ].filter((name): name is string => Boolean(name));

    const visitBasics = collectText(record.visitBasics, "Visit basics");
    const convenience = collectText(record.convenience, "Convenience");
    const smartNotes = collectText(record.smartNotes, "Smart notes");
    const meta = asRecord(record._poi_meta) ?? asRecord(record.poi_meta);
    const sources = collectText(meta?.sources, "Sources");
    const title = nameRow?.name_en ?? humanizePoiKey(poiKey);

    addChunk(chunks, {
      id: `poi:${poiKey}`,
      source: "data/poi_kb/poi_knowledge_base_v1.29.json",
      locale: "all",
      category: "poi",
      title,
      text: [
        `POI key: ${poiKey}.`,
        `Names: ${Array.from(new Set(names)).join(" / ")}.`,
        nameRow?.region ? `Region: ${nameRow.region}.` : "",
        nameRow?.category ? `Category: ${nameRow.category}.` : "",
        ...visitBasics,
        ...convenience,
        ...smartNotes,
        ...sources,
      ]
        .filter(Boolean)
        .join(" "),
      tags: [poiKey, ...names, nameRow?.region ?? "", nameRow?.category ?? "", "poi", "attraction"],
      priority: 1,
    });
  }

  return chunks;
}

function buildChunksForLocale(locale: TourProductPageLocale): SiteKnowledgeChunk[] {
  const localized = buildMessageChunks(locale);
  const fallbackEnglish = locale === "en" ? [] : buildMessageChunks("en").map((chunk) => ({ ...chunk, id: `${chunk.id}:fallback-en` }));
  const staticLegal = STATIC_LEGAL_OVERVIEW.map((chunk) => ({ ...chunk, locale: "all" as const }));
  return [...localized, ...fallbackEnglish, ...staticLegal, ...buildGlobalPolicyChunks(locale), ...buildPoiChunks()];
}

export function getSiteKnowledgeChunks(locale: TourProductPageLocale = "en"): SiteKnowledgeChunk[] {
  const normalizedLocale = MESSAGES_BY_LOCALE[locale] ? locale : "en";
  const cached = chunkCache.get(normalizedLocale);
  if (cached) return cached;
  const chunks = buildChunksForLocale(normalizedLocale);
  chunkCache.set(normalizedLocale, chunks);
  return chunks;
}

function normalizeForSearch(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[`*_#[\]()>]/g, " ")
    .replace(/[^\p{L}\p{N}@._+\-\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesCjkLike(value: string): boolean {
  return /[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value);
}

function expandCjkToken(token: string): string[] {
  const chars = Array.from(token);
  if (chars.length < 3 || chars.length > 18) return [];
  const grams: string[] = [];
  for (const size of [2, 3]) {
    for (let i = 0; i <= chars.length - size; i += 1) {
      grams.push(chars.slice(i, i + size).join(""));
    }
  }
  return grams;
}

function tokenize(value: string): string[] {
  const normalized = normalizeForSearch(value);
  const rawTokens = normalized.match(/[\p{L}\p{N}@._+\-]{2,}/gu) ?? [];
  const tokens: string[] = [];
  for (const token of rawTokens) {
    if (STOPWORDS.has(token)) continue;
    tokens.push(token);
    if (includesCjkLike(token)) tokens.push(...expandCjkToken(token));
  }
  return Array.from(new Set(tokens));
}

function searchBlob(chunk: SiteKnowledgeChunk): string {
  const tags = chunk.tags.join(" ");
  const compactTags = tags.replace(/\s+/g, "");
  return normalizeForSearch(`${chunk.title} ${chunk.text} ${tags} ${compactTags}`);
}

function scoreChunk(chunk: SiteKnowledgeChunk, query: string): number {
  const normalizedQuery = normalizeForSearch(query);
  if (!normalizedQuery) return 0;
  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  const blob = searchBlob(chunk);
  const compactBlob = blob.replace(/\s+/g, "");
  const title = normalizeForSearch(chunk.title);
  const tags = normalizeForSearch(chunk.tags.join(" "));
  const tokens = tokenize(query);

  let score = chunk.priority ?? 0;
  if (normalizedQuery.length >= 4 && blob.includes(normalizedQuery)) score += 40;
  if (compactQuery.length >= 4 && compactBlob.includes(compactQuery)) score += 28;

  for (const token of tokens) {
    if (tags.includes(token)) score += 8;
    if (title.includes(token)) score += 6;
    if (blob.includes(token)) score += token.length >= 4 || includesCjkLike(token) ? 3 : 1;
  }

  for (const boost of CATEGORY_BOOSTS) {
    if (chunk.category !== boost.category) continue;
    if (boost.tokens.some((token) => normalizedQuery.includes(normalizeForSearch(token)))) {
      score += boost.boost;
    }
  }

  return score;
}

export function rankSiteKnowledgeChunks(
  query: string,
  locale: TourProductPageLocale = "en",
  options: { limit?: number; minScore?: number } = {},
): Array<SiteKnowledgeChunk & { score: number }> {
  const limit = options.limit ?? 8;
  const minScore = options.minScore ?? 4;
  return getSiteKnowledgeChunks(locale)
    .map((chunk) => ({ ...chunk, score: scoreChunk(chunk, query) }))
    .filter((chunk) => chunk.score >= minScore)
    .sort((a, b) => b.score - a.score || (b.priority ?? 0) - (a.priority ?? 0) || a.title.localeCompare(b.title))
    .slice(0, limit);
}

function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars - 1).trim()}...`;
}

function defaultContextChunks(locale: TourProductPageLocale): SiteKnowledgeChunk[] {
  const chunks = getSiteKnowledgeChunks(locale);
  return chunks.filter((chunk) => chunk.id.includes(":footer") || chunk.id.includes("about:ourStory")).slice(0, 2);
}

export function buildSiteKnowledgeContextText({
  locale = "en",
  query,
  maxChunks = 8,
  maxChars = 7000,
}: {
  locale?: TourProductPageLocale;
  query: string;
  maxChunks?: number;
  maxChars?: number;
}): string {
  const ranked = rankSiteKnowledgeChunks(query, locale, { limit: maxChunks });
  const selected = ranked.length > 0 ? ranked : defaultContextChunks(locale).map((chunk) => ({ ...chunk, score: 0 }));
  const blocks: string[] = [];
  let usedChars = 0;

  for (const chunk of selected) {
    const block = [
      `### ${chunk.title}`,
      `Source: ${chunk.source} | Category: ${chunk.category}`,
      truncateText(chunk.text, chunk.category === "poi" ? 1200 : 1000),
    ].join("\n");
    if (usedChars + block.length > maxChars) break;
    blocks.push(block);
    usedChars += block.length;
  }

  return blocks.join("\n\n");
}
