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
      /** Admin is locale-neutral. Collapse stale localized admin URLs before they 404. */
      { source: '/ko/admin/ko/admin/:path*', destination: '/admin/:path*', permanent: false },
      { source: '/ko/admin/ko/admin', destination: '/admin', permanent: false },
      { source: '/ko/admin/ko', destination: '/admin', permanent: false },
      { source: '/admin/ko/admin/:path*', destination: '/admin/:path*', permanent: false },
      { source: '/admin/ko/admin', destination: '/admin', permanent: false },
      { source: '/admin/ko', destination: '/admin', permanent: false },
      {
        source: '/:locale(en|ko|zh-CN|zh-TW|ja|es)/admin/:innerLocale(en|ko|zh-CN|zh-TW|ja|es)/admin/:path*',
        destination: '/admin/:path*',
        permanent: false,
      },
      {
        source: '/:locale(en|ko|zh-CN|zh-TW|ja|es)/admin/:innerLocale(en|ko|zh-CN|zh-TW|ja|es)/admin',
        destination: '/admin',
        permanent: false,
      },
      {
        source: '/:locale(en|ko|zh-CN|zh-TW|ja|es)/admin/:innerLocale(en|ko|zh-CN|zh-TW|ja|es)',
        destination: '/admin',
        permanent: false,
      },
      {
        source: '/admin/:locale(en|ko|zh-CN|zh-TW|ja|es)/admin',
        destination: '/admin',
        permanent: false,
      },
      {
        source: '/admin/:locale(en|ko|zh-CN|zh-TW|ja|es)/admin/:path*',
        destination: '/admin/:path*',
        permanent: false,
      },
      {
        source: '/admin/:locale(en|ko|zh-CN|zh-TW|ja|es)',
        destination: '/admin',
        permanent: false,
      },
      { source: '/:locale(en|ko|zh-CN|zh-TW|ja|es)/admin', destination: '/admin', permanent: false },
      { source: '/:locale(en|ko|zh-CN|zh-TW|ja|es)/admin/:path*', destination: '/admin/:path*', permanent: false },
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
      /**
       * Legacy region-landing pages (`/busan`, `/jeju`, `/seoul`) were broken
       * stubs ("Busan Tours" header with 2 hardcoded cards, one mislabeled as
       * Jeju). The canonical region surfaces are now the tours hub
       * (`/tours/list?destination=...`) and the itinerary builder
       * (`/itinerary-builder?region=...`). Send users to the builder when they
       * hit a region root, since that's where they'd be choosing region anyway.
       */
      { source: '/busan', destination: '/itinerary-builder?region=busan', permanent: true },
      { source: '/jeju', destination: '/itinerary-builder?region=jeju', permanent: true },
      // /seoul stays untouched until Seoul rollout (post-MVP) — it's at least
      // not a dead end since the home + /tours still surface Seoul content.
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
  /**
   * N20 — baseline security response headers (previously absent entirely).
   *
   * Scope is the safe, framework-agnostic subset that does not risk breaking
   * third-party embeds (Stripe Elements, Google Maps, LINE OAuth):
   *   - HSTS: force HTTPS for a year (prod is HTTPS-only behind Vercel).
   *   - X-Content-Type-Options: stop MIME sniffing.
   *   - X-Frame-Options + frame-ancestors: block clickjacking via framing.
   *   - Referrer-Policy: don't leak full URLs (which can carry bookingId/token).
   *   - Permissions-Policy: drop powerful features we never use.
   * A full Content-Security-Policy is intentionally deferred — our pages load
   * inline Stripe/Maps scripts and would need a nonce/allowlist pass first
   * (tracked separately) to avoid breaking checkout and map tiles.
   */
  async headers() {
    const securityHeaders = [
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains',
      },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        /**
         * Tour Room needs same-origin mic (voice bridge STT) and camera (photo
         * capture) for guests/guides/drivers. `microphone=()` / `camera=()`
         * blocks BOTH — self included — so `getUserMedia()` was rejected without
         * even prompting. `(self)` allows only our own origin (no third parties),
         * which is what the feature requires. geolocation stays self-only.
         */
        key: 'Permissions-Policy',
        value: 'camera=(self), microphone=(self), geolocation=(self), browsing-topics=()',
      },
    ];
    return [{ source: '/:path*', headers: securityHeaders }];
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
      { protocol: 'https', hostname: 'atockorea.com', pathname: '/images/**' },
      { protocol: 'https', hostname: 'www.atockorea.com', pathname: '/images/**' },
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
    /**
     * Cache transformed variants for 1 year. Default 60s forces a re-transform
     * of every `/_next/image?url=...` after a minute, which on cold cache for
     * 33-card list pages (× 3 device sizes × 2 formats) becomes hundreds of
     * sharp pipeline runs per visit. Source paths are stable (filename-based,
     * versioned by the wire-poi-images script when content changes), so a long
     * TTL is safe — content edits land on new filenames anyway.
     */
    minimumCacheTTL: 31536000,
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
     *
     * `@react-google-maps/api` is intentionally NOT in this list — Next's modular
     * import transform splits its named exports across separate module instances,
     * which breaks `useJsApiLoader`'s module-scope load cache. The result is that
     * two consumers (e.g. POICatalogMap + TourPickupMapSection) each get their own
     * "is loading" state and one or both stay stuck on the loading placeholder.
     */
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      'recharts',
    ],
  },
}

module.exports = withBundleAnalyzer(nextConfig)
