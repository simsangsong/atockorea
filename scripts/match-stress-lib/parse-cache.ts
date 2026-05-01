/**
 * Tiny on-disk cache for Haiku parser outputs so reruns are deterministic
 * and don't burn API credit on identical queries.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ParsedQueryV2 } from "@/lib/tour-match-v2/types";

const ROOT = join(process.cwd(), "scripts", "match-stress-lib", "results", "parsed-cache");

function ensureDir(): void {
  if (!existsSync(ROOT)) mkdirSync(ROOT, { recursive: true });
}

function key(query: string): string {
  return createHash("sha256").update(query).digest("hex").slice(0, 32);
}

export function readParseCache(query: string): ParsedQueryV2 | null {
  ensureDir();
  const file = join(ROOT, `${key(query)}.json`);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as ParsedQueryV2;
  } catch {
    return null;
  }
}

export function writeParseCache(query: string, parsed: ParsedQueryV2): void {
  ensureDir();
  const file = join(ROOT, `${key(query)}.json`);
  writeFileSync(file, JSON.stringify(parsed, null, 2));
}
