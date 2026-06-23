/**
 * Shared helpers for the AI-agent channel surfaces (llms.txt, agents.md,
 * machine catalog feed, MCP server, .well-known discovery docs).
 *
 * Keeps the canonical origin resolution identical to app/sitemap.ts +
 * app/robots.ts so every agent-facing URL points at the host Google and
 * AI crawlers actually index.
 */

import { STATIC_TOUR_PRODUCTS } from "@/components/product-tour-static/catalog/staticTourCatalogCards";

/** Canonical site origin (apex → www, trailing slash stripped). */
export function siteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://www.atockorea.com";
  const normalized = raw.replace(/\/+$/, "");
  return normalized === "https://atockorea.com"
    ? "https://www.atockorea.com"
    : normalized;
}

export interface AgentCatalogEntry {
  slug: string;
  title: string;
  subtitle: string;
  region: string;
  duration: string;
  stops: number;
  rating: number;
  reviewCount: number;
  priceFromUsd: number;
  compareAtUsd?: number;
  maxGroupSize?: number;
  detailUrl: string;
  image: string;
  summary: string;
}

/**
 * Flatten the static tour catalogue into a stable, machine-readable shape.
 * Sourced from the same registry that drives the sitemap, so the agent feed
 * never drifts from what crawlers index.
 */
export function agentCatalog(): AgentCatalogEntry[] {
  const origin = siteOrigin();
  return STATIC_TOUR_PRODUCTS.map((p) => ({
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle,
    region: p.region,
    duration: p.duration,
    stops: p.stopsCount,
    rating: p.rating,
    reviewCount: p.reviewCount,
    priceFromUsd: p.listPriceUsd,
    compareAtUsd: p.compareAtPriceUsd,
    maxGroupSize: p.maxGroupSize,
    detailUrl: `${origin}/tour-product/${p.slug}`,
    image: p.heroImage,
    summary: p.shortCardDescription,
  }));
}
