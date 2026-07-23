/**
 * ops_whatsapp_templates 시드 — 6 locale × 5 프리셋 (플랜 §4.2).
 *
 * lib/ops/whatsapp/presets.ts의 WA_PRESETS를 단일 소스로
 * (tenant_id, preset_key, locale) upsert 한다. 몇 번을 다시 실행해도 30행 —
 * idempotent. 마이그레이션(20260724090000_ops_whatsapp.sql)이 먼저 적용되어
 * 있어야 한다 (unique index ops_whatsapp_templates_key_idx가 onConflict 대상).
 *
 * Usage:  npx tsx scripts/seed-ops-whatsapp-templates.ts [--dry-run]
 * Env:    NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *         (없으면 리포 루트 .env.local에서 읽는다)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { WA_PRESETS, WA_LOCALES, WA_PRESET_KEYS } from '../lib/ops/whatsapp/presets';

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

  // 시드 자체 무결성 검증 — 프리셋 5 × 로케일 6 전부 비어있지 않아야 한다.
  if (WA_PRESETS.length !== WA_PRESET_KEYS.length) {
    throw new Error(`[seed] preset count mismatch: ${WA_PRESETS.length} != ${WA_PRESET_KEYS.length}`);
  }
  for (const preset of WA_PRESETS) {
    for (const locale of WA_LOCALES) {
      const body = preset.bodies[locale];
      if (!body || !body.trim()) throw new Error(`[seed] empty body: ${preset.key}/${locale}`);
      if (!body.includes('{guest_name}')) {
        throw new Error(`[seed] ${preset.key}/${locale}: missing {guest_name} variable`);
      }
    }
  }
  console.log(`[seed] preset integrity OK: ${WA_PRESETS.length} presets × ${WA_LOCALES.length} locales`);

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

  const rows = WA_PRESETS.flatMap((preset) =>
    WA_LOCALES.map((locale) => ({
      tenant_id: TENANT_ID,
      preset_key: preset.key,
      locale,
      label: preset.label,
      timing: preset.timing,
      body: preset.bodies[locale],
      active: true,
      updated_at: new Date().toISOString(),
    })),
  );

  const { data, error } = await supabase
    .from('ops_whatsapp_templates')
    .upsert(rows, { onConflict: 'tenant_id,preset_key,locale' })
    .select('preset_key,locale');
  if (error) throw new Error(`[seed] upsert failed: ${error.message}`);

  console.log('[seed] upserted', data?.length ?? 0, 'templates');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
