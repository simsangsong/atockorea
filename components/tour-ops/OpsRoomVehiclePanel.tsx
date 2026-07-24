'use client';

/**
 * 룸 차량 배정 — AtoC 통합 플랜 §4.1 B-2 / §5.6.
 *
 * ops_room_vehicles에는 쓰기 표면이 하나도 없었다. 룸에 차를 붙이는 일이
 * SQL로만 가능했고, 그래서 §5.3 좌석 선택 플로우 전체가 수동 작업에 묶여
 * 있었다. 이 패널은 운영자가 이미 일하는 자리(룸 상세 드로어) 안에서
 * 배차·차량번호·기사를 지정한다.
 *
 * 🔴 좌석이 이미 배정된 차량의 배치도 교체는 서버가 409로 막는다. 이 패널은
 * 그 409가 돌려준 "무엇이 사라지는지"를 좌석번호·손님 이름까지 보여준 뒤에만
 * 선택지를 연다(좌석 유지 / 전체 해제). 그리고 실행 직후 [되돌리기]를 띄운다 —
 * 스냅샷이 이벤트에 남아 있어서 원상복구가 가능하다.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Bus, Loader2, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { getOpsToken } from '@/components/tour-ops/opsShared';

interface LayoutOption {
  id: string;
  model: string;
  display_name: Record<string, string> | null;
  total_seats: number;
  is_verified: boolean;
}

interface DriverOption {
  id: string;
  display_name: string;
  role: string;
  last_seen_at: string | null;
}

interface AssignmentBrief {
  seat_number: number;
  guest_label: string | null;
  booking_id: string;
  checked_in: boolean;
  absent: boolean;
  locked: boolean;
}

interface VehicleRow {
  id: string;
  layout_id: string;
  model: string | null;
  display_name: Record<string, string> | null;
  plate_number: string | null;
  driver_participant_id: string | null;
  driver_name: string | null;
  has_override: boolean;
  override_note: string | null;
  total_seats: number;
  assignments: AssignmentBrief[];
}

interface Conflict {
  vehicleId: string;
  layoutId: string;
  message: string;
  assigned: AssignmentBrief[];
  lost: AssignmentBrief[];
  patch: Record<string, unknown>;
}

function layoutLabel(row: { display_name: Record<string, string> | null; model: string | null }): string {
  return row.display_name?.ko || row.display_name?.en || row.model || '차량';
}

async function authedFetch(url: string, init: RequestInit = {}) {
  const token = await getOpsToken();
  return fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    credentials: 'include',
    cache: 'no-store',
  });
}

export default function OpsRoomVehiclePanel({ roomId }: { roomId: string }) {
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [layouts, setLayouts] = useState<LayoutOption[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [undoEventId, setUndoEventId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch(`/api/admin/tour-ops/rooms/${encodeURIComponent(roomId)}/vehicles`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || '차량 정보를 불러오지 못했어요.');
      setVehicles(json.vehicles as VehicleRow[]);
      setLayouts(json.layouts as LayoutOption[]);
      setDrivers(json.drivers as DriverOption[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '차량 정보를 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchVehicle = useCallback(
    async (vehicleId: string, patch: Record<string, unknown>, strategy?: 'keep' | 'clear') => {
      setBusy(true);
      try {
        const body: Record<string, unknown> = { vehicle_id: vehicleId, ...patch };
        if (strategy) {
          body.strategy = strategy;
          body.confirm = true;
        }
        const res = await authedFetch(`/api/admin/tour-ops/rooms/${encodeURIComponent(roomId)}/vehicles`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (res.status === 409 && json?.error === 'seats_assigned') {
          setConflict({
            vehicleId,
            layoutId: String(patch.layout_id ?? ''),
            message: json.message,
            assigned: (json.assigned as AssignmentBrief[]) ?? [],
            lost: (json.lost as AssignmentBrief[]) ?? [],
            patch,
          });
          return;
        }
        if (!res.ok) throw new Error(json?.message || json?.error || '저장 실패');
        setConflict(null);
        setUndoEventId(json.undo_event_id ?? null);
        const released = (json.released as number[]) ?? [];
        toast.success(
          released.length > 0 ? `저장했어요. ${released.length}석 배정이 해제됐어요.` : '저장했어요.',
        );
        await load();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '저장 실패');
      } finally {
        setBusy(false);
      }
    },
    [roomId, load],
  );

  const undo = useCallback(async () => {
    if (!undoEventId) return;
    setBusy(true);
    try {
      const res = await authedFetch(`/api/admin/tour-ops/rooms/${encodeURIComponent(roomId)}/vehicles`, {
        method: 'PATCH',
        body: JSON.stringify({ undo_event_id: undoEventId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || '되돌리기 실패');
      const skipped = (json.skipped as number[]) ?? [];
      toast.success(
        skipped.length > 0
          ? `${json.restored}석 복원. ${skipped.join(', ')}번은 이미 다른 손님이 잡아 복원하지 못했어요.`
          : `${json.restored}석을 복원했어요.`,
      );
      setUndoEventId(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '되돌리기 실패');
    } finally {
      setBusy(false);
    }
  }, [undoEventId, roomId, load]);

  const removeVehicle = useCallback(
    async (vehicleId: string) => {
      setBusy(true);
      try {
        let res = await authedFetch(
          `/api/admin/tour-ops/rooms/${encodeURIComponent(roomId)}/vehicles?vehicle_id=${encodeURIComponent(vehicleId)}`,
          { method: 'DELETE' },
        );
        let json = await res.json();
        if (res.status === 409 && json?.error === 'seats_assigned') {
          if (!window.confirm(`${json.message}\n\n그래도 배차를 해제할까요?`)) return;
          res = await authedFetch(
            `/api/admin/tour-ops/rooms/${encodeURIComponent(roomId)}/vehicles?vehicle_id=${encodeURIComponent(vehicleId)}&confirm=1`,
            { method: 'DELETE' },
          );
          json = await res.json();
        }
        if (!res.ok) throw new Error(json?.message || json?.error || '해제 실패');
        toast.success('배차를 해제했어요.');
        await load();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '해제 실패');
      } finally {
        setBusy(false);
      }
    },
    [roomId, load],
  );

  const createVehicle = useCallback(
    async (payload: Record<string, unknown>) => {
      setBusy(true);
      try {
        const res = await authedFetch(`/api/admin/tour-ops/rooms/${encodeURIComponent(roomId)}/vehicles`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || '배차 실패');
        toast.success('차량을 배정했어요. 손님 좌석 선택이 열려요.');
        setAdding(false);
        await load();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '배차 실패');
      } finally {
        setBusy(false);
      }
    },
    [roomId, load],
  );

  return (
    <div className="min-h-[200px] flex-1 space-y-3 overflow-y-auto px-4 py-3">
      {loading ? (
        <p className="text-center text-[12px] text-[var(--tr-ink-3)]">차량 정보를 불러오는 중…</p>
      ) : (
        <>
          {vehicles.length === 0 && !adding && (
            <div className="rounded-xl border border-dashed border-[var(--tr-hairline)] p-4 text-center">
              <Bus className="mx-auto mb-2 size-6 text-[var(--tr-ink-3)]" />
              <p className="text-[12px] text-[var(--tr-ink-2)]">
                아직 차량이 배정되지 않았어요. 배차해야 손님이 좌석을 고를 수 있어요.
              </p>
            </div>
          )}

          {vehicles.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              layouts={layouts}
              drivers={drivers}
              busy={busy}
              onSave={(patch) => void patchVehicle(vehicle.id, patch)}
              onRemove={() => void removeVehicle(vehicle.id)}
            />
          ))}

          {undoEventId && (
            <button
              type="button"
              onClick={() => void undo()}
              disabled={busy}
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] text-[12px] font-semibold text-[var(--tr-ink-2)] disabled:opacity-40"
            >
              <RotateCcw className="size-3.5" /> 방금 변경 되돌리기
            </button>
          )}

          {adding ? (
            <NewVehicleForm
              layouts={layouts}
              drivers={drivers}
              busy={busy}
              onCancel={() => setAdding(false)}
              onCreate={createVehicle}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--tr-accent)] text-[12px] font-semibold text-[var(--tr-bubble-me-ink)]"
            >
              <Plus className="size-4" /> 차량 배정
            </button>
          )}
        </>
      )}

      {conflict && (
        <ConflictSheet
          conflict={conflict}
          busy={busy}
          onCancel={() => setConflict(null)}
          onChoose={(strategy) => void patchVehicle(conflict.vehicleId, conflict.patch, strategy)}
        />
      )}
    </div>
  );
}

function VehicleCard({
  vehicle,
  layouts,
  drivers,
  busy,
  onSave,
  onRemove,
}: {
  vehicle: VehicleRow;
  layouts: LayoutOption[];
  drivers: DriverOption[];
  busy: boolean;
  onSave: (patch: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  const [layoutId, setLayoutId] = useState(vehicle.layout_id);
  const [plate, setPlate] = useState(vehicle.plate_number ?? '');
  const [driverParticipantId, setDriverParticipantId] = useState(vehicle.driver_participant_id ?? '');
  const [driverName, setDriverName] = useState(vehicle.driver_name ?? '');

  useEffect(() => {
    setLayoutId(vehicle.layout_id);
    setPlate(vehicle.plate_number ?? '');
    setDriverParticipantId(vehicle.driver_participant_id ?? '');
    setDriverName(vehicle.driver_name ?? '');
  }, [vehicle]);

  const dirty =
    layoutId !== vehicle.layout_id ||
    plate !== (vehicle.plate_number ?? '') ||
    driverParticipantId !== (vehicle.driver_participant_id ?? '') ||
    driverName !== (vehicle.driver_name ?? '');

  const seated = vehicle.assignments.length;
  const checkedIn = vehicle.assignments.filter((a) => a.checked_in).length;
  const selectedLayout = layouts.find((layout) => layout.id === layoutId) ?? null;

  return (
    <div className="rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <Bus className="size-4 shrink-0 text-[var(--tr-ink-2)]" />
        <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-[var(--tr-ink)]">
          {layoutLabel(vehicle)}
          {vehicle.plate_number ? <span className="ml-1.5 font-normal">{vehicle.plate_number}</span> : null}
        </p>
        {vehicle.has_override && (
          <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
            오버라이드
          </span>
        )}
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          aria-label="배차 해제"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--tr-ink-3)] disabled:opacity-40"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <p className="mb-2 text-[11px] text-[var(--tr-ink-2)]">
        정원 {vehicle.total_seats}석 · 배정 {seated}석 · 체크인 {checkedIn}석
      </p>

      <label className="mb-2 block text-[11px] font-semibold text-[var(--tr-ink-2)]">
        배치도
        <select
          value={layoutId}
          onChange={(event) => setLayoutId(event.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 text-[13px] font-normal text-[var(--tr-ink)]"
        >
          {layouts.map((layout) => (
            <option key={layout.id} value={layout.id}>
              {layoutLabel({ display_name: layout.display_name, model: layout.model })} ({layout.total_seats}석)
              {layout.is_verified ? '' : ' — 미확정'}
            </option>
          ))}
        </select>
      </label>
      {selectedLayout && !selectedLayout.is_verified && (
        <p className="mb-2 flex items-start gap-1 text-[11px] text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-3 shrink-0" />이 배치도는 아직 실차 사진 대조가 안 됐어요.
        </p>
      )}

      <label className="mb-2 block text-[11px] font-semibold text-[var(--tr-ink-2)]">
        차량번호
        <input
          value={plate}
          onChange={(event) => setPlate(event.target.value)}
          maxLength={32}
          placeholder="예: 12가 3456"
          className="mt-1 h-10 w-full rounded-lg border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 text-[13px] font-normal text-[var(--tr-ink)]"
        />
      </label>

      <label className="mb-2 block text-[11px] font-semibold text-[var(--tr-ink-2)]">
        기사 (입장한 스태프)
        <select
          value={driverParticipantId}
          onChange={(event) => setDriverParticipantId(event.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 text-[13px] font-normal text-[var(--tr-ink)]"
        >
          <option value="">— 미지정 —</option>
          {drivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.display_name} ({driver.role === 'driver' ? '기사' : '가이드'})
            </option>
          ))}
        </select>
      </label>

      <label className="mb-2 block text-[11px] font-semibold text-[var(--tr-ink-2)]">
        기사 이름 (입장 전 표시용)
        <input
          value={driverName}
          onChange={(event) => setDriverName(event.target.value)}
          maxLength={60}
          placeholder="예: 김기사"
          className="mt-1 h-10 w-full rounded-lg border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 text-[13px] font-normal text-[var(--tr-ink)]"
        />
      </label>

      <div className="flex gap-2">
        <a
          href={`/admin/vehicle-layouts?override=${encodeURIComponent(vehicle.id)}`}
          className="flex h-10 flex-1 items-center justify-center rounded-lg border border-[var(--tr-hairline)] text-[12px] font-semibold text-[var(--tr-ink-2)]"
        >
          배치도 오버라이드
        </a>
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={() =>
            onSave({
              layout_id: layoutId,
              plate_number: plate,
              driver_participant_id: driverParticipantId || null,
              driver_name: driverName,
            })
          }
          className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--tr-accent)] text-[12px] font-semibold text-[var(--tr-bubble-me-ink)] disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : null} 저장
        </button>
      </div>
    </div>
  );
}

function NewVehicleForm({
  layouts,
  drivers,
  busy,
  onCancel,
  onCreate,
}: {
  layouts: LayoutOption[];
  drivers: DriverOption[];
  busy: boolean;
  onCancel: () => void;
  onCreate: (payload: Record<string, unknown>) => void;
}) {
  const [layoutId, setLayoutId] = useState(layouts[0]?.id ?? '');
  const [plate, setPlate] = useState('');
  const [driverParticipantId, setDriverParticipantId] = useState('');
  const [driverName, setDriverName] = useState('');

  return (
    <div className="rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <p className="flex-1 text-[13px] font-bold text-[var(--tr-ink)]">새 차량 배정</p>
        <button
          type="button"
          onClick={onCancel}
          aria-label="취소"
          className="flex size-8 items-center justify-center rounded-lg text-[var(--tr-ink-3)]"
        >
          <X className="size-4" />
        </button>
      </div>
      <select
        value={layoutId}
        onChange={(event) => setLayoutId(event.target.value)}
        className="mb-2 h-10 w-full rounded-lg border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 text-[13px] text-[var(--tr-ink)]"
      >
        {layouts.map((layout) => (
          <option key={layout.id} value={layout.id}>
            {layoutLabel({ display_name: layout.display_name, model: layout.model })} ({layout.total_seats}석)
          </option>
        ))}
      </select>
      <input
        value={plate}
        onChange={(event) => setPlate(event.target.value)}
        placeholder="차량번호 (예: 12가 3456)"
        maxLength={32}
        className="mb-2 h-10 w-full rounded-lg border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 text-[13px] text-[var(--tr-ink)]"
      />
      <select
        value={driverParticipantId}
        onChange={(event) => setDriverParticipantId(event.target.value)}
        className="mb-2 h-10 w-full rounded-lg border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 text-[13px] text-[var(--tr-ink)]"
      >
        <option value="">기사 — 미지정</option>
        {drivers.map((driver) => (
          <option key={driver.id} value={driver.id}>
            {driver.display_name} ({driver.role === 'driver' ? '기사' : '가이드'})
          </option>
        ))}
      </select>
      <input
        value={driverName}
        onChange={(event) => setDriverName(event.target.value)}
        placeholder="기사 이름 (입장 전 표시용)"
        maxLength={60}
        className="mb-2 h-10 w-full rounded-lg border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 text-[13px] text-[var(--tr-ink)]"
      />
      <button
        type="button"
        disabled={busy || !layoutId}
        onClick={() =>
          onCreate({
            layout_id: layoutId,
            plate_number: plate,
            driver_participant_id: driverParticipantId || null,
            driver_name: driverName,
          })
        }
        className="h-11 w-full rounded-xl bg-[var(--tr-accent)] text-[12px] font-semibold text-[var(--tr-bubble-me-ink)] disabled:opacity-40"
      >
        배정하기
      </button>
    </div>
  );
}

/** 배치도 교체의 결과를 먼저 보여주고 선택지를 연다 (조용한 파괴 금지). */
function ConflictSheet({
  conflict,
  busy,
  onCancel,
  onChoose,
}: {
  conflict: Conflict;
  busy: boolean;
  onCancel: () => void;
  onChoose: (strategy: 'keep' | 'clear') => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="취소" onClick={onCancel} className="absolute inset-0 bg-black/60" />
      <div
        className="relative max-h-[80dvh] w-full overflow-y-auto rounded-t-3xl border-t border-[var(--tr-hairline)] bg-[var(--tr-surface)] p-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
      >
        <p className="mb-2 flex items-center gap-1.5 text-[14px] font-bold text-[var(--tr-ink)]">
          <AlertTriangle className="size-4 text-amber-600" /> 좌석이 이미 배정돼 있어요
        </p>
        <p className="mb-3 text-[12px] leading-relaxed text-[var(--tr-ink-2)]">{conflict.message}</p>

        {conflict.lost.length > 0 && (
          <div className="mb-3 rounded-xl bg-[var(--tr-surface-2)] p-3">
            <p className="mb-1.5 text-[11px] font-semibold text-[var(--tr-ink-2)]">
              새 배치도에 없는 좌석 ({conflict.lost.length}석)
            </p>
            <ul className="space-y-1">
              {conflict.lost.map((row) => (
                <li key={row.seat_number} className="text-[11px] text-[var(--tr-ink)]">
                  <b>{row.seat_number}번</b> {row.guest_label || '—'}
                  {row.checked_in ? ' · 체크인 완료' : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onChoose('keep')}
            className="h-11 w-full rounded-xl bg-[var(--tr-accent)] text-[12px] font-semibold text-[var(--tr-bubble-me-ink)] disabled:opacity-40"
          >
            같은 번호 좌석은 유지 ({conflict.lost.length}석만 해제)
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onChoose('clear')}
            className="h-11 w-full rounded-xl border border-rose-300 text-[12px] font-semibold text-rose-600 disabled:opacity-40"
          >
            전 좌석 해제하고 다시 받기 ({conflict.assigned.length}석)
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="h-11 w-full rounded-xl border border-[var(--tr-hairline)] text-[12px] font-semibold text-[var(--tr-ink-2)]"
          >
            취소
          </button>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-[var(--tr-ink-3)]">
          어느 쪽을 고르든 해제된 배정은 기록에 남아요 — 바로 뒤에 나오는 [되돌리기]로 복구할 수 있어요.
        </p>
      </div>
    </div>
  );
}
