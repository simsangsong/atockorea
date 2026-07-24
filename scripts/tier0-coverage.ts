/**
 * §L L4 — Tier 0 커버리지 리포트.
 *
 *   npx tsx scripts/tier0-coverage.ts [--days=30] [--limit=20] [--min=2]
 *
 * `chat_messages`에서 **Tier 1로 샌 컨시어지 질문**을 모아 빈도순으로 묶는다.
 * Tier 0 사전에 걸리면 네트워크도 LLM도 쓰지 않으므로(< 100ms), 여기 위쪽에
 * 있는 질문이 §L에서 가장 값싼 절감원이다 — 캐시(L2)가 두 번째부터 아끼는
 * 반면 사전은 **첫 번째부터** 아낀다.
 *
 * 🔴 **읽기 전용이다. 사전을 자동으로 고치지 않는다.**
 * 빈도만 보고 키워드를 넣으면 오답이 사전에 굳고, 그때부터 그 질문은 영원히
 * 틀린 즉답을 받는다. 채택은 사람이 `lib/tour-room/concierge.ts`의
 * INTENT_KEYWORDS를 직접 고쳐서 한다.
 */
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { matchConciergeIntent, classifyConciergeGuardrail } from '../lib/tour-room/concierge';
import { potentialCallsSaved, rankTier0Candidates, type QuestionSample } from '../lib/ops/ai/tier0Coverage';

const TIER1_CATEGORY = 'tour_room_concierge_tier1';

function arg(name: string, fallback: number): number {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  const n = hit ? Number(hit.split('=')[1]) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('missing supabase env');
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const days = arg('days', 30);
  const limit = arg('limit', 20);
  const minCount = arg('min', 2);
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Tier 1 응답들 → 그 직전 user 메시지가 샌 질문이다.
  const { data: replies, error } = await sb
    .from('chat_messages')
    .select('session_id, message_index, user_locale, created_at')
    .eq('category', TIER1_CATEGORY)
    .gte('created_at', sinceIso)
    .limit(5000);
  if (error) throw error;

  const rows = (replies ?? []) as Array<{ session_id: string; message_index: number; user_locale: string | null }>;
  if (rows.length === 0) {
    console.log(`최근 ${days}일간 Tier 1 응답이 없습니다 — 샌 질문이 없거나 아직 트래픽이 없습니다.`);
    return;
  }

  // 질문은 바로 앞 인덱스의 user 행이다(logChatTurn이 N=user, N+1=assistant로 넣는다).
  const samples: QuestionSample[] = [];
  const bySession = new Map<string, number[]>();
  for (const r of rows) {
    const list = bySession.get(r.session_id) ?? [];
    list.push(r.message_index - 1);
    bySession.set(r.session_id, list);
  }

  for (const [sessionId, indexes] of bySession) {
    const { data: questions } = await sb
      .from('chat_messages')
      .select('content, user_locale')
      .eq('session_id', sessionId)
      .eq('role', 'user')
      .in('message_index', indexes);
    for (const q of (questions ?? []) as Array<{ content: string | null; user_locale: string | null }>) {
      if (q.content) samples.push({ question: q.content, locale: q.user_locale });
    }
  }

  // 가드레일에 걸린 질문(환불·응급 등)은 사전 후보가 아니다 — 그건 사람에게
  // 넘겨야 하는 것이고, 즉답으로 만들면 S6(신뢰)을 깎는다.
  const eligible = samples.filter((s) => !classifyConciergeGuardrail(s.question));

  const candidates = rankTier0Candidates(eligible, {
    alreadyMatched: (t) => Boolean(matchConciergeIntent(t)),
    minCount,
    limit,
  });

  console.log(`\n=== Tier 0 커버리지 (최근 ${days}일) ===`);
  console.log(`Tier 1 응답 ${rows.length}건 · 질문 수집 ${samples.length}건 · 가드레일 제외 후 ${eligible.length}건`);
  console.log(`후보 ${candidates.length}건 (${minCount}회 이상 반복)\n`);

  if (candidates.length === 0) {
    console.log('반복되는 누락 질문이 없습니다 — 사전을 늘려도 아낄 것이 없습니다.');
    return;
  }

  for (const [i, c] of candidates.entries()) {
    console.log(`${String(i + 1).padStart(2)}. ${c.count}회  [${c.locales.join(',') || '-'}]  ${c.key}`);
    for (const s of c.samples) console.log(`      · ${s}`);
  }

  console.log(`\n전부 채택하면 최대 ${potentialCallsSaved(candidates)}회의 Tier 1 호출이 사라집니다.`);
  console.log('🔴 자동 반영하지 않습니다 — lib/tour-room/concierge.ts의 INTENT_KEYWORDS를 사람이 고치세요.');
  console.log('   (오답을 사전에 굳히면 그 질문은 영원히 틀린 즉답을 받습니다.)');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
