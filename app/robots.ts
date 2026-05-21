import { MetadataRoute } from 'next';

function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://www.atockorea.com';
  const normalized = raw.replace(/\/+$/, '');

  return normalized === 'https://atockorea.com'
    ? 'https://www.atockorea.com'
    : normalized;
}

export default function robots(): MetadataRoute.Robots {
  const baseUrl = siteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/merchant/',
          '/mypage/',
          '/auth/',
          '/dashboard/',
          '/test/',
          '/test-admin/',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/merchant/',
          '/mypage/',
          '/auth/',
          '/dashboard/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}













