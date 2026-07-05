// W4.6 — trust badges: which verified knowledge grounded this answer.
//
// Maps the RAG chunks that were actually injected into the prompt onto small,
// human-readable source labels (+ internal link when the chunk has one) so
// the widget can render "근거: 환불 정책" style badges under the reply.
// Deterministic — labels come from source_type / chunk titles, never the model.

import type { RetrievedChunk } from "@/lib/rag/retrieve";
import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";

export type AnswerSource = {
  type: string;
  label: string;
  href: string | null;
};

const TYPE_LABELS: Record<string, Record<TourProductPageLocale, string>> = {
  policy: {
    en: "Site policy", ko: "사이트 정책", ja: "サイトポリシー",
    zh: "网站政策", "zh-TW": "網站政策", es: "Política del sitio",
  },
  site: {
    en: "Site guide", ko: "사이트 안내", ja: "サイト案内",
    zh: "网站指南", "zh-TW": "網站指南", es: "Guía del sitio",
  },
  qa: {
    en: "Support team answer", ko: "운영팀 답변", ja: "サポート回答",
    zh: "客服回答", "zh-TW": "客服回答", es: "Respuesta del equipo",
  },
  poi: {
    en: "Travel spot info", ko: "여행지 정보", ja: "観光地情報",
    zh: "景点信息", "zh-TW": "景點資訊", es: "Información del lugar",
  },
  tour_product: {
    en: "Tour page", ko: "투어 페이지", ja: "ツアーページ",
    zh: "行程页面", "zh-TW": "行程頁面", es: "Página del tour",
  },
};

/** Same-site hrefs only (relative path); anything else renders unlinked. */
function safeInternalHref(url: string | null): string | null {
  if (!url) return null;
  const u = url.trim();
  if (/^\/(?!\/)/.test(u)) return u;
  const m = u.match(/^https:\/\/(?:www\.)?atockorea\.com(\/[^\s]*)$/i);
  return m ? m[1] : null;
}

/**
 * Top grounding sources for the badge row: chunks arrive already ranked, we
 * keep the first occurrence per (type, label) pair, capped at 3.
 */
export function buildAnswerSources(
  chunks: readonly RetrievedChunk[],
  locale: TourProductPageLocale,
): AnswerSource[] {
  const out: AnswerSource[] = [];
  const seen = new Set<string>();
  for (const chunk of chunks) {
    if (out.length >= 3) break;
    const typeMap = TYPE_LABELS[chunk.source_type];
    const label =
      chunk.source_type === "tour_product" && chunk.title
        ? chunk.title
        : (typeMap?.[locale] ?? typeMap?.en ?? chunk.source_type);
    const key = `${chunk.source_type}:${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ type: chunk.source_type, label, href: safeInternalHref(chunk.url) });
  }
  return out;
}
