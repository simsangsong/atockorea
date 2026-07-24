'use client';

/**
 * 차량 배치도 에디터 — AtoC 통합 플랜 §5.3b.
 *
 * 플랜이 정적 이미지를 기각한 이유의 절반은 "실차와 다른 배치를 발견하면
 * JSON 수정만으로 즉시 반영"이었다. 그런데 시드 5종만 있고 편집 UI가 없어서
 * 그 수정이 raw SQL로만 가능했다 — 이 화면이 그 구멍이다.
 *
 * 왼쪽: 표준 배치도 5종 + 실차 오버라이드 목록.
 * 오른쪽: 공용 <SeatMap> 위에 빈 칸 오버레이를 겹친 편집 캔버스 +
 *         검증 패널 + 실차 사진 대조 게이트.
 *
 * 🔴 서버 모듈 금지: 이 파일은 'use client'다. 순수 규칙(layoutEditor)만
 * 가져오고, 사진 업로드는 fetch로 라우트에 맡긴다 (layoutPhoto.ts는
 * node:crypto를 쓰므로 여기서 import하면 webpack 프로덕션 빌드가 깨진다).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Bus,
  Camera,
  Check,
  DoorOpen,
  Eraser,
  Hash,
  Loader2,
  MousePointer2,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  Shuffle,
  Trash2,
  Wrench,
} from 'lucide-react';
import { getAdminAccessToken } from '@/app/admin/match-pois/_hooks/usePoiRow';
import LayoutCanvas, { type EditorTool } from './_components/LayoutCanvas';
import {
  FIXTURE_LABELS_KO,
  MAX_COLS,
  addSeat,
  hasBlockingIssues,
  issueSeatNumbers,
  moveSeat,
  putFixture,
  removeFixtureAt,
  removeSeat,
  renumberSeats,
  setCols,
  validateVehicleLayout,
  type InUseSeatRef,
  type LayoutIssue,
} from '@/lib/ops/seating/layoutEditor';
import type { FixtureType, VehicleLayoutJson } from '@/lib/ops/seating/layouts';

interface LayoutRow {
  id: string;
  model: string;
  display_name: Record<string, string> | null;
  layout_json: VehicleLayoutJson;
  total_seats: number;
  is_verified: boolean;
  verified_at: string | null;
  reference_photo_path: string | null;
  reference_photo_url?: string | null;
  vehicle_count: number;
  override_count: number;
}

interface OverrideRow {
  room_vehicle_id: string;
  room_id: string;
  layout_id: string;
  plate_number: string | null;
  note: string | null;
  tour_date: string | null;
}

type Selection = { kind: 'model'; id: string } | { kind: 'override'; roomVehicleId: string };

async function authedFetch(url: string, init: RequestInit = {}) {
  const token = await getAdminAccessToken();
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string>) ?? {}),
    Authorization: `Bearer ${token}`,
  };
  if (!(init.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  return fetch(url, { ...init, headers, credentials: 'include', cache: 'no-store' });
}

function layoutName(row: LayoutRow | null): string {
  if (!row) return '';
  return row.display_name?.ko || row.display_name?.en || row.model;
}

const TOOLS: Array<{ key: EditorTool; label: string; icon: typeof MousePointer2 }> = [
  { key: 'select', label: '선택·이동', icon: MousePointer2 },
  { key: 'seat', label: '좌석 추가', icon: Plus },
  { key: 'driver', label: FIXTURE_LABELS_KO.driver, icon: Bus },
  { key: 'door', label: FIXTURE_LABELS_KO.door, icon: DoorOpen },
  { key: 'facility', label: FIXTURE_LABELS_KO.facility, icon: Wrench },
  { key: 'stairs', label: FIXTURE_LABELS_KO.stairs, icon: Settings2 },
  { key: 'erase', label: '지우기', icon: Eraser },
];

export default function VehicleLayoutsPage() {
  const [layouts, setLayouts] = useState<LayoutRow[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [migrationPending, setMigrationPending] = useState(false);
  const [listLoading, setListLoading] = useState(true);

  const [selection, setSelection] = useState<Selection | null>(null);
  const [detail, setDetail] = useState<LayoutRow | null>(null);
  const [overrideDetail, setOverrideDetail] = useState<{
    room_vehicle_id: string;
    room_id: string;
    plate_number: string | null;
    note: string | null;
    hasOverride: boolean;
  } | null>(null);
  const [draft, setDraft] = useState<VehicleLayoutJson | null>(null);
  const [totalSeats, setTotalSeats] = useState(0);
  const [inUse, setInUse] = useState<InUseSeatRef[]>([]);
  const [dirty, setDirty] = useState(false);

  const [tool, setTool] = useState<EditorTool>('select');
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [photoMatched, setPhotoMatched] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<LayoutIssue | null>(null);

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await authedFetch('/api/admin/vehicle-layouts');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `배치도 로드 실패 (${res.status})`);
      setLayouts(json.data as LayoutRow[]);
      setOverrides((json.overrides as OverrideRow[]) ?? []);
      setMigrationPending(Boolean(json.migration_pending));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  // /admin/vehicle-layouts?override=<roomVehicleId> — 배차 화면에서 딥링크로 들어온다.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const id = new URLSearchParams(window.location.search).get('override');
    if (id) setSelection({ kind: 'override', roomVehicleId: id });
  }, []);

  const openSelection = useCallback(async (next: Selection) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    setSelectedSeat(null);
    setPhotoMatched(false);
    setPendingConfirm(null);
    setDirty(false);
    try {
      if (next.kind === 'model') {
        const res = await authedFetch(`/api/admin/vehicle-layouts/${next.id}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || '배치도 로드 실패');
        const row = json.data as LayoutRow;
        setDetail(row);
        setOverrideDetail(null);
        setDraft(row.layout_json);
        setTotalSeats(row.total_seats);
        setInUse((json.in_use_seats as InUseSeatRef[]) ?? []);
      } else {
        const res = await authedFetch(`/api/admin/vehicle-layouts/overrides/${next.roomVehicleId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || '오버라이드 로드 실패');
        const base = json.base as LayoutRow | null;
        const data = json.data as {
          room_vehicle_id: string;
          room_id: string;
          plate_number: string | null;
          override: VehicleLayoutJson | null;
          override_note: string | null;
        };
        setDetail(base ? { ...base, is_verified: false, verified_at: null, reference_photo_path: null, vehicle_count: 0, override_count: 0 } : null);
        setOverrideDetail({
          room_vehicle_id: data.room_vehicle_id,
          room_id: data.room_id,
          plate_number: data.plate_number,
          note: data.override_note,
          hasOverride: Boolean(data.override),
        });
        const effective = data.override ?? base?.layout_json ?? null;
        setDraft(effective);
        setTotalSeats(effective ? effective.seats.length : 0);
        setInUse((json.in_use_seats as InUseSeatRef[]) ?? []);
      }
      setSelection(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (selection && !draft && !busy) void openSelection(selection);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deep-link bootstrap only
  }, [selection?.kind, selection && 'id' in selection ? selection.id : selection?.roomVehicleId]);

  const issues = useMemo(() => {
    if (!draft) return [] as LayoutIssue[];
    return validateVehicleLayout({
      layout: draft,
      totalSeats,
      model: detail?.model ?? null,
      inUse,
    });
  }, [draft, totalSeats, detail?.model, inUse]);

  const blocked = hasBlockingIssues(issues);

  const mutate = (next: VehicleLayoutJson) => {
    setDraft(next);
    setDirty(true);
    setNotice(null);
  };

  const handleSeatTap = (n: number) => {
    if (!draft) return;
    if (tool === 'erase') {
      mutate(removeSeat(draft, n));
      if (selectedSeat === n) setSelectedSeat(null);
      return;
    }
    setSelectedSeat((current) => (current === n ? null : n));
    setTool('select');
  };

  const handleCellTap = (r: number, c: number) => {
    if (!draft) return;
    if (tool === 'seat') {
      mutate(addSeat(draft, r, c));
      return;
    }
    if (tool === 'erase') {
      mutate(removeFixtureAt(draft, r, c));
      return;
    }
    if (tool === 'select') {
      if (selectedSeat != null) mutate(moveSeat(draft, selectedSeat, r, c));
      return;
    }
    const width = tool === 'door' || tool === 'stairs' ? 2 : 1;
    mutate(putFixture(draft, tool as FixtureType, r, c, width));
  };

  const save = useCallback(
    async (confirmInUse: boolean) => {
      if (!draft || !selection) return;
      setBusy(true);
      setError(null);
      try {
        const isOverride = selection.kind === 'override';
        const url = isOverride
          ? `/api/admin/vehicle-layouts/overrides/${selection.roomVehicleId}`
          : `/api/admin/vehicle-layouts/${selection.id}`;
        const res = await authedFetch(url, {
          method: isOverride ? 'PUT' : 'PATCH',
          body: JSON.stringify({
            layout_json: draft,
            total_seats: totalSeats,
            confirm_in_use: confirmInUse,
            note: overrideDetail?.note ?? null,
          }),
        });
        const json = await res.json();
        if (res.status === 409 && json?.error === 'seats_in_use') {
          const issue = (json.issues as LayoutIssue[]).find((i) => i.code === 'in_use_seat_removed');
          setPendingConfirm(issue ?? null);
          return;
        }
        if (!res.ok) throw new Error(json?.message || json?.error || '저장 실패');
        setPendingConfirm(null);
        setDirty(false);
        setNotice(
          json?.verification_reset
            ? '저장했어요. 배치가 바뀌었으니 실차 사진 대조를 다시 해주세요.'
            : '저장했어요.',
        );
        await loadList();
        await openSelection(selection);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [draft, selection, totalSeats, overrideDetail?.note, loadList, openSelection],
  );

  const uploadPhoto = async (file: File) => {
    if (!selection || selection.kind !== 'model') return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('photo', file);
      const res = await authedFetch(`/api/admin/vehicle-layouts/${selection.id}`, {
        method: 'POST',
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || json?.error || '사진 업로드 실패');
      setPhotoMatched(false);
      setNotice('사진을 올렸어요. 대조 후 확정하세요.');
      await openSelection(selection);
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const setVerified = async (verify: boolean) => {
    if (!selection || selection.kind !== 'model') return;
    setBusy(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/vehicle-layouts/${selection.id}`, {
        method: 'PATCH',
        body: JSON.stringify(
          verify ? { action: 'verify', confirm_photo_match: photoMatched } : { action: 'unverify' },
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || json?.error || '처리 실패');
      setNotice(verify ? '실차 대조 확정 완료.' : '확정을 해제했어요.');
      await openSelection(selection);
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const clearOverride = async () => {
    if (!selection || selection.kind !== 'override') return;
    if (!window.confirm('이 실차의 오버라이드를 지우고 표준 배치도로 되돌릴까요?')) return;
    setBusy(true);
    setError(null);
    try {
      let res = await authedFetch(
        `/api/admin/vehicle-layouts/overrides/${selection.roomVehicleId}`,
        { method: 'DELETE' },
      );
      let json = await res.json();
      if (res.status === 409 && json?.error === 'seats_in_use') {
        if (!window.confirm(`${json.message}\n\n그래도 되돌릴까요?`)) return;
        res = await authedFetch(
          `/api/admin/vehicle-layouts/overrides/${selection.roomVehicleId}?confirm_in_use=1`,
          { method: 'DELETE' },
        );
        json = await res.json();
      }
      if (!res.ok) throw new Error(json?.message || json?.error || '되돌리기 실패');
      setNotice('표준 배치도로 되돌렸어요.');
      await loadList();
      await openSelection(selection);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const assignedSeats = useMemo(() => inUse.map((ref) => ref.seatNumber), [inUse]);
  const checkedInSeats = useMemo(
    () => inUse.filter((ref) => ref.checkedIn).map((ref) => ref.seatNumber),
    [inUse],
  );
  const highlightSeats = useMemo(() => issueSeatNumbers(issues), [issues]);

  return (
    <div className="-m-6 flex h-[calc(100vh-3.5rem)] flex-col bg-admin-bg">
      <div className="flex items-center gap-2 border-b border-admin-border bg-admin-surface px-4 py-2">
        <Bus className="size-4 text-emerald-600" />
        <h1 className="text-sm font-semibold text-slate-900">차량 배치도</h1>
        {migrationPending && (
          <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
            마이그레이션 미적용 — 확정·오버라이드 기능 제한
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* 목록 */}
        <aside
          className={`w-full flex-col border-r border-admin-border bg-admin-surface lg:flex lg:w-72 ${
            selection ? 'hidden' : 'flex'
          }`}
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            <p className="border-b border-admin-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              표준 배치도
            </p>
            {listLoading ? (
              <p className="p-4 text-sm text-slate-500">불러오는 중…</p>
            ) : (
              layouts.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => void openSelection({ kind: 'model', id: row.id })}
                  className={`flex w-full items-center gap-2 border-b border-admin-border px-3 py-2.5 text-left hover:bg-slate-50 ${
                    selection?.kind === 'model' && selection.id === row.id ? 'bg-emerald-50' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{layoutName(row)}</p>
                    <p className="truncate text-xs text-slate-500">
                      {row.total_seats}석 · 배차 {row.vehicle_count}대
                      {row.override_count > 0 ? ` (오버라이드 ${row.override_count})` : ''}
                    </p>
                  </div>
                  {row.is_verified ? (
                    <span className="flex shrink-0 items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                      <BadgeCheck className="size-3" /> 확정
                    </span>
                  ) : (
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                      미확정
                    </span>
                  )}
                </button>
              ))
            )}

            <p className="border-b border-admin-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              실차 오버라이드
            </p>
            {overrides.length === 0 ? (
              <p className="px-3 py-3 text-xs text-slate-500">
                표준과 다른 실차가 없어요. 배차 화면에서 [배치도 오버라이드]로 만들 수 있어요.
              </p>
            ) : (
              overrides.map((row) => (
                <button
                  key={row.room_vehicle_id}
                  type="button"
                  onClick={() => void openSelection({ kind: 'override', roomVehicleId: row.room_vehicle_id })}
                  className={`flex w-full items-center gap-2 border-b border-admin-border px-3 py-2.5 text-left hover:bg-slate-50 ${
                    selection?.kind === 'override' && selection.roomVehicleId === row.room_vehicle_id
                      ? 'bg-emerald-50'
                      : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {row.plate_number || '차량번호 미입력'}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {row.tour_date || '—'} · {row.note || '메모 없음'}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* 편집기 */}
        <main className={`min-w-0 flex-1 flex-col lg:flex ${selection ? 'flex' : 'hidden lg:flex'}`}>
          {!draft || !selection ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <Bus className="mb-3 size-10 text-slate-300" />
              <p className="text-sm text-slate-500">왼쪽에서 배치도를 선택하면 편집기가 열려요.</p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center gap-2 border-b border-admin-border bg-admin-surface px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelection(null);
                    setDraft(null);
                  }}
                  aria-label="목록으로"
                  className="-ml-1 flex size-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 lg:hidden"
                >
                  <ArrowLeft className="size-5" />
                </button>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-semibold text-slate-900">
                    {selection.kind === 'override'
                      ? `실차 오버라이드 — ${overrideDetail?.plate_number || '차량번호 미입력'}`
                      : layoutName(detail)}
                  </h2>
                  <p className="text-xs text-slate-500">
                    좌석 {draft.seats.length}석 · {draft.cols}열
                    {inUse.length > 0 ? ` · 배정된 좌석 ${inUse.length}석` : ''}
                  </p>
                </div>
                {dirty && (
                  <span className="shrink-0 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    저장 안 됨
                  </span>
                )}
                <button
                  type="button"
                  disabled={busy || blocked || !dirty}
                  onClick={() => void save(false)}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                  저장
                </button>
              </div>

              {error && (
                <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">{error}</div>
              )}
              {notice && (
                <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-700">
                  {notice}
                </div>
              )}

              <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div>
                  {/* 도구 */}
                  <div className="mb-3 flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
                    {TOOLS.map(({ key, label, icon: Icon }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setTool(key)}
                        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                          tool === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        <Icon className="size-3.5" /> {label}
                      </button>
                    ))}
                    <span className="mx-1 h-5 w-px bg-slate-300" />
                    <button
                      type="button"
                      onClick={() => mutate(renumberSeats(draft))}
                      className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white"
                    >
                      <Shuffle className="size-3.5" /> 번호 다시매기기
                    </button>
                    {selectedSeat != null && (
                      <button
                        type="button"
                        onClick={() => {
                          mutate(removeSeat(draft, selectedSeat));
                          setSelectedSeat(null);
                        }}
                        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-white"
                      >
                        <Trash2 className="size-3.5" /> {selectedSeat}번 삭제
                      </button>
                    )}
                  </div>

                  <LayoutCanvas
                    layout={draft}
                    selectedSeat={selectedSeat}
                    highlightSeats={highlightSeats}
                    assignedSeats={assignedSeats}
                    checkedInSeats={checkedInSeats}
                    tool={tool}
                    onSeatTap={handleSeatTap}
                    onCellTap={handleCellTap}
                  />

                  {/* 격자/정원 */}
                  <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg border border-admin-border bg-white p-3">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                      열(cols)
                      <input
                        type="number"
                        min={1}
                        max={MAX_COLS}
                        value={draft.cols}
                        onChange={(e) => mutate(setCols(draft, Number(e.target.value) || 1))}
                        className="w-16 rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                      <Hash className="size-3.5" /> 판매석(total_seats)
                      <input
                        type="number"
                        min={1}
                        value={totalSeats}
                        onChange={(e) => {
                          setTotalSeats(Number(e.target.value) || 0);
                          setDirty(true);
                        }}
                        className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setTotalSeats(draft.seats.length);
                        setDirty(true);
                      }}
                      className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600"
                    >
                      <RotateCcw className="size-3" /> 좌석 수({draft.seats.length})에 맞추기
                    </button>
                  </div>
                </div>

                {/* 오른쪽 패널 */}
                <div className="space-y-3">
                  <IssuePanel issues={issues} />

                  {selection.kind === 'model' ? (
                    <VerifyPanel
                      detail={detail}
                      photoMatched={photoMatched}
                      setPhotoMatched={setPhotoMatched}
                      busy={busy}
                      dirty={dirty}
                      onUpload={uploadPhoto}
                      onVerify={() => void setVerified(true)}
                      onUnverify={() => void setVerified(false)}
                    />
                  ) : (
                    <div className="rounded-lg border border-admin-border bg-white p-3">
                      <p className="mb-1.5 text-xs font-semibold text-slate-700">실차 오버라이드</p>
                      <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
                        이 배치도는 <b>이 차량 한 대에만</b> 적용돼요. 표준 배치도는 바뀌지 않아요.
                      </p>
                      <input
                        value={overrideDetail?.note ?? ''}
                        onChange={(e) => {
                          setOverrideDetail((current) =>
                            current ? { ...current, note: e.target.value } : current,
                          );
                          setDirty(true);
                        }}
                        placeholder="메모 (예: 뒷줄 3석 — 2026-08-17 실차)"
                        className="mb-2 w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
                      />
                      {overrideDetail?.hasOverride && (
                        <button
                          type="button"
                          onClick={() => void clearOverride()}
                          disabled={busy}
                          className="w-full rounded-md border border-slate-300 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40"
                        >
                          표준 배치도로 되돌리기
                        </button>
                      )}
                    </div>
                  )}

                  {inUse.length > 0 && (
                    <div className="rounded-lg border border-admin-border bg-white p-3">
                      <p className="mb-1.5 text-xs font-semibold text-slate-700">배정된 좌석</p>
                      <ul className="space-y-1 text-[11px] text-slate-600">
                        {inUse.map((ref) => (
                          <li key={`${ref.roomVehicleId}-${ref.seatNumber}`} className="flex gap-1.5">
                            <span className="font-semibold">{ref.seatNumber}번</span>
                            <span className="truncate">{ref.guestLabel || '—'}</span>
                            <span className="ml-auto truncate text-slate-400">{ref.roomLabel}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {pendingConfirm && (
        <ConfirmInUseDialog
          issue={pendingConfirm}
          busy={busy}
          onCancel={() => setPendingConfirm(null)}
          onConfirm={() => void save(true)}
        />
      )}
    </div>
  );
}

function IssuePanel({ issues }: { issues: LayoutIssue[] }) {
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
        <Check className="size-4" /> 검증 통과 — 저장할 수 있어요.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-admin-border bg-white p-3">
      <p className="mb-2 text-xs font-semibold text-slate-700">검증</p>
      <ul className="space-y-1.5">
        {issues.map((issue, i) => (
          <li
            key={`${issue.code}-${i}`}
            className={`flex gap-1.5 rounded px-2 py-1.5 text-[11px] leading-relaxed ${
              issue.severity === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'
            }`}
          >
            <AlertTriangle className="mt-0.5 size-3 shrink-0" />
            <span>{issue.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** §5.3b 실차 사진 대조 게이트 — 사진 없이는 확정 버튼이 열리지 않는다. */
function VerifyPanel({
  detail,
  photoMatched,
  setPhotoMatched,
  busy,
  dirty,
  onUpload,
  onVerify,
  onUnverify,
}: {
  detail: LayoutRow | null;
  photoMatched: boolean;
  setPhotoMatched: (v: boolean) => void;
  busy: boolean;
  dirty: boolean;
  onUpload: (file: File) => void;
  onVerify: () => void;
  onUnverify: () => void;
}) {
  const hasPhoto = Boolean(detail?.reference_photo_path);
  return (
    <div className="rounded-lg border border-admin-border bg-white p-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
        <Camera className="size-3.5" /> 실차 사진 대조
      </p>
      <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
        실제 차량 내부 사진과 대조해야 확정할 수 있어요. 사진은 비공개 저장소에 보관되고 링크는 15분 뒤 만료돼요.
      </p>

      {detail?.reference_photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- 서명 URL(비공개 버킷), 최적화 대상 아님
        <img
          src={detail.reference_photo_url}
          alt="실차 내부"
          className="mb-2 max-h-48 w-full rounded border border-admin-border object-cover"
        />
      ) : hasPhoto ? (
        <p className="mb-2 rounded bg-slate-50 p-2 text-[11px] text-slate-500">
          사진이 등록돼 있지만 링크를 발급하지 못했어요. 새로고침해 보세요.
        </p>
      ) : null}

      <label className="mb-2 flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-300 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
        <Camera className="size-3.5" />
        {hasPhoto ? '사진 교체' : '실차 사진 올리기'}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
            e.target.value = '';
          }}
        />
      </label>

      {detail?.is_verified ? (
        <>
          <p className="mb-2 flex items-center gap-1.5 rounded bg-emerald-50 px-2 py-1.5 text-[11px] font-semibold text-emerald-700">
            <BadgeCheck className="size-3.5" /> 확정됨
            {detail.verified_at ? ` · ${detail.verified_at.slice(0, 10)}` : ''}
          </p>
          <button
            type="button"
            onClick={onUnverify}
            disabled={busy}
            className="w-full rounded-md border border-slate-300 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40"
          >
            확정 해제
          </button>
        </>
      ) : (
        <>
          <label className="mb-2 flex items-start gap-2 text-[11px] leading-relaxed text-slate-600">
            <input
              type="checkbox"
              checked={photoMatched}
              disabled={!hasPhoto}
              onChange={(e) => setPhotoMatched(e.target.checked)}
              className="mt-0.5"
            />
            <span>위 사진과 이 배치도(좌석 수·위치·설비)를 직접 대조했습니다.</span>
          </label>
          <button
            type="button"
            onClick={onVerify}
            disabled={busy || !hasPhoto || !photoMatched || dirty}
            className="w-full rounded-md bg-slate-900 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            검수 확정
          </button>
          {!hasPhoto && (
            <p className="mt-1.5 text-[11px] text-slate-500">사진을 올려야 확정할 수 있어요.</p>
          )}
          {dirty && hasPhoto && (
            <p className="mt-1.5 text-[11px] text-slate-500">먼저 저장한 뒤 확정하세요.</p>
          )}
        </>
      )}
    </div>
  );
}

/** 사용 중 좌석 소실 — 영향받는 룸을 이름으로 보여주고 명시적 확인을 받는다. */
function ConfirmInUseDialog({
  issue,
  busy,
  onCancel,
  onConfirm,
}: {
  issue: LayoutIssue;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" aria-label="취소" onClick={onCancel} className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-rose-700">
          <AlertTriangle className="size-4" /> 사용 중인 배치도예요
        </p>
        <p className="mb-3 text-xs leading-relaxed text-slate-600">{issue.message}</p>
        {(issue.rooms ?? []).length > 0 && (
          <ul className="mb-4 max-h-48 space-y-1.5 overflow-y-auto rounded bg-slate-50 p-2.5">
            {(issue.rooms ?? []).map((room) => (
              <li key={room.roomId} className="text-[11px] leading-relaxed text-slate-700">
                <b>{room.roomLabel}</b> — {room.seats.join(', ')}번
                {room.guests.length > 0 ? ` (${room.guests.join(', ')})` : ''}
              </li>
            ))}
          </ul>
        )}
        <p className="mb-4 text-[11px] leading-relaxed text-slate-500">
          저장하면 이 손님들의 좌석 배정이 사라져요. 손님은 다시 좌석을 골라야 해요.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-md border border-slate-300 py-2 text-xs font-semibold text-slate-600"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 rounded-md bg-rose-600 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            확인하고 저장
          </button>
        </div>
      </div>
    </div>
  );
}
