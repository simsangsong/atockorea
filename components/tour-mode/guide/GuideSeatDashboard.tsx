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
 * 노쇼만 마찰이 있다 (§5.4b D12 — 비대칭 마찰 원칙): [노쇼 처리]는 absent를
 * 바로 부르지 않고 증거 캡처 시트를 연다. 카메라 강제(capture="environment")
 * 현장 사진 + GPS 1회 취득(실패 시 사유 필수) + 촬영시각을 먼저 업로드하고,
 * 받은 evidenceId로만 absent를 호출한다. 업로드 실패 시 절대 넘어가지 않는다.
 *
 * 단일 소스 = ops_seat_assignments(useTourManifest). 변경은 응답 anchorRoomId로
 * 기존 /api/ops/rooms/[roomId]/{checkin,absent,seats,gate,no-show-evidence} 를
 * 호출한다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ChevronDown, ChevronUp, MapPin, Palette, Play, QrCode, RefreshCw, StickyNote, Users, X } from 'lucide-react';
import SeatMap from '@/components/ops/SeatMap';
import GuideGuestCard, { channelLabel, statusMeta } from '@/components/tour-mode/guide/GuideGuestCard';
import { hasNote, noteSummary, type GuestNote } from '@/lib/ops/seating/guestNotes';
import { useTourManifest, type ManifestAssignment } from '@/hooks/useTourManifest';
import { buildSeatStateMap } from '@/lib/ops/seating/logic';
import {
  buildRosterGroups,
  buildRosterRows,
  dashboardCounts,
  gateStatus,
  type RosterRow,
} from '@/lib/ops/seating/dashboard';
import {
  buildPickupGroupLegend,
  buildPickupSeatAccents,
} from '@/lib/ops/seating/pickupGroupColor';

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
  // D12 — [노쇼 처리] 탭이 여는 증거 캡처 시트의 대상 좌석.
  const [evidenceTarget, setEvidenceTarget] = useState<SeatTarget | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  // §5.4b 픽업그룹 색 오버레이 — 기본 OFF (상태색 단독 판독이 기본 뷰).
  const [pickupColors, setPickupColors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // §K B4 — 그룹 전체의 운영자 메모. 명단 행(아이콘)과 게스트 카드(전문)가
  // 같은 소스를 읽는다(B4-D4) — 두 곳에서 따로 부르면 반드시 어긋난다.
  const [guestNotes, setGuestNotes] = useState<Map<string, GuestNote>>(new Map());

  const bookings = data?.bookings ?? [];
  const assignments = data?.assignments ?? [];
  const vehicles = data?.vehicles ?? [];
  const anchorRoomId = data?.anchorRoomId ?? null;

  // 메모는 명단과 따로 로드한다 — 메모 테이블이 아직 없거나 조회가 실패해도
  // 명단은 그대로 떠야 한다(다른 ops_* 표면과 같은 graceful degrade).
  const loadNotes = useCallback(async () => {
    if (!anchorRoomId || !token) return;
    try {
      const res = await fetch(`/api/ops/rooms/${anchorRoomId}/notes?rt=${encodeURIComponent(token)}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const json = (await res.json()) as { notes?: GuestNote[] };
      setGuestNotes(new Map((json.notes ?? []).map((n) => [n.bookingId, n])));
    } catch {
      /* 메모 없이 명단이 뜬다 */
    }
  }, [anchorRoomId, token]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  const saveNote = useCallback(
    async (targetBookingId: string, text: string) => {
      if (!anchorRoomId || !token) return;
      // 낙관적 저장: 승차 중에 쓰는 물건이라 왕복을 기다리게 하지 않는다.
      // 실패하면 서버 상태로 되돌린다(사라진 것처럼 보이지 않게 loadNotes 재호출).
      const previous = guestNotes;
      const optimistic = new Map(previous);
      if (text.trim()) {
        optimistic.set(targetBookingId, {
          bookingId: targetBookingId,
          note: text.trim(),
          updatedByRole: 'guide',
          updatedByName: null,
          updatedAt: new Date().toISOString(),
        });
      } else {
        optimistic.delete(targetBookingId);
      }
      setGuestNotes(optimistic);
      try {
        const res = await fetch(`/api/ops/rooms/${anchorRoomId}/notes?rt=${encodeURIComponent(token)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId: targetBookingId, note: text }),
        });
        if (!res.ok) throw new Error('save_failed');
        await loadNotes();
      } catch {
        setGuestNotes(previous);
        setNote('메모 저장에 실패했습니다');
      }
    },
    [anchorRoomId, token, guestNotes, loadNotes],
  );

  const counts = useMemo(() => dashboardCounts(bookings, assignments), [bookings, assignments]);
  const groups = useMemo(() => buildRosterGroups(bookings, assignments), [bookings, assignments]);
  const rowByBooking = useMemo(
    () => new Map<string, RosterRow>(buildRosterRows(bookings, assignments).map((r) => [r.bookingId, r])),
    [bookings, assignments],
  );
  const gate = useMemo(() => gateStatus(assignments), [assignments]);
  // 색은 canonical 픽업 키에서 결정론적으로 파생 — 그룹이 늘거나 줄어도 불변.
  const pickupLegend = useMemo(() => buildPickupGroupLegend(groups.map((g) => g.group)), [groups]);
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
  const markAbsent = (t: SeatTarget, action: 'mark' | 'clear', evidenceId?: string) =>
    mutate('absent', {
      roomVehicleId: t.roomVehicleId,
      seatNumber: t.seatNumber,
      action,
      ...(evidenceId ? { evidenceId } : {}),
    });
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
  const accentsFor = (rows: ManifestAssignment[]) =>
    pickupColors ? buildPickupSeatAccents(pickupLegend, rows) : undefined;

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

      {/* segment (mobile only — sm+ shows both panels side by side) + actions */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex flex-1 gap-1 rounded-full bg-[var(--tr-surface-2)] p-1 sm:hidden">
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
        {/* §5.4b — 픽업 순서 운영 뷰: 좌석 테두리를 픽업그룹 색으로 칠한다. */}
        <button
          type="button"
          onClick={() => setPickupColors((v) => !v)}
          aria-pressed={pickupColors}
          className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-bold ${
            pickupColors
              ? 'bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)]'
              : 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]'
          }`}
          data-testid="pickup-colors-btn"
        >
          <Palette size={14} aria-hidden />
          픽업 색
        </button>
        <button
          type="button"
          onClick={() => setQrOpen(true)}
          disabled={!anchorRoomId}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[var(--tr-ink)] px-3 text-xs font-bold text-[var(--tr-canvas)] disabled:opacity-40"
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

      {/* 명단 · 좌석판 — 모바일은 세그먼트, 데스크톱(sm+)은 나란히 = 명단 행
          hover ↔ 좌석판 하이라이트 양방향(§5.4b). */}
      <div className="mt-3 sm:grid sm:grid-cols-2 sm:gap-4">
        {/* ── 명단 ── */}
        <div className={`space-y-2 ${seg === 'roster' ? '' : 'hidden'} sm:block`} data-testid="roster-view">
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
                                {/* B4 — 메모 아이콘 + 말줄임. 🔴 위 ⚠(손님이 선언한
                                    needs)와 다른 모양이어야 한다: 하나는 손님 말,
                                    하나는 운영자 말이다(B4-D1). */}
                                {hasNote(guestNotes.get(row.bookingId)?.note) && (
                                  <span
                                    className="inline-flex max-w-[9rem] items-center gap-1 rounded-full bg-[var(--tr-surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--tr-ink-2)]"
                                    data-testid="row-note"
                                  >
                                    <StickyNote size={9} aria-hidden />
                                    <span className="truncate">{noteSummary(guestNotes.get(row.bookingId)?.note)}</span>
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

        {/* ── 좌석판 ── */}
        <div className={`space-y-4 ${seg === 'seats' ? '' : 'hidden'} sm:block`} data-testid="seat-view">
          {/* 색 범례 — 색 단독 판독 금지(§5.4b): 번호 배지 + 픽업지 이름이 함께 온다. */}
          {pickupColors && pickupLegend.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" data-testid="pickup-legend">
              {pickupLegend.map((entry) => (
                <li
                  key={entry.key}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2.5 py-1"
                  data-testid="pickup-legend-item"
                  data-pickup-key={entry.key}
                  data-pickup-color={entry.color ?? ''}
                >
                  <span
                    aria-hidden
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 text-[9px] font-bold"
                    style={
                      entry.color
                        ? { borderColor: entry.color, color: entry.color }
                        : { borderColor: 'var(--tr-hairline)', color: 'var(--tr-ink-3)' }
                    }
                  >
                    {entry.index}
                  </span>
                  <span className="text-[11px] font-semibold text-[var(--tr-ink-2)]">
                    {entry.firstPickupTime ? `${entry.firstPickupTime} · ` : ''}
                    {entry.displayName}
                    {entry.color ? '' : ' (색 없음)'}
                  </span>
                  <span className="text-[11px] text-[var(--tr-ink-3)] tabular-nums">{entry.paxCount}명</span>
                </li>
              ))}
            </ul>
          )}
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
                    seatAccents={accentsFor(seatVehicleFor(v.roomVehicleId))}
                    onSeatTap={(n) => onSeatTap(v.roomVehicleId, n)}
                    ariaLabel="좌석판"
                  />
                </div>
              </div>
            ) : null,
          )}
        </div>
      </div>

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
            <GuideGuestCard
              row={cardRow}
              onClose={() => setCardBookingId(null)}
              note={guestNotes.get(cardRow.bookingId) ?? null}
              onSaveNote={saveNote}
            />
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
          onAbsent={(action) => {
            // 노쇼 마킹은 증거를 먼저 받는다 (D12). 취소는 무마찰 그대로.
            if (action === 'mark') {
              setEvidenceTarget(seatTarget);
              setSeatTarget(null);
              return;
            }
            void markAbsent(seatTarget, 'clear').then(() => setSeatTarget(null));
          }}
          onAssign={(bid) => void assignSeat(seatTarget, bid).then(() => setSeatTarget(null))}
        />
      )}

      {/* 노쇼 증거 캡처 시트 (§5.4b D12) — 사진·GPS·타임스탬프 없이는 닫히지 않는다 */}
      {evidenceTarget && anchorRoomId && (
        <NoShowEvidenceSheet
          target={evidenceTarget}
          roomId={anchorRoomId}
          token={token}
          onClose={() => setEvidenceTarget(null)}
          onRecorded={(evidenceId) => {
            const t = evidenceTarget;
            setEvidenceTarget(null);
            void markAbsent(t, 'mark', evidenceId);
          }}
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

type GpsState =
  | { kind: 'pending' }
  | { kind: 'ok'; latitude: number; longitude: number; accuracyM: number | null }
  | { kind: 'failed'; reason: string };

const GPS_TIMEOUT_MS = 8000;

/**
 * 노쇼 증거 캡처 시트 (§5.4b D12).
 *
 * 카메라 강제(capture="environment") 현장 사진은 필수. GPS는 시트가 열리자마자
 * 1회 취득하고, 거부/실패하면 사유 입력이 필수로 열린다 — "GPS 없음"도 기록된
 * 사실이지 우회로가 아니다. 업로드가 200으로 끝나야만 onRecorded가 불리고
 * 그때 비로소 absent가 호출된다.
 */
function NoShowEvidenceSheet({
  target,
  roomId,
  token,
  onClose,
  onRecorded,
}: {
  target: SeatTarget;
  roomId: string;
  token: string;
  onClose: () => void;
  onRecorded: (evidenceId: string) => void;
}) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [gps, setGps] = useState<GpsState>({ kind: 'pending' });
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let alive = true;
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
    if (!geo) {
      setGps({ kind: 'failed', reason: '이 기기에서 위치를 쓸 수 없어요' });
      return () => {
        alive = false;
      };
    }
    geo.getCurrentPosition(
      (pos) => {
        if (!alive) return;
        setGps({
          kind: 'ok',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyM: Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null,
        });
      },
      () => {
        if (!alive) return;
        setGps({ kind: 'failed', reason: '위치를 받지 못했어요' });
      },
      { enableHighAccuracy: true, timeout: GPS_TIMEOUT_MS, maximumAge: 0 },
    );
    return () => {
      alive = false;
    };
  }, []);

  const needsReason = gps.kind === 'failed';
  const canSubmit = Boolean(photo) && (gps.kind === 'ok' || reason.trim().length > 0) && !submitting;

  const submit = async () => {
    if (!photo || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('photo', photo);
      form.append('roomVehicleId', target.roomVehicleId);
      form.append('seatNumber', String(target.seatNumber));
      form.append('capturedAt', new Date().toISOString());
      if (gps.kind === 'ok') {
        form.append('latitude', String(gps.latitude));
        form.append('longitude', String(gps.longitude));
        if (gps.accuracyM !== null) form.append('accuracyM', String(gps.accuracyM));
      } else {
        form.append('gpsUnavailableReason', reason.trim());
      }
      if (note.trim()) form.append('note', note.trim());

      // Content-Type은 절대 직접 넣지 않는다 (boundary는 브라우저가 붙인다).
      const res = await fetch(`/api/ops/rooms/${roomId}/no-show-evidence`, {
        method: 'POST',
        headers: { 'x-tour-room-token': token },
        body: form,
      });
      const json = (await res.json().catch(() => ({}))) as { evidenceId?: string; message?: string; error?: string };
      if (!res.ok || !json.evidenceId) {
        setError(json.message || json.error || '증거를 저장하지 못했어요. 다시 시도해 주세요.');
        return;
      }
      onRecorded(json.evidenceId);
    } catch {
      setError('네트워크 오류로 증거를 저장하지 못했어요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center sm:items-center" data-testid="no-show-evidence-sheet">
      <button type="button" aria-label="닫기" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 max-h-[88dvh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-[var(--tr-surface)] p-4 sm:rounded-2xl">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-sm font-bold text-[var(--tr-ink)]">{target.seatNumber}번 좌석 노쇼 증거</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-11 w-11 items-center justify-center text-[var(--tr-ink-3)]"
            data-testid="evidence-cancel"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <p className="mb-3 text-xs text-[var(--tr-ink-3)]">
          픽업지 현장 사진과 위치·시각을 남겨야 노쇼로 처리돼요. (OTA 분쟁 대응 자료)
        </p>

        {/* 1. 카메라 강제 — accept=image/* + capture=environment */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          data-testid="evidence-photo-input"
          onChange={(e) => {
            setPhoto(e.target.files?.[0] ?? null);
            setError(null);
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex min-h-[52px] w-full items-center gap-2 rounded-xl border border-dashed border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] px-4 py-3 text-left text-sm font-bold text-[var(--tr-ink)]"
          data-testid="evidence-photo-btn"
        >
          <Camera size={18} className="shrink-0 text-[var(--tr-ink-2)]" aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            {photo ? photo.name : '현장 사진 촬영 (필수)'}
          </span>
          {photo && <span className="shrink-0 text-xs font-semibold text-[var(--tr-safe)]">준비됨</span>}
        </button>

        {/* 2. GPS — 성공하면 좌표, 실패하면 사유 필수 */}
        <div className="mt-2 flex items-start gap-2 rounded-xl bg-[var(--tr-surface-2)] px-3 py-2.5" data-testid="evidence-gps">
          <MapPin size={15} className="mt-0.5 shrink-0 text-[var(--tr-ink-2)]" aria-hidden />
          <p className="text-xs text-[var(--tr-ink-2)] tabular-nums">
            {gps.kind === 'pending' && '위치 확인 중…'}
            {gps.kind === 'ok' &&
              `${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}${gps.accuracyM !== null ? ` (±${gps.accuracyM}m)` : ''}`}
            {gps.kind === 'failed' && `${gps.reason} — 사유를 적어주세요`}
          </p>
        </div>
        {needsReason && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="예: 실내 주차장이라 GPS 미수신"
            className="mt-2 w-full rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-2.5 text-sm text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)]"
            data-testid="evidence-gps-reason"
          />
        )}

        {/* 3. 선택 메모 */}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="메모 (선택) — 예: 10분 대기 후 출발"
          className="mt-2 w-full rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-2.5 text-sm text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)]"
          data-testid="evidence-note"
        />

        {error && (
          <p className="mt-2 rounded-xl bg-[var(--tr-danger-soft)] px-3 py-2 text-xs font-medium text-[var(--tr-danger)]" data-testid="evidence-error">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => void submit()}
          className="mt-3 min-h-[48px] w-full rounded-xl bg-[var(--tr-danger)] px-4 py-3 text-sm font-bold text-white disabled:bg-[var(--tr-surface-2)] disabled:text-[var(--tr-ink-3)]"
          data-testid="evidence-submit"
        >
          {submitting ? '증거 저장 중…' : '증거 저장 후 노쇼 처리'}
        </button>
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
