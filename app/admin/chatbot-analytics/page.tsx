"use client";

/**
 * 챗봇 분석 대시보드 — RAG/학습 루프 상태 한눈에.
 *   볼륨 · 에스컬레이션율 · 피드백 도움률 · 의도분포 · Q&A 파이프라인 · RAG 인덱스
 *   + 커버리지 갭(👎/에스컬레이션 질문)에서 원클릭 Q&A 초안 생성.
 *
 * Auth: app/admin/layout.tsx 가 세운 Supabase admin 세션 사용.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Analytics = {
  window_days: number;
  volume: { sessions: number; messages: number; userMessages: number; escalatedMessages: number; tickets: number };
  escalationRate: number;
  feedback: { positive: number; negative: number; total: number; helpfulRate: number | null };
  qa: Record<string, number>;
  rag: { bySource: Record<string, number>; total: number; lastRefresh: string | null };
  categories: Record<string, number>;
  gaps: {
    negativeFeedback: Array<{ question: string | null; answer: string | null; locale: string | null; tour_slug: string | null; created_at: string }>;
    escalatedQuestions: Array<{ content: string; escalation_reason: string | null; user_locale: string | null; tour_slug: string | null; created_at: string }>;
  };
};

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const { data: { session } } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  if (!session) throw new Error("not_authenticated");
  return fetch(path, {
    ...init,
    credentials: "include",
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
  });
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function pct(n: number | null): string {
  return n === null ? "—" : `${Math.round(n * 100)}%`;
}

export default function ChatbotAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [created, setCreated] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await authedFetch("/api/admin/chatbot-analytics?days=30");
      if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
      setData((await r.json()) as Analytics);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

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
      } catch (e) {
        alert(`초안 생성 실패: ${(e as Error).message}`);
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  if (loading) return <div className="p-6 text-sm text-slate-500">불러오는 중…</div>;
  if (error) return <div className="p-6 text-sm text-rose-600">오류: {error}</div>;
  if (!data) return null;

  const catEntries = Object.entries(data.categories).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const catMax = Math.max(1, ...catEntries.map(([, n]) => n));

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">챗봇 분석</h1>
          <p className="text-sm text-slate-500">최근 {data.window_days}일 · RAG·학습 루프 상태</p>
        </div>
        <button onClick={() => void load()} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
          새로고침
        </button>
      </div>

      {/* Volume + rates */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="세션" value={data.volume.sessions.toLocaleString()} />
        <Stat label="사용자 질문" value={data.volume.userMessages.toLocaleString()} sub={`총 메시지 ${data.volume.messages.toLocaleString()}`} />
        <Stat label="에스컬레이션율" value={pct(data.escalationRate)} sub={`티켓 ${data.volume.tickets} · 에스컬 ${data.volume.escalatedMessages}`} />
        <Stat label="답변 도움률" value={pct(data.feedback.helpfulRate)} sub={`👍 ${data.feedback.positive} / 👎 ${data.feedback.negative}`} />
      </div>

      {/* Q&A pipeline + RAG index */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Q&A 학습 파이프라인</h2>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div><div className="text-xl font-bold text-amber-600">{data.qa.draft ?? 0}</div><div className="text-xs text-slate-500">검토 대기</div></div>
            <div><div className="text-xl font-bold text-emerald-600">{data.qa.approved ?? 0}</div><div className="text-xs text-slate-500">승인됨</div></div>
            <div><div className="text-xl font-bold text-sky-600">{data.qa.active ?? 0}</div><div className="text-xs text-slate-500">RAG 활성</div></div>
          </div>
          <a href="/admin/qa-review" className="mt-3 inline-block text-xs font-medium text-sky-600 hover:underline">검토하러 가기 →</a>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">RAG 인덱스 ({data.rag.total.toLocaleString()} 청크)</h2>
          <div className="mt-3 space-y-1 text-sm">
            {Object.entries(data.rag.bySource).sort((a, b) => b[1] - a[1]).map(([src, n]) => (
              <div key={src} className="flex justify-between text-slate-600"><span>{src}</span><span className="font-medium">{n.toLocaleString()}</span></div>
            ))}
          </div>
          <div className="mt-2 text-xs text-slate-400">마지막 갱신: {data.rag.lastRefresh ? new Date(data.rag.lastRefresh).toLocaleString() : "—"}</div>
        </div>
      </div>

      {/* Category distribution */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">질문 카테고리 분포</h2>
        <div className="mt-3 space-y-1.5">
          {catEntries.length === 0 && <div className="text-xs text-slate-400">분류된 메시지 없음 (CHAT_AUDIT_LOG 필요)</div>}
          {catEntries.map(([cat, n]) => (
            <div key={cat} className="flex items-center gap-2 text-xs">
              <span className="w-28 shrink-0 truncate text-slate-600">{cat}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-sky-400" style={{ width: `${(n / catMax) * 100}%` }} />
              </div>
              <span className="w-8 text-right font-medium text-slate-500">{n}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Coverage gaps */}
      <div className="grid gap-4 lg:grid-cols-2">
        <GapList
          title="👎 도움 안 됨"
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
  empty,
  rows,
  busy,
  created,
  onCreate,
}: {
  title: string;
  empty: string;
  rows: Array<{ key: string; question: string; answer: string; tourSlug: string | null; locale: string | null; meta: string }>;
  busy: string | null;
  created: Set<string>;
  onCreate: (key: string, q: string, a: string, slug: string | null, locale: string | null) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-2">
        {rows.length === 0 && <div className="text-xs text-slate-400">{empty}</div>}
        {rows.map((r) => (
          <div key={r.key} className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
            <div className="text-[13px] text-slate-800">{r.question}</div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide text-slate-400">{r.meta}</span>
              {created.has(r.key) ? (
                <span className="text-[11px] font-medium text-emerald-600">초안 생성됨 ✓</span>
              ) : (
                <button
                  disabled={busy === r.key}
                  onClick={() => onCreate(r.key, r.question, r.answer, r.tourSlug, r.locale)}
                  className="rounded-full bg-sky-950 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-900 disabled:opacity-50"
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
