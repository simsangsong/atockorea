/**
 * qa-sse-reconnect — what the room does when the fallback itself fails.
 *
 * K1a hardened the SERVER: a declared duration, a backoff curve, a reconnect
 * cache, a start ceiling that throttles instead of rejecting. All of that is
 * asserted in `sseFallbackDefence.test.ts` and none of it is in question here.
 *
 * This walks the other half — the browser — because K1a's own premise is that
 * the expensive, and therefore the interesting, event is the RECONNECT, and the
 * client is who performs it. `useTourRoomChannel` has exactly two transports
 * with no polling client behind them, so if the fallback dies the room does not
 * degrade: it goes silent, and the guest has no reason to reload.
 *
 * Three phases, in a real browser, with the realtime WebSocket blocked so the
 * SSE ladder is actually the live transport (R-3's corporate-wifi case):
 *
 *   1. healthy      — the room reaches /events at all. Without this the other
 *                     two phases would be measuring an empty page.
 *   2. network drop — /events is aborted at the transport layer. `EventSource`
 *                     is specified to retry this, so the count MUST climb. This
 *                     phase exists to prove the meter works: a harness that
 *                     cannot see a retry cannot claim one is missing.
 *   3. HTTP error   — /events answers 500. Per spec a non-200 fails the
 *                     connection PERMANENTLY (readyState CLOSED, no retry), so
 *                     recovery here has to come from our code or not at all.
 *
 * Phase 3 is the assertion. Phase 2 is what keeps phase 3 honest.
 *
 * A ceiling is asserted alongside the floor: recovering by hammering would just
 * be K1a again from the other end.
 *
 * Usage:
 *   ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts && npx tsx scripts/sim-populate.ts
 *   WALK_BASE=http://localhost:3185 npx tsx scripts/qa-sse-reconnect.ts
 *
 * Exit: 0 = all checks passed · 1 = a check failed · 2 = preconditions absent.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { chromium, type Browser, type Page } from 'playwright';

const BASE = process.env.WALK_BASE ?? 'http://localhost:3185';
const OUT = process.env.WALK_OUT ?? 'scripts/.walk-sse';
const FIXTURES = path.join(__dirname, '.sim-fixtures.json');

/** Long enough for several native retries (~3s apart) and one of ours. */
const OBSERVE_MS = 26_000;
/** Recovering by hammering is the same bug from the other end. */
const MAX_ATTEMPTS_IN_WINDOW = 10;

const results: Array<{ name: string; ok: boolean; detail: string }> = [];
const check = (name: string, ok: boolean, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  ✅' : '  🔴'} ${name}${detail ? ` — ${detail}` : ''}`);
  return ok;
};

/**
 * Noise this walk causes on purpose, plus the machine's own.
 *
 * Phases 2 and 3 exist to make /events fail, so the browser logging that it
 * failed is the harness working. Printing it beside real errors would train the
 * next reader to skim past the section — anything NOT listed here is a finding.
 */
const EXPECTED_NOISE = [
  /Google Maps/, // refuses localhost referrers; this machine, not the product
  /ERR_CONNECTION_RESET/, // phase 2, injected
  /status of 500/, // phase 3, injected
];
const isExpected = (text: string) => EXPECTED_NOISE.some((r) => r.test(text));

/**
 * Blocks the realtime transport the way a hotel firewall does, so the room is
 * genuinely running on the fallback rather than merely having one available.
 * Without this every phase below would be measuring realtime and passing.
 */
const BLOCK_WEBSOCKET = `
  (() => {
    const Dead = class {
      constructor() {
        this.readyState = 3;
        setTimeout(() => {
          try { this.onerror && this.onerror(new Event('error')); } catch {}
          try { this.onclose && this.onclose({ code: 1006, reason: 'blocked', wasClean: false }); } catch {}
        }, 30);
      }
      send() {}
      close() {}
      addEventListener() {}
      removeEventListener() {}
    };
    Dead.CONNECTING = 0; Dead.OPEN = 1; Dead.CLOSING = 2; Dead.CLOSED = 3;
    window.WebSocket = Dead;
  })();
`;

type Phase = 'healthy' | 'abort' | 'http500';

interface PhaseResult {
  attempts: number;
  hint: string;
  errors: string[];
}

async function runPhase(browser: Browser, roomUrl: string, phase: Phase): Promise<PhaseResult> {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: 'en-US',
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !isExpected(m.text())) errors.push(m.text().slice(0, 160));
  });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 160)));

  await page.addInitScript(BLOCK_WEBSOCKET);

  let attempts = 0;
  await page.route('**/api/tour-rooms/**/events*', async (route) => {
    attempts += 1;
    if (phase === 'abort') return route.abort('connectionreset');
    if (phase === 'http500') {
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    }
    return route.continue();
  });

  await page.goto(`${BASE}${roomUrl}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  // Wait for the shell, never for a number of seconds: dev compiles on first
  // hit and a fixed sleep screenshots "불러오는 중…" instead of the room.
  await page
    .waitForSelector('[data-testid="lifecycle-badge"], [data-testid="room-tab-chat"]', { timeout: 180_000 })
    .catch(() => undefined);

  const startedAt = Date.now();
  const attemptsAtStart = attempts;
  await page.waitForTimeout(OBSERVE_MS);
  const observed = attempts - attemptsAtStart;

  const hint = await readConnectionHint(page);
  await page.screenshot({ path: path.join(OUT, `${phase}.png`) }).catch(() => undefined);
  await context.close();

  console.log(
    `  · ${phase}: ${attempts} attempt(s) total, ${observed} in the ${Math.round(
      (Date.now() - startedAt) / 1000,
    )}s window · header says "${hint || '(nothing)'}"`,
  );
  return { attempts, hint, errors };
}

/** The degraded-connection line RoomShell renders in the header, if any. */
async function readConnectionHint(page: Page): Promise<string> {
  return page
    .evaluate(() => {
      const header = document.querySelector('header');
      const line = header?.querySelector('p');
      return line?.textContent?.trim() ?? '';
    })
    .catch(() => '');
}

async function main(): Promise<number> {
  loadEnvConfig(process.cwd());
  mkdirSync(OUT, { recursive: true });

  if (!existsSync(FIXTURES)) {
    console.error('🔴 no scripts/.sim-fixtures.json — run sim-tour-day.ts then sim-populate.ts');
    return 2;
  }
  const fx = JSON.parse(readFileSync(FIXTURES, 'utf8')) as { room1Url?: string };
  if (!fx.room1Url) {
    console.error('🔴 fixtures carry no room1Url');
    return 2;
  }

  const browser = await chromium.launch();
  const errors: string[] = [];
  try {
    console.log('\n  realtime blocked — the room is on the SSE fallback for all three phases\n');

    const healthy = await runPhase(browser, fx.room1Url, 'healthy');
    errors.push(...healthy.errors);
    if (
      !check(
        '① 폴백이 살아 있다 (realtime 차단 시 /events 로 내려온다)',
        healthy.attempts > 0,
        `${healthy.attempts} 회 접속`,
      )
    ) {
      // Everything after this would be measuring a page that never tried.
      console.error('\n🔴 SSE 사다리에 도달하지 못했다 — 이 뒤의 측정은 전부 공허하다.');
      return 2;
    }

    const dropped = await runPhase(browser, fx.room1Url, 'abort');
    errors.push(...dropped.errors);
    check(
      '② 네트워크 끊김은 브라우저가 스스로 복구한다 (계측기가 재시도를 볼 수 있다)',
      dropped.attempts >= 2,
      `${OBSERVE_MS / 1000}초 동안 ${dropped.attempts} 회 시도`,
    );

    const broken = await runPhase(browser, fx.room1Url, 'http500');
    errors.push(...broken.errors);
    check(
      '🔴 ③ 서버가 500 을 한 번 뱉어도 방이 되살아난다',
      broken.attempts >= 2,
      broken.attempts >= 2
        ? `${OBSERVE_MS / 1000}초 동안 ${broken.attempts} 회 시도`
        : `${OBSERVE_MS / 1000}초 동안 ${broken.attempts} 회 — EventSource 가 영구히 닫혔고 아무도 다시 열지 않는다`,
    );
    check(
      '④ 되살아나되 두들기지 않는다',
      broken.attempts <= MAX_ATTEMPTS_IN_WINDOW,
      `상한 ${MAX_ATTEMPTS_IN_WINDOW} / 실측 ${broken.attempts}`,
    );
    /**
     * The lie is specific: stuck forever with nothing in flight while the header
     * still promises a reconnection. "Offline — retrying" alongside a real retry
     * is the truth and passes; "Reconnecting…" with one attempt ever does not.
     */
    check(
      '⑤ 아무도 재시도하지 않는데 헤더가 "다시 연결하는 중"이라고 하지 않는다',
      !(broken.attempts < 2 && /reconnect|연결|再接続|Reconex|重新连|重新連|Verbindung|Переподкл|Riconness/i.test(broken.hint)),
      `헤더: "${broken.hint || '(없음)'}"`,
    );
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n  ${results.length - failed.length}/${results.length} 통과 · 스크린샷 ${OUT}/`);
  const unexpected = [...new Set(errors)];
  if (unexpected.length > 0) {
    console.log('\n  🔴 예상 밖 콘솔 에러 (주입한 실패가 아니다):');
    for (const e of unexpected.slice(0, 8)) console.log('   ', e);
  }
  if (results.length === 0) {
    console.error('\n🔴 아무것도 검사하지 않았다.');
    return 2;
  }
  return failed.length > 0 || unexpected.length > 0 ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error);
    process.exit(2);
  });
