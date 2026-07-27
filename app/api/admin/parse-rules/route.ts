import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { AdminAuthFailure, adminAuthJsonResponse, requireAdmin } from '@/lib/auth';
import { buildRuleFromCluster, type MineableCluster } from '@/lib/ops/parse/mining';
import { governanceState } from '@/lib/ops/parse/rule-governance';
import { getLearningHealth } from '@/lib/ops/parse/health';

export const dynamic = 'force-dynamic';

/**
 * DE5 — OTA 파서 학습 루프의 쓰기 쪽.
 *
 * `ops_parse_rules`를 만지는 라우트가 **하나도 없었다.** 규칙을 읽는 코드는 있고,
 * 실패 뭉치를 규칙으로 바꾸는 `buildRuleFromCluster`도 있는데 아무도 부르지
 * 않았다. 그래서 파서는 실패를 모으기만 하고(라이브 38건) 아무것도 배우지
 * 못했다(규칙 0건).
 *
 * GET  — 규칙 목록 + **후보**(관찰 뭉치에서 방금 계산한 것)
 * POST — 후보 하나를 shadow 규칙으로 만든다 (활성화가 아니다)
 *
 * 🔴 후보의 패턴은 **서버에서 다시 계산한다.** 클라이언트가 보낸 정규식을 그대로
 * 저장하면 어드민 화면이 파서에 임의 패턴을 주입하는 통로가 된다. 요청은
 * `template_hash`만 고른다.
 */

const TENANT = 'atockorea';
/** 이보다 적게 본 템플릿은 규칙으로 만들지 않는다 — 일회성 표기일 수 있다. */
const MIN_CLUSTER_SIZE = 3;

interface ObservationRow {
  template_hash: string;
  raw_line_template: string;
}

/** 관찰 → 템플릿 해시별 뭉치. 마이닝은 template_hash 기준이다(임베딩 아님). */
async function loadClusters(
  supabase: ReturnType<typeof createServerClient>,
): Promise<MineableCluster[]> {
  const { data } = await supabase
    .from('ops_parse_observations')
    .select('template_hash, raw_line_template')
    .eq('tenant_id', TENANT)
    .limit(5000);

  const byHash = new Map<string, { template: string; n: number }>();
  for (const row of (data ?? []) as ObservationRow[]) {
    const hit = byHash.get(row.template_hash);
    if (hit) hit.n += 1;
    else byHash.set(row.template_hash, { template: row.raw_line_template, n: 1 });
  }

  return [...byHash.entries()]
    .filter(([, v]) => v.n >= MIN_CLUSTER_SIZE)
    .map(([template_hash, v]) => ({
      tenant_id: TENANT,
      template_hash,
      raw_line_template: v.template,
      cluster_size: v.n,
    }))
    .sort((a, b) => b.cluster_size - a.cluster_size);
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();

    const { data: ruleRows } = await supabase
      .from('ops_parse_rules')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    const rules: Array<Record<string, unknown>> = ((ruleRows ?? []) as Array<Record<string, unknown>>).map((r) => ({
      ...r,
      // 활성 규칙이 무엇을 근거로 활성인지 화면이 말할 수 있어야 한다.
      governance: governanceState({
        match_count: Number(r.match_count ?? 0),
        success_count: Number(r.success_count ?? 0),
        promotion_reason: (r.promotion_reason as string | null) ?? null,
        validated_fixture: (r.validated_fixture as string | null) ?? null,
        promoted_by: (r.promoted_by as string | null) ?? null,
      }),
    }));

    // 이미 규칙이 된 템플릿은 후보에서 뺀다(notes 에 출처 해시를 적어 둔다).
    const usedHashes = new Set(
      rules.map((r) => String(r.notes ?? '')).flatMap((n) => {
        const m = n.match(/template_hash=([a-z0-9_-]+)/i);
        return m ? [m[1]] : [];
      }),
    );

    const clusters = await loadClusters(supabase);
    const candidates: Array<Record<string, unknown>> = [];
    const skipped: Array<Record<string, unknown>> = [];
    for (const cluster of clusters) {
      if (usedHashes.has(cluster.template_hash)) continue;
      const { candidate, skip } = buildRuleFromCluster(cluster);
      if (candidate) {
        candidates.push({
          template_hash: cluster.template_hash,
          cluster_size: cluster.cluster_size,
          raw_line_template: cluster.raw_line_template,
          template_pattern: candidate.template_pattern,
          slot_map: candidate.slot_map,
        });
      } else if (skip) {
        // 왜 후보가 못 됐는지도 보여준다 — 조용히 사라지면 원인을 못 찾는다.
        skipped.push({ ...skip, cluster_size: cluster.cluster_size });
      }
    }

    // 학습 건강도. `health.ts` 주석이 "the admin surface treats null as
    // 'health unavailable'"이라고 적어 두었는데 그 admin surface가 없었다.
    const health = await getLearningHealth(supabase, TENANT);

    return NextResponse.json({ rules, candidates, skipped, health, min_cluster_size: MIN_CLUSTER_SIZE });
  } catch (error: unknown) {
    if (error instanceof AdminAuthFailure) return adminAuthJsonResponse(error);
    console.error('[GET /api/admin/parse-rules]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();
    const body = (await req.json().catch(() => ({}))) as { template_hash?: string };
    const templateHash = String(body.template_hash ?? '').trim();
    if (!templateHash) {
      return NextResponse.json({ error: 'template_hash is required' }, { status: 400 });
    }

    const cluster = (await loadClusters(supabase)).find((c) => c.template_hash === templateHash);
    if (!cluster) {
      return NextResponse.json(
        { error: `이 템플릿은 아직 ${MIN_CLUSTER_SIZE}회 이상 관찰되지 않았습니다.` },
        { status: 404 },
      );
    }

    const { candidate, skip } = buildRuleFromCluster(cluster);
    if (!candidate) {
      return NextResponse.json({ error: `규칙으로 만들 수 없습니다: ${skip?.reason}` }, { status: 409 });
    }

    // 🔴 shadow 로만 들어간다. 활성화는 PATCH 의 거버넌스 검사를 통과해야 한다.
    const { data, error } = await supabase
      .from('ops_parse_rules')
      .insert({
        tenant_id: candidate.tenant_id,
        scope: candidate.scope,
        template_pattern: candidate.template_pattern,
        slot_map: candidate.slot_map,
        postprocess: candidate.postprocess,
        source: 'auto_mined',
        status: 'shadow',
        notes: `template_hash=${cluster.template_hash} cluster_size=${cluster.cluster_size}`,
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ rule: data }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof AdminAuthFailure) return adminAuthJsonResponse(error);
    console.error('[POST /api/admin/parse-rules]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
