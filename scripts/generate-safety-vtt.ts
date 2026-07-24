import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  SAFETY_SCRIPT_LOCALES,
  buildSafetyVtt,
  safetyVideoMetadata,
} from '../lib/video-automation/safetyScript';

/**
 * Generate the 30-second safety video's WebVTT tracks (plan §5.6.2).
 *
 *   npm run safety:vtt            # write the files
 *   npm run safety:vtt -- --check # fail if the committed files are stale
 *
 * Output (committed to the repo — they serve as static assets):
 *   public/videos/safety-intro-30s/subtitles/{locale}.vtt   × 10
 *   public/videos/safety-intro-30s/metadata.json
 *
 * The MP4 itself is a human deliverable and is deliberately NOT faked here.
 * Until one is produced, uploaded, and approved in /admin/poi-videos, the
 * safety briefing card ships as text only.
 */

const OUT_DIR = path.join(process.cwd(), 'public', 'videos', 'safety-intro-30s');
const SUBS_DIR = path.join(OUT_DIR, 'subtitles');

function main(): void {
  const check = process.argv.slice(2).includes('--check');
  const files: Array<{ file: string; content: string }> = SAFETY_SCRIPT_LOCALES.map((locale) => ({
    file: path.join(SUBS_DIR, `${locale}.vtt`),
    content: buildSafetyVtt(locale),
  }));
  files.push({
    file: path.join(OUT_DIR, 'metadata.json'),
    content: `${JSON.stringify(safetyVideoMetadata(), null, 2)}\n`,
  });

  if (check) {
    const stale = files.filter(
      ({ file, content }) => !existsSync(file) || readFileSync(file, 'utf8') !== content,
    );
    if (stale.length > 0) {
      console.error(`[safety:vtt] stale or missing:\n${stale.map((s) => `  ${s.file}`).join('\n')}`);
      process.exit(1);
    }
    console.log(`[safety:vtt] ${files.length} files up to date.`);
    return;
  }

  mkdirSync(SUBS_DIR, { recursive: true });
  for (const { file, content } of files) writeFileSync(file, content, 'utf8');
  console.log(`[safety:vtt] wrote ${files.length} files to ${OUT_DIR}`);
}

main();
