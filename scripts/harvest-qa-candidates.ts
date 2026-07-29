/**
 * Harvest reusable Q&A drafts from past AI chat turns.
 *
 * Thin CLI wrapper around `lib/rag/harvest.ts` — the same core the weekly
 * Vercel cron (`/api/cron/rag-harvest`) runs (W5.1).
 *
 * The support-ticket path is already handled by createQaDraftFromSupportReply.
 *
 * X20 — this runs BOTH sources, same as the cron: marketing chat turns, and
 * tour-room pairs (a guest asked, a guide answered). One flywheel, two inputs;
 * a second harvest command would drift from this one within a release.
 *
 * Run:
 *   node --env-file=.env.local --import tsx scripts/harvest-qa-candidates.ts [--limit=40] [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import { harvestQaCandidates } from "@/lib/rag/harvest";
import { harvestRoomQaCandidates } from "@/lib/rag/roomHarvest.server";

const argLimit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 40);
const DRY_RUN = process.argv.includes("--dry-run");

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required");
  return createClient(url, key, { auth: { persistSession: false } });
}

const limit = Number.isFinite(argLimit) ? argLimit : 40;
const log = (line: string) => console.log(line);

async function main() {
  const sb = client();
  const room = await harvestRoomQaCandidates(sb, { limit, dryRun: DRY_RUN, log });
  const chat = await harvestQaCandidates(sb, { limit, dryRun: DRY_RUN, log });
  console.log(
    `[harvest] room drafts ${room.created} (rooms ${room.roomsScanned}, pairs ${room.pairsFound}, ` +
      `dupes ${room.dupes}, thin ${room.tooThin}) · chat drafts ${chat.created}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
