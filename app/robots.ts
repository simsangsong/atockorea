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

// AI agents / LLM crawlers we explicitly welcome. They are pointed at the
// token-efficient agent surfaces (/llms.txt, /agents.md, /feed/) and kept out
// of the same private areas as search crawlers.
const AI_AGENTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'anthropic-ai',
  'Google-Extended',
  'PerplexityBot',
  'Perplexity-User',
  'Applebot-Extended',
  'Bytespider',
  'CCBot',
];

const PRIVATE_PATHS = [
  '/api/',
  '/admin/',
  '/merchant/',
  '/mypage/',
  '/auth/',
  '/dashboard/',
];

export default function robots(): MetadataRoute.Robots {
  const baseUrl = siteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [...PRIVATE_PATHS, '/test/', '/test-admin/'],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: PRIVATE_PATHS,
      },
      {
        // AI agents: full content access, but allow the MCP discovery card and
        // agent feeds explicitly so /api/ disallow doesn't hide them.
        userAgent: AI_AGENTS,
        allow: ['/', '/llms.txt', '/agents.md', '/feed/', '/.well-known/'],
        disallow: PRIVATE_PATHS,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}













