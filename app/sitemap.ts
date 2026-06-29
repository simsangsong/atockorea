import { MetadataRoute } from 'next';
import { STATIC_TOUR_PRODUCTS } from '@/components/product-tour-static/catalog/staticTourCatalogCards';
import { isTourSlugBlockedFromConsumerSurfaces } from '@/lib/tour-consumer-visibility';

const LOCALE_HOME_PATHS = ['/ko', '/zh-CN', '/zh-TW', '/ja', '/es'] as const;

function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://www.atockorea.com';
  const normalized = raw.replace(/\/+$/, '');

  // Production redirects apex -> www, so sitemap/robots should advertise the
  // canonical host Google actually indexes.
  return normalized === 'https://atockorea.com'
    ? 'https://www.atockorea.com'
    : normalized;
}

function entry(
  baseUrl: string,
  path: string,
  options: Omit<MetadataRoute.Sitemap[number], 'url' | 'lastModified'>,
): MetadataRoute.Sitemap[number] {
  return {
    url: `${baseUrl}${path === '/' ? '' : path}`,
    lastModified: new Date(),
    ...options,
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = siteUrl();

  const staticTourProductPages: MetadataRoute.Sitemap = [
    ...STATIC_TOUR_PRODUCTS.filter(
      (p) => !isTourSlugBlockedFromConsumerSurfaces(p.slug),
    ).map((p) => ({
      url: `${baseUrl}/tour-product/${p.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];

  const staticPages: MetadataRoute.Sitemap = [
    entry(baseUrl, '/', { changeFrequency: 'daily', priority: 1 }),
    entry(baseUrl, '/tours/list', { changeFrequency: 'daily', priority: 0.9 }),
    entry(baseUrl, '/search', { changeFrequency: 'daily', priority: 0.75 }),
    // Klook onboarding prep 2026-06-29: the itinerary-builder URLs were removed
    // from the sitemap — the builder is hidden site-wide (routes 308→/tours/list).
    // Restore these 4 entries when ITINERARY_BUILDER_ENABLED flips back to true.
    entry(baseUrl, '/contact', { changeFrequency: 'monthly', priority: 0.45 }),
    entry(baseUrl, '/support', { changeFrequency: 'monthly', priority: 0.45 }),
    entry(baseUrl, '/for-agents', { changeFrequency: 'monthly', priority: 0.4 }),
    entry(baseUrl, '/about', { changeFrequency: 'monthly', priority: 0.4 }),
    entry(baseUrl, '/privacy', { changeFrequency: 'yearly', priority: 0.2 }),
    entry(baseUrl, '/terms', { changeFrequency: 'yearly', priority: 0.2 }),
    entry(baseUrl, '/refund-policy', { changeFrequency: 'yearly', priority: 0.2 }),
    entry(baseUrl, '/cookies', { changeFrequency: 'yearly', priority: 0.2 }),
    ...LOCALE_HOME_PATHS.map((path) =>
      entry(baseUrl, path, { changeFrequency: 'daily', priority: 0.85 }),
    ),
  ];

  return [...staticPages, ...staticTourProductPages];
}











