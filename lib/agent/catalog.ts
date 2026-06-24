/**
 * Agent-channel catalogue adapter.
 *
 * Projects the static tour-product registry into a stable, machine-first shape
 * for the `/api/agent/v1/*` endpoints. Sourced from the same lean catalogue the
 * sitemap uses (`STATIC_TOUR_PRODUCTS`) — no DB round-trip, deterministic, and
 * consumer-visibility filtered so blocked/legacy SKUs never leak to agents.
 */

import {
  listStaticTourProducts,
  type StaticTourProductRegistration,
} from "@/components/product-tour-static/catalog/staticTourCatalogCards";
import { isTourSlugBlockedFromConsumerSurfaces } from "@/lib/tour-consumer-visibility";

/** Canonical public host that the agent channel advertises in links. */
export function agentSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://www.atockorea.com";
  const normalized = raw.replace(/\/+$/, "");
  return normalized === "https://atockorea.com" ? "https://www.atockorea.com" : normalized;
}

export interface AgentCatalogItem {
  slug: string;
  title: string;
  subtitle: string;
  region: string;
  duration: string;
  stops: number;
  rating: number;
  review_count: number;
  badges: readonly string[];
  /** Per-unit list price in USD. Final total is reconfirmed at checkout. */
  price_usd: number;
  compare_at_price_usd: number | null;
  max_group_size: number | null;
  summary: string;
  hero_image: string;
  thumbnail: string;
  /** Human-facing product page (where a traveller completes checkout). */
  url: string;
  /** Machine endpoint for the full product record. */
  detail_url: string;
}

function toItem(p: StaticTourProductRegistration, base: string): AgentCatalogItem {
  return {
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle,
    region: p.region,
    duration: p.duration,
    stops: p.stopsCount,
    rating: p.rating,
    review_count: p.reviewCount,
    badges: p.badges,
    price_usd: p.listPriceUsd,
    compare_at_price_usd: typeof p.compareAtPriceUsd === "number" ? p.compareAtPriceUsd : null,
    max_group_size: typeof p.maxGroupSize === "number" ? p.maxGroupSize : null,
    summary: p.shortCardDescription,
    hero_image: p.heroImage,
    thumbnail: p.thumbnail,
    url: `${base}/tour-product/${p.slug}`,
    detail_url: `${base}/api/agent/v1/tours/${p.slug}`,
  };
}

/** All agent-visible catalogue products, optionally filtered by region / search. */
export function listAgentCatalog(opts?: {
  region?: string | null;
  search?: string | null;
}): AgentCatalogItem[] {
  const base = agentSiteUrl();
  const region = opts?.region?.trim().toLowerCase() || "";
  const search = opts?.search?.trim().toLowerCase() || "";

  return listStaticTourProducts("en")
    .filter((p) => !isTourSlugBlockedFromConsumerSurfaces(p.slug))
    .filter((p) => (region ? p.region.toLowerCase().includes(region) : true))
    .filter((p) =>
      search
        ? `${p.title} ${p.subtitle} ${p.shortCardDescription} ${p.badges.join(" ")}`
            .toLowerCase()
            .includes(search)
        : true,
    )
    .map((p) => toItem(p, base));
}

/** Single agent catalogue product by slug, or `null` when not found / blocked. */
export function getAgentCatalogItem(slug: string): AgentCatalogItem | null {
  const s = slug.trim().toLowerCase();
  if (!s || isTourSlugBlockedFromConsumerSurfaces(s)) return null;
  const found = listStaticTourProducts("en").find((p) => p.slug.toLowerCase() === s);
  return found ? toItem(found, agentSiteUrl()) : null;
}
