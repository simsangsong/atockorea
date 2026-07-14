import { defineConfig, devices } from '@playwright/test';

/**
 * T1.9 — Playwright E2E for Tour Mode (master plan §F).
 *
 * The suite runs against a local `next dev` server with the tour-mode flag on.
 * Live-data model (same approach as the chatbot golden tests): global-setup
 * seeds one clearly-labelled E2E booking in the project database via the
 * service-role key from .env.local, signs invite tokens with the same secret
 * ladder the server uses, and global-teardown removes everything it created.
 *
 * Run: `npm run e2e` (first time: `npx playwright install chromium`).
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  // One worker: tests share a single seeded room and message feed order matters.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${process.env.E2E_PORT || 3311}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx next dev -p ${process.env.E2E_PORT || 3311} --webpack`,
    port: Number(process.env.E2E_PORT || 3311),
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_TOUR_MODE_V1: '1',
    },
  },
});
