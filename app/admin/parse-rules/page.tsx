'use client';

/**
 * DE5 — OTA 파서 학습 화면.
 *
 * 지금까지 파서는 예약 메일 파싱에 실패하면 기록만 남기고(라이브 38건) 아무것도
 * 배우지 않았다. 같은 형식이 다음에 또 와도 또 실패했다. 규칙을 만들 길이
 * 코드 어디에도 없었기 때문이다.
 *
 * 여기서 하는 일은 두 가지뿐이다:
 *   ① 여러 번 본 표기(후보)를 **shadow** 규칙으로 만든다 — 아직 파싱에 안 쓰인다
 *   ② 근거가 있으면 **활성**으로 올린다 — Hard Rule #20 "No silent active rule"
 *
 * 활성화는 통계(매치 100회·동의율 95%)를 넘거나, 사유를 적어야 한다. DB CHECK가
 * 같은 규칙을 하한으로 강제하므로 화면을 우회해도 조용히 켜지지 않는다.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Play, RotateCcw, Sparkles, XCircle } from 'lucide-react';
import { getAdminAccessToken } from '@/app/admin/match-pois/_hooks/usePoiRow';

interface RuleRow {
  id: string;
  template_pattern: string;
  status: string;
  source: string;
  match_count: number;
  success_count: number;
  promotion_reason: string | null;
  governance: 'threshold' | 'override' | 'ungoverned';
  notes: string | null;
  created_at: string;
}

interface Candidate {
  template_hash: string;
  cluster_size: number;
  raw_line_template: string;
  template_pattern: string;
  slot_map: Record<string, number>;
}

interface Health {
  totalObservations: number;
  corpus: { haiku: number; sonnet: number; humanCorrection: number; adapter: number };
  lastObservedAt: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  shadow: '섀도(관찰만)',
  candidate: '후보',
  active: '활성',
  retired: '은퇴',
};

export default function ParseRulesPage() {
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [skipped, setSkipped] = useState<Array<{ template_hash: string; reason: string; cluster_size: number }>>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [minCluster, setMinCluster] = useState(3);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const authedFetch = useCallback(async (url: string, init?: RequestInit) => {
    const token = await getAdminAccessToken();
    return fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
      credentials: 'include',
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch('/api/admin/parse-rules');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '불러오기 실패');
      setRules(json.rules ?? []);
      setCandidates(json.candidates ?? []);
      setSkipped(json.skipped ?? []);
      setHealth(json.health ?? null);
      setMinCluster(json.min_cluster_size ?? 3);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const makeShadow = async (templateHash: string) => {
    setBusy(templateHash);
    try {
      const res = await authedFetch('/api/admin/parse-rules', {
        method: 'POST',
        body: JSON.stringify({ template_hash: templateHash }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '규칙 생성 실패');
      toast.success('섀도 규칙으로 만들었어요. 실제 파싱에는 아직 쓰이지 않아요.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '규칙 생성 실패');
    } finally {
      setBusy(null);
    }
  };

  const transition = async (id: string, action: 'promote' | 'retire' | 'shadow') => {
    let reason: string | null = null;
    if (action === 'promote') {
      // 사유는 거버넌스의 증거다 — 비우면 서버가 422로 되돌린다.
      reason = window.prompt('활성화 사유를 적어주세요 (무엇을 확인했나요?)');
      if (reason === null) return;
    }
    setBusy(id);
    try {
      const res = await authedFetch(`/api/admin/parse-rules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action, ...(reason ? { promotion_reason: reason } : {}) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '변경 실패');
      toast.success(action === 'promote' ? '활성화했어요.' : action === 'retire' ? '은퇴시켰어요.' : '섀도로 되돌렸어요.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '변경 실패');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-cjk-safe text-xl font-bold text-stone-900">파서 학습 규칙</h1>
        <p className="text-cjk-body mt-1 text-sm text-stone-600">
          같은 형식의 예약 메일을 다시 손으로 고치지 않으려면, 여러 번 본 표기를 규칙으로 만들어 두세요.
          규칙은 <b>섀도</b>로 시작해 실제 파싱에 영향을 주지 않고, 확인한 뒤에만 활성화됩니다.
        </p>
      </header>

      <section className="rounded-xl border border-stone-200 bg-white p-4" data-testid="learning-health">
        <h2 className="text-cjk-safe text-sm font-bold text-stone-900">학습 코퍼스</h2>
        {health === null ? (
          <p className="mt-1 text-sm text-stone-500">측정할 수 없습니다(관찰 저장소 미가동).</p>
        ) : (
          <p className="mt-1 text-sm text-stone-700">
            관찰 {health.totalObservations.toLocaleString()}건 · 사람 교정 {health.corpus.humanCorrection}건
            {health.lastObservedAt ? ` · 마지막 ${health.lastObservedAt.slice(0, 10)}` : ' · 아직 관찰 없음'}
          </p>
        )}
      </section>

      <section>
        <h2 className="text-cjk-safe text-sm font-bold text-stone-900">
          후보 <span className="font-normal text-stone-500">({minCluster}회 이상 본 표기)</span>
        </h2>
        {loading ? (
          <p className="mt-2 text-sm text-stone-500">불러오는 중…</p>
        ) : candidates.length === 0 ? (
          <p className="text-cjk-body mt-2 text-sm text-stone-500">
            아직 후보가 없습니다. 같은 형식의 메일을 {minCluster}번 이상 파싱하면 여기에 나타납니다.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {candidates.map((c) => (
              <li
                key={c.template_hash}
                className="text-cjk-safe rounded-xl border border-stone-200 bg-white p-3"
                data-testid={`candidate-${c.template_hash}`}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="break-all font-mono text-xs text-stone-700">{c.raw_line_template}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {c.cluster_size}회 관찰 · 추출 항목 {Object.keys(c.slot_map).join(', ') || '없음'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === c.template_hash}
                    onClick={() => void makeShadow(c.template_hash)}
                    className="text-cjk-safe inline-flex h-9 shrink-0 items-center gap-1 rounded-lg bg-stone-900 px-3 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    <Sparkles className="size-3.5" /> 섀도로 만들기
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {skipped.length > 0 && (
          <details className="mt-2">
            <summary className="text-cjk-safe cursor-pointer text-xs text-stone-500">
              규칙으로 못 만든 뭉치 {skipped.length}건
            </summary>
            <ul className="mt-1 space-y-1 text-xs text-stone-500">
              {skipped.map((s) => (
                <li key={s.template_hash}>
                  {s.cluster_size}회 · {s.reason}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section>
        <h2 className="text-cjk-safe text-sm font-bold text-stone-900">규칙 {rules.length}건</h2>
        {rules.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">아직 규칙이 없습니다.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {rules.map((r) => (
              <li key={r.id} className="text-cjk-safe rounded-xl border border-stone-200 bg-white p-3" data-testid={`rule-${r.id}`}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="break-all font-mono text-xs text-stone-700">{r.template_pattern}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {STATUS_LABEL[r.status] ?? r.status} · 매치 {r.match_count}/성공 {r.success_count}
                      {r.status === 'active' && r.governance === 'ungoverned' && (
                        <span className="ml-1 font-bold text-red-700">⚠ 근거 없는 활성</span>
                      )}
                      {r.promotion_reason ? ` · ${r.promotion_reason}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {r.status !== 'active' && r.status !== 'retired' && (
                      <button
                        type="button"
                        disabled={busy === r.id}
                        onClick={() => void transition(r.id, 'promote')}
                        className="text-cjk-safe inline-flex h-9 items-center gap-1 rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        <Play className="size-3.5" /> 활성화
                      </button>
                    )}
                    {r.status === 'active' && (
                      <button
                        type="button"
                        disabled={busy === r.id}
                        onClick={() => void transition(r.id, 'shadow')}
                        className="text-cjk-safe inline-flex h-9 items-center gap-1 rounded-lg bg-stone-100 px-3 text-xs font-semibold text-stone-700 disabled:opacity-40"
                      >
                        <RotateCcw className="size-3.5" /> 섀도로
                      </button>
                    )}
                    {r.status !== 'retired' && (
                      <button
                        type="button"
                        disabled={busy === r.id}
                        onClick={() => void transition(r.id, 'retire')}
                        className="text-cjk-safe inline-flex h-9 items-center gap-1 rounded-lg bg-stone-100 px-3 text-xs font-semibold text-stone-700 disabled:opacity-40"
                      >
                        <XCircle className="size-3.5" /> 은퇴
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-cjk-body flex items-start gap-1.5 text-xs text-stone-500">
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
        활성 규칙은 통계 임계(매치 100회·동의율 95%)를 넘거나 사유가 있어야 합니다. 화면을 우회해도 DB가 같은 규칙으로 막습니다.
      </p>
    </div>
  );
}
