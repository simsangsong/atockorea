/**
 * F3b / v3 — the screen-RECORDING stage (owner brief §V3-E).
 *
 * A screenshot shows what is on a screen. A recording shows what HAPPENS — and
 * the things this guide most needs to teach are transitions: a switch flipping,
 * a card disappearing because it did its job, a sheet rising. None of that can
 * be taught with a still.
 *
 * Same discipline as `shots.mjs`, for the same reason: every flow DECLARES
 * where it goes, what it presses and what it waits for, and a flow that cannot
 * complete fails the build instead of yielding a clip of the wrong thing. A
 * guide video showing an interaction the app no longer has is worse than no
 * video, because nobody re-checks a video once it ships.
 *
 * 🔴 Recordings do NOT replace screenshots. A card grid must stay still — four
 * moving cards cannot be read. Clips are for `screen-demo` scenes only.
 *
 * Usage:
 *   dev server + ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts && sim-populate.ts
 *   node scripts/scene-video/recordings.mjs [--locale en] [--out dir]
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '../video-guide/lib/deps.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.WALK_BASE ?? 'http://localhost:3181';
const ROOT = process.cwd();
const VIEW = { width: 390, height: 844 };

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const LOCALE = argOf('locale', 'en');
const OUT = path.resolve(ROOT, argOf('out', path.join(HERE, '.clips')));

/**
 * The flows.
 *
 * `steps` are (page) => Promise, run in order with a settle pause between them
 * so the recording reads as deliberate rather than as a machine flicking
 * through screens. `hold` is the pause after each step, in ms.
 */
export const FLOWS = [
  {
    id: 'flow-tabs',
    what: 'Moving between tabs — home, chat, today, settings',
    hold: 1100,
    // 🔴 The Map tab is deliberately NOT in this flow. The Google Maps key does
    // not allow a localhost referrer, so the canvas renders "Map unavailable" —
    // true of the build machine, false of the product, and a guide video must
    // not teach a failure state. Restore this step once the key's referrer
    // allowlist covers the dev origin.
    steps: [
      { tap: '[data-testid="room-tab-chat"]', wait: '[data-testid="chat-feed"]' },
      { tap: '[data-testid="room-tab-schedule"]', wait: '[data-tr-panel="schedule"]' },
      { tap: '[data-testid="room-tab-settings"]', wait: '[data-tr-panel="settings"]' },
      { tap: '[data-testid="room-tab-home"]', wait: '[data-testid="home-tab"]' },
    ],
  },
  {
    id: 'flow-unlock',
    what: 'Turning on arrival commentary — the card does its job and leaves',
    hold: 1300,
    steps: [
      // Sit on the card for a beat so the viewer reads it before it is used.
      { wait: '[data-testid="arrival-unlock-card"]' },
      // The card vanishing IS the confirmation — it only exists while the thing
      // is off. Proving it further on the Map tab would drag the broken map
      // canvas into the clip (see flow-tabs), so the proof stays on this screen.
      { tap: '[data-testid="arrival-unlock-enable"]', gone: '[data-testid="arrival-unlock-card"]' },
    ],
  },
  {
    id: 'flow-guide',
    what: 'Opening the Smart Guide from the header',
    hold: 1200,
    steps: [
      { tap: '[data-testid="concierge-open"], [data-testid="smart-guide-open"]', wait: '[data-testid="room-sheet"]' },
    ],
  },
];

const MASK_CSS = `
  nextjs-portal{display:none!important}
  [data-testid="presence-bar"] span[title]{color:transparent!important}
`;

function ff(argv, label) {
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...argv],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.status !== 0) {
    throw new Error(`ffmpeg failed (${label})\n${r.stderr?.toString().slice(0, 900)}`);
  }
}

function probeDuration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=nw=1:nk=1', file], { stdio: ['ignore', 'pipe', 'pipe'] });
  const n = Number.parseFloat(r.stdout?.toString().trim() ?? '');
  return Number.isFinite(n) ? n : 0;
}

async function clearOnboarding(page) {
  for (let i = 0; i < 8; i += 1) {
    if ((await page.locator('[data-testid="onboarding"]').count()) === 0) return;
    const next = page.locator('[data-testid="onboard-next"]');
    if ((await next.count()) === 0) return;
    await next.click({ timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(350);
  }
}

export async function captureFlows({ base = BASE, locale = LOCALE, out = OUT } = {}) {
  const fixturesPath = path.join(ROOT, 'scripts/.sim-fixtures.json');
  if (!fs.existsSync(fixturesPath)) {
    throw new Error('scripts/.sim-fixtures.json 이 없다 — 먼저 sim-tour-day.ts / sim-populate.ts');
  }
  const fx = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));
  fs.mkdirSync(out, { recursive: true });

  const browser = await chromium.launch();
  const manifest = {};

  for (const flow of FLOWS) {
    const raw = path.join(out, `.raw-${flow.id}`);
    fs.rmSync(raw, { recursive: true, force: true });
    fs.mkdirSync(raw, { recursive: true });

    const context = await browser.newContext({
      viewport: VIEW,
      deviceScaleFactor: 2,
      locale: `${locale}-KR`,
      permissions: ['geolocation'],
      geolocation: { latitude: 33.4586, longitude: 126.9425 },
      recordVideo: { dir: raw, size: VIEW },
      // The room animates on a timer; reduced motion would flatten the very
      // transitions this stage exists to capture.
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();

    try {
      const res = await page.goto(`${base}${fx.room1Url}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      if (!res || res.status() >= 400) throw new Error(`room unreachable: ${res?.status()}`);
      await page.waitForSelector('[data-testid="home-tab"]', { timeout: 60_000 });
      await page.evaluate(([id, l]) => window.localStorage.setItem(`tour_mode_locale:${id}`, l), [fx.booking1, locale]);
      // The opt-in persists per booking+day; clear it so `flow-unlock` records
      // the switch actually being turned on rather than an already-on screen.
      await page.evaluate(() => {
        for (const k of Object.keys(window.localStorage)) {
          if (k.startsWith('tour_mode_geo_share:')) window.localStorage.removeItem(k);
        }
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-testid="home-tab"]', { timeout: 60_000 });
      await page.addStyleTag({ content: MASK_CSS });
      await clearOnboarding(page);
      await page.waitForTimeout(1200);

      for (const step of flow.steps) {
        if (step.tap) {
          const target = page.locator(step.tap).first();
          if ((await target.count()) === 0) {
            throw new Error(`step target absent: ${step.tap}`);
          }
          await target.click({ timeout: 15_000 });
        }
        if (step.wait) await page.waitForSelector(step.wait, { timeout: 20_000 });
        if (step.gone) await page.waitForSelector(step.gone, { state: 'detached', timeout: 20_000 });
        await page.waitForTimeout(flow.hold ?? 1000);
      }
    } catch (e) {
      await context.close().catch(() => undefined);
      await browser.close().catch(() => undefined);
      throw new Error(
        `flow "${flow.id}" 을 완주하지 못했다: ${e.message}\n`
        + '  화면이 바뀌었거나 이 상태가 이 픽스처에 없다. 잘못된 클립으로 넘어가지 않는다.',
      );
    }

    // The .webm only lands on disk once the context closes.
    await context.close();
    const webm = fs.readdirSync(raw).find((f) => f.endsWith('.webm'));
    if (!webm) throw new Error(`flow "${flow.id}" 의 녹화 파일이 없다`);

    const mp4 = path.join(out, `${flow.id}.mp4`);
    // Re-encode to a keyframe-friendly h264 so the builder can seek into it,
    // and normalise to the pipeline's 30fps so the overlay never drifts.
    ff(['-i', path.join(raw, webm), '-r', '30', '-c:v', 'libx264', '-preset', 'medium',
      '-crf', '20', '-pix_fmt', 'yuv420p', '-an', mp4], `clip ${flow.id}`);
    fs.rmSync(raw, { recursive: true, force: true });

    const seconds = probeDuration(mp4);
    if (seconds < 1) throw new Error(`flow "${flow.id}" 클립이 ${seconds.toFixed(2)}s — 사실상 비어 있다`);
    manifest[flow.id] = {
      file: path.relative(ROOT, mp4),
      what: flow.what,
      seconds: Number(seconds.toFixed(2)),
      bytes: fs.statSync(mp4).size,
      locale,
    };
    console.log(`  🎬 ${flow.id.padEnd(14)} ${seconds.toFixed(1)}s  ${flow.what}`);
  }

  await browser.close();
  fs.writeFileSync(path.join(out, 'clips.json'),
    JSON.stringify({ base, locale, capturedFor: 'scene-video', clips: manifest }, null, 2));
  console.log(`\n  ${Object.keys(manifest).length}/${FLOWS.length} clips → ${path.relative(ROOT, out)}`);
  return manifest;
}

if (process.argv[1]?.endsWith('recordings.mjs')) {
  captureFlows().catch((e) => {
    console.error(`🔴 ${e.message}`);
    process.exit(1);
  });
}
