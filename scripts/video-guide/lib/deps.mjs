/**
 * Where the two native/heavy dependencies come from.
 *
 * 🔴 Neither `sharp` nor `playwright` is installed in the main checkout, and a
 * git worktree usually has no `node_modules` at all — the pilot only ran
 * because one particular worktree happened to have both. A later session
 * invoking this pipeline from main would have had the vertical cut, the wide
 * cut and the poster all die on `Cannot find package 'playwright'`.
 *
 * So they are resolved explicitly against a checkout that does have them,
 * with an env override for a machine laid out differently. NEVER junction
 * node_modules into a worktree instead — a recursive delete follows the link
 * out into the real checkout (trap T-15).
 *
 * If this throws, the message says exactly what to do; do not silently fall
 * back to a headless-less path, because the shell would then render nothing
 * and the guide would ship without text.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';

const HOSTS = [
  process.env.VIDEO_GUIDE_DEP_HOST,
  process.env.VIDEO_GUIDE_SHARP_HOST,          // the older, sharp-only name
  'C:/Users/sangsong/atockorea-ops-next/package.json',
  'C:/Users/sangsong/atockorea/package.json',
].filter(Boolean);

function load(name) {
  const tried = [];
  for (const host of HOSTS) {
    if (!fs.existsSync(host)) { tried.push(`${host} (no package.json)`); continue; }
    try {
      return createRequire(host)(name);
    } catch (e) {
      tried.push(`${host} (${e.code ?? 'failed'})`);
    }
  }
  throw new Error(
    `'${name}' 을 찾을 수 없다. 설치된 체크아웃을 가리켜라:\n` +
    `  VIDEO_GUIDE_DEP_HOST=<...>/package.json node scripts/video-guide/...\n` +
    `또는 그 체크아웃에서 npm i ${name}\n시도한 경로:\n  ` + tried.join('\n  '));
}

export const sharp = load('sharp');
export const { chromium } = load('playwright');
