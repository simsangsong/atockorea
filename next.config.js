/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
  // Static export for Capacitor (uncomment when building for mobile)
  // output: 'export',
  images: {
    unoptimized: process.env.NODE_ENV === 'production' && process.env.BUILD_FOR_MOBILE === 'true',
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },
  // Enable compression
  compress: true,
  // Optimize production builds
  swcMinify: true,
  // Enable React strict mode
  reactStrictMode: true,
  // Optimize fonts
  optimizeFonts: true,
  // Production source maps (optional, for debugging)
  productionBrowserSourceMaps: false,
  // Experimental features for better performance
  experimental: {
    optimizeCss: true,
  },
}

module.exports = withBundleAnalyzer(nextConfig)

