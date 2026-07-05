"use client";

/**
 * 챗봇 분석 대시보드 — RAG/학습 루프 상태 한눈에.
 *   볼륨 · 에스컬레이션율 · 디플렉션율 · 피드백 도움률 · 의도분포 · Q&A 파이프라인 · RAG 인덱스
 *   + 커버리지 갭(도움 안 됨/에스컬레이션 질문)에서 원클릭 Q&A 초안 생성.
 *
 * Auth: app/admin/layout.tsx 가 세운 Supabase admin 세션 사용.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, ThumbsUp, ThumbsDown, Check, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { StatCard, StatCardSkeleton } from "@/components/admin/StatCard";
import { Skeleton } from "@/components/admin/Skeleton";
import { cn } from "@/lib/utils";

type Analytics = {
  window_days: number;
  volume: { sessions: number; messages: number; userMessages: number; escalatedMessages: number; tickets: number };
  escalationRate: number;
  deflectionRate: number | null;
  /** W6.5 — turns that neither escalated nor drew a 👎 (conservative proxy). */
  resolutionRate?: number | null;
  funnel: { bookings: number; confirmed: number; pending: number; valueKrw: number };
  reliability?: {
    assistantTurns24h: number;
    errorTurns24h: number;
    failureRate24h: number;
    cost24hUsd: number;
    costWindowUsd: number;
  };
  feedback: { positive: number; negative: number; total: number; helpfulRate: number | null };
  qa: Record<string, number>;
  rag: { bySource: Record<string, number>; total: number; lastRefresh: string | null };
  categories: Record<string, number>;
  gaps: {
    negativeFeedback: Array<{ question: string | null; answer: string | null; locale: string | null; tour_slug: string | null; created_at: string }>;
    escalatedQuestions: Array<{ content: string; escalation_reason: string | null; user_locale: string | null; tour_slug: string | null; created_at: string }>;
  };
};

const PERIODS = [7, 30, 90] as const;

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const { data: { session } } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  if (!session) throw new Error("not_authenticated");
  return fetch(path, {
    ...init,
    credentials: "include",
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
  });
}

function pct(n: number | null): string {
  return n === null ? "—" : `${Math.round(n * 100)}%`;
}

export default function ChatbotAnalyticsPage() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [created, setCreated] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await authedFetch(`/api/admin/chatbot-analytics?days=${days}`);
      if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
      setData((await r.json()) as Analytics);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const createDraft = useCallback(
    async (key: string, question: string, answer: string, tourSlug: string | null, locale: string | null) => {
      setBusy(key);
      try {
        const r = await authedFetch("/api/admin/qa-pairs", {
          method: "POST",
          body: JSON.stringify({
            question: question.slice(0, 2000),
            answer: (answer || "(작성 필요 — 검토 후 보완)").slice(0, 8000),
            question_locale: locale || "ko",
            answer_locale: locale || "ko",
            tour_slug: tourSlug || undefined,
            source: "manual",
            tags: ["coverage_gap"],
          }),
        });
        if (!r.ok) throw new Error(await r.text());
        setCreated((prev) => new Set(prev).add(key));
        toast.success("Q&A 초안을 생성했습니다");
      } catch (e) {
        toast.error(`초안 생성 실패: ${(e as Error).message}`);
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const periodSelector = (
    <div className="flex items-center gap-1 rounded-lg border border-admin-border bg-admin-surface p-0.5">
      {PERIODS.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => setDays(d)}
          className={cn(
            "min-h-9 rounded-md px-3 text-xs font-semibold transition-colors",
            days === d ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
          )}
        >
          {d}일
        </button>
      ))}
    </div>
  );

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-900">챗봇 분석</h1>
        <p className="text-sm text-slate-500">최근 {data?.window_days ?? days}일 · RAG·학습 루프 상태</p>
      </div>
      <div className="flex items-center gap-2">
        {periodSelector}
        <button
          onClick={() => void load()}
          aria-label="새로고침"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-admin-border bg-admin-surface px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} /> 새로고침
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
        <Skeleton className="h-28 w-full rounded-design-md" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 w-full rounded-design-md" />
          <Skeleton className="h-40 w-full rounded-design-md" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        {header}
        <div className="max-w-xl rounded-design-md border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-medium text-red-800">오류: {error}</p>
          <button
            onClick={() => void load()}
            className="mt-3 min-h-11 rounded-lg bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const catEntries = Object.entries(data.categories).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const catMax = Math.max(1, ...catEntries.map(([, n]) => n));

  return (
    <div className="space-y-6">
      {header}

      {/* Volume + rates (escalation now surfaced alongside deflection) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard label="세션" value={data.volume.sessions.toLocaleString()} />
        <StatCard
          label="사용자 질문"
          value={data.volume.userMessages.toLocaleString()}
          sublabel={`총 메시지 ${data.volume.messages.toLocaleString()}`}
        />
        {/* W6.5 — 해결률(보수적 프록시): 에스컬레이션도 👎도 없던 턴 비율 */}
        <StatCard
          label="해결률"
          value={pct(data.resolutionRate ?? null)}
          sublabel="에스컬레이션·👎 미발생 턴"
        />
        <StatCard
          label="에스컬레이션율"
          value={pct(data.escalationRate)}
          sublabel={`사람 연결 ${data.volume.escalatedMessages.toLocaleString()}건`}
        />
        <StatCard label="디플렉션율" value={pct(data.deflectionRate)} sublabel="사람 없이 응대 (≠해결)" />
        <StatCard
          label="답변 도움률"
          value={pct(data.feedback.helpfulRate)}
          sublabel={
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-0.5"><ThumbsUp className="size-3" /> {data.feedback.positive}</span>
              <span className="inline-flex items-center gap-0.5"><ThumbsDown className="size-3" /> {data.feedback.negative}</span>
            </span>
          }
        />
      </div>

      {/* W0.2c/W0.5 — reliability + LLM cost (spend-cap early warning) */}
      {data.reliability && (
        <div className="rounded-design-md border border-admin-border bg-admin-surface p-4 shadow-admin-card">
          <h2 className="text-sm font-semibold text-slate-900">신뢰성 · LLM 비용</h2>
          <p className="text-xs text-slate-500">
            실패 턴은 <code className="rounded bg-slate-100 px-1">[error:코드]</code>로 기록 · 비용 급증 시 Gemini 지출캡(ai.studio/usage) 접근 여부를 확인하세요
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center md:grid-cols-4">
            <div>
              <div className={cn("text-2xl font-bold tabular-nums", data.reliability.failureRate24h > 0.01 ? "text-rose-600" : "text-emerald-600")}>
                {pct(data.reliability.failureRate24h)}
              </div>
              <div className="text-xs text-slate-500">실패율 (24h)</div>
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-slate-900">
                {data.reliability.errorTurns24h.toLocaleString()}<span className="text-sm font-medium text-slate-400">/{data.reliability.assistantTurns24h.toLocaleString()}</span>
              </div>
              <div className="text-xs text-slate-500">실패/전체 턴 (24h)</div>
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-slate-900">${data.reliability.cost24hUsd.toFixed(3)}</div>
              <div className="text-xs text-slate-500">LLM 비용 (24h)</div>
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-slate-900">${data.reliability.costWindowUsd.toFixed(2)}</div>
              <div className="text-xs text-slate-500">LLM 비용 ({data.window_days}일)</div>
            </div>
          </div>
        </div>
      )}

      {/* Chatbot quote → checkout funnel (bookings the bot created) */}
      <div className="rounded-design-md border border-admin-border bg-admin-surface p-4 shadow-admin-card">
        <h2 className="text-sm font-semibold text-slate-900">챗봇 견적 → 예약 퍼널</h2>
        <p className="text-xs text-slate-500">최근 {data.window_days}일 · 챗봇이 만든 예약 (source_url=chatbot)</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center md:grid-cols-4">
          <div><div className="text-2xl font-bold tabular-nums text-slate-900">{data.funnel.bookings.toLocaleString()}</div><div className="text-xs text-slate-500">예약 생성</div></div>
          <div><div className="text-2xl font-bold tabular-nums text-emerald-600">{data.funnel.confirmed.toLocaleString()}</div><div className="text-xs text-slate-500">결제확정/홀드</div></div>
          <div><div className="text-2xl font-bold tabular-nums text-amber-600">{data.funnel.pending.toLocaleString()}</div><div className="text-xs text-slate-500">결제 대기</div></div>
          <div><div className="text-2xl font-bold tabular-nums text-slate-900">₩{Math.round(data.funnel.valueKrw).toLocaleString()}</div><div className="text-xs text-slate-500">예약 금액</div></div>
        </div>
      </div>

      {/* Q&A pipeline + RAG index */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-design-md border border-admin-border bg-admin-surface p-4 shadow-admin-card">
          <h2 className="text-sm font-semibold text-slate-900">Q&A 학습 파이프라인</h2>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div><div className="text-xl font-bold tabular-nums text-amber-600">{data.qa.draft ?? 0}</div><div className="text-xs text-slate-500">검토 대기</div></div>
            <div><div className="text-xl font-bold tabular-nums text-emerald-600">{data.qa.approved ?? 0}</div><div className="text-xs text-slate-500">승인됨</div></div>
            <div><div className="text-xl font-bold tabular-nums text-sky-600">{data.qa.active ?? 0}</div><div className="text-xs text-slate-500">RAG 활성</div></div>
          </div>
          <a href="/admin/qa-review" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
            검토하러 가기 <ArrowRight className="size-3" />
          </a>
        </div>
        <div className="rounded-design-md border border-admin-border bg-admin-surface p-4 shadow-admin-card">
          <h2 className="text-sm font-semibold text-slate-900">RAG 인덱스 ({data.rag.total.toLocaleString()} 청크)</h2>
          <div className="mt-3 space-y-1 text-sm">
            {Object.entries(data.rag.bySource).sort((a, b) => b[1] - a[1]).map(([src, n]) => (
              <div key={src} className="flex justify-between text-slate-600"><span>{src}</span><span className="font-medium tabular-nums">{n.toLocaleString()}</span></div>
            ))}
          </div>
          <div className="mt-2 text-xs text-slate-400">마지막 갱신: {data.rag.lastRefresh ? new Date(data.rag.lastRefresh).toLocaleString() : "—"}</div>
        </div>
      </div>

      {/* Category distribution */}
      <div className="rounded-design-md border border-admin-border bg-admin-surface p-4 shadow-admin-card">
        <h2 className="text-sm font-semibold text-slate-900">질문 카테고리 분포</h2>
        <div className="mt-3 space-y-1.5">
          {catEntries.length === 0 && <div className="text-xs text-slate-400">분류된 메시지 없음 (CHAT_AUDIT_LOG 필요)</div>}
          {catEntries.map(([cat, n]) => (
            <div key={cat} className="flex items-center gap-2 text-xs">
              <span className="w-28 shrink-0 truncate text-slate-600">{cat}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-sky-400" style={{ width: `${(n / catMax) * 100}%` }} />
              </div>
              <span className="w-8 text-right font-medium tabular-nums text-slate-500">{n}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Coverage gaps */}
      <div className="grid gap-4 lg:grid-cols-2">
        <GapList
          title="도움 안 됨"
          titleIcon={<ThumbsDown className="size-4 text-rose-500" />}
          empty="부정 피드백 없음"
          rows={data.gaps.negativeFeedback.map((g) => ({
            key: `nf:${g.created_at}`,
            question: g.question ?? "(질문 없음)",
            answer: g.answer ?? "",
            tourSlug: g.tour_slug,
            locale: g.locale,
            meta: g.tour_slug ?? "사이트",
          }))}
          busy={busy}
          created={created}
          onCreate={createDraft}
        />
        <GapList
          title="에스컬레이션된 질문"
          empty="에스컬레이션 없음"
          rows={data.gaps.escalatedQuestions.map((g) => ({
            key: `eq:${g.created_at}`,
            question: g.content,
            answer: "",
            tourSlug: g.tour_slug,
            locale: g.user_locale,
            meta: g.escalation_reason ?? "—",
          }))}
          busy={busy}
          created={created}
          onCreate={createDraft}
        />
      </div>
    </div>
  );
}

function GapList({
  title,
  titleIcon,
  empty,
  rows,
  busy,
  created,
  onCreate,
}: {
  title: string;
  titleIcon?: React.ReactNode;
  empty: string;
  rows: Array<{ key: string; question: string; answer: string; tourSlug: string | null; locale: string | null; meta: string }>;
  busy: string | null;
  created: Set<string>;
  onCreate: (key: string, q: string, a: string, slug: string | null, locale: string | null) => void;
}) {
  return (
    <div className="rounded-design-md border border-admin-border bg-admin-surface p-4 shadow-admin-card">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">{titleIcon}{title}</h2>
      <div className="mt-3 space-y-2">
        {rows.length === 0 && <div className="text-xs text-slate-400">{empty}</div>}
        {rows.map((r) => (
          <div key={r.key} className="rounded-lg border border-admin-border bg-slate-50/60 p-2.5">
            <div className="text-[13px] text-slate-800">{r.question}</div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-wide text-slate-400">{r.meta}</span>
              {created.has(r.key) ? (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-600">
                  <Check className="size-3" /> 초안 생성됨
                </span>
              ) : (
                <button
                  disabled={busy === r.key}
                  onClick={() => onCreate(r.key, r.question, r.answer, r.tourSlug, r.locale)}
                  className="min-h-9 flex-shrink-0 rounded-full bg-slate-900 px-2.5 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {busy === r.key ? "…" : "Q&A 초안 만들기"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
