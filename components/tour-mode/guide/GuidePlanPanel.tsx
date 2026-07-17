'use client';

/**
 * W2 — the guide console's per-room day-plan panel (master plan §I W2.1/W2.2
 * + §G confirm screen).
 *
 * One expandable panel per room card:
 *   - guest_draft review: the wish-list stops (with the §G diff — stops not
 *     in the currently-served schedule get a 신규 badge), the A10 needs
 *     summary, W1.3 feasibility warnings → one-tap 확정 (PUT confirm:true).
 *   - confirmed/live editing (W2.2 MUTATE): reorder / add / remove / skip
 *     with a reason code / time+stay edits → 저장 fans the plan_updated
 *     capsule to guests and the driver console follows the resolver chain.
 *   - W2.1 manual arrival (§O-8): per-stop [도착] fires the same
 *     manual-arrival route the driver console uses (content card fan-out).
 *   - skip suggestions (W2.2): same-category match_pois within ~20km of a
 *     skipped stop, nearest first — one tap swaps it in.
 *
 * Korean-only (guides operate in Korean); guest-facing capsules stay
 * template-translated server-side. Auth = the guide tour-date token as the
 * `?rt=` query param on every call (same pattern as the overview poll).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DayPlanStop } from '@/lib/tour-room/dayPlan';
import {
  markNewStops,
  swapSuggestions,
  type SuggestionPoi,
} from '@/lib/tour-room/planReview';
import { formatMinutes } from '@/lib/itinerary-builder/distance';

interface FeasibilityWarning {
  code: 'overrun' | 'closed' | 'out_of_region';
  stop_id?: string;
  title?: string;
  detail: Record<string, string | number>;
}

interface PlanGetResponse {
  source: string;
  schedule: Array<Record<string, unknown>>;
  day_plan: {
    status?: string;
    version?: number;
    stops?: DayPlanStop[];
    needs?: Record<string, unknown> | null;
    feasibility?: { warnings?: FeasibilityWarning[]; total_min?: number; budget_min?: number | null } | null;
  } | null;
  tour: { date: string | null; region: string | null; total_hours: number | null; guide_curated: boolean };
}

const SKIP_REASON_LABELS: Record<string, string> = {
  closed: '휴무',
  weather: '날씨',
  crowd: '혼잡',
  guest_request: '손님 요청',
  time: '시간 부족',
};

const DURATIONS = [30, 45, 60, 90, 120, 180];

function stopTitle(stop: DayPlanStop): string {
  const names = stop.name_i18n;
  if (names && typeof names === 'object') {
    const en = (names as Record<string, string>).en;
    if (en?.trim()) return en.trim();
    const first = Object.values(names).find((v) => typeof v === 'string' && v.trim());
    if (first) return String(first).trim();
  }
  return typeof stop.poi_key === 'string'
    ? stop.poi_key.split(/[_\s]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : '';
}

function needsSummary(needs: Record<string, unknown> | null | undefined): string[] {
  if (!needs || typeof needs !== 'object') return [];
  const out: string[] = [];
  const n = needs as Record<string, unknown>;
  const party: string[] = [];
  if (typeof n.adults === 'number') party.push(`성인 ${n.adults}`);
  if (typeof n.children === 'number' && n.children > 0) {
    const ages = Array.isArray(n.child_ages) && n.child_ages.length > 0 ? ` (${(n.child_ages as number[]).join('·')}세)` : '';
    party.push(`아동 ${n.children}${ages}`);
  }
  if (party.length) out.push(party.join(' · '));
  if (n.stroller === true) out.push('유모차');
  if (n.wheelchair === true) out.push('휠체어');
  if (n.luggage === true) out.push('대형 짐');
  if (Array.isArray(n.dietary) && n.dietary.length > 0) out.push(`식이: ${(n.dietary as string[]).join(', ')}`);
  if (typeof n.allergy_note === 'string' && n.allergy_note.trim()) out.push(`⚠ 알레르기: ${n.allergy_note}`);
  if (n.pace === 'relaxed') out.push('페이스: 여유롭게');
  if (n.pace === 'packed') out.push('페이스: 알차게');
  if (typeof n.note === 'string' && n.note.trim()) out.push(`메모: ${n.note}`);
  return out;
}

function warningText(w: FeasibilityWarning): string {
  if (w.code === 'overrun') {
    const over = Number(w.detail.over_min) || 0;
    return `예약 시간보다 약 ${formatMinutes(over)} 초과 — 일부 스톱 조정 권장`;
  }
  if (w.code === 'closed') return `${w.title ?? '해당 스톱'} — 투어일 휴무로 보임`;
  return `${w.title ?? '해당 스톱'} — 서비스 권역 밖 (확인 필요)`;
}

export default function GuidePlanPanel({
  bookingId,
  token,
  onChanged,
}: {
  bookingId: string;
  token: string;
  onChanged?: () => void;
}) {
  const [data, setData] = useState<PlanGetResponse | null>(null);
  const [stops, setStops] = useState<DayPlanStop[]>([]);
  const [warnings, setWarnings] = useState<FeasibilityWarning[]>([]);
  const [pois, setPois] = useState<SuggestionPoi[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addText, setAddText] = useState('');
  const [arrivedIds, setArrivedIds] = useState<Set<string>>(() => new Set());

  const api = useCallback(
    (path: string, init?: RequestInit) =>
      fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}${path}${path.includes('?') ? '&' : '?'}rt=${encodeURIComponent(token)}`, {
        cache: 'no-store',
        ...init,
        headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...(init?.headers ?? {}) },
      }),
    [bookingId, token],
  );

  // load plan + region pois (suggestions) once
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api('/plan');
        if (!res.ok) throw new Error('plan_load_failed');
        const body = (await res.json()) as PlanGetResponse;
        if (cancelled) return;
        setData(body);
        setStops((body.day_plan?.stops as DayPlanStop[]) ?? []);
        setWarnings(body.day_plan?.feasibility?.warnings ?? []);
        if (body.tour.region) {
          void fetch(`/api/itinerary-builder/pois?region=${body.tour.region}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((poisBody: { pois?: SuggestionPoi[] } | null) => {
              if (!cancelled && poisBody?.pois) setPois(poisBody.pois);
            })
            .catch(() => undefined);
        }
      } catch {
        if (!cancelled) setError('일정을 불러오지 못했어요.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const planStatus = data?.day_plan?.status ?? null;
  const hasDraft = planStatus === 'guest_draft';
  const isActive = planStatus !== null && planStatus !== 'guest_draft';

  const newStopIds = useMemo(
    () => (hasDraft && data ? markNewStops(stops, data.schedule as never) : new Set<string>()),
    [hasDraft, data, stops],
  );

  const planPoiKeys = useMemo(() => stops.map((s) => s.poi_key).filter(Boolean) as string[], [stops]);

  const mutate = (updater: (prev: DayPlanStop[]) => DayPlanStop[]) => {
    setStops(updater);
    setDirty(true);
  };

  const putPlan = useCallback(
    async (extra: Record<string, unknown>, label: string) => {
      setBusy(label);
      setError(null);
      try {
        const payload = stops.map((s) => ({
          id: s.id,
          title: stopTitle(s),
          poi_key: s.poi_key ?? undefined,
          place_id: s.place_id ?? undefined,
          stop_type: s.stop_type,
          arrival_planned: s.arrival_planned ?? undefined,
          duration_min: s.duration_min ?? undefined,
          lat: (s.lat as number | undefined) ?? undefined,
          lng: (s.lng as number | undefined) ?? undefined,
          status: s.status ?? 'pending',
          skip_reason: s.skip_reason ?? undefined,
          memo_guide: (s.memo_guide as string | undefined) ?? undefined,
          memo_guest: (s.memo_guest as string | undefined) ?? undefined,
        }));
        const res = await api('/plan', {
          method: 'PUT',
          body: JSON.stringify({ stops: payload, ...extra }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          day_plan?: PlanGetResponse['day_plan'];
          feasibility?: { warnings?: FeasibilityWarning[] };
          error?: string;
        };
        if (!res.ok) throw new Error(body.error || 'save_failed');
        setData((prev) => (prev ? { ...prev, day_plan: body.day_plan ?? prev.day_plan } : prev));
        if (body.day_plan?.stops) setStops(body.day_plan.stops as DayPlanStop[]);
        if (body.feasibility?.warnings) setWarnings(body.feasibility.warnings);
        setDirty(false);
        onChanged?.();
        return true;
      } catch (e) {
        setError(e instanceof Error && e.message !== 'save_failed' ? `저장 실패: ${e.message}` : '저장에 실패했어요.');
        return false;
      } finally {
        setBusy(null);
      }
    },
    [api, stops, onChanged],
  );

  const announceArrival = async (stop: DayPlanStop) => {
    const id = typeof stop.id === 'string' ? stop.id : `seq:${stop.seq}`;
    setBusy(`arrive:${id}`);
    setError(null);
    try {
      const res = await api('/manual-arrival', {
        method: 'POST',
        body: JSON.stringify({ poiKey: stop.poi_key ?? undefined, title: stopTitle(stop) }),
      });
      if (!res.ok) throw new Error('arrival_failed');
      setArrivedIds((prev) => new Set(prev).add(id));
      // §C-3: reflect the actual on the stop row too (saved on next 저장).
      mutate((prev) => prev.map((s) => (s.id === stop.id ? { ...s, status: 'arrived' } : s)));
    } catch {
      setError('도착 안내 전송에 실패했어요.');
    } finally {
      setBusy(null);
    }
  };

  if (error && !data) {
    return <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p>;
  }
  if (!data) {
    return <p className="mt-2 px-1 text-[12px] text-gray-400">일정 불러오는 중…</p>;
  }

  const needs = needsSummary(data.day_plan?.needs);

  return (
    <div className="mt-2 rounded-2xl border border-gray-200 bg-white p-3" data-testid="guide-plan-panel">
      {/* status row */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
            hasDraft
              ? 'bg-amber-100 text-amber-800'
              : isActive
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-gray-100 text-gray-500'
          }`}
        >
          {hasDraft
            ? `손님 희망 일정 v${data.day_plan?.version ?? 1} — 검토 필요`
            : isActive
              ? `확정된 일정 v${data.day_plan?.version ?? 1}`
              : '개별 일정 없음 (기본 코스 운행)'}
        </span>
        {planStatus === null && (
          <span className="text-[11px] text-gray-400">스톱을 추가해 개별 일정을 만들 수 있어요</span>
        )}
      </div>

      {/* needs (A10) */}
      {needs.length > 0 && (
        <div className="mt-2 rounded-xl bg-gray-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-gray-500">손님 정보</p>
          {needs.map((line, i) => (
            <p key={i} className={`text-[12px] leading-relaxed ${line.startsWith('⚠') ? 'font-semibold text-red-600' : 'text-gray-700'}`}>
              {line}
            </p>
          ))}
        </div>
      )}

      {/* warnings (W1.3) */}
      {warnings.length > 0 && (
        <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2">
          {warnings.map((w, i) => (
            <p key={i} className="text-[12px] leading-relaxed text-amber-800">⚠ {warningText(w)}</p>
          ))}
        </div>
      )}

      {/* stops */}
      <ol className="mt-2 space-y-1.5">
        {stops.map((stop, index) => {
          const id = typeof stop.id === 'string' ? stop.id : `seq:${stop.seq}`;
          const skipped = stop.status === 'skipped';
          const suggestions = skipped
            ? swapSuggestions({ target: stop, pois, excludePoiKeys: planPoiKeys })
            : [];
          return (
            <li key={id} className={`rounded-xl border px-2.5 py-2 ${skipped ? 'border-gray-100 bg-gray-50 opacity-80' : 'border-gray-100'}`}>
              <div className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-center text-[12px] font-bold text-gray-400">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[13px] font-semibold ${skipped ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {stopTitle(stop)}
                    {newStopIds.has(id) && (
                      <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">신규</span>
                    )}
                    {typeof stop.memo_guest === 'string' && stop.memo_guest && (
                      <span className="ml-1.5 text-[11px] font-normal text-gray-500">“{stop.memo_guest}”</span>
                    )}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <input
                      type="time"
                      value={(stop.arrival_planned as string | null) ?? ''}
                      onChange={(e) =>
                        mutate((prev) => prev.map((s) => (s.id === stop.id ? { ...s, arrival_planned: e.target.value || null } : s)))
                      }
                      className="rounded-lg border border-gray-200 px-1.5 py-1 text-[12px]"
                    />
                    <select
                      value={stop.duration_min ?? 60}
                      onChange={(e) =>
                        mutate((prev) => prev.map((s) => (s.id === stop.id ? { ...s, duration_min: Number(e.target.value) } : s)))
                      }
                      className="rounded-lg border border-gray-200 px-1.5 py-1 text-[12px]"
                    >
                      {DURATIONS.map((m) => (
                        <option key={m} value={m}>{m}분</option>
                      ))}
                    </select>
                    {skipped ? (
                      <select
                        value={(stop.skip_reason as string | null) ?? 'closed'}
                        onChange={(e) =>
                          mutate((prev) => prev.map((s) => (s.id === stop.id ? { ...s, skip_reason: e.target.value } : s)))
                        }
                        className="rounded-lg border border-gray-200 px-1.5 py-1 text-[12px] text-gray-500"
                      >
                        {Object.entries(SKIP_REASON_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    ) : (
                      isActive && (
                        <button
                          type="button"
                          disabled={busy === `arrive:${id}` || arrivedIds.has(id)}
                          onClick={() => void announceArrival(stop)}
                          className={`rounded-lg px-2 py-1 text-[12px] font-semibold ${
                            arrivedIds.has(id) || stop.status === 'arrived'
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-gray-900 text-white'
                          } disabled:opacity-50`}
                          data-testid="arrival-button"
                        >
                          {arrivedIds.has(id) || stop.status === 'arrived' ? '도착 안내됨 ✓' : '도착'}
                        </button>
                      )
                    )}
                  </div>
                  {/* swap suggestions for a skipped stop */}
                  {suggestions.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {suggestions.map(({ poi, distance_km }) => (
                        <button
                          key={poi.poi_key}
                          type="button"
                          onClick={() =>
                            mutate((prev) => {
                              const next = [...prev];
                              next.splice(index + 1, 0, {
                                id: `swap-${poi.poi_key}-${Date.now().toString(36)}`,
                                source: 'poi',
                                poi_key: poi.poi_key,
                                name_i18n: { en: poi.name_en ?? poi.poi_key, ...(poi.name_ko ? { ko: poi.name_ko } : {}) },
                                stop_type: 'sight',
                                duration_min: poi.default_stay_minutes ?? 60,
                                status: 'pending',
                                lat: poi.lat,
                                lng: poi.lng,
                              } as DayPlanStop);
                              return next;
                            })
                          }
                          className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700"
                        >
                          ↺ {poi.name_ko ?? poi.name_en} ({distance_km.toFixed(1)}km)
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* reorder / skip / remove */}
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label="위로"
                    disabled={index === 0}
                    onClick={() =>
                      mutate((prev) => {
                        const next = [...prev];
                        [next[index - 1], next[index]] = [next[index], next[index - 1]];
                        return next;
                      })
                    }
                    className="h-7 w-7 rounded-lg bg-gray-100 text-[12px] font-bold text-gray-600 disabled:opacity-30"
                  >↑</button>
                  <button
                    type="button"
                    aria-label="아래로"
                    disabled={index === stops.length - 1}
                    onClick={() =>
                      mutate((prev) => {
                        const next = [...prev];
                        [next[index], next[index + 1]] = [next[index + 1], next[index]];
                        return next;
                      })
                    }
                    className="h-7 w-7 rounded-lg bg-gray-100 text-[12px] font-bold text-gray-600 disabled:opacity-30"
                  >↓</button>
                  {isActive ? (
                    <button
                      type="button"
                      onClick={() =>
                        mutate((prev) =>
                          prev.map((s) =>
                            s.id === stop.id
                              ? skipped
                                ? { ...s, status: 'pending', skip_reason: null }
                                : { ...s, status: 'skipped', skip_reason: s.skip_reason ?? 'closed' }
                              : s,
                          ),
                        )
                      }
                      className={`h-7 rounded-lg px-2 text-[12px] font-semibold ${skipped ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}
                      data-testid="skip-toggle"
                    >
                      {skipped ? '복원' : '스킵'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label="삭제"
                      onClick={() => mutate((prev) => prev.filter((s) => s.id !== stop.id))}
                      className="h-7 w-7 rounded-lg bg-gray-100 text-[12px] font-bold text-red-500"
                    >✕</button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* add stop */}
      <form
        className="mt-2 flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const text = addText.trim();
          if (!text) return;
          // curated name → poi stop (with coords); anything else → free stop
          const poi = pois.find((p) => p.name_ko === text || p.name_en?.toLowerCase() === text.toLowerCase());
          mutate((prev) => [
            ...prev,
            poi
              ? ({
                  id: `add-${poi.poi_key}-${Date.now().toString(36)}`,
                  source: 'poi',
                  poi_key: poi.poi_key,
                  name_i18n: { en: poi.name_en ?? poi.poi_key, ...(poi.name_ko ? { ko: poi.name_ko } : {}) },
                  stop_type: 'sight',
                  duration_min: poi.default_stay_minutes ?? 60,
                  status: 'pending',
                  lat: poi.lat,
                  lng: poi.lng,
                } as DayPlanStop)
              : ({
                  id: `add-${Date.now().toString(36)}`,
                  source: 'free',
                  name_i18n: { en: text },
                  stop_type: 'sight',
                  duration_min: 60,
                  status: 'pending',
                } as DayPlanStop),
          ]);
          setAddText('');
        }}
      >
        <input
          value={addText}
          onChange={(e) => setAddText(e.target.value)}
          list={`plan-pois-${bookingId}`}
          maxLength={120}
          placeholder="스톱 추가 (장소명)"
          className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-[13px]"
        />
        <datalist id={`plan-pois-${bookingId}`}>
          {pois.slice(0, 100).map((poi) => (
            <option key={poi.poi_key} value={poi.name_ko ?? poi.name_en ?? poi.poi_key} />
          ))}
        </datalist>
        <button
          type="submit"
          disabled={!addText.trim()}
          className="shrink-0 rounded-xl bg-gray-100 px-3 py-2 text-[13px] font-semibold text-gray-700 disabled:opacity-40"
        >
          추가
        </button>
      </form>

      {error && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p>}

      {/* actions */}
      <div className="mt-2.5 flex gap-2">
        {isActive ? (
          <button
            type="button"
            disabled={!dirty || busy !== null || stops.length === 0}
            onClick={() => void putPlan({}, 'save')}
            className="flex-1 rounded-xl bg-gray-900 py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
            data-testid="plan-save"
          >
            {busy === 'save' ? '저장 중…' : '저장 (손님에게 변경 안내)'}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy !== null || stops.length === 0}
            onClick={() => void putPlan({ confirm: true }, 'confirm')}
            className="flex-1 rounded-xl bg-[var(--tr-accent)] py-2.5 text-[13px] font-bold text-[var(--tr-bubble-me-ink)] disabled:opacity-40"
            data-testid="plan-confirm"
          >
            {busy === 'confirm' ? '확정 중…' : '일정 확정 (손님에게 발송)'}
          </button>
        )}
      </div>
    </div>
  );
}
