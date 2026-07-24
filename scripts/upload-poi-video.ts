#!/usr/bin/env node
/**
 * W3 — publish a produced POI video run to Supabase Storage + the review queue.
 *
 *   npm run video:upload -- --poi=<poi_key> [--dir=<prod dir>] [--allow-warnings]
 *
 * Thin CLI over lib/video-automation/upload.server.ts (the batch runner calls
 * the same uploader). Rows land as **pending_review**; nothing serves until an
 * admin approves them in /admin/poi-videos (VP-D10).
 */

import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  latestRunDir,
  uploadProducedRun,
  type UploadDbClient,
} from '@/lib/video-automation/upload.server';

function parseArgs(argv: string[]): { poi: string; dir?: string; allowWarnings: boolean } {
  let poi = '';
  let dir: string | undefined;
  let allowWarnings = false;
  for (const arg of argv) {
    if (arg.startsWith('--poi=')) poi = arg.slice('--poi='.length).trim();
    else if (arg.startsWith('--dir=')) dir = arg.slice('--dir='.length).trim();
    else if (arg === '--allow-warnings') allowWarnings = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!poi && !dir) {
    throw new Error('Usage: npm run video:upload -- --poi=<poi_key> [--dir=<prod dir>] [--allow-warnings]');
  }
  return { poi, dir, allowWarnings };
}

async function main(): Promise<void> {
  const root = process.cwd();
  const options = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (.env.local).');
  }
  const supabase = createClient(supabaseUrl, supabaseKey) as unknown as UploadDbClient;

  const runDir = options.dir ? path.resolve(root, options.dir) : latestRunDir(root, options.poi);
  const result = await uploadProducedRun(supabase, {
    root,
    runDir,
    allowWarnings: options.allowWarnings,
    log: (line) => console.log(line),
  });

  console.log(
    `\nDone: ${result.uploaded.length} language(s) uploaded as pending_review (v${result.version}).` +
      '\nNext: approve them in /admin/poi-videos — nothing serves until then.',
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
