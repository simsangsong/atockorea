/**
 * Harness trust — a QA script that cannot reach the database is not a gate.
 *
 * Found in the feature audit (F0, 2026-08-03). `qa-course-classification.ts`
 * read a bare `process.env.SUPABASE_SERVICE_ROLE_KEY` and never called
 * `loadEnvConfig`. `tsx` does not load `.env.local` on its own, so on every
 * standard checkout the script printed "cannot check" and exited 2 — for as
 * long as it had existed. Its own header calls itself "the live half of the
 * course-classification gate"; the live half had never asked the question.
 *
 * It failed *honestly* (exit 2, never a silent 0), which is why nobody caught
 * it: the repo already learned that lesson from `qa-admin-cjk` reporting "0
 * issues" when it could not authenticate. Honesty stops a wrong answer. It does
 * not stop a missing one. An exit 2 that nobody reads and a passing gate look
 * identical from outside, and this is the second time in this track that a
 * thing was alive but unreachable.
 *
 * The invariant is mechanical and cannot drift: any script that reads Supabase
 * credentials out of the environment must also put them there.
 *
 * Mutation check: delete the `loadEnvConfig` import from any harness in
 * SUPABASE_HARNESSES and this suite fails.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCRIPTS = path.join(ROOT, 'scripts');

/** Reads Supabase credentials straight out of the process environment. */
const READS_SUPABASE_ENV = /process\.env\.(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)/;
/** Puts them there first. `dotenv` counts; the repo standard is `@next/env`. */
const LOADS_ENV = /loadEnvConfig|require\(['"]dotenv|from ['"]dotenv/;

function harnessFiles(): string[] {
  return readdirSync(SCRIPTS)
    .filter((f) => /^(qa-|k4-|sim-)[\w.-]+\.(ts|mjs)$/.test(f))
    .sort();
}

function reads(file: string): boolean {
  return READS_SUPABASE_ENV.test(readFileSync(path.join(SCRIPTS, file), 'utf8'));
}

const SUPABASE_HARNESSES = harnessFiles().filter(reads);

describe('harness env loading', () => {
  it('finds harnesses that talk to Supabase (a vacuous sweep proves nothing)', () => {
    // 🔴 The backstop this whole suite rests on. If the glob or the regex ever
    // stops matching, every assertion below passes over an empty list and this
    // file becomes decoration — the exact failure mode it exists to catch.
    expect(SUPABASE_HARNESSES.length).toBeGreaterThan(3);
  });

  it.each(SUPABASE_HARNESSES)('%s loads .env before reading Supabase credentials', (file) => {
    const source = readFileSync(path.join(SCRIPTS, file), 'utf8');
    expect(LOADS_ENV.test(source)).toBe(true);
  });
});
