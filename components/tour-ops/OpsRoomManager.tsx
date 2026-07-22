'use client';

/**
 * 룸 · 링크 관리 — full-screen sheet over the ops hub.
 *
 * Ops Freedom rev (사용자 요청 2026-07-18):
 *   · date navigation (◀ ▶ + date input) — any day, not just the monitoring day;
 *   · [+ 예약 만들기] — manual entry for OTA (GYG/Viator/Klook), direct sales
 *     and TEST rooms; a real bookings row, so every downstream machine
 *     (rooms, links, D-1 dispatch, driver console) works unchanged;
 *   · per-booking links now include 기사(driver) alongside 손님/가이드, and the
 *     customer QR overlay offers the /plan (일정 만들기) link too;
 *   · light/dark theme toggle, LIGHT by default (persisted).
 *
 * Existing controls kept verbatim: 초대 메일(revoke-and-replace dispatch),
 * mint-and-copy links with QR, 룸 닫기/재개.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Loader2, Mail, Moon, Plus, QrCode, RefreshCw, Sun, X } from 'lucide-react';
import { getOpsToken } from '@/components/tour-ops/opsShared';
import { useOpsTheme } from '@/components/tour-ops/opsTheme';
import { useConfirmSheet } from '@/components/tour-mode/ConfirmSheet';

interface ManagedBooking {
  id: string;
  tour_id: string | null;
  tour_time: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  number_of_guests: number | null;
  preferred_language: string | null;
  status: string;
  source?: string | null;
  tour: { id?: string; title: string; city?: string | null } | null;
  room: { id: string; status: string } | null;
  invite: {
    customer_active: boolean;
    customer_last: { sent_via: string | null; created_at: string; revoked: boolean } | null;
    guide_active: boolean;
    guide_last: { sent_via: string | null; created_at: string; revoked: boolean } | null;
  };
}

interface MintedLink {
  url: string;
  qr_data_url: string | null;
}

type LinkRole = 'customer' | 'guide' | 'driver';

const CHANNEL_BADGES: Record<string, { label: string; cls: string }> = {
  gyg: { label: 'GYG', cls: 'bg-orange-500/15 text-orange-500' },
  viator: { label: 'Viator', cls: 'bg-teal-500/15 text-teal-600' },
  klook: { label: 'Klook', cls: 'bg-rose-500/15 text-rose-500' },
  direct: { label: '직접', cls: 'bg-blue-500/15 text-blue-500' },
  test: { label: 'TEST', cls: 'bg-slate-500/20 text-slate-500' },
  other: { label: '기타', cls: 'bg-slate-500/20 text-slate-500' },
};

/**
 * W1.2 — tr-* token palette. Chrome roles resolve via the ops shell's
 * `.tr-root` + `.dark`/light ancestor (OpsRoomManager renders inside OpsApp),
 * so no per-theme branch is needed. Semantic badges keep both hues via `dark:`
 * variants (light default matches the old .ops-light values → shade-neutral).
 */
function palette() {
  return {
    root: 'bg-[var(--tr-canvas)] text-[var(--tr-ink)]',
    headerBorder: 'border-[var(--tr-hairline)]',
    sub: 'text-[var(--tr-ink-3)]',
    iconBtn: 'text-[var(--tr-ink-2)] active:bg-[var(--tr-surface-2)]',
    card: 'border-[var(--tr-hairline)] bg-[var(--tr-surface)]',
    groupTitle: 'text-[var(--tr-ink-2)]',
    groupCount: 'text-[var(--tr-ink-3)]',
    nameMeta: 'text-[var(--tr-ink-3)]',
    secondaryBtn: 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]',
    linkWrap: 'bg-[var(--tr-surface-2)]',
    linkText: 'text-[var(--tr-ink-2)]',
    linkDivider: 'border-[var(--tr-hairline)]',
    qrIdle: 'text-[var(--tr-ink-3)]',
    badgeNoRoom: 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]',
    badgeClosed: 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-3)]',
    badgeActive: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    badgeCustomer: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    badgeGuide: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    input:
      'border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)]',
    sheet: 'bg-[var(--tr-surface)] text-[var(--tr-ink)]',
    label: 'text-[var(--tr-ink-2)]',
  };
}

async function authedFetch(input: string, init?: RequestInit): Promise<Response> {
  const token = await getOpsToken();
  return fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
    cache: 'no-store',
  });
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function shiftDate(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

export default function OpsRoomManager({
  date,
  onClose,
  onOpenRoom,
  onRoomsChanged,
}: {
  date: string;
  onClose: () => void;
  onOpenRoom: (roomId: string) => void;
  onRoomsChanged: () => void;
}) {
  const [viewDate, setViewDate] = useState(date);
  // Shared with the whole 관제센터 (OpsApp shell) — one switch everywhere.
  const [theme, toggleTheme] = useOpsTheme();
  const [bookings, setBookings] = useState<ManagedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // `${bookingId}:${action}`
  const [links, setLinks] = useState<Record<string, MintedLink>>({}); // `${bookingId}:${role}`
  const [qrOpen, setQrOpen] = useState<{ title: string; link: MintedLink; role: LinkRole } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  // M1 — in-app confirm (window.confirm is banned on tour surfaces, M-D6).
  const { confirm: confirmSheet, sheet: confirmSheetEl } = useConfirmSheet({ confirm: '발송', cancel: '취소' });

  const T = palette();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch(`/api/admin/tour-ops/bookings?date=${viewDate}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '불러오기 실패');
      setBookings(json.bookings as ManagedBooking[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [viewDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const mintLink = useCallback(
    async (booking: ManagedBooking, role: LinkRole) => {
      const key = `${booking.id}:${role}`;
      setBusy(key);
      try {
        const res = await authedFetch('/api/admin/tour-ops/links', {
          method: 'POST',
          body: JSON.stringify({ bookingId: booking.id, role }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '링크 발급 실패');
        const link: MintedLink = { url: json.url, qr_data_url: json.qr_data_url ?? null };
        setLinks((prev) => ({ ...prev, [key]: link }));
        const copied = await copyText(link.url);
        const roleLabel = role === 'customer' ? '손님' : role === 'guide' ? '운영자' : '별도 기사';
        toast.success(copied ? `${roleLabel} 링크를 복사했습니다` : '링크 발급됨 — QR 버튼으로 확인하세요');
        onRoomsChanged();
        void load();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '링크 발급 실패');
      } finally {
        setBusy(null);
      }
    },
    [load, onRoomsChanged],
  );

  const dispatchInvites = useCallback(
    async (booking: ManagedBooking) => {
      const target = booking.contact_email ?? '이메일 없음';
      const ok = await confirmSheet({
        title: '초대 메일 발송',
        message: `초대 메일을 발송할까요?\n손님: ${target}\n(기존 발송 링크는 회수되고 새 링크로 교체됩니다)`,
      });
      if (!ok) return;
      const key = `${booking.id}:dispatch`;
      setBusy(key);
      try {
        const res = await authedFetch(`/api/admin/orders/${booking.id}/dispatch-room`, {
          method: 'POST',
          body: JSON.stringify({ force: true }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '발송 실패');
        const parts: string[] = [];
        parts.push(json.customer?.sent ? '손님 메일 발송됨' : `손님 실패: ${json.customer?.error ?? '?'}`);
        parts.push(json.guide?.sent ? '가이드 메일 발송됨' : `가이드: ${json.guide?.error ?? '건너뜀'}`);
        toast.success(parts.join(' · '));
        onRoomsChanged();
        void load();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '발송 실패');
      } finally {
        setBusy(null);
      }
    },
    [load, onRoomsChanged, confirmSheet],
  );

  const setRoomStatus = useCallback(
    async (booking: ManagedBooking, status: 'active' | 'closed') => {
      if (!booking.room) return;
      const key = `${booking.id}:status`;
      setBusy(key);
      try {
        const res = await authedFetch(`/api/admin/tour-ops/rooms/${booking.room.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '변경 실패');
        toast.success(status === 'closed' ? '룸을 닫았습니다' : '룸을 다시 열었습니다');
        onRoomsChanged();
        void load();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '변경 실패');
      } finally {
        setBusy(null);
      }
    },
    [load, onRoomsChanged],
  );

  // Group by tour title for scanability on a busy day.
  const groups = new Map<string, ManagedBooking[]>();
  for (const booking of bookings) {
    const title = booking.tour?.title ?? '기타';
    groups.set(title, [...(groups.get(title) ?? []), booking]);
  }

  return (
    <div
      /* Self-sufficient tr-* scope: `.tr-root` provides the vars and `.dark`
         drives the dark palette + semantic `dark:` badges (the shell already
         nests these, but this fixed overlay stays correct if rendered alone). */
      className={`tr-root fixed inset-0 z-50 flex flex-col ${theme === 'dark' ? 'dark' : ''} ${T.root}`}
      data-testid="ops-room-manager"
    >
      <header
        className={`border-b px-4 ${T.headerBorder}`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="mx-auto flex min-h-[52px] w-full max-w-3xl items-center justify-between">
        <div>
          <h2 className="text-[15px] font-bold">룸 · 링크 관리</h2>
          <p className={`text-[11px] ${T.sub}`}>{viewDate} · 예약 {bookings.length}건</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? '라이트 모드' : '다크 모드'}
            className={`flex size-10 items-center justify-center rounded-lg ${T.iconBtn}`}
            data-testid="theme-toggle"
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            aria-label="새로고침"
            className={`flex size-10 items-center justify-center rounded-lg ${T.iconBtn}`}
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className={`flex size-10 items-center justify-center rounded-lg ${T.iconBtn}`}
          >
            <X className="size-5" />
          </button>
        </div>
        </div>
      </header>

      {/* date navigation + create — always visible, empty day included.
          The date input is deliberately COMPACT (not flex-1): a full-width
          native date input turned the whole bar into a calendar trigger on
          desktop (2026-07-18 report). */}
      <div className={`border-b px-4 py-2.5 ${T.headerBorder}`}>
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2">
        <button
          type="button"
          onClick={() => setViewDate((d) => shiftDate(d, -1))}
          aria-label="이전 날짜"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[15px] font-bold ${T.secondaryBtn}`}
        >
          ◀
        </button>
        <input
          type="date"
          value={viewDate}
          onChange={(e) => e.target.value && setViewDate(e.target.value)}
          className={`h-9 w-40 shrink-0 rounded-lg border px-2 text-center text-[13px] font-semibold ${T.input}`}
          data-testid="date-input"
        />
        <button
          type="button"
          onClick={() => setViewDate((d) => shiftDate(d, 1))}
          aria-label="다음 날짜"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[15px] font-bold ${T.secondaryBtn}`}
        >
          ▶
        </button>
        <div className="min-w-0 flex-1" />
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex h-9 shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-3 text-[12px] font-bold text-white"
          data-testid="manual-booking-open"
        >
          <Plus className="size-4" /> 예약 만들기
        </button>
      </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 pb-8">
      <div className="mx-auto w-full max-w-3xl">
        {loading && bookings.length === 0 ? (
          <p className={`mt-16 text-center text-[13px] ${T.sub}`}>불러오는 중…</p>
        ) : bookings.length === 0 ? (
          <div className="mt-16 text-center">
            <p className={`text-[13px] ${T.sub}`}>{viewDate}에 예약이 없습니다.</p>
            <p className={`mt-1 text-[12px] ${T.sub}`}>
              OTA(GYG·Viator·Klook)·전화 예약·테스트 룸은 직접 등록할 수 있어요.
            </p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-4 inline-flex h-11 items-center gap-1.5 rounded-xl bg-blue-600 px-5 text-[13px] font-bold text-white"
              data-testid="manual-booking-open-empty"
            >
              <Plus className="size-4" /> OTA · 테스트 예약 만들기
            </button>
          </div>
        ) : (
          [...groups.entries()].map(([title, rows]) => (
            <section key={title} className="mb-4">
              <h3 className={`mb-1.5 px-1 text-[12px] font-semibold ${T.groupTitle}`}>
                {title} <span className={`font-normal ${T.groupCount}`}>· {rows.length}팀</span>
              </h3>
              <div className="space-y-2">
                {rows.map((booking) => {
                  const room = booking.room;
                  const customerLink = links[`${booking.id}:customer`];
                  const guideLink = links[`${booking.id}:guide`];
                  const driverLink = links[`${booking.id}:driver`];
                  const channel = booking.source ? CHANNEL_BADGES[booking.source] : null;
                  return (
                    <div key={booking.id} className={`rounded-2xl border p-3 ${T.card}`}>
                      <button
                        type="button"
                        onClick={() => room && onOpenRoom(room.id)}
                        disabled={!room}
                        className="flex w-full items-start justify-between gap-2 text-left disabled:cursor-default"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold">
                            {booking.contact_name ?? '게스트'}
                            <span className={`ml-1.5 text-[12px] font-normal ${T.nameMeta}`}>
                              {booking.number_of_guests ?? 1}명 · {booking.preferred_language ?? 'en'}
                              {booking.tour_time ? ` · ${booking.tour_time.slice(0, 5)}` : ''}
                            </span>
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-1">
                            {channel && (
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${channel.cls}`}>
                                {channel.label}
                              </span>
                            )}
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                !room ? T.badgeNoRoom : room.status === 'closed' ? T.badgeClosed : T.badgeActive
                              }`}
                            >
                              {!room ? '룸 없음' : room.status === 'closed' ? '룸 닫힘' : '룸 활성'}
                            </span>
                            {booking.invite.customer_active && (
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${T.badgeCustomer}`}>
                                손님 링크 발급됨
                              </span>
                            )}
                            {booking.invite.guide_active && (
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${T.badgeGuide}`}>
                                운영자 링크 발급됨
                              </span>
                            )}
                          </p>
                        </div>
                        {room && <span className={`shrink-0 text-[11px] ${T.sub}`}>룸 열기 →</span>}
                      </button>

                      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => void dispatchInvites(booking)}
                          disabled={busy === `${booking.id}:dispatch`}
                          className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-[12px] font-semibold text-white disabled:opacity-50"
                        >
                          {busy === `${booking.id}:dispatch` ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Mail className="size-4" />
                          )}
                          초대 메일 발송
                        </button>
                        {room ? (
                          <button
                            type="button"
                            onClick={() => void setRoomStatus(booking, room.status === 'closed' ? 'active' : 'closed')}
                            disabled={busy === `${booking.id}:status`}
                            className={`flex h-10 items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold disabled:opacity-50 ${T.secondaryBtn}`}
                          >
                            {room.status === 'closed' ? '룸 재개' : '룸 닫기'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void mintLink(booking, 'customer')}
                            disabled={busy === `${booking.id}:customer`}
                            className={`flex h-10 items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold disabled:opacity-50 ${T.secondaryBtn}`}
                          >
                            룸 만들기 + 링크
                          </button>
                        )}
                        <LinkAction
                          label="손님 링크"
                          minted={customerLink}
                          busy={busy === `${booking.id}:customer`}
                          onMint={() => void mintLink(booking, 'customer')}
                          onQr={() =>
                            customerLink &&
                            setQrOpen({
                              title: `${booking.contact_name ?? '손님'} — 손님 링크`,
                              link: customerLink,
                              role: 'customer',
                            })
                          }
                          T={T}
                        />
                        <LinkAction
                          label="운영자 링크 (가이드·운전)"
                          minted={guideLink}
                          busy={busy === `${booking.id}:guide`}
                          onMint={() => void mintLink(booking, 'guide')}
                          onQr={() => guideLink && setQrOpen({ title: `${title} — 운영자 링크`, link: guideLink, role: 'guide' })}
                          T={T}
                        />
                        <LinkAction
                          label="별도 기사 (PIN)"
                          minted={driverLink}
                          busy={busy === `${booking.id}:driver`}
                          onMint={() => void mintLink(booking, 'driver')}
                          onQr={() => driverLink && setQrOpen({ title: `${title} — 별도 기사 링크`, link: driverLink, role: 'driver' })}
                          T={T}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
      </div>

      {qrOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6"
          onClick={() => setQrOpen(null)}
        >
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-[13px] font-semibold text-slate-900">{qrOpen.title}</p>
            {qrOpen.link.qr_data_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL QR, next/image gains nothing
              <img src={qrOpen.link.qr_data_url} alt="QR 코드" className="mx-auto mt-3 w-full max-w-[240px]" />
            ) : (
              <p className="mt-3 text-[12px] text-slate-500">QR 생성 실패 — 링크를 복사해 전달하세요.</p>
            )}
            <button
              type="button"
              onClick={() => {
                void copyText(qrOpen.link.url).then((ok) =>
                  ok ? toast.success('링크를 복사했습니다') : toast.error('복사 실패'),
                );
              }}
              className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 text-[13px] font-semibold text-white"
            >
              <Copy className="size-4" /> 링크 복사
            </button>
            {qrOpen.role === 'customer' && (
              <button
                type="button"
                onClick={() => {
                  void copyText(qrOpen.link.url.replace('/tour-mode/room/', '/tour-mode/plan/')).then((ok) =>
                    ok ? toast.success('일정(/plan) 링크를 복사했습니다') : toast.error('복사 실패'),
                  );
                }}
                className="mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-amber-500 text-[13px] font-semibold text-white"
              >
                <Copy className="size-4" /> 일정 만들기 링크 복사
              </button>
            )}
            <button
              type="button"
              onClick={() => setQrOpen(null)}
              className="mt-2 h-9 w-full rounded-xl text-[13px] font-medium text-slate-500"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {createOpen && (
        <ManualBookingSheet
          defaultDate={viewDate}
          T={T}
          onClose={() => setCreateOpen(false)}
          onCreated={(createdDate) => {
            setCreateOpen(false);
            setViewDate(createdDate);
            onRoomsChanged();
            void load();
          }}
        />
      )}
      {confirmSheetEl}
    </div>
  );
}

function LinkAction({
  label,
  minted,
  busy,
  onMint,
  onQr,
  T,
}: {
  label: string;
  minted: MintedLink | undefined;
  busy: boolean;
  onMint: () => void;
  onQr: () => void;
  T: ReturnType<typeof palette>;
}) {
  return (
    <div className={`flex h-10 items-stretch overflow-hidden rounded-xl ${T.linkWrap}`}>
      <button
        type="button"
        onClick={onMint}
        disabled={busy}
        className={`flex flex-1 items-center justify-center gap-1.5 text-[12px] font-semibold disabled:opacity-50 ${T.linkText}`}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-3.5" />}
        {label}
      </button>
      <button
        type="button"
        onClick={minted ? onQr : onMint}
        disabled={busy}
        aria-label={`${label} QR`}
        className={`flex w-10 items-center justify-center border-l disabled:opacity-50 ${T.linkDivider} ${
          minted ? 'text-emerald-500' : T.qrIdle
        }`}
      >
        <QrCode className="size-4" />
      </button>
    </div>
  );
}

const CHANNEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'gyg', label: 'GetYourGuide' },
  { value: 'viator', label: 'Viator' },
  { value: 'klook', label: 'Klook' },
  { value: 'direct', label: '직접 판매 (전화·카톡)' },
  { value: 'test', label: '테스트' },
  { value: 'other', label: '기타' },
];

const LANGUAGE_OPTIONS = ['en', 'ko', 'ja', 'zh', 'es', 'fr', 'de', 'it'];

function ManualBookingSheet({
  defaultDate,
  T,
  onClose,
  onCreated,
}: {
  defaultDate: string;
  T: ReturnType<typeof palette>;
  onClose: () => void;
  onCreated: (tourDate: string) => void;
}) {
  const [tours, setTours] = useState<Array<{ id: string; title: string; city: string | null }>>([]);
  const [tourId, setTourId] = useState('');
  const [tourDate, setTourDate] = useState(defaultDate);
  const [tourTime, setTourTime] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [guests, setGuests] = useState('2');
  const [language, setLanguage] = useState('en');
  const [channel, setChannel] = useState('gyg');
  const [externalRef, setExternalRef] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await authedFetch('/api/admin/tour-ops/manual-booking');
        const json = await res.json();
        if (res.ok && Array.isArray(json.tours)) {
          setTours(json.tours);
          if (json.tours.length > 0) setTourId((prev) => prev || json.tours[0].id);
        }
      } catch {
        toast.error('투어 목록을 불러오지 못했습니다');
      }
    })();
  }, []);

  const submit = async () => {
    if (!tourId || !tourDate || !contactName.trim()) {
      toast.error('투어, 날짜, 고객명을 입력해 주세요');
      return;
    }
    setSaving(true);
    try {
      const res = await authedFetch('/api/admin/tour-ops/manual-booking', {
        method: 'POST',
        body: JSON.stringify({
          tourId,
          tourDate,
          tourTime: tourTime || undefined,
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          numberOfGuests: Number(guests) || 1,
          preferredLanguage: language,
          channel,
          externalRef: externalRef.trim() || undefined,
          totalPrice: totalPrice ? Number(totalPrice.replace(/[^0-9]/g, '')) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '생성 실패');
      toast.success('예약을 등록했습니다 — 이제 링크 발급·메일 발송이 가능해요');
      onCreated(tourDate);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '생성 실패');
    } finally {
      setSaving(false);
    }
  };

  const field = `h-11 w-full rounded-xl border px-3 text-[14px] ${T.input}`;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className={`max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl p-5 pb-8 ${T.sheet}`}
        onClick={(e) => e.stopPropagation()}
        data-testid="manual-booking-sheet"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-bold">수동 예약 등록</h3>
          <button type="button" onClick={onClose} aria-label="닫기" className={`rounded-lg p-2 ${T.iconBtn}`}>
            <X className="size-5" />
          </button>
        </div>
        <p className={`mt-0.5 text-[12px] ${T.label}`}>
          OTA·전화 예약·테스트용 — 등록 즉시 룸/링크/일정/기사 콘솔이 전부 작동합니다. 결제는 청구되지 않아요.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className={`mb-1 block text-[12px] font-semibold ${T.label}`}>채널</label>
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className={field}>
              {CHANNEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`mb-1 block text-[12px] font-semibold ${T.label}`}>투어 *</label>
            <select value={tourId} onChange={(e) => setTourId(e.target.value)} className={field} data-testid="mb-tour">
              {tours.length === 0 && <option value="">불러오는 중…</option>}
              {tours.map((tour) => (
                <option key={tour.id} value={tour.id}>
                  {tour.city ? `[${tour.city}] ` : ''}{tour.title}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`mb-1 block text-[12px] font-semibold ${T.label}`}>투어일 *</label>
              <input type="date" value={tourDate} onChange={(e) => setTourDate(e.target.value)} className={field} data-testid="mb-date" />
            </div>
            <div>
              <label className={`mb-1 block text-[12px] font-semibold ${T.label}`}>시작 시간</label>
              <input type="time" value={tourTime} onChange={(e) => setTourTime(e.target.value)} className={field} />
            </div>
          </div>
          <div>
            <label className={`mb-1 block text-[12px] font-semibold ${T.label}`}>고객명 *</label>
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="예: Caroline Anne" className={field} data-testid="mb-name" />
          </div>
          <div>
            <label className={`mb-1 block text-[12px] font-semibold ${T.label}`}>이메일 (초대 메일 수신 — OTA 릴레이 주소 OK)</label>
            <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="customer-xxx@reply.getyourguide.com" className={field} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`mb-1 block text-[12px] font-semibold ${T.label}`}>전화</label>
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+33..." className={field} />
            </div>
            <div>
              <label className={`mb-1 block text-[12px] font-semibold ${T.label}`}>인원</label>
              <input type="number" min={1} max={40} value={guests} onChange={(e) => setGuests(e.target.value)} className={field} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`mb-1 block text-[12px] font-semibold ${T.label}`}>손님 언어</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className={field}>
                {LANGUAGE_OPTIONS.map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={`mb-1 block text-[12px] font-semibold ${T.label}`}>금액 (참고용, ₩)</label>
              <input inputMode="numeric" value={totalPrice} onChange={(e) => setTotalPrice(e.target.value)} placeholder="97000" className={field} />
            </div>
          </div>
          <div>
            <label className={`mb-1 block text-[12px] font-semibold ${T.label}`}>외부 예약번호 (GYG ref 등)</label>
            <input value={externalRef} onChange={(e) => setExternalRef(e.target.value)} placeholder="GYGBLHK75KZ3" className={field} />
          </div>
        </div>

        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-[15px] font-bold text-white disabled:opacity-50"
          data-testid="mb-submit"
        >
          {saving ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
          예약 등록
        </button>
      </div>
    </div>
  );
}
