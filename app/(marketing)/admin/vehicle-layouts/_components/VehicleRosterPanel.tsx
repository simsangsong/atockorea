'use client';

/**
 * 차량 마스터 목록·편집 — 관제 W1.
 *
 * 배치도(모델별 좌석 도면)와 차량(실제 번호판을 가진 개체)은 다른 것이다.
 * 지금까지는 후자가 `ops_room_vehicles.plate_number` 자유 텍스트뿐이라
 * "이 차가 같은 날 두 투어에 갔는가"를 물어볼 대상이 없었다 — 이 화면이
 * 그 대상을 만든다.
 *
 * 배치도 편집기와 같은 페이지의 두 번째 탭으로 사는 이유: 사이드바 항목을
 * 하나 더 늘리지 않기 위해서다(어드민 IA 재편 W11과 같은 방향).
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bus, Check, Loader2, Pencil, Plus, Power, Search, Trash2, X } from 'lucide-react';
import { getAdminAccessToken } from '@/app/(marketing)/admin/match-pois/_hooks/usePoiRow';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { formatPlate } from '@/lib/ops/vehicles/registry';

interface VehicleRow {
  id: string;
  plate_number: string;
  layout_id: string | null;
  nickname: string | null;
  seat_capacity: number | null;
  driver_name: string | null;
  driver_phone: string | null;
  active: boolean;
  note: string | null;
  layout_label: string | null;
  layout_total_seats: number | null;
  capacity: number | null;
}

export interface LayoutOption {
  id: string;
  label: string;
  totalSeats: number;
}

interface DraftState {
  id: string | null;
  plateNumber: string;
  layoutId: string;
  nickname: string;
  seatCapacity: string;
  driverName: string;
  driverPhone: string;
  note: string;
  active: boolean;
}

const EMPTY_DRAFT: DraftState = {
  id: null,
  plateNumber: '',
  layoutId: '',
  nickname: '',
  seatCapacity: '',
  driverName: '',
  driverPhone: '',
  note: '',
  active: true,
};

function draftFromRow(row: VehicleRow): DraftState {
  return {
    id: row.id,
    plateNumber: row.plate_number,
    layoutId: row.layout_id ?? '',
    nickname: row.nickname ?? '',
    seatCapacity: row.seat_capacity == null ? '' : String(row.seat_capacity),
    driverName: row.driver_name ?? '',
    driverPhone: row.driver_phone ?? '',
    note: row.note ?? '',
    active: row.active,
  };
}

export default function VehicleRosterPanel({ layouts }: { layouts: LayoutOption[] }) {
  const [rows, setRows] = useState<VehicleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAdminAccessToken();
      const res = await fetch('/api/admin/ops-vehicles?active=all', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '불러오기 실패');
      setRows(json.data as VehicleRow[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '차량 목록을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const token = await getAdminAccessToken();
      const body = {
        plateNumber: draft.plateNumber,
        layoutId: draft.layoutId || null,
        nickname: draft.nickname,
        // 빈 칸은 null 로 보내 "배치도 좌석수 상속"을 명시한다 — 0을 보내면
        // 정원 0인 차가 되어 모든 배차가 정원 초과로 잡힌다.
        seatCapacity: draft.seatCapacity.trim() === '' ? null : draft.seatCapacity.trim(),
        driverName: draft.driverName,
        driverPhone: draft.driverPhone,
        note: draft.note,
        active: draft.active,
      };
      const res = await fetch(
        draft.id ? `/api/admin/ops-vehicles/${draft.id}` : '/api/admin/ops-vehicles',
        {
          method: draft.id ? 'PATCH' : 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '저장 실패');
      toast.success(draft.id ? '차량 정보를 수정했어요.' : '차량을 등록했어요.');
      setDraft(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  }, [draft, load]);

  const remove = useCallback(
    async (row: VehicleRow) => {
      if (!window.confirm(`${formatPlate(row.plate_number)} 차량을 삭제할까요?\n배차 이력이 있으면 삭제 대신 운행 중지로 처리됩니다.`)) {
        return;
      }
      try {
        const token = await getAdminAccessToken();
        const res = await fetch(`/api/admin/ops-vehicles/${row.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '삭제 실패');
        // 서버가 무엇을 했는지 그대로 말한다 — "지웠다"고 했는데 비활성이면
        // 다음 사람이 목록에서 그 차를 보고 혼란스러워한다.
        toast.success(json.mode === 'deactivated' ? json.message : '차량을 삭제했어요.');
        await load();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '삭제하지 못했어요.');
      }
    },
    [load],
  );

  const toggleActive = useCallback(
    async (row: VehicleRow) => {
      try {
        const token = await getAdminAccessToken();
        const res = await fetch(`/api/admin/ops-vehicles/${row.id}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: !row.active }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '변경 실패');
        await load();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '변경하지 못했어요.');
      }
    },
    [load],
  );

  const q = query.trim().toLowerCase();
  const visible = q
    ? rows.filter(
        (r) =>
          r.plate_number.toLowerCase().includes(q) ||
          (r.nickname ?? '').toLowerCase().includes(q) ||
          (r.driver_name ?? '').toLowerCase().includes(q),
      )
    : rows;

  const columns: DataTableColumn<VehicleRow>[] = [
    {
      key: 'plate',
      header: '차량 번호',
      cell: (row) => (
        <span className="flex items-center gap-2">
          <span className="font-semibold text-slate-900 tabular-nums">{formatPlate(row.plate_number)}</span>
          {!row.active && (
            <span className="text-cjk-safe rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
              운행 중지
            </span>
          )}
        </span>
      ),
    },
    { key: 'nickname', header: '별칭', cell: (row) => row.nickname || <span className="text-slate-400">—</span> },
    {
      key: 'layout',
      header: '배치도',
      cell: (row) => row.layout_label || <span className="text-slate-400">미지정</span>,
    },
    {
      key: 'capacity',
      header: '정원',
      align: 'right',
      cell: (row) =>
        row.capacity == null ? (
          // "정원 미상"은 0이 아니다. 0으로 보이면 정원 검증이 못 도는 것을
          // 알아채지 못한 채 모든 배차가 초과로 잡힌다.
          <span className="text-cjk-safe rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
            미상
          </span>
        ) : (
          <span className="tabular-nums">
            {row.capacity}석{row.seat_capacity == null ? '' : ' (직접)'}
          </span>
        ),
    },
    {
      key: 'driver',
      header: '기본 기사',
      cell: (row) =>
        row.driver_name ? (
          <span>
            {row.driver_name}
            {row.driver_phone ? <span className="ml-1 text-xs text-slate-500">{row.driver_phone}</span> : null}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: 'actions',
      header: '관리',
      align: 'right',
      cell: (row) => (
        <span className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => setDraft(draftFromRow(row))}
            className="flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="수정"
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => void toggleActive(row)}
            className="flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label={row.active ? '운행 중지' : '운행 재개'}
          >
            <Power className={`size-4 ${row.active ? '' : 'text-amber-600'}`} />
          </button>
          <button
            type="button"
            onClick={() => void remove(row)}
            className="flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
            aria-label="삭제"
          >
            <Trash2 className="size-4" />
          </button>
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="번호판·별칭·기사 이름"
            className="h-10 w-full rounded-lg border border-admin-border bg-white pl-8 pr-3 text-sm outline-none focus:border-emerald-500"
          />
        </div>
        <button
          type="button"
          onClick={() => setDraft({ ...EMPTY_DRAFT })}
          className="text-cjk-safe flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Plus className="size-4" />
          <span className="text-cjk-safe">차량 등록</span>
        </button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">불러오는 중…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={visible}
          getRowKey={(row) => row.id}
          empty={
            <div className="rounded-design-md border border-dashed border-admin-border bg-white p-10 text-center">
              <Bus className="mx-auto mb-2 size-6 text-slate-300" />
              <p className="text-cjk-body text-sm text-slate-600">
                {rows.length === 0
                  ? '등록된 차량이 없어요. 번호판을 등록하면 배차 달력과 중복 배차 감지가 켜집니다.'
                  : '검색 결과가 없어요.'}
              </p>
            </div>
          }
        />
      )}

      {draft && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-cjk-safe text-base font-bold text-slate-900">
                {draft.id ? '차량 수정' : '차량 등록'}
              </h2>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="닫기"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3">
              <Field label="차량 번호" required>
                <input
                  value={draft.plateNumber}
                  onChange={(e) => setDraft({ ...draft, plateNumber: e.target.value })}
                  placeholder="12가3456"
                  className="h-10 w-full rounded-lg border border-admin-border px-3 text-sm outline-none focus:border-emerald-500"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  공백·하이픈은 저장할 때 자동으로 정리돼요. (12가 3456 = 12가3456)
                </p>
              </Field>

              <Field label="별칭">
                <input
                  value={draft.nickname}
                  onChange={(e) => setDraft({ ...draft, nickname: e.target.value })}
                  placeholder="흰색 카운티 / 2호차"
                  className="h-10 w-full rounded-lg border border-admin-border px-3 text-sm outline-none focus:border-emerald-500"
                />
              </Field>

              <Field label="배치도">
                <select
                  value={draft.layoutId}
                  onChange={(e) => setDraft({ ...draft, layoutId: e.target.value })}
                  className="h-10 w-full rounded-lg border border-admin-border bg-white px-2 text-sm outline-none focus:border-emerald-500"
                >
                  <option value="">미지정</option>
                  {layouts.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label} ({l.totalSeats}석)
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="좌석수 (직접 입력)">
                <input
                  value={draft.seatCapacity}
                  onChange={(e) => setDraft({ ...draft, seatCapacity: e.target.value.replace(/[^0-9]/g, '') })}
                  inputMode="numeric"
                  placeholder="비우면 배치도 좌석수를 따름"
                  className="h-10 w-full rounded-lg border border-admin-border px-3 text-sm outline-none focus:border-emerald-500"
                />
                <p className="mt-1 text-[11px] text-slate-500">실차가 개조돼 좌석수가 다를 때만 채워 주세요.</p>
              </Field>

              <div className="grid grid-cols-2 gap-2">
                <Field label="기본 기사">
                  <input
                    value={draft.driverName}
                    onChange={(e) => setDraft({ ...draft, driverName: e.target.value })}
                    className="h-10 w-full rounded-lg border border-admin-border px-3 text-sm outline-none focus:border-emerald-500"
                  />
                </Field>
                <Field label="기사 연락처">
                  <input
                    value={draft.driverPhone}
                    onChange={(e) => setDraft({ ...draft, driverPhone: e.target.value })}
                    inputMode="tel"
                    className="h-10 w-full rounded-lg border border-admin-border px-3 text-sm outline-none focus:border-emerald-500"
                  />
                </Field>
              </div>

              <Field label="메모">
                <textarea
                  value={draft.note}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-admin-border px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </Field>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                  className="size-4"
                />
                <span className="text-cjk-safe">운행 중</span>
              </label>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="text-cjk-safe h-11 flex-1 rounded-lg border border-admin-border text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <span className="text-cjk-safe">취소</span>
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || !draft.plateNumber.trim()}
                className="text-cjk-safe flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                <span className="text-cjk-safe">저장</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-cjk-safe mb-1 block text-xs font-semibold text-slate-600">
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}
