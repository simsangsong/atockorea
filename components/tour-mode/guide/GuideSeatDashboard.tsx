'use client';

/**
 * 가이드 명단·체크인 대시보드 — AtoC 통합 플랜 §5.4b + 시작 게이트 §5.4 C-16.
 *
 * [명단 | 좌석판] 세그먼트 + 상단 고정 카운터바(총원·체크인·대기·노쇼·팀수,
 * Realtime). 명단 = 픽업지 그룹 아코디언(행: 이름·인원·채널·좌석·상태·특이사항).
 * 좌석판 = SeatMap(staff 뷰). 명단 행 ↔ 좌석판 양방향 하이라이트(highlightSeats).
 * 좌석 탭 → 액션 시트(체크인 guide_manual / 노쇼 absent / 미지정 게스트 현장
 * 지정). [체크인 QR] 전체화면(5분 nonce, 인쇄). [투어 시작] = allSeatsResolved.
 *
 * 단일 소스 = ops_seat_assignments(useTourManifest). 변경은 응답 anchorRoomId로
 * 기존 /api/ops/rooms/[roomId]/{checkin,absent,seats,gate} 를 호출한다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Play, QrCode, RefreshCw, Users, X } from 'lucide-react';
import SeatMap from '@/components/ops/SeatMap';
import GuideGuestCard, { channelLabel, statusMeta } from '@/components/tour-mode/guide/GuideGuestCard';
import { useTourManifest, type ManifestAssignment } from '@/hooks/useTourManifest';
import { buildSeatStateMap } from '@/lib/ops/seating/logic';
import {
  buildRosterGroups,
  buildRosterRows,
  dashboardCounts,
  gateStatus,
  type RosterRow,
} from '@/lib/ops/seating/dashboard';

type Seg = 'roster' | 'seats';

interface SeatTarget {
  roomVehicleId: string;
  seatNumber: number;
  assignment: ManifestAssignment | null;
}

export default function GuideSeatDashboard({
  token,
  bookingId,
  tourTitle,
}: {
  token: string;
  bookingId: string;
  tourTitle?: string;
}) {
  const { data, error, loading, refetch } = useTourManifest(bookingId, token);
  const [seg, setSeg] = useState<Seg>('roster');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [hoverBookingId, setHoverBookingId] = useState<string | null>(null);
  const [cardBookingId, setCardBookingId] = useState<string | null>(null);
  const [seatTarget, setSeatTarget] = useState<SeatTarget | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const bookings = data?.bookings ?? [];
  const assignments = data?.assignments ?? [];
  const vehicles = data?.vehicles ?? [];
  const anchorRoomId = data?.anchorRoomId ?? null;

  const counts = useMemo(() => dashboardCounts(bookings, assignments), [bookings, assignments]);
  const groups = useMemo(() => buildRosterGroups(bookings, assignments), [bookings, assignments]);
  const rowByBooking = useMemo(
    () => new Map<string, RosterRow>(buildRosterRows(bookings, assignments).map((r) => [r.bookingId, r])),
    [bookings, assignments],
  );
  const gate = useMemo(() => gateStatus(assignments), [assignments]);
  const highlightBookingId = hoverBookingId ?? cardBookingId;
  const highlightSeats = useMemo(
    () =>
      highlightBookingId
        ? assignments.filter((a) => a.booking_id === highlightBookingId).map((a) => a.seat_number)
        : [],
    [assignments, highlightBookingId],
  );

  // 미지정(claim만) 게스트 — staff 현장 좌석 지정 대상 (빈 좌석 탭).
  const unseated = useMemo(() => {
    const seated = new Set(assignments.map((a) => a.booking_id));
    return bookings.filter((b) => !seated.has(b.id));
  }, [bookings, assignments]);

  // ── mutations (all target anchorRoomId with existing room endpoints) ──────
  const mutate = useCallback(
    async (path: string, body: Record<string, unknown>) => {
      if (!anchorRoomId) return;
      setBusy(true);
      setNote(null);
      try {
        const res = await fetch(`/api/ops/rooms/${anchorRoomId}/${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-tour-room-token': token },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setNote(j.error || 'action_failed');
        }
        await refetch();
      } catch {
        setNote('action_failed');
      } finally {
        setBusy(false);
      }
    },
    [anchorRoomId, token, refetch],
  );

  const manualCheckin = (t: SeatTarget, action: 'checkin' | 'undo') =>
    mutate('checkin', { method: 'guide_manual', roomVehicleId: t.roomVehicleId, seatNumber: t.seatNumber, action });
  const markAbsent = (t: SeatTarget, action: 'mark' | 'clear') =>
    mutate('absent', { roomVehicleId: t.roomVehicleId, seatNumber: t.seatNumber, action });
  const assignSeat = (t: SeatTarget, targetBookingId: string) => {
    const label = bookings.find((b) => b.id === targetBookingId)?.contactName ?? undefined;
    return mutate('seats', {
      roomVehicleId: t.roomVehicleId,
      bookingId: targetBookingId,
      seats: [{ seatNumber: t.seatNumber, guestLabel: label }],
    });
  };
  const startTour = () => mutate('gate', {});

  const onSeatTap = useCallback(
    (roomVehicleId: string, seatNumber: number) => {
      const assignment = assignments.find(
        (a) => a.room_vehicle_id === roomVehicleId && a.seat_number === seatNumber,
      );
      setSeatTarget({ roomVehicleId, seatNumber, assignment: assignment ?? null });
    },
    [assignments],
  );

  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const cardRow = cardBookingId ? rowByBooking.get(cardBookingId) ?? null : null;

  // ── styling ───────────────────────────────────────────────────────────────
  const seatVehicleFor = (roomVehicleId: string): ManifestAssignment[] =>
    assignments.filter((a) => a.room_vehicle_id === roomVehicleId);

  return (
    <section className="mt-6" data-testid="guide-seat-dashboard">
      {/* counter bar (§5.4b — Realtime 고정) */}
      <div
        className="sticky top-0 z-10 -mx-4 flex items-center gap-x-2.5 gap-y-1 overflow-x-auto border-b border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-4 py-2"
        data-testid="counter-bar"
      >
        <span className="inline-flex items-center gap-1 text-sm font-bold text-[var(--tr-ink)] tabular-nums">
          <Users size={14} aria-hidden />
          {counts.totalPax}명 · {counts.teams}팀
        </span>
        <span className="h-3.5 w-px bg-[var(--tr-hairline)]" aria-hidden />
        <span className="text-sm font-semibold text-[var(--tr-safe)] tabular-nums" data-testid="count-checkedin">
          체크인 {counts.checkedInPax}
        </span>
        <span className="text-sm font-semibold text-[var(--tr-ink-2)] tabular-nums" data-testid="count-waiting">
          대기 {counts.waitingPax}
        </span>
        <span className="text-sm font-semibold text-[var(--tr-danger)] tabular-nums" data-testid="count-absent">
          노쇼 {counts.absentPax}
        </span>
        <button
          type="button"
          onClick={() => void refetch()}
          aria-label="새로고침"
          className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--tr-ink-3)] active:bg-[var(--tr-surface-2)]"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} aria-hidden />
        </button>
      </div>

      {/* segment + actions */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex flex-1 gap-1 rounded-full bg-[var(--tr-surface-2)] p-1">
          {(['roster', 'seats'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSeg(k)}
              className={`flex-1 rounded-full py-1.5 text-xs font-bold ${
                seg === k ? 'bg-[var(--tr-surface)] text-[var(--tr-ink)] shadow-sm' : 'text-[var(--tr-ink-3)]'
              }`}
              data-testid={`seg-${k}`}
            >
              {k === 'roster' ? '명단' : '좌석판'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setQrOpen(true)}
          disabled={!anchorRoomId}
          className="flex h-9 items-center gap-1.5 rounded-full bg-[var(--tr-ink)] px-3 text-xs font-bold text-[var(--tr-canvas)] disabled:opacity-40"
          data-testid="checkin-qr-btn"
        >
          <QrCode size={14} aria-hidden />
          체크인 QR
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-xl border border-[var(--tr-danger-soft)] bg-[var(--tr-surface)] px-3 py-2 text-xs font-medium text-[var(--tr-danger)]">
          {error}
        </p>
      )}
      {note && (
        <p className="mt-2 rounded-xl bg-[var(--tr-danger-soft)] px-3 py-2 text-xs font-medium text-[var(--tr-danger)]" data-testid="dashboard-note">
          {note}
        </p>
      )}

      {/* ── 명단 ──────────────────────────────────────────────────────────── */}
      {seg === 'roster' && (
        <div className="mt-3 space-y-2" data-testid="roster-view">
          {groups.length === 0 && (
            <p className="rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-6 text-center text-sm text-[var(--tr-ink-3)]">
              배정된 예약이 없어요.
            </p>
          )}
          {groups.map(({ group, rows }) => {
            const isCollapsed = collapsed.has(group.key);
            const checked = rows.filter((r) => r.status === 'checked_in').length;
            return (
              <div
                key={group.key}
                className="overflow-hidden rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)]"
                data-testid="pickup-group"
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left"
                  data-testid="pickup-group-header"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-[var(--tr-ink)]">
                      {group.firstPickupTime ? `${group.firstPickupTime} · ` : ''}
                      {group.displayName}
                    </span>
                    <span className="text-xs text-[var(--tr-ink-3)]">
                      {group.teamCount}팀 {group.paxCount}명 · 체크인 {checked}/{group.teamCount}
                    </span>
                  </span>
                  {isCollapsed ? (
                    <ChevronDown size={16} className="shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
                  ) : (
                    <ChevronUp size={16} className="shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
                  )}
                </button>
                {!isCollapsed && (
                  <ul className="divide-y divide-[var(--tr-hairline)]">
                    {rows.map((row) => {
                      const meta = statusMeta(row.status);
                      const ch = channelLabel(row.channel);
                      return (
                        <li key={row.bookingId}>
                          <button
                            type="button"
                            onMouseEnter={() => setHoverBookingId(row.bookingId)}
                            onMouseLeave={() => setHoverBookingId((cur) => (cur === row.bookingId ? null : cur))}
                            onClick={() => setCardBookingId(row.bookingId)}
                            className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left active:bg-[var(--tr-surface-2)]"
                            data-testid="roster-row"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-1.5">
                                <span className="truncate text-sm font-semibold text-[var(--tr-ink)]">{row.name}</span>
                                <span className="text-xs text-[var(--tr-ink-3)]">{row.partySize}명</span>
                                {ch && (
                                  <span className="rounded-full bg-[var(--tr-surface-2)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--tr-ink-3)]">
                                    {ch}
                                  </span>
                                )}
                                {row.highlights.length > 0 && (
                                  <span className="rounded-full bg-[var(--tr-danger-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--tr-danger)]" data-testid="row-highlight">
                                    ⚠ {row.highlights.length}
                                  </span>
                                )}
                              </span>
                              <span className="mt-0.5 block text-xs text-[var(--tr-ink-3)] tabular-nums">
                                {row.seatNumbers.length > 0 ? `좌석 ${row.seatNumbers.join(', ')}` : '좌석 미지정'}
                              </span>
                            </span>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${meta.cls}`}>
                              {meta.label}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── 좌석판 ────────────────────────────────────────────────────────── */}
      {seg === 'seats' && (
        <div className="mt-3 space-y-4" data-testid="seat-view">
          {vehicles.length === 0 && (
            <p className="rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-6 text-center text-sm text-[var(--tr-ink-3)]">
              차량이 아직 배정되지 않았어요.
            </p>
          )}
          {vehicles.map((v) =>
            v.layout ? (
              <div key={v.roomVehicleId} className="rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] p-3">
                <p className="mb-2 text-xs font-bold text-[var(--tr-ink-2)]">
                  {v.plateNumber || v.model || '차량'}
                </p>
                <div className="overflow-x-auto">
                  <SeatMap
                    layout={v.layout}
                    seatStates={buildSeatStateMap(v.layout, seatVehicleFor(v.roomVehicleId))}
                    highlightSeats={highlightSeats}
                    onSeatTap={(n) => onSeatTap(v.roomVehicleId, n)}
                    ariaLabel="좌석판"
                  />
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}

      {/* ── 시작 게이트 (§5.4 C-16) ───────────────────────────────────────── */}
      <button
        type="button"
        disabled={!gate.enabled || busy || Boolean(data?.started)}
        onClick={() => void startTour()}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--tr-safe)] px-4 py-3 text-sm font-bold text-white disabled:bg-[var(--tr-surface-2)] disabled:text-[var(--tr-ink-3)]"
        data-testid="start-gate-btn"
      >
        <Play size={16} aria-hidden />
        {data?.started
          ? '투어 시작됨'
          : gate.enabled
            ? '투어 시작'
            : gate.hasAssignments
              ? `${gate.pendingCount}명 미체크인`
              : '좌석 배정 없음'}
      </button>

      {/* guest card sheet */}
      {cardRow && (
        <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center" data-testid="dashboard-card">
          <button type="button" aria-label="닫기" className="absolute inset-0 bg-black/30" onClick={() => setCardBookingId(null)} />
          <div className="relative z-10 w-full max-w-md p-4">
            <GuideGuestCard row={cardRow} onClose={() => setCardBookingId(null)} />
          </div>
        </div>
      )}

      {/* seat action sheet */}
      {seatTarget && (
        <SeatActionSheet
          target={seatTarget}
          busy={busy}
          unseated={unseated.map((b) => ({ id: b.id, name: b.contactName ?? 'Guest' }))}
          onClose={() => setSeatTarget(null)}
          onCheckin={(action) => void manualCheckin(seatTarget, action).then(() => setSeatTarget(null))}
          onAbsent={(action) => void markAbsent(seatTarget, action).then(() => setSeatTarget(null))}
          onAssign={(bid) => void assignSeat(seatTarget, bid).then(() => setSeatTarget(null))}
        />
      )}

      {/* check-in QR overlay (§5.4c) */}
      {qrOpen && anchorRoomId && (
        <CheckinQrOverlay roomId={anchorRoomId} token={token} onClose={() => setQrOpen(false)} />
      )}
    </section>
  );
}

/** 좌석 탭 액션 시트 — 체크인(guide_manual) / 노쇼(absent) / 미지정 게스트 현장 지정. */
function SeatActionSheet({
  target,
  busy,
  unseated,
  onClose,
  onCheckin,
  onAbsent,
  onAssign,
}: {
  target: SeatTarget;
  busy: boolean;
  unseated: Array<{ id: string; name: string }>;
  onClose: () => void;
  onCheckin: (action: 'checkin' | 'undo') => void;
  onAbsent: (action: 'mark' | 'clear') => void;
  onAssign: (bookingId: string) => void;
}) {
  const a = target.assignment;
  const btn =
    'w-full rounded-xl px-4 py-3 text-sm font-bold active:scale-[0.99] disabled:opacity-40';
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" data-testid="seat-action-sheet">
      <button type="button" aria-label="닫기" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-t-2xl bg-[var(--tr-surface)] p-4 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold text-[var(--tr-ink)]">{target.seatNumber}번 좌석</p>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-[var(--tr-ink-3)]">
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="space-y-2">
          {a ? (
            <>
              {a.absent_at ? (
                <button type="button" disabled={busy} className={`${btn} bg-[var(--tr-surface-2)] text-[var(--tr-ink)]`} onClick={() => onAbsent('clear')} data-testid="act-absent-clear">
                  노쇼 취소
                </button>
              ) : a.checked_in_at ? (
                <button type="button" disabled={busy} className={`${btn} bg-[var(--tr-surface-2)] text-[var(--tr-ink)]`} onClick={() => onCheckin('undo')} data-testid="act-checkin-undo">
                  체크인 취소
                </button>
              ) : (
                <>
                  <button type="button" disabled={busy} className={`${btn} bg-[var(--tr-safe)] text-white`} onClick={() => onCheckin('checkin')} data-testid="act-checkin">
                    체크인 (현장)
                  </button>
                  <button type="button" disabled={busy} className={`${btn} bg-[var(--tr-danger-soft)] text-[var(--tr-danger)]`} onClick={() => onAbsent('mark')} data-testid="act-absent">
                    노쇼 처리
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <p className="text-xs text-[var(--tr-ink-3)]">빈 좌석 — 미지정 게스트를 현장 지정</p>
              {unseated.length === 0 && <p className="text-xs text-[var(--tr-ink-3)]">미지정 게스트가 없어요.</p>}
              {unseated.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  disabled={busy}
                  className={`${btn} bg-[var(--tr-surface-2)] text-[var(--tr-ink)]`}
                  onClick={() => onAssign(g.id)}
                  data-testid="act-assign"
                >
                  {g.name}
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** 전체화면 체크인 QR (§5.4c) — 5분 nonce 로테이션 + 인쇄용 정적 QR. */
function CheckinQrOverlay({
  roomId,
  token,
  onClose,
}: {
  roomId: string;
  token: string;
  onClose: () => void;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [staticUrl, setStaticUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ops/rooms/${roomId}/checkin`, {
        headers: { 'x-tour-room-token': token },
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.consoleUrl) {
        setErr(true);
        return { rotatesInSec: 300 };
      }
      const QRCode = (await import('qrcode')).default;
      setDataUrl(await QRCode.toDataURL(json.consoleUrl, { width: 320, margin: 1 }));
      setStaticUrl(json.staticUrl ?? null);
      return { rotatesInSec: json.rotatesInSec ?? 300 };
    } catch {
      setErr(true);
      return { rotatesInSec: 300 };
    }
  }, [roomId, token]);

  useEffect(() => {
    let timer: number | undefined;
    let alive = true;
    const cycle = async () => {
      const { rotatesInSec } = await load();
      if (!alive) return;
      timer = window.setTimeout(cycle, Math.max(30, rotatesInSec) * 1000);
    };
    void cycle();
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [load]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-white p-6 text-center" data-testid="checkin-qr-overlay">
      <p className="text-lg font-bold text-neutral-900">체크인 QR</p>
      <p className="mt-1 text-sm text-neutral-500">게스트가 카메라로 스캔하면 원탭 체크인됩니다.</p>
      <div className="mt-6 flex h-[320px] w-[320px] items-center justify-center">
        {err ? (
          <p className="text-sm text-neutral-500">QR을 불러오지 못했어요.</p>
        ) : dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="check-in QR" width={320} height={320} data-testid="qr-image" />
        ) : (
          <p className="text-sm text-neutral-400">불러오는 중…</p>
        )}
      </div>
      <div className="mt-6 flex gap-2">
        {staticUrl && (
          <a
            href={staticUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-neutral-100 px-4 py-2.5 text-sm font-bold text-neutral-900"
            data-testid="qr-print"
          >
            인쇄용 QR
          </a>
        )}
        <button type="button" onClick={onClose} className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white" data-testid="qr-close">
          닫기
        </button>
      </div>
    </div>
  );
}
