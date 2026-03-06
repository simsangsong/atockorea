import type { CapacitorConfig } from '@capacitor/cli';

/**
 * AtoC Korea - Android app config.
 *
 * Live URL mode: app loads the production website so website and app stay
 * in sync without rebuilding the app. Set CAPACITOR_SERVER_URL when running
 * `npx cap sync` to override (e.g. for staging).
 */
const config: CapacitorConfig = {
  appId: 'com.atockorea.app',
  appName: 'AtoC Korea',
  webDir: 'out',
  server: {
    // Load production site so app and website are always in sync.
    url: process.env.CAPACITOR_SERVER_URL || 'https://www.atockorea.com',
    cleartext: process.env.NODE_ENV === 'development',
    allowNavigation: [
      '*.atockorea.com',
      '*.stripe.com',
      '*.supabase.co',
      '*.google.com',
      '*.googleapis.com',
      '*.googleapis.com/*',
    ],
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 500,
      launchAutoHide: true,
      backgroundColor: '#1e40af',
    },
  },
};

export default config;
