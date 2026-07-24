'use client';

/**
 * 가이드 관리 (§6.9 / §11.F) — 프로필 · 단가 · 휴무 달력 · 배정.
 *
 * 왼쪽 목록에서 사람을 고르고 오른쪽에서 4개 탭을 편집하는 구조. 모바일에서는
 * 목록 → 상세로 전환된다(관제 현장에서 폰으로 여는 화면이라 44px 터치 타깃을
 * 지킨다).
 *
 * 배정 탭이 월 정산의 입력이다: tour_rooms에는 guide_id가 없어서 "이 가이드가
 * 이 달에 무엇을 했는가"가 어디에도 없었고, 그 원장을 여기서 만든다. 실제 정산과
 * 세무 서식은 /admin/guide-settlements.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calculator,
  CalendarDays,
  ClipboardList,
  Coins,
  Copy,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
} from 'lucide-react';
import { getAdminAccessToken } from '@/app/admin/match-pois/_hooks/usePoiRow';
import GuideRestCalendar, { type RestDay } from '@/components/ops/GuideRestCalendar';
import { kstToday } from '@/lib/ops/guides/availability';
import GuideProfileForm, { emptyForm, formFromRow, type GuideFormValue } from './_components/GuideProfileForm';
import GuideRatesPanel from './_components/GuideRatesPanel';
import GuideAssignmentsPanel from './_components/GuideAssignmentsPanel';
import type { AssignmentListRow, GuideListRow, RateRow, ResolvedRateRow } from './_types';

type Tab = 'profile' | 'rates' | 'calendar' | 'assignments';

const TABS: Array<{ key: Tab; label: string; icon: typeof User }> = [
  { key: 'profile', label: '프로필', icon: User },
  { key: 'rates', label: '단가', icon: Coins },
  { key: 'calendar', label: '휴무', icon: CalendarDays },
  { key: 'assignments', label: '배정', icon: ClipboardList },
];

async function authedFetch(url: string, init: RequestInit = {}) {
  const token = await getAdminAccessToken();
  return fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    credentials: 'include',
    cache: 'no-store',
  });
}

function typeLabel(t: string | null): string {
  return t === 'driver' ? '기사' : t === 'bus_guide' ? '안내' : t === 'both' ? '겸업' : '미지정';
}

export default function AdminGuidesPage() {
  const today = useMemo(() => kstToday(), []);
  const [ty, tm] = useMemo(() => today.split('-').map(Number), [today]);

  const [guides, setGuides] = useState<GuideListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [piiKeyConfigured, setPiiKeyConfigured] = useState(true);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<Tab>('profile');
  const [form, setForm] = useState<GuideFormValue>(emptyForm());

  const [rates, setRates] = useState<RateRow[]>([]);
  const [resolvedRates, setResolvedRates] = useState<ResolvedRateRow[]>([]);
  const [restDays, setRestDays] = useState<RestDay[]>([]);
  const [calYear, setCalYear] = useState(ty);
  const [calMonth, setCalMonth] = useState(tm);
  const [busyDate, setBusyDate] = useState<string | null>(null);

  // 배정 탭 — 월 정산의 입력 원장.
  const [assignments, setAssignments] = useState<AssignmentListRow[]>([]);
  const [assignMonth, setAssignMonth] = useState(today.slice(0, 7));
  const [busyAssignmentId, setBusyAssignmentId] = useState<string | null>(null);

  // PII 원문 열람 (목적 입력 → 열람, 호출마다 감사로그 1행).
  const [revealField, setRevealField] = useState<'rrn' | 'bank_account' | null>(null);
  const [revealPurpose, setRevealPurpose] = useState('');
  const [revealedValue, setRevealedValue] = useState<string | null>(null);

  const selected = useMemo(
    () => guides.find((g) => g.id === selectedId) ?? null,
    [guides, selectedId],
  );

  const loadGuides = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/guides?active=${showInactive ? 'all' : 'true'}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `목록 로드 실패 (${res.status})`);
      setGuides(json.data as GuideListRow[]);
      setPiiKeyConfigured(Boolean(json.piiKeyConfigured));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    void loadGuides();
  }, [loadGuides]);

  const loadRates = useCallback(async (guideId: string) => {
    try {
      const res = await authedFetch(`/api/admin/guides/${guideId}/rates`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || '단가 로드 실패');
      setRates(json.data as RateRow[]);
      setResolvedRates(json.resolved as ResolvedRateRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const loadRestDays = useCallback(async (guideId: string, year: number, month: number) => {
    try {
      const res = await authedFetch(`/api/admin/guides/${guideId}/unavailable?year=${year}&month=${month}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || '휴무 로드 실패');
      setRestDays(json.data as RestDay[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const loadAssignments = useCallback(async (guideId: string, month: string) => {
    try {
      const res = await authedFetch(
        `/api/admin/guides/assignments?guideId=${encodeURIComponent(guideId)}&period=${encodeURIComponent(month)}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || '배정 로드 실패');
      setAssignments(json.data as AssignmentListRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const addAssignment = async (
    input: { tourDate: string; tourType: string; role: string; amountKrw: number | null; note: string },
  ) => {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authedFetch('/api/admin/guides/assignments', {
        method: 'POST',
        body: JSON.stringify({ guideId: selectedId, ...input }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || '배정 추가 실패');
      setNotice('배정을 추가했습니다. 수행 후 [일했음]을 눌러야 정산에 집계됩니다.');
      await loadAssignments(selectedId, assignMonth);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const patchAssignment = async (id: string, patch: Record<string, unknown>) => {
    if (!selectedId) return;
    setBusyAssignmentId(id);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/guides/assignments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || '배정 수정 실패');
      await loadAssignments(selectedId, assignMonth);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyAssignmentId(null);
    }
  };

  const deleteAssignment = async (id: string) => {
    if (!selectedId) return;
    setBusyAssignmentId(id);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/guides/assignments/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || '배정 삭제 실패');
      await loadAssignments(selectedId, assignMonth);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyAssignmentId(null);
    }
  };

  const selectGuide = (row: GuideListRow) => {
    setCreating(false);
    closeReveal();
    setSelectedId(row.id);
    setForm(formFromRow(row));
    setTab('profile');
    setRates([]);
    setResolvedRates([]);
    setRestDays([]);
    setAssignments([]);
    setCalYear(ty);
    setCalMonth(tm);
    void loadRates(row.id);
    void loadRestDays(row.id, ty, tm);
  };

  const startCreate = () => {
    setCreating(true);
    setSelectedId(null);
    setForm(emptyForm());
    setTab('profile');
  };

  const saveProfile = async () => {
    if (!form.name.trim()) {
      setError('이름을 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const payload: Record<string, unknown> = {
      name: form.name,
      phone: form.phone,
      email: form.email,
      languages: form.languages,
      guideType: form.guideType,
      bankName: form.bankName,
      bankHolder: form.bankHolder,
      certified: form.certified,
      active: form.active,
      note: form.note,
    };
    // 민감 필드는 이번에 입력했을 때만 전송한다 — 빈 칸은 "안 건드림"이지 "삭제"가 아니다.
    if (form.residentNumber.trim()) payload.residentNumber = form.residentNumber.trim();
    if (form.bankAccount.trim()) payload.bankAccount = form.bankAccount.trim();

    try {
      const res = await authedFetch(creating ? '/api/admin/guides' : `/api/admin/guides/${selectedId}`, {
        method: creating ? 'POST' : 'PATCH',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `저장 실패 (${res.status})`);
      const row = json.data as GuideListRow;
      setNotice('저장했습니다.');
      setCreating(false);
      setSelectedId(row.id);
      setForm(formFromRow(row));
      await loadGuides();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleRestDay = async (date: string, isRest: boolean) => {
    if (!selectedId) return;
    setBusyDate(date);
    setError(null);
    try {
      const res = await authedFetch(
        isRest
          ? `/api/admin/guides/${selectedId}/unavailable?date=${date}`
          : `/api/admin/guides/${selectedId}/unavailable`,
        isRest ? { method: 'DELETE' } : { method: 'POST', body: JSON.stringify({ date }) },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || '휴무 변경 실패');
      await loadRestDays(selectedId, calYear, calMonth);
      await loadGuides();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyDate(null);
    }
  };

  const addRate = async (input: {
    tourType: string;
    amountKrw: number;
    effectiveFrom: string;
    note: string;
  }) => {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/guides/${selectedId}/rates`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || '단가 저장 실패');
      setNotice('단가를 저장했습니다.');
      await loadRates(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const mintScheduleLink = async () => {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/guides/${selectedId}/schedule-link`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || '링크 발급 실패');
      let copied = false;
      try {
        await navigator.clipboard.writeText(json.url as string);
        copied = true;
      } catch {
        copied = false;
      }
      setNotice(
        copied
          ? `셀프 스케줄 링크를 복사했습니다 (만료 ${String(json.expiresAt).slice(0, 10)}). 카톡·문자로 전달하세요.`
          : `링크: ${json.url}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  /**
   * 원문 열람은 2단계다: [원문 보기] → 목적 입력 → 열람. 목적이 서버에서 필수라
   * 화면도 그 순서를 그대로 보여준다(네이티브 prompt는 iOS WebView에서 신뢰할 수
   * 없고, 감사 기록의 입력을 그런 창에 맡길 수는 없다).
   */
  const submitReveal = async () => {
    if (!selectedId || !revealField) return;
    const purpose = revealPurpose.trim();
    if (purpose.length < 2) {
      setError('열람 목적을 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/guides/${selectedId}/reveal`, {
        method: 'POST',
        body: JSON.stringify({ field: revealField, purpose }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || '열람 실패');
      setRevealedValue(json.value as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const closeReveal = () => {
    setRevealField(null);
    setRevealPurpose('');
    setRevealedValue(null);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return guides;
    return guides.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.phone ?? '').includes(q) ||
        (g.languages ?? []).some((l) => l.includes(q)),
    );
  }, [guides, search]);

  const detailOpen = creating || Boolean(selectedId);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-[20px] font-bold text-slate-900">가이드 관리</h1>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
          {guides.length}명
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => void loadGuides()}
          className="flex h-11 items-center gap-1.5 rounded-xl bg-slate-100 px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-200"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> 새로고침
        </button>
        <button
          type="button"
          onClick={startCreate}
          className="flex h-11 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-[13px] font-bold text-white"
        >
          <Plus className="size-4" /> 가이드 추가
        </button>
      </header>

      {!piiKeyConfigured && (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-800">
          암호화 키가 설정되지 않아 주민번호·계좌 저장이 잠겨 있습니다. 나머지 정보(이름·언어·단가·휴무)는
          정상 저장됩니다.
        </p>
      )}
      {error && (
        <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-700">{error}</p>
      )}
      {notice && (
        <p className="mb-3 flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[13px] font-medium text-emerald-800">
          <span className="min-w-0 flex-1 break-all">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 text-emerald-600">
            닫기
          </button>
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* ── 목록 ─────────────────────────────────────────────────────── */}
        <aside className={`${detailOpen ? 'hidden lg:block' : ''}`}>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[14px] text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름 · 연락처 · 언어"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            className={`mb-2 h-11 w-full rounded-xl px-3 text-[13px] font-semibold ${
              showInactive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {showInactive ? '비활성 포함해서 보는 중' : '활성만 보는 중'}
          </button>

          {loading && guides.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-slate-500">불러오는 중…</p>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-slate-500">등록된 가이드가 없습니다.</p>
          ) : (
            <ul className="space-y-1.5">
              {filtered.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => selectGuide(g)}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      selectedId === g.id
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <p className="flex items-center gap-1.5 text-[14px] font-bold">
                      <span className="truncate">{g.name}</span>
                      {g.certified && (
                        <ShieldCheck
                          className={`size-3.5 shrink-0 ${selectedId === g.id ? 'text-emerald-300' : 'text-emerald-600'}`}
                        />
                      )}
                      {!g.active && (
                        <span className="shrink-0 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                          비활성
                        </span>
                      )}
                    </p>
                    <p
                      className={`mt-0.5 truncate text-[12px] ${
                        selectedId === g.id ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {typeLabel(g.guide_type)}
                      {(g.languages ?? []).length > 0 && ` · ${(g.languages ?? []).join('/').toUpperCase()}`}
                      {(g.unavailable_this_month ?? 0) > 0 && ` · 이번달 휴무 ${g.unavailable_this_month}일`}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* ── 상세 ─────────────────────────────────────────────────────── */}
        <section className={`${detailOpen ? '' : 'hidden lg:block'}`}>
          {!detailOpen ? (
            <p className="rounded-2xl border border-dashed border-slate-200 py-20 text-center text-[13px] text-slate-400">
              왼쪽에서 가이드를 선택하세요.
            </p>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2 lg:hidden">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(null);
                    setCreating(false);
                  }}
                  className="flex h-11 items-center gap-1 rounded-xl bg-slate-100 px-3 text-[13px] font-semibold text-slate-700"
                >
                  <ArrowLeft className="size-4" /> 목록
                </button>
                <p className="truncate text-[15px] font-bold text-slate-900">
                  {creating ? '새 가이드' : (selected?.name ?? '')}
                </p>
              </div>

              {!creating && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {TABS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => {
                        setTab(t.key);
                        if (t.key === 'calendar' && selectedId) void loadRestDays(selectedId, calYear, calMonth);
                        if (t.key === 'rates' && selectedId) void loadRates(selectedId);
                        if (t.key === 'assignments' && selectedId) void loadAssignments(selectedId, assignMonth);
                      }}
                      className={`flex h-11 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold transition ${
                        tab === t.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <t.icon className="size-4" /> {t.label}
                    </button>
                  ))}
                </div>
              )}

              {(creating || tab === 'profile') && (
                <>
                  <GuideProfileForm
                    key={creating ? 'new' : selectedId}
                    value={form}
                    onChange={setForm}
                    piiKeyConfigured={piiKeyConfigured}
                    rrnMasked={creating ? null : selected?.rrn_masked}
                    bankAccountMasked={creating ? null : selected?.bank_account_masked}
                    onReveal={
                      creating
                        ? undefined
                        : (field) => {
                            setRevealField(field);
                            setRevealPurpose('');
                            setRevealedValue(null);
                          }
                    }
                  />

                  {revealField && (
                    <div className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 p-3">
                      <p className="text-[13px] font-bold text-amber-900">
                        {revealField === 'rrn' ? '주민등록번호' : '계좌번호'} 원문 열람
                      </p>
                      <p className="mt-0.5 text-[12px] text-amber-800">
                        열람 목적을 입력하면 감사로그에 기록된 뒤 원문이 표시됩니다.
                      </p>
                      {revealedValue === null ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <input
                            className="h-11 min-w-[200px] flex-1 rounded-xl border border-amber-300 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none"
                            value={revealPurpose}
                            onChange={(e) => setRevealPurpose(e.target.value)}
                            placeholder="예: 2026-07 지급명세서 작성"
                            autoComplete="off"
                          />
                          <button
                            type="button"
                            onClick={() => void submitReveal()}
                            disabled={busy || revealPurpose.trim().length < 2}
                            className="flex h-11 items-center gap-1.5 rounded-xl bg-amber-600 px-4 text-[13px] font-bold text-white disabled:opacity-40"
                          >
                            {busy && <Loader2 className="size-4 animate-spin" />} 열람
                          </button>
                          <button
                            type="button"
                            onClick={closeReveal}
                            className="h-11 rounded-xl bg-white px-4 text-[13px] font-semibold text-amber-800"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="select-all rounded-xl bg-white px-3 py-2 font-mono text-[15px] font-bold text-slate-900">
                            {revealedValue}
                          </span>
                          <button
                            type="button"
                            onClick={closeReveal}
                            className="h-11 rounded-xl bg-white px-4 text-[13px] font-semibold text-amber-800"
                          >
                            닫기
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void saveProfile()}
                      disabled={busy}
                      className="flex h-11 items-center gap-1.5 rounded-xl bg-slate-900 px-5 text-[13px] font-bold text-white disabled:opacity-40"
                    >
                      {busy && <Loader2 className="size-4 animate-spin" />}
                      {creating ? '가이드 등록' : '저장'}
                    </button>
                    {!creating && (
                      <button
                        type="button"
                        onClick={() => void mintScheduleLink()}
                        disabled={busy}
                        className="flex h-11 items-center gap-1.5 rounded-xl bg-slate-100 px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-40"
                      >
                        <Link2 className="size-4" /> 셀프 스케줄 링크
                      </button>
                    )}
                    {creating && (
                      <button
                        type="button"
                        onClick={() => setCreating(false)}
                        className="h-11 rounded-xl bg-slate-100 px-4 text-[13px] font-semibold text-slate-600"
                      >
                        취소
                      </button>
                    )}
                  </div>
                  {!creating && (
                    <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
                      <Copy className="size-3" /> 링크는 복사만 됩니다 — 발송은 담당자가 직접 합니다.
                    </p>
                  )}
                </>
              )}

              {!creating && tab === 'rates' && (
                <GuideRatesPanel
                  rates={rates}
                  resolved={resolvedRates}
                  isDefaultScope={false}
                  busy={busy}
                  onAdd={(input) => void addRate(input)}
                />
              )}

              {!creating && tab === 'calendar' && (
                <>
                  <p className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-[12px] leading-relaxed text-slate-500">
                    휴무는 배정을 막지 않습니다 — 추천에서 빠지고 배정 화면에 경고가 뜰 뿐입니다.
                    최종 판단은 사람이 합니다.
                  </p>
                  <GuideRestCalendar
                    year={calYear}
                    month={calMonth}
                    restDays={restDays}
                    today={today}
                    busyDate={busyDate}
                    onMonthChange={({ year, month }) => {
                      setCalYear(year);
                      setCalMonth(month);
                      if (selectedId) void loadRestDays(selectedId, year, month);
                    }}
                    onToggle={(date, isRest) => void toggleRestDay(date, isRest)}
                  />
                </>
              )}

              {!creating && tab === 'assignments' && (
                <>
                  <GuideAssignmentsPanel
                    month={assignMonth}
                    rows={assignments}
                    busy={busy}
                    busyId={busyAssignmentId}
                    onMonthChange={(m) => {
                      setAssignMonth(m);
                      if (selectedId && /^\d{4}-\d{2}$/.test(m)) void loadAssignments(selectedId, m);
                    }}
                    onAdd={(input) => void addAssignment(input)}
                    onPatch={(id, patch) => void patchAssignment(id, patch)}
                    onDelete={(id) => void deleteAssignment(id)}
                  />
                  <Link
                    href="/admin/guide-settlements"
                    className="mt-4 flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Calculator className="size-4" />
                    월 정산 · 세무 서식으로
                  </Link>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
