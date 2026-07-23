/**
 * ops_vehicle_layouts 시드 — 차량 배치도 5종 (플랜 §5.3b, 웹 검증 확정판).
 *
 * lib/ops/seating/layouts.ts의 VEHICLE_LAYOUT_SEEDS를 단일 소스로
 * (tenant_id, model) upsert 한다. 몇 번을 다시 실행해도 결과는 5행 —
 * idempotent. 마이그레이션(20260723130000_ops_seating.sql)이 먼저
 * 적용되어 있어야 한다 (unique index ops_vehicle_layouts_tenant_model_idx
 * 가 onConflict 대상).
 *
 * Usage:  npx tsx scripts/seed-vehicle-layouts.ts [--dry-run]
 * Env:    NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *         (없으면 리포 루트 .env.local에서 읽는다)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { VEHICLE_LAYOUT_SEEDS, VEHICLE_MODELS, seatCount } from '../lib/ops/seating/layouts';

// @ts-expect-error import.meta.url under tsx
const __dirname = dirname(fileURLToPath(import.meta.url));

const TENANT_ID = 'atockorea';

function loadEnvLocal() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  for (const candidate of [
    join(__dirname, '..', '.env.local'),
    join(__dirname, '..', '..', 'atockorea', '.env.local'), // worktree → main repo
  ]) {
    if (!existsSync(candidate)) continue;
    for (const line of readFileSync(candidate, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, '');
    }
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  // 시드 자체 무결성 검증 — totalSeats와 layout 좌석 수가 어긋나면 중단.
  for (const model of VEHICLE_MODELS) {
    const seed = VEHICLE_LAYOUT_SEEDS[model];
    const actual = seatCount(seed.layout);
    if (actual !== seed.totalSeats) {
      throw new Error(
        `[seed] ${model}: layout has ${actual} seats but totalSeats=${seed.totalSeats}`,
      );
    }
    const numbers = seed.layout.seats.map((s) => s.n).sort((a, b) => a - b);
    numbers.forEach((n, i) => {
      if (n !== i + 1) throw new Error(`[seed] ${model}: seat numbers not contiguous 1..N`);
    });
  }
  console.log('[seed] layout integrity OK:',
    VEHICLE_MODELS.map((m) => `${m}=${VEHICLE_LAYOUT_SEEDS[m].totalSeats}`).join(' '));

  if (dryRun) {
    console.log('[seed] --dry-run: no DB writes.');
    return;
  }

  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing');
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const rows = VEHICLE_MODELS.map((model) => {
    const seed = VEHICLE_LAYOUT_SEEDS[model];
    return {
      tenant_id: TENANT_ID,
      model: seed.model,
      display_name: seed.displayName,
      layout_json: seed.layout,
      total_seats: seed.totalSeats,
      updated_at: new Date().toISOString(),
    };
  });

  const { data, error } = await supabase
    .from('ops_vehicle_layouts')
    .upsert(rows, { onConflict: 'tenant_id,model' })
    .select('model,total_seats');
  if (error) throw new Error(`[seed] upsert failed: ${error.message}`);

  console.log('[seed] upserted', data?.length ?? 0, 'layouts:');
  for (const r of data ?? []) console.log(`  - ${r.model}: ${r.total_seats} seats`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
