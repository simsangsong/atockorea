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
    ];
  },
  generateBuildId: async () => `build-${Date.now()}`,
  /** Slow disks / AV scans can hit default chunk load timeouts in dev (ChunkLoadError on app/layout). */
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer && config.output) {
      config.output.chunkLoadTimeout = 180000;
    }
    return config;
  },
  // Static export for Capacitor (uncomment when building for mobile)
  // output: 'export',
  // i18n is handled by middleware + app/[locale] (next.config i18n breaks App Router)
  images: {
    unoptimized: process.env.NODE_ENV === 'production' && process.env.BUILD_FOR_MOBILE === 'true',
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'plus.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'images.pexels.com', pathname: '/**' },
      { protocol: 'https', hostname: 'videos.pexels.com', pathname: '/**' },
      /** Fallback for CMS / Supabase / other CDNs used elsewhere in the app */
      { protocol: 'https', hostname: '**', pathname: '/**' },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },
  compress: true,
  reactStrictMode: true,
  // Production source maps (optional, for debugging)
  productionBrowserSourceMaps: false,
  // Experimental features for better performance
  experimental: {
    // optimizeCss: true, // Disabled due to critters module requirement
  },
}

module.exports = withBundleAnalyzer(nextConfig)

