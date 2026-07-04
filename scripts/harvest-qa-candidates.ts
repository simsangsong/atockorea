/**
 * Harvest reusable Q&A drafts from past AI chat turns.
 *
 * Thin CLI wrapper around `lib/rag/harvest.ts` — the same core the weekly
 * Vercel cron (`/api/cron/rag-harvest`) runs (W5.1).
 *
 * The support-ticket path is already handled by createQaDraftFromSupportReply.
 *
 * Run:
 *   node --env-file=.env.local --import tsx scripts/harvest-qa-candidates.ts [--limit=40] [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import { harvestQaCandidates } from "@/lib/rag/harvest";

const argLimit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 40);
const DRY_RUN = process.argv.includes("--dry-run");

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required");
  return createClient(url, key, { auth: { persistSession: false } });
}

harvestQaCandidates(client(), {
  limit: Number.isFinite(argLimit) ? argLimit : 40,
  dryRun: DRY_RUN,
  log: (line) => console.log(line),
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
