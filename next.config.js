/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
  async redirects() {
    /** Public flagship detail — do not use :path* on `/tour/...` or checkout subpaths would break. */
    const canonical = '/tour-product/east-signature-nature-core';
    const eastUuid = 'c5d60898-a167-4b88-ac9f-62a910921866';
    return [
      /** Legacy My Page paths — canonical is `/mypage`. */
      { source: '/my', destination: '/mypage', permanent: true },
      { source: '/my/:path*', destination: '/mypage/:path*', permanent: true },
      { source: '/my-page', destination: '/mypage', permanent: true },
      { source: '/my-page/:path*', destination: '/mypage/:path*', permanent: true },
      { source: `/tour/${eastUuid}`, destination: canonical, permanent: true },
      {
        source: `/:locale(en|ko|zh-CN|zh-TW|ja|es)/tour/${eastUuid}`,
        destination: '/:locale/tour-product/east-signature-nature-core',
        permanent: true,
      },
      { source: '/tour/east-signature-nature-core', destination: canonical, permanent: true },
      { source: '/tour/east-jeju-signature-small-group', destination: canonical, permanent: true },
      { source: '/tour/jeju-east-small-group-template-preview', destination: canonical, permanent: true },
      {
        source: '/:locale(en|ko|zh-CN|zh-TW|ja|es)/tour/east-signature-nature-core',
        destination: '/:locale/tour-product/east-signature-nature-core',
        permanent: true,
      },
      {
        source: '/:locale(en|ko|zh-CN|zh-TW|ja|es)/tour/east-jeju-signature-small-group',
        destination: '/:locale/tour-product/east-signature-nature-core',
        permanent: true,
      },
      {
        source: '/:locale(en|ko|zh-CN|zh-TW|ja|es)/tour/jeju-east-small-group-template-preview',
        destination: '/:locale/tour-product/east-signature-nature-core',
        permanent: true,
      },
      { source: '/tour-preview/east-small-group-v2', destination: canonical, permanent: true },
      { source: '/tour-preview/jeju-east-small-group-template-preview', destination: canonical, permanent: true },
      { source: '/tour-preview/east-jeju-signature-small-group', destination: canonical, permanent: true },
      {
        source: '/:locale(en|ko|zh-CN|zh-TW|ja|es)/tour-preview/east-small-group-v2',
        destination: '/:locale/tour-product/east-signature-nature-core',
        permanent: true,
      },
      {
        source: '/:locale(en|ko|zh-CN|zh-TW|ja|es)/tour-preview/jeju-east-small-group-template-preview',
        destination: '/:locale/tour-product/east-signature-nature-core',
        permanent: true,
      },
      {
        source: '/:locale(en|ko|zh-CN|zh-TW|ja|es)/tour-preview/east-jeju-signature-small-group',
        destination: '/:locale/tour-product/east-signature-nature-core',
        permanent: true,
      },
      /**
       * Legacy city detail routes (`/jeju/<slug>`, `/seoul/<slug>`, `/busan/<slug>`)
       * unify under the canonical `/tour-product/<slug>` template so every product
       * detail page shares the v2 background + card system. The `/<city>` index
       * pages (no slug) keep their own list view — only `:slug` segments redirect.
       * If the slug isn't a registered tour product, the catch-all page calls
       * `notFound()` as before.
       */
      { source: '/jeju/:slug', destination: '/tour-product/:slug', permanent: true },
      { source: '/seoul/:slug', destination: '/tour-product/:slug', permanent: true },
      { source: '/busan/:slug', destination: '/tour-product/:slug', permanent: true },
      {
        source: '/:locale(en|ko|zh-CN|zh-TW|ja|es)/jeju/:slug',
        destination: '/:locale/tour-product/:slug',
        permanent: true,
      },
      {
        source: '/:locale(en|ko|zh-CN|zh-TW|ja|es)/seoul/:slug',
        destination: '/:locale/tour-product/:slug',
        permanent: true,
      },
      {
        source: '/:locale(en|ko|zh-CN|zh-TW|ja|es)/busan/:slug',
        destination: '/:locale/tour-product/:slug',
        permanent: true,
      },
    ];
  },
  generateBuildId: async () => `build-${Date.now()}`,
  /** Slow disks / AV scans can hit default chunk load timeouts in dev (ChunkLoadError on app/layout). */
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer && config.output) {
      config.output.chunkLoadTimeout = 180000;
    }
    /**
     * Exclude `.claude/` from the dev file watcher. The agent harness keeps git
     * worktrees + session data under `.claude/` (tens of thousands of files);
     * without this, webpack's watcher churns through them and triggers an
     * endless rebuild loop that interrupts client hydration on large pages.
     * Glob strings only — this webpack version's schema rejects RegExp entries.
     */
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
          '**/.claude/**',
        ],
      };
    }
    return config;
  },
  // Static export for Capacitor (uncomment when building for mobile)
  // output: 'export',
  // i18n is handled by middleware + app/[locale] (next.config i18n breaks App Router)
  images: {
    unoptimized: process.env.NODE_ENV === 'production' && process.env.BUILD_FOR_MOBILE === 'true',
    /**
     * Explicit allowlist replaces a previous `**` wildcard. Add a host here
     * before referencing it from product JSON, registry, or DB-stored URLs.
     * Official Korean tourism CDNs (Visit Jeju, KTO, Visit Busan) are pre-allowed
     * to support Phase 9 image sourcing.
     */
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'plus.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'images.pexels.com', pathname: '/**' },
      { protocol: 'https', hostname: 'videos.pexels.com', pathname: '/**' },
      { protocol: 'https', hostname: 'pixabay.com', pathname: '/**' },
      { protocol: 'https', hostname: 'cdn.pixabay.com', pathname: '/**' },
      { protocol: 'https', hostname: 'live.staticflickr.com', pathname: '/**' },
      { protocol: 'https', hostname: 'farm1.staticflickr.com', pathname: '/**' },
      { protocol: 'https', hostname: 'farm2.staticflickr.com', pathname: '/**' },
      { protocol: 'https', hostname: 'farm3.staticflickr.com', pathname: '/**' },
      { protocol: 'https', hostname: 'farm4.staticflickr.com', pathname: '/**' },
      { protocol: 'https', hostname: 'farm5.staticflickr.com', pathname: '/**' },
      { protocol: 'https', hostname: 'farm6.staticflickr.com', pathname: '/**' },
      { protocol: 'https', hostname: 'farm7.staticflickr.com', pathname: '/**' },
      { protocol: 'https', hostname: 'farm8.staticflickr.com', pathname: '/**' },
      { protocol: 'https', hostname: 'farm9.staticflickr.com', pathname: '/**' },
      { protocol: 'https', hostname: '**.supabase.co', pathname: '/**' },
      { protocol: 'https', hostname: '**.supabase.in', pathname: '/**' },
      { protocol: 'https', hostname: 'cdn.visitjeju.net', pathname: '/**' },
      { protocol: 'https', hostname: 'api.cdn.visitjeju.net', pathname: '/**' },
      { protocol: 'https', hostname: 'www.visitjeju.net', pathname: '/**' },
      { protocol: 'https', hostname: 'tong.visitkorea.or.kr', pathname: '/**' },
      { protocol: 'https', hostname: 'ktoimg.visitkorea.or.kr', pathname: '/**' },
      { protocol: 'https', hostname: 'cdn.visitbusan.net', pathname: '/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'maps.googleapis.com', pathname: '/**' },
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    /** Allowed `quality` values for `next/image` (Next 16 rejects values not listed). */
    qualities: [75, 90],
    minimumCacheTTL: 60,
  },
  compress: true,
  reactStrictMode: true,
  // Production source maps (optional, for debugging)
  productionBrowserSourceMaps: false,
  // Experimental features for better performance
  experimental: {
    // optimizeCss: true, // Disabled due to critters module requirement
    /**
     * Tree-shake named imports from large packages so unused exports are dropped at
     * build time. Without this, `import { ShieldCheck } from "lucide-react"` still
     * pulls the full barrel; with it, only the requested members ship to the client.
     * Big wins here: framer-motion, recharts, lucide-react (577 icons), Google Maps.
     */
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      'recharts',
      '@react-google-maps/api',
    ],
  },
}

module.exports = withBundleAnalyzer(nextConfig)

