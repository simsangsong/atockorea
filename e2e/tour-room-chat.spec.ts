/**
 * T1.9 — two browser contexts (guide token / customer token) exchange
 * messages in one tour room (master plan §F, AC: playwright passes).
 *
 * Covers, end to end against the real join/messages APIs + Realtime/SSE:
 *   1. one-click direct entry via `?rt=` invite link, no login (§O-1 ①);
 *   2. token scrubbed from the address bar after join (§O-1 ③);
 *   3. guide → customer delivery and customer → guide delivery (round trip);
 *   4. quick-reply preset delivery (zero-LLM presetKey path, §M-2 ②).
 */
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { FIXTURES_PATH, type TourRoomE2EFixtures } from './global-setup';

const fixtures = (): TourRoomE2EFixtures =>
  JSON.parse(readFileSync(FIXTURES_PATH, 'utf8')) as TourRoomE2EFixtures;

async function openRoom(page: Page, bookingId: string, token: string): Promise<void> {
  await page.goto(`/tour-mode/room/${bookingId}?rt=${encodeURIComponent(token)}`, {
    timeout: 120_000, // first hit compiles the route on a cold dev server
  });
  // Joined = the chat feed is on screen.
  await expect(page.getByTestId('chat-feed')).toBeVisible({ timeout: 120_000 });
}

async function sendText(page: Page, text: string): Promise<void> {
  await page.getByRole('textbox').fill(text);
  await page.getByRole('button', { name: 'send' }).click();
}

test('guide and customer round-trip chat through invite tokens', async ({ browser }) => {
  test.setTimeout(300_000); // cold `next dev` compile of the room route dominates
  const { bookingId, guideToken, customerToken } = fixtures();
  const runId = Date.now().toString(36);

  const guideContext = await browser.newContext();
  const customerContext = await browser.newContext();
  const guidePage = await guideContext.newPage();
  const customerPage = await customerContext.newPage();

  try {
    await openRoom(guidePage, bookingId, guideToken);
    await openRoom(customerPage, bookingId, customerToken);

    // §O-1 ③ — the invite token must not stay in the address bar / history.
    await expect.poll(() => guidePage.url()).not.toContain('rt=');
    await expect.poll(() => customerPage.url()).not.toContain('rt=');

    // Guide → customer.
    const guideMessage = `E2E guide ping ${runId}`;
    await sendText(guidePage, guideMessage);
    await expect(guidePage.getByTestId('chat-feed')).toContainText(guideMessage);
    await expect(customerPage.getByTestId('chat-feed')).toContainText(guideMessage, {
      timeout: 30_000,
    });

    // Customer → guide.
    const customerMessage = `E2E customer pong ${runId}`;
    await sendText(customerPage, customerMessage);
    await expect(customerPage.getByTestId('chat-feed')).toContainText(customerMessage);
    await expect(guidePage.getByTestId('chat-feed')).toContainText(customerMessage, {
      timeout: 30_000,
    });

    // Quick-reply preset (zero-LLM presetKey path): first chip, customer → guide.
    const firstChip = customerPage.getByTestId('quick-replies').locator('button').first();
    const chipLabel = (await firstChip.innerText()).trim();
    await firstChip.click();
    await expect(guidePage.getByTestId('chat-feed')).toContainText(
      // Chip label is "emoji text"; the feed shows the text part.
      chipLabel.replace(/^\S+\s/, ''),
      { timeout: 30_000 },
    );
  } finally {
    await guideContext.close();
    await customerContext.close();
  }
});
