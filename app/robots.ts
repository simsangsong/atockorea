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

  // Private surfaces no crawler (human or AI) should touch.
  const privateDisallow = [
    '/admin/',
    '/merchant/',
    '/mypage/',
    '/auth/',
    '/dashboard/',
    '/test/',
    '/test-admin/',
  ];

  // AI assistants/agents we explicitly welcome. They get the public site AND
  // the agent channel (`/api/agent/`, `/llms.txt`) — but never the internal
  // API or private dashboards. Listing them by name is a discoverability +
  // trust signal: we want to be found and transacted with by these clients.
  const aiAgents = [
    'GPTBot',
    'OAI-SearchBot',
    'ChatGPT-User',
    'ClaudeBot',
    'Claude-User',
    'anthropic-ai',
    'PerplexityBot',
    'Perplexity-User',
    'Google-Extended',
    'Applebot-Extended',
    'Amazonbot',
    'Bytespider',
    'CCBot',
  ];

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/api/agent/', '/llms.txt'],
        disallow: ['/api/', ...privateDisallow],
      },
      {
        userAgent: 'Googlebot',
        allow: ['/', '/api/agent/', '/llms.txt'],
        disallow: ['/api/', '/admin/', '/merchant/', '/mypage/', '/auth/', '/dashboard/'],
      },
      {
        userAgent: aiAgents,
        allow: ['/', '/api/agent/', '/llms.txt'],
        disallow: ['/api/', ...privateDisallow],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}













