/**
 * W7.1 — the ops-center SOS loop, end to end:
 *
 *   1. customer (invite token, real browser) sends an SOS from the room and
 *      sees the "connected to ops" status (W4.3);
 *   2. the ops plane surfaces it — /rooms pins the SOS room and /channels
 *      hands out its Broadcast topic (W2.1) — asserted with a real admin
 *      bearer (throwaway admin user created here, removed in cleanup);
 *   3. ops replies through the admin messages path (the ops drawer's exact
 *      call, W3.3);
 *   4. the customer receives the reply live with the ops highlight (W4.3).
 *
 * The ops drawer/tab UI itself is covered by component tests — this spec
 * proves the full customer↔ops data loop against the live stack.
 */
import { readFileSync } from 'node:fs';
import { loadEnvConfig } from '@next/env';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { test, expect, type Page } from '@playwright/test';
import { FIXTURES_PATH, type TourRoomE2EFixtures } from './global-setup';

const OPS_ADMIN_EMAIL = 'e2e-tour-ops-admin@atockorea.test';

const fixtures = (): TourRoomE2EFixtures =>
  JSON.parse(readFileSync(FIXTURES_PATH, 'utf8')) as TourRoomE2EFixtures;

let service: SupabaseClient;
let adminUserId: string | null = null;
let adminAccessToken: string;

test.beforeAll(async () => {
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !anonKey) throw new Error('E2E ops spec needs Supabase env (.env.local)');
  service = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Throwaway admin: auth user + user_profiles role=admin (the requireAdmin gate).
  const password = `E2e!${Math.random().toString(36).slice(2, 12)}Aa1`;
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email: OPS_ADMIN_EMAIL,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) throw new Error(`E2E ops admin create failed: ${createError?.message}`);
  adminUserId = created.user.id;
  const { error: profileError } = await service
    .from('user_profiles')
    .upsert({ id: adminUserId, full_name: 'E2E Ops Admin', role: 'admin' });
  if (profileError) throw new Error(`E2E ops admin profile failed: ${profileError.message}`);

  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({
    email: OPS_ADMIN_EMAIL,
    password,
  });
  if (signInError || !signIn.session) throw new Error(`E2E ops admin sign-in failed: ${signInError?.message}`);
  adminAccessToken = signIn.session.access_token;
});

test.afterAll(async () => {
  if (!adminUserId) return;
  await service.from('user_profiles').delete().eq('id', adminUserId);
  await service.auth.admin.deleteUser(adminUserId);
});

async function openRoom(page: Page, bookingId: string, token: string): Promise<void> {
  await page.goto(`/tour-mode/room/${bookingId}?rt=${encodeURIComponent(token)}`, { timeout: 120_000 });
  await expect(page.getByTestId('chat-feed')).toBeVisible({ timeout: 120_000 });
}

async function adminGet(baseURL: string, path: string): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${baseURL}${path}`, {
    headers: { Authorization: `Bearer ${adminAccessToken}` },
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

test('SOS → ops feed → ops reply → customer receives the highlighted answer', async ({ browser, baseURL }) => {
  test.setTimeout(300_000);
  const { bookingId, tourDate, customerToken } = fixtures();
  const runId = Date.now().toString(36);

  const customerContext = await browser.newContext({ permissions: [] }); // geolocation denied → location-less SOS path
  const customerPage = await customerContext.newPage();

  try {
    // 1 — customer sends an SOS and sees the connected status.
    await openRoom(customerPage, bookingId, customerToken);
    // The SOS button lives inside the collapsed emergency card — expand it first.
    await customerPage.getByRole('button', { name: /Emergency & help/ }).click();
    await customerPage.getByTestId('sos-button').click();
    await customerPage.getByTestId('sos-send').click();
    await expect(customerPage.getByTestId('sos-sent')).toBeVisible({ timeout: 30_000 });
    await expect(customerPage.getByTestId('sos-connected')).toBeVisible();

    // 2 — the ops plane pins the SOS room (aggregate) and exposes its topic (directory).
    await expect
      .poll(
        async () => {
          const { status, json } = await adminGet(baseURL!, `/api/admin/tour-ops/rooms?date=${tourDate}`);
          if (status !== 200) return `status:${status}`;
          const rooms = json.rooms as Array<{ booking_id: string; sos: unknown }>;
          const room = rooms.find((r) => r.booking_id === bookingId);
          return room?.sos ? 'sos-pinned' : 'no-sos';
        },
        { timeout: 30_000 },
      )
      .toBe('sos-pinned');

    const channels = await adminGet(baseURL!, `/api/admin/tour-ops/channels?date=${tourDate}`);
    expect(channels.status).toBe(200);
    const channelRows = channels.json.channels as Array<{ booking_id: string; topic: string }>;
    expect(channelRows.find((row) => row.booking_id === bookingId)?.topic).toMatch(/^tour-room:/);

    // 3 — ops replies through the admin messages path (the drawer's call).
    const replyText = `Ops here — we are on it (${runId})`;
    const replyRes = await fetch(`${baseURL}/api/tour-rooms/${bookingId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminAccessToken}` },
      body: JSON.stringify({ text: replyText }),
    });
    expect(replyRes.status).toBe(201);

    // 4 — the customer receives it live, highlighted as the ops response.
    await expect(customerPage.getByTestId('chat-feed')).toContainText(replyText, { timeout: 30_000 });
    await expect(customerPage.getByTestId('ops-reply-dot').first()).toBeVisible();
  } finally {
    await customerContext.close();
  }
});
