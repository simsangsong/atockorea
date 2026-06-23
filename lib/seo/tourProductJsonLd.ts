/**
 * Build schema.org JSON-LD blocks for a tour product detail page.
 *
 * Emits:
 *  - `Product` with `Offer` and (when reviews exist) `AggregateRating`
 *  - `FAQPage` (when the product has staticQuestions)
 *
 * Rendered as `<script type="application/ld+json">` from the page-level
 * server component so search crawlers see it without JS execution.
 */

import type { TourProductDetailViewModel } from "@/components/product-tour-static/_shared/tourProductFullPageJsonTypes";

type StaticQuestion = { id?: string | number; question: string; answer: string };

type ReviewsSummary = {
  averageRating?: number | null;
  totalReviews?: number | null;
};

type ViewModelLike = Pick<
  TourProductDetailViewModel,
  "headlineLine1" | "headlineLine2" | "hero" | "price"
> & {
  staticQuestions?: ReadonlyArray<StaticQuestion> | null;
  reviewsSummary?: ReviewsSummary | null;
};

function siteOrigin(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (url && /^https?:\/\//.test(url)) return url.replace(/\/$/, "");
  return "https://atockorea.com";
}

function safeProductName(vm: ViewModelLike): string {
  return [vm.headlineLine1, vm.headlineLine2].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function safePrice(vm: ViewModelLike): { price: string; priceCurrency: string } | null {
  const amount = vm.price?.amountLabel;
  const currency = vm.price?.currency;
  if (!amount || !currency) return null;
  const cleaned = String(amount).replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  return { price: cleaned, priceCurrency: String(currency).toUpperCase() };
}

export function buildTourProductJsonLd(vm: ViewModelLike, slug: string): unknown[] {
  const url = `${siteOrigin()}/tour-product/${slug}`;
  const name = safeProductName(vm);
  const blocks: unknown[] = [];

  const provider = {
    "@type": "TravelAgency",
    name: "AtoC Korea",
    url: siteOrigin(),
    areaServed: { "@type": "Country", name: "South Korea" },
  };

  const product: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    url,
    category: "Tour",
    image: vm.hero?.imageUrl ? [vm.hero.imageUrl] : undefined,
    description: vm.hero?.tagline ?? undefined,
    brand: { "@type": "Brand", name: "AtoC Korea" },
    provider,
  };

  const price = safePrice(vm);
  if (price) {
    product.offers = {
      "@type": "Offer",
      price: price.price,
      priceCurrency: price.priceCurrency,
      availability: "https://schema.org/InStock",
      url,
      seller: provider,
    };
  }

  const summary = vm.reviewsSummary;
  if (summary && (summary.totalReviews ?? 0) > 0 && (summary.averageRating ?? 0) > 0) {
    product.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(summary.averageRating),
      reviewCount: Number(summary.totalReviews),
      bestRating: 5,
      worstRating: 1,
    };
  }

  blocks.push(product);

  const faqs = (vm.staticQuestions ?? []).filter((q) => q?.question && q?.answer);
  if (faqs.length > 0) {
    blocks.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((q) => ({
        "@type": "Question",
        name: q.question,
        acceptedAnswer: { "@type": "Answer", text: q.answer },
      })),
    });
  }

  return blocks;
}

export function tourProductJsonLdScripts(vm: ViewModelLike, slug: string): string[] {
  return buildTourProductJsonLd(vm, slug).map((block) => JSON.stringify(block));
}
