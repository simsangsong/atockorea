/**
 * support 인박스 유실분 백필 — Resend Received API → received_emails.
 *
 * 왜 필요한가: Resend 웹훅이 apex 도메인(atockorea.com)을 가리키고 있었고,
 * apex는 www로 307 리다이렉트된다. Resend는 리다이렉트를 따라가지 않고 실패로
 * 기록하므로 2026-05-21 이후 수신분이 DB에 한 건도 저장되지 않았다. URL은
 * 고쳐졌지만 그 기간의 메일은 Resend 쪽에만 남아 있다.
 *
 * 왜 대시보드 Replay가 아닌가: Replay는 웹훅 이벤트가 보존된 건에만 쓸 수
 * 있고 한 건씩 수동 클릭이다. Received API는 수신 메일 원본을 페이지네이션으로
 * 전부 돌려주므로 보존 기간에 의존하지 않는다.
 *
 * 저장 규칙은 웹훅 라우트와 공유한다 (lib/support/storeReceivedEmail.ts) —
 * 복구분과 실시간분이 다르게 저장되면 안 되므로.
 *
 * 멱등: received_emails.message_id UNIQUE. 몇 번을 다시 돌려도 duplicate로 끝난다.
 *
 * Usage:
 *   npx tsx scripts/backfill-received-emails.ts --dry-run          # 판정만 (기본 권장)
 *   npx tsx scripts/backfill-received-emails.ts                    # 실제 저장
 *   npx tsx scripts/backfill-received-emails.ts --since 2026-05-21 # 기간 한정
 *   npx tsx scripts/backfill-received-emails.ts --limit 50
 *
 * Env: RESEND_API_KEY (Full access — send-only 제한 키는 Received API에서 401)
 *      NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *      (없으면 리포 루트 .env.local에서 읽는다)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { storeReceivedEmail, supportInboundAddresses } from '../lib/support/storeReceivedEmail';

// @ts-expect-error import.meta.url under tsx
const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
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

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

interface ReceivedListItem {
  id: string;
  created_at?: string;
}

async function resendGet<T>(path: string, apiKey: string): Promise<T> {
  const res = await fetch(`https://api.resend.com${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const json = (await res.json()) as T & { message?: string; name?: string };
  if (!res.ok) {
    throw new Error(
      `Resend ${path} → ${res.status} ${json.name ?? ''} ${json.message ?? ''}`.trim() +
        (res.status === 401 ? '\n  ↳ RESEND_API_KEY가 Full access인지 확인하세요 (send-only 키는 Received API 불가).' : ''),
    );
  }
  return json;
}

/** Received API 전체 페이지네이션. */
async function listAllReceived(apiKey: string, limit: number): Promise<ReceivedListItem[]> {
  const out: ReceivedListItem[] = [];
  let after: string | null = null;
  while (out.length < limit) {
    const qs = new URLSearchParams({ limit: String(Math.min(100, limit - out.length)) });
    if (after) qs.set('after', after);
    const page = await resendGet<{ data: ReceivedListItem[]; has_more: boolean }>(
      `/emails/receiving?${qs}`,
      apiKey,
    );
    if (!page.data?.length) break;
    out.push(...page.data);
    if (!page.has_more) break;
    const last = page.data[page.data.length - 1];
    if (!last?.id || last.id === after) break; // 커서가 안 움직이면 중단 (무한루프 방지)
    after = last.id;
  }
  return out.slice(0, limit);
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes('--dry-run');
  const since = arg('--since');
  const limit = Number(arg('--limit') ?? 500);

  const apiKey = process.env.RESEND_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY가 없습니다.');
  if (!supabaseUrl || !serviceKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 없습니다.');

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  console.log(`[backfill] support 주소: ${[...supportInboundAddresses()].join(', ')}`);
  console.log(`[backfill] 모드: ${dryRun ? 'DRY-RUN (쓰기 없음)' : '실제 저장'}${since ? ` / since=${since}` : ''}`);

  const listed = await listAllReceived(apiKey, limit);
  const targets = since ? listed.filter((e) => (e.created_at ?? '') >= since) : listed;
  console.log(`[backfill] Resend 수신 목록 ${listed.length}건 → 대상 ${targets.length}건\n`);

  const tally = { stored: 0, stored_self: 0, duplicate: 0, not_support: 0, error: 0 };
  for (const item of targets) {
    // 목록 응답에는 본문이 없다 — 건별로 원본을 가져온다.
    let full: Record<string, unknown>;
    try {
      full = await resendGet<Record<string, unknown>>(`/emails/receiving/${item.id}`, apiKey);
    } catch (e) {
      tally.error += 1;
      console.log(`  ✗ ${item.id} fetch 실패: ${e instanceof Error ? e.message : e}`);
      continue;
    }

    const outcome = await storeReceivedEmail({
      supabase,
      data: full,
      fallbackMessageId: item.id,
      dryRun,
    });

    tally[outcome.result] += 1;
    const when = (item.created_at ?? '').slice(0, 19);
    // dry-run 판단 근거로 발신자/제목을 같이 보여준다 — 자기 자신이 보낸
    // 자동응답·바운스가 섞여 있으면 contact_inquiries 노이즈가 되므로.
    const who = String((full.from as string) ?? '').slice(0, 34);
    const subj = String((full.subject as string) ?? '(제목없음)').replace(/\s+/g, ' ').slice(0, 44);
    if (outcome.result === 'stored') console.log(`  ✓ ${when}  ${who.padEnd(34)} ${subj}`);
    else if (outcome.result === 'stored_self') console.log(`  ↩ ${when}  ${who.padEnd(34)} ${subj}   [자체알림·문의 미생성]`);
    else if (outcome.result === 'duplicate') console.log(`  · ${when}  이미 저장됨`);
    else if (outcome.result === 'not_support') console.log(`  – ${when}  support 대상 아님 (${outcome.recipients.join(', ') || '수신자 불명'})`);
    else console.log(`  ✗ ${when}  ${outcome.stage}: ${outcome.message}`);
  }

  console.log(
    `\n[backfill] 문의생성 ${tally.stored} / 자체알림 ${tally.stored_self} / 중복 ${tally.duplicate} / 대상아님 ${tally.not_support} / 실패 ${tally.error}`,
  );
  if (dryRun) console.log('[backfill] --dry-run 이었습니다. 실제 저장하려면 플래그 없이 다시 실행하세요.');
}

main().catch((e) => {
  console.error('[backfill] 실패:', e instanceof Error ? e.message : e);
  process.exit(1);
});
