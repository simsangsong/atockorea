'use client';

/**
 * 룸 · 링크 관리 — full-screen sheet over the ops hub.
 *
 * Lists every non-cancelled booking for the monitoring date (rooms that don't
 * exist yet included — /rooms can't show those) and gives per-booking one-tap
 * controls:
 *   · 초대 메일 — the existing revoke-and-replace dispatch (customer + guide);
 *   · 손님/가이드 링크 — mint-and-copy via /tour-ops/links (no email, no
 *     revocation of previously sent links) with a QR overlay for scanning
 *     straight off the ops phone;
 *   · 룸 닫기/재개 — manual lifecycle override.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Loader2, Mail, QrCode, RefreshCw, X } from 'lucide-react';
import { getOpsToken } from '@/components/tour-ops/opsShared';

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
  const [bookings, setBookings] = useState<ManagedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // `${bookingId}:${action}`
  const [links, setLinks] = useState<Record<string, MintedLink>>({}); // `${bookingId}:${role}`
  const [qrOpen, setQrOpen] = useState<{ title: string; link: MintedLink } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch(`/api/admin/tour-ops/bookings?date=${date}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '불러오기 실패');
      setBookings(json.bookings as ManagedBooking[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const mintLink = useCallback(
    async (booking: ManagedBooking, role: 'customer' | 'guide') => {
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
        toast.success(
          copied
            ? `${role === 'customer' ? '손님' : '가이드'} 링크를 복사했습니다`
            : '링크 발급됨 — QR 버튼으로 확인하세요',
        );
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
      if (!window.confirm(`초대 메일을 발송할까요?\n손님: ${target}\n(기존 발송 링크는 회수되고 새 링크로 교체됩니다)`)) return;
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
    [load, onRoomsChanged],
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
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100" data-testid="ops-room-manager">
      <header
        className="flex min-h-[52px] items-center justify-between border-b border-white/10 px-4"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div>
          <h2 className="text-[15px] font-bold">룸 · 링크 관리</h2>
          <p className="text-[11px] text-slate-500">{date} · 예약 {bookings.length}건</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void load()}
            aria-label="새로고침"
            className="flex size-10 items-center justify-center rounded-lg text-slate-400 active:bg-white/10"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex size-10 items-center justify-center rounded-lg text-slate-400 active:bg-white/10"
          >
            <X className="size-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3 pb-8">
        {loading && bookings.length === 0 ? (
          <p className="mt-16 text-center text-[13px] text-slate-500">불러오는 중…</p>
        ) : bookings.length === 0 ? (
          <p className="mt-16 text-center text-[13px] text-slate-500">{date}에 예약이 없습니다.</p>
        ) : (
          [...groups.entries()].map(([title, rows]) => (
            <section key={title} className="mb-4">
              <h3 className="mb-1.5 px-1 text-[12px] font-semibold text-slate-400">
                {title} <span className="font-normal text-slate-600">· {rows.length}팀</span>
              </h3>
              <div className="space-y-2">
                {rows.map((booking) => {
                  const room = booking.room;
                  const customerLink = links[`${booking.id}:customer`];
                  const guideLink = links[`${booking.id}:guide`];
                  return (
                    <div key={booking.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <button
                        type="button"
                        onClick={() => room && onOpenRoom(room.id)}
                        disabled={!room}
                        className="flex w-full items-start justify-between gap-2 text-left disabled:cursor-default"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold">
                            {booking.contact_name ?? '게스트'}
                            <span className="ml-1.5 text-[12px] font-normal text-slate-500">
                              {booking.number_of_guests ?? 1}명 · {booking.preferred_language ?? 'en'}
                              {booking.tour_time ? ` · ${booking.tour_time.slice(0, 5)}` : ''}
                            </span>
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-1">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                !room
                                  ? 'bg-white/10 text-slate-400'
                                  : room.status === 'closed'
                                    ? 'bg-slate-500/20 text-slate-400'
                                    : 'bg-emerald-500/15 text-emerald-300'
                              }`}
                            >
                              {!room ? '룸 없음' : room.status === 'closed' ? '룸 닫힘' : '룸 활성'}
                            </span>
                            {booking.invite.customer_active && (
                              <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-300">
                                손님 링크 발급됨
                              </span>
                            )}
                            {booking.invite.guide_active && (
                              <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-300">
                                가이드 링크 발급됨
                              </span>
                            )}
                          </p>
                        </div>
                        {room && <span className="shrink-0 text-[11px] text-slate-500">룸 열기 →</span>}
                      </button>

                      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => void dispatchInvites(booking)}
                          disabled={busy === `${booking.id}:dispatch`}
                          className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-blue-500/90 text-[12px] font-semibold text-white disabled:opacity-50"
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
                            className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-white/10 text-[12px] font-semibold text-slate-200 disabled:opacity-50"
                          >
                            {room.status === 'closed' ? '룸 재개' : '룸 닫기'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void mintLink(booking, 'customer')}
                            disabled={busy === `${booking.id}:customer`}
                            className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-white/10 text-[12px] font-semibold text-slate-200 disabled:opacity-50"
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
                            setQrOpen({ title: `${booking.contact_name ?? '손님'} — 손님 링크`, link: customerLink })
                          }
                        />
                        <LinkAction
                          label="가이드 링크"
                          minted={guideLink}
                          busy={busy === `${booking.id}:guide`}
                          onMint={() => void mintLink(booking, 'guide')}
                          onQr={() =>
                            guideLink && setQrOpen({ title: `${title} — 가이드 링크`, link: guideLink })
                          }
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
    </div>
  );
}

function LinkAction({
  label,
  minted,
  busy,
  onMint,
  onQr,
}: {
  label: string;
  minted: MintedLink | undefined;
  busy: boolean;
  onMint: () => void;
  onQr: () => void;
}) {
  return (
    <div className="flex h-10 items-stretch overflow-hidden rounded-xl bg-white/10">
      <button
        type="button"
        onClick={onMint}
        disabled={busy}
        className="flex flex-1 items-center justify-center gap-1.5 text-[12px] font-semibold text-slate-200 disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-3.5" />}
        {label}
      </button>
      <button
        type="button"
        onClick={minted ? onQr : onMint}
        disabled={busy}
        aria-label={`${label} QR`}
        className={`flex w-10 items-center justify-center border-l border-white/10 disabled:opacity-50 ${
          minted ? 'text-emerald-300' : 'text-slate-500'
        }`}
      >
        <QrCode className="size-4" />
      </button>
    </div>
  );
}
