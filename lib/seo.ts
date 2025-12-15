import { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://atockorea.com';
const siteName = 'AtoC Korea';
const defaultDescription = 'Direct connection to trusted Korea tours. Licensed Korean travel agencies, certified guides, and lower prices through direct partnerships.';
const defaultImage = `${siteUrl}/og-image.jpg`;

export interface SEOConfig {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  section?: string;
  tags?: string[];
  noindex?: boolean;
  nofollow?: boolean;
}

export function generateMetadata(config: SEOConfig): Metadata {
  const {
    title,
    description = defaultDescription,
    image = defaultImage,
    url,
    type = 'website',
    publishedTime,
    modifiedTime,
    author,
    section,
    tags,
    noindex = false,
    nofollow = false,
  } = config;

  const fullTitle = title ? `${title} | ${siteName}` : siteName;
  const fullUrl = url ? `${siteUrl}${url}` : siteUrl;

  return {
    title: fullTitle,
    description,
    keywords: tags?.join(', '),
    authors: author ? [{ name: author }] : undefined,
    creator: siteName,
    publisher: siteName,
    robots: {
      index: !noindex,
      follow: !nofollow,
      googleBot: {
        index: !noindex,
        follow: !nofollow,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    openGraph: {
      type,
      url: fullUrl,
      title: fullTitle,
      description,
      siteName,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title || siteName,
        },
      ],
      publishedTime,
      modifiedTime,
      authors: author ? [author] : undefined,
      section,
      tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [image],
      creator: '@atockorea',
      site: '@atockorea',
    },
    alternates: {
      canonical: fullUrl,
    },
    metadataBase: new URL(siteUrl),
  };
}

export function generateStructuredData(type: 'Tour' | 'Organization' | 'WebSite', data: any) {
  const baseStructuredData = {
    '@context': 'https://schema.org',
    '@type': type,
  };

  switch (type) {
    case 'Tour':
      return {
        ...baseStructuredData,
        name: data.name || data.title,
        description: data.description,
        image: data.image,
        url: data.url,
        offers: {
          '@type': 'Offer',
          price: data.price,
          priceCurrency: 'USD',
          availability: data.availability || 'https://schema.org/InStock',
          validFrom: data.validFrom || new Date().toISOString(),
        },
        aggregateRating: data.rating
          ? {
              '@type': 'AggregateRating',
              ratingValue: data.rating,
              reviewCount: data.reviewCount || 0,
            }
          : undefined,
        duration: data.duration,
        location: data.location
          ? {
              '@type': 'Place',
              name: data.location,
            }
          : undefined,
      };

    case 'Organization':
      return {
        ...baseStructuredData,
        name: siteName,
        url: siteUrl,
        logo: `${siteUrl}/logo.png`,
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'Customer Service',
          email: 'support@atockorea.com',
        },
        sameAs: [
          'https://www.facebook.com/atockorea',
          'https://www.instagram.com/atockorea',
          'https://twitter.com/atockorea',
        ],
      };

    case 'WebSite':
      return {
        ...baseStructuredData,
        name: siteName,
        url: siteUrl,
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${siteUrl}/search?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      };

    default:
      return baseStructuredData;
  }
}

