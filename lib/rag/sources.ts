/**
 * Knowledge source adapters for the chatbot RAG index.
 *
 * Reuses the existing context builders so the RAG corpus stays in lockstep
 * with what the keyword path already knows:
 *   - POI KB / legal / policy / footer / about  ->  lib/chatbot/siteKnowledge
 *   - tour products (card + itinerary + FAQ)     ->  static tour bundles
 *
 * Approved Q&A (source_type='qa') is NOT collected here — those are embedded
 * on approval in Phase 2, one row at a time, so they appear immediately.
 */

import { getSiteKnowledgeChunks } from "@/lib/chatbot/siteKnowledge";
import { listStaticTourProducts } from "@/components/product-tour-static/catalog/staticTourCatalogCards";
import { getStaticTourProductFullPageJson } from "@/components/product-tour-static/_shared/tourProductBundleRegistry";
import { buildTourProductViewModelFromFullPageJson } from "@/components/product-tour-static/_shared/buildTourProductViewModelFromJson";
import { buildTourProductAssistantContextText } from "@/lib/tour-product/tourProductAssistantContext";
import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";

export type KnowledgeSourceType = "poi" | "tour_product" | "site" | "policy" | "qa";

export type KnowledgeRecord = {
  source_type: KnowledgeSourceType;
  source_id: string;
  chunk_index: number;
  locale: string;
  title: string | null;
  content: string;
  url: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
};

export const RAG_LOCALES: TourProductPageLocale[] = ["en", "ko", "ja", "zh", "zh-TW", "es"];

function stripLocalePrefix(id: string): string {
  return id.replace(/^(en|ko|ja|zh-TW|zh|es):/, "");
}

function sourceTypeForCategory(category: string): KnowledgeSourceType {
  if (category === "poi") return "poi";
  if (category === "policy") return "policy";
  return "site"; // footer | about | legal
}

function urlFromSource(source: string): string | null {
  return source.startsWith("/") ? source : null;
}

/**
 * Site knowledge (POI KB, legal, policy, footer, about).
 *
 * `getSiteKnowledgeChunks` mixes three locale flavours per build:
 *   - localized message chunks (chunk.locale === the build locale)
 *   - ":fallback-en" duplicates (skip — we ingest the native locale instead)
 *   - "all" chunks: POI + static legal + global policies (English-universal)
 *
 * We ingest universal chunks once (locale "all") and localized chunks per locale.
 */
function collectSiteRecords(): KnowledgeRecord[] {
  const records: KnowledgeRecord[] = [];
  const seen = new Set<string>();

  const push = (rec: KnowledgeRecord) => {
    const key = `${rec.source_type}::${rec.source_id}::${rec.locale}::${rec.chunk_index}`;
    if (seen.has(key)) return;
    seen.add(key);
    records.push(rec);
  };

  // Universal chunks (locale-agnostic) — collect from the English build once.
  for (const chunk of getSiteKnowledgeChunks("en")) {
    const universal = chunk.locale === "all" || /(?:^|:)global-policy:/.test(chunk.id);
    if (!universal) continue;
    push({
      source_type: sourceTypeForCategory(chunk.category),
      source_id: stripLocalePrefix(chunk.id),
      chunk_index: 0,
      locale: "all",
      title: chunk.title,
      content: chunk.text,
      url: urlFromSource(chunk.source),
      tags: chunk.tags,
      metadata: { category: chunk.category, source: chunk.source, priority: chunk.priority ?? 0 },
    });
  }

  // Localized message chunks (legal/policy/footer/about), per locale.
  for (const locale of RAG_LOCALES) {
    for (const chunk of getSiteKnowledgeChunks(locale)) {
      if (chunk.locale !== locale) continue; // skip "all" + fallback duplicates
      if (chunk.id.endsWith(":fallback-en")) continue;
      push({
        source_type: sourceTypeForCategory(chunk.category),
        source_id: stripLocalePrefix(chunk.id),
        chunk_index: 0,
        locale,
        title: chunk.title,
        content: chunk.text,
        url: urlFromSource(chunk.source),
        tags: chunk.tags,
        metadata: { category: chunk.category, source: chunk.source, priority: chunk.priority ?? 0 },
      });
    }
  }

  return records;
}

/** Split the assistant-context markdown into per-section chunks. */
function splitTourSections(text: string): Array<{ title: string; body: string }> {
  const sections: Array<{ title: string; body: string }> = [];
  // Sections look like "## Heading\n...body..." separated by blank lines.
  const parts = text.split(/\n##\s+/).map((p, i) => (i === 0 ? p.replace(/^##\s+/, "") : p));
  for (const part of parts) {
    const newlineIdx = part.indexOf("\n");
    const heading = (newlineIdx === -1 ? part : part.slice(0, newlineIdx)).trim();
    const body = (newlineIdx === -1 ? "" : part.slice(newlineIdx + 1)).trim();
    if (!heading || !body) continue;
    const lower = heading.toLowerCase();
    // Skip instruction-only / duplicated sections.
    if (lower.startsWith("rules for answers")) continue;
    if (lower.startsWith("cross-product policies")) continue; // already in policy chunks
    sections.push({ title: heading, body });
  }
  return sections;
}

function collectTourRecords(): KnowledgeRecord[] {
  const records: KnowledgeRecord[] = [];
  const slugs = Array.from(new Set(listStaticTourProducts("en").map((t) => t.slug)));

  for (const locale of RAG_LOCALES) {
    const cards = new Map(listStaticTourProducts(locale).map((t) => [t.slug, t]));
    for (const slug of slugs) {
      const card = cards.get(slug);
      const url = `/tour-product/${slug}`;

      // Card-level chunk (great for recommendation recall).
      if (card) {
        const content = [
          card.title,
          card.subtitle,
          card.region ? `Region: ${card.region}` : "",
          card.duration ? `Duration: ${card.duration}` : "",
          card.priceLabel ? `Price: ${card.priceLabel}` : "",
          card.shortCardDescription,
          card.badges?.length ? `Tags: ${card.badges.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join("\n");
        records.push({
          source_type: "tour_product",
          source_id: slug,
          chunk_index: 0,
          locale,
          title: card.title,
          content,
          url,
          tags: ["tour", card.region, ...(card.badges ?? [])].filter(Boolean) as string[],
          metadata: { kind: "card", region: card.region ?? null, slug },
        });
      }

      // Deep chunks (itinerary, FAQ, at-a-glance) — only for natively localized bundles.
      let doc: ReturnType<typeof getStaticTourProductFullPageJson> = null;
      try {
        doc = getStaticTourProductFullPageJson(slug, locale);
      } catch {
        doc = null;
      }
      if (!doc) continue; // no native bundle for this locale; card chunk is enough
      try {
        const vm = buildTourProductViewModelFromFullPageJson(doc, locale);
        const sections = splitTourSections(buildTourProductAssistantContextText(vm, locale));
        sections.forEach((section, i) => {
          records.push({
            source_type: "tour_product",
            source_id: slug,
            chunk_index: i + 1,
            locale,
            title: `${card?.title ?? slug} — ${section.title}`,
            content: section.body,
            url,
            tags: ["tour", section.title, slug].filter(Boolean),
            metadata: { kind: "detail", section: section.title, slug },
          });
        });
      } catch {
        // One malformed bundle must not abort the whole ingest.
      }
    }
  }

  return records;
}

/** All non-Q&A knowledge records (site + policy + poi + tour products). */
export function collectStaticKnowledgeRecords(): KnowledgeRecord[] {
  return [...collectSiteRecords(), ...collectTourRecords()];
}
