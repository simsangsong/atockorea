// W4.1 — rich tour cards for the chat widget.
//
// The model (and the deterministic catalogue fallback) reference products by
// their `/tour-product/<slug>` URL. This module resolves those slugs against
// the static catalogue registry into a deterministic card payload (title,
// thumbnail, price, rating — never model-invented) and strips the raw URL
// text out of the reply so the widget renders cards instead of link spam.

import {
  getStaticTourProductBySlug,
  hrefStaticTourProductDetail,
} from "@/components/product-tour-static/catalog/staticTourCatalogCards";
import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";

export type TourCardPayload = {
  slug: string;
  title: string;
  image_url: string;
  duration: string;
  rating: number;
  review_count: number;
  price_from_usd: number;
  compare_at_usd: number | null;
  href: string;
};

/** Widget panel is ~26rem wide; more than 3 cards is noise, not choice. */
export const MAX_TOUR_CARDS = 3;

const TOUR_URL_RE = /(?:https:\/\/(?:www\.)?atockorea\.com)?\/tour-product\/([a-z0-9-]+)/gi;
const MD_LINK_RE = /\[([^\]\n]{1,200})\]\(([^\s()]{1,600})\)/g;

/** Ordered, de-duplicated product slugs referenced in a reply. */
export function extractTourSlugs(reply: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  TOUR_URL_RE.lastIndex = 0;
  for (let m = TOUR_URL_RE.exec(reply); m; m = TOUR_URL_RE.exec(reply)) {
    const slug = m[1].toLowerCase();
    if (!seen.has(slug)) {
      seen.add(slug);
      out.push(slug);
    }
  }
  return out;
}

function slugFromUrl(url: string): string | null {
  const m = url.match(/\/tour-product\/([a-z0-9-]+)/i);
  return m ? m[1].toLowerCase() : null;
}

/**
 * Remove the raw URL text for slugs that got a card. Markdown links keep
 * their label; bare URLs are dropped, then orphaned separators (" · " at line
 * end, empty parens, space-before-punctuation) are tidied. Conservative on
 * purpose — anything not clearly URL debris stays untouched.
 */
function stripCardedUrls(reply: string, carded: ReadonlySet<string>): string {
  let out = reply.replace(MD_LINK_RE, (whole, label: string, url: string) => {
    const slug = slugFromUrl(url);
    return slug && carded.has(slug) ? label : whole;
  });
  TOUR_URL_RE.lastIndex = 0;
  out = out.replace(TOUR_URL_RE, (whole, slug: string) =>
    carded.has(slug.toLowerCase()) ? "" : whole,
  );
  return out
    .replace(/\(\s*\)|（\s*）/g, "")
    .replace(/[ \t]*(?:·|•|-|—|:|：)[ \t]*$/gm, "")
    .replace(/[ \t]+([.,;!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Build deterministic tour cards for every catalogue product referenced in
 * the reply (capped at MAX_TOUR_CARDS) and return the reply with those raw
 * URLs stripped. Unknown/blocked slugs never get a card AND keep their URL
 * text untouched, so nothing referenced becomes unreachable.
 */
export function buildTourCardsFromReply(
  reply: string,
  locale: TourProductPageLocale,
): { cards: TourCardPayload[]; cleanedReply: string } {
  const cards: TourCardPayload[] = [];
  const carded = new Set<string>();
  for (const slug of extractTourSlugs(reply)) {
    if (cards.length >= MAX_TOUR_CARDS) break;
    const p = getStaticTourProductBySlug(slug, locale);
    if (!p) continue; // unknown or consumer-blocked → leave the URL alone
    carded.add(slug);
    cards.push({
      slug: p.slug,
      title: p.title,
      image_url: p.thumbnail || p.heroImage,
      duration: p.duration,
      rating: p.rating,
      review_count: p.reviewCount,
      price_from_usd: p.listPriceUsd,
      compare_at_usd: typeof p.compareAtPriceUsd === "number" ? p.compareAtPriceUsd : null,
      href: hrefStaticTourProductDetail(p.slug),
    });
  }
  if (cards.length === 0) return { cards, cleanedReply: reply };
  return { cards, cleanedReply: stripCardedUrls(reply, carded) };
}
