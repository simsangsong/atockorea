'use client';

/**
 * AtoC 통합 Phase 2 — 명단(Roster) 탭 (plan §3.2, kursoflow ManifestView 참고).
 *
 * (tour_id, tour_date) 스코프의 bookings를 픽업지 그룹으로 묶어 보여준다:
 * 상단 카운터(팀/명/연락완료) → 픽업지 아코디언(팀·명·최이른 픽업시각) →
 * 행(이름·인원·채널·언어·특이사항 하이라이트) + WhatsApp prefill 액션:
 *   [WA] 프리셋 선택 → wa.me 새 탭 오픈(+opened 로그) → [발송 완료] 수동 체크.
 * 일괄 모드: 게스트 체크 → [다음 열기]로 탭 순차 오픈 (popup-blocker 안전 —
 * 클릭당 1탭, plan §4.2 wa.me 순차 오픈).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, ChevronDown, ChevronUp, Copy, Mail, MessageCircle, RefreshCw } from 'lucide-react';
import { getOpsToken } from '@/components/tour-ops/opsShared';
import {
  groupBookingsByPickup,
  manifestTotals,
  extractHighlights,
  type ManifestBooking,
} from '@/lib/ops/manifest/group';
import {
  buildWhatsAppDeepLink,
  resolveWhatsAppDigits,
} from '@/lib/ops/whatsapp/wa-deep-link';
import { WA_PRESETS, getPreset, presetBodyForLocale, type WaPresetKey } from '@/lib/ops/whatsapp/presets';

const HIGHLIGHT_LABELS: Record<string, string> = {
  allergy: '알레르기',
  dietary: '식단',
  mobility: '이동보조',
  infant: '유아',
};

const SOURCE_BADGE: Record<string, string> = {
  klook: 'Klook',
  viator: 'Viator',
  gyg: 'GYG',
  kkday: 'KKday',
  atoc: 'AtoC',
  direct: '직접',
  test: 'TEST',
};

export default function OpsManifestView({
  tourId,
  tourDate,
  tourTitle,
}: {
  tourId: string;
  tourDate: string;
  tourTitle?: string | null;
}) {
  const [bookings, setBookings] = useState<ManifestBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [presetKey, setPresetKey] = useState<WaPresetKey>('pickup_d1');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCursor, setBulkCursor] = useState(0);
  // 룸 초대 이메일 일괄 발송 (§4.2① + §5.1) — D10 확인 게이트.
  const [emailConfirm, setEmailConfirm] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const token = await getOpsToken();
      const res = await fetch(
        `/api/admin/tour-ops/manifest?tourId=${encodeURIComponent(tourId)}&date=${encodeURIComponent(tourDate)}`,
        { headers: { Authorization: `Bearer ${token}` }, credentials: 'include', cache: 'no-store' },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '명단 불러오기 실패');
      setBookings((json.bookings ?? []) as ManifestBooking[]);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '명단 불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [tourId, tourDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => groupBookingsByPickup(bookings), [bookings]);
  const totals = useMemo(() => manifestTotals(bookings), [bookings]);
  const preset = getPreset(presetKey) ?? WA_PRESETS[0];
  const emailEligible = useMemo(
    () => bookings.filter((b) => Boolean((b.contactEmail ?? '').trim())).length,
    [bookings],
  );

  /** 룸 초대 링크를 이메일 있는 게스트 전원에게 일괄 발송 (확인 게이트 통과 후). */
  const sendBulkInvite = useCallback(async () => {
    setEmailBusy(true);
    try {
      const token = await getOpsToken();
      const res = await fetch('/api/admin/tour-ops/manifest/bulk-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ tourId, tourDate }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '초대 발송 실패');
      setInviteLink(typeof json.url === 'string' ? json.url : null);
      toast.success(`${json.sent ?? 0}명 발송 · ${json.skippedNoEmail ?? 0} 이메일없음`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '초대 발송 실패');
    } finally {
      setEmailBusy(false);
      setEmailConfirm(false);
    }
  }, [tourId, tourDate, load]);

  const copyInviteLink = useCallback(async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success('초대 링크를 복사했습니다');
    } catch {
      toast.error('복사에 실패했습니다');
    }
  }, [inviteLink]);

  /** wa.me 링크 준비: {room_link}/{pass_link}가 필요한 프리셋이면 links API로
   *  고객 토큰 링크를 먼저 발급(기존 경로 재사용), 아니면 즉시 렌더. */
  const buildLinkFor = useCallback(
    async (booking: ManifestBooking): Promise<{ url: string; message: string } | null> => {
      const digits = resolveWhatsAppDigits({ phone: booking.contactPhone, whatsapp: booking.whatsapp });
      if (!digits) return null;
      const body = presetBodyForLocale(preset, booking.preferredLanguage);
      let roomLink = '';
      if (body.includes('{room_link}') || body.includes('{pass_link}') || body.includes('{pass_url}')) {
        try {
          const token = await getOpsToken();
          const res = await fetch('/api/admin/tour-ops/links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            credentials: 'include',
            body: JSON.stringify({ bookingId: booking.id, role: 'customer' }),
          });
          const json = await res.json();
          if (res.ok && typeof json.url === 'string') roomLink = json.url;
        } catch {
          /* 링크 없이도 발송은 가능 — 변수는 빈 값 */
        }
      }
      const input = {
        phone: digits,
        guestName: booking.contactName ?? 'Guest',
        tourName: tourTitle ?? '',
        tourDate,
        pickupPoint: booking.pickupName,
        pickupTime: booking.pickupTime,
        roomLink: roomLink || null,
        passLink: roomLink || null,
        operatorName: 'AtoC Korea',
      };
      const url = buildWhatsAppDeepLink(input, body);
      if (!url) return null;
      return { url, message: decodeURIComponent(url.split('?text=')[1] ?? '') };
    },
    [preset, tourDate, tourTitle],
  );

  const logAction = useCallback(async (payload: Record<string, unknown>) => {
    try {
      const token = await getOpsToken();
      await fetch('/api/admin/tour-ops/wa-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
    } catch {
      /* 로그는 best-effort — wa.me 오픈을 막지 않는다 */
    }
  }, []);

  const openWa = useCallback(
    async (booking: ManifestBooking) => {
      const built = await buildLinkFor(booking);
      if (!built) {
        toast.error('사용 가능한 전화번호가 없습니다');
        return false;
      }
      window.open(built.url, '_blank', 'noopener,noreferrer');
      setBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, waOpenedAt: new Date().toISOString() } : b)),
      );
      void logAction({
        action: 'opened',
        bookingId: booking.id,
        presetKey: preset.key,
        locale: booking.preferredLanguage,
        waUrl: built.url,
        renderedMessage: built.message,
      });
      return true;
    },
    [buildLinkFor, logAction, preset.key],
  );

  const markSent = useCallback(
    async (booking: ManifestBooking) => {
      setBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, waMarkedSentAt: new Date().toISOString() } : b)),
      );
      void logAction({ action: 'mark_sent', bookingId: booking.id });
    },
    [logAction],
  );

  // 일괄 순차 오픈 — 클릭 1회당 1탭 (popup-blocker 안전).
  const bulkList = useMemo(() => bookings.filter((b) => selected.has(b.id)), [bookings, selected]);
  const bulkNext = useCallback(async () => {
    if (bulkCursor >= bulkList.length) return;
    const ok = await openWa(bulkList[bulkCursor]);
    setBulkCursor((c) => c + 1);
    if (!ok) toast.error(`${bulkList[bulkCursor].contactName ?? '게스트'} — 전화번호 없음, 건너뜀`);
  }, [bulkCursor, bulkList, openWa]);

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setBulkCursor(0);
  };

  const toggleGroup = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="ops-manifest">
      {/* 카운터 바 */}
      <div className="flex items-center gap-2 border-b border-[var(--tr-hairline)] px-4 py-2 text-[12px]">
        <span className="font-bold text-[var(--tr-ink)]">
          총 {totals.pax}명 · {totals.teams}팀
        </span>
        <span className="text-emerald-700 dark:text-emerald-300">발송 {totals.contacted}</span>
        {totals.uncontacted > 0 && (
          <span className="text-amber-700 dark:text-amber-300">미연락 {totals.uncontacted}</span>
        )}
        <span className="flex-1" />
        <select
          value={presetKey}
          onChange={(e) => setPresetKey(e.target.value as WaPresetKey)}
          aria-label="WhatsApp 프리셋"
          className="h-8 rounded-lg border border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] px-2 text-[12px] text-[var(--tr-ink)]"
        >
          {WA_PRESETS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label} ({p.timing})
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            setInviteLink(null);
            setEmailConfirm(true);
          }}
          disabled={emailBusy || emailEligible === 0}
          aria-label="룸 초대 이메일 일괄 발송"
          className="flex h-8 items-center gap-1 rounded-lg bg-[var(--tr-surface-2)] px-2.5 text-[11px] font-semibold text-[var(--tr-ink)] disabled:opacity-40"
        >
          <Mail className="size-3.5" />
          룸 초대 이메일
        </button>
        <button
          type="button"
          onClick={() => void load()}
          aria-label="새로고침"
          className="flex size-8 items-center justify-center rounded-lg text-[var(--tr-ink-2)] active:bg-[var(--tr-surface-2)]"
        >
          <RefreshCw className="size-4" />
        </button>
      </div>

      {/* 룸 초대 이메일 일괄 발송 — D10 확인 게이트 (명시적 2차 클릭 요구) */}
      {emailConfirm && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--tr-hairline)] bg-amber-50 px-4 py-2 dark:bg-amber-500/10">
          <span className="text-[12px] text-[var(--tr-ink)]">
            이메일 있는 게스트 <b>{emailEligible}팀</b>에게 룸 초대 링크를 보냅니다. 계속할까요?
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => void sendBulkInvite()}
            disabled={emailBusy}
            className="h-8 rounded-lg bg-[var(--tr-accent)] px-3 text-[12px] font-semibold text-white disabled:opacity-40"
          >
            {emailBusy ? '발송 중…' : '확인 발송'}
          </button>
          <button
            type="button"
            onClick={() => setEmailConfirm(false)}
            disabled={emailBusy}
            className="h-8 rounded-lg px-2 text-[12px] text-[var(--tr-ink-2)]"
          >
            취소
          </button>
        </div>
      )}

      {/* 발송 후 초대 링크 노출(복사 가능) */}
      {inviteLink && (
        <div className="flex items-center gap-2 border-b border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] px-4 py-2">
          <Mail className="size-3.5 shrink-0 text-[var(--tr-ink-3)]" />
          <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--tr-ink-2)]" title={inviteLink}>
            {inviteLink}
          </span>
          <button
            type="button"
            onClick={() => void copyInviteLink()}
            aria-label="초대 링크 복사"
            className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-[var(--tr-surface)] px-2.5 text-[11px] font-semibold text-[var(--tr-ink)]"
          >
            <Copy className="size-3.5" />
            복사
          </button>
        </div>
      )}

      {/* 일괄 순차 오픈 바 */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 border-b border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] px-4 py-2">
          <span className="text-[12px] text-[var(--tr-ink-2)]">
            선택 {selected.size}팀 · {Math.min(bulkCursor, bulkList.length)}/{bulkList.length} 열림
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => void bulkNext()}
            disabled={bulkCursor >= bulkList.length}
            className="h-8 rounded-lg bg-emerald-600 px-3 text-[12px] font-semibold text-white disabled:opacity-40"
          >
            {bulkCursor >= bulkList.length ? '완료' : `다음 열기 (${bulkCursor + 1}번째)`}
          </button>
          <button
            type="button"
            onClick={() => {
              setSelected(new Set());
              setBulkCursor(0);
            }}
            className="h-8 rounded-lg px-2 text-[12px] text-[var(--tr-ink-2)]"
          >
            해제
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2 pb-6">
        {loading && <p className="mt-8 text-center text-[12px] text-[var(--tr-ink-3)]">명단을 불러오는 중…</p>}
        {!loading && loadError && (
          <p className="mt-8 text-center text-[12px] text-red-600 dark:text-red-400">{loadError}</p>
        )}
        {!loading && !loadError && bookings.length === 0 && (
          <p className="mt-8 text-center text-[12px] text-[var(--tr-ink-3)]">이 날짜의 예약이 없습니다.</p>
        )}

        {groups.map((group) => {
          const isCollapsed = collapsed.has(group.key);
          return (
            <section key={group.key} className="rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)]">
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                aria-expanded={!isCollapsed}
              >
                <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[var(--tr-ink)]">
                  {group.firstPickupTime && (
                    <span className="mr-1.5 tabular-nums text-[var(--tr-accent)]">{group.firstPickupTime}</span>
                  )}
                  {group.displayName}
                </span>
                <span className="shrink-0 text-[11px] text-[var(--tr-ink-3)]">
                  {group.teamCount}팀 {group.paxCount}명
                </span>
                {isCollapsed ? <ChevronDown className="size-4 shrink-0" /> : <ChevronUp className="size-4 shrink-0" />}
              </button>

              {!isCollapsed && (
                <ul className="border-t border-[var(--tr-hairline)]">
                  {group.bookings.map((booking) => {
                    const highlights = extractHighlights(booking.specialRequests);
                    const sent = Boolean(booking.waMarkedSentAt);
                    const opened = Boolean(booking.waOpenedAt);
                    return (
                      <li
                        key={booking.id}
                        className="flex items-center gap-2 border-b border-[var(--tr-hairline)] px-3 py-2 last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(booking.id)}
                          onChange={() => toggleSelected(booking.id)}
                          aria-label={`${booking.contactName ?? '게스트'} 선택`}
                          className="size-4 shrink-0 accent-emerald-600"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-[var(--tr-ink)]">
                            {booking.contactName ?? '게스트'}
                            <span className="ml-1 font-normal text-[var(--tr-ink-3)]">{booking.partySize}명</span>
                            {booking.source && (
                              <span className="ml-1.5 rounded bg-[var(--tr-surface-2)] px-1 py-0.5 text-[9px] font-bold uppercase text-[var(--tr-ink-2)]">
                                {SOURCE_BADGE[booking.source] ?? booking.source}
                              </span>
                            )}
                            <span className="ml-1 text-[10px] text-[var(--tr-ink-3)]">
                              {booking.preferredLanguage ?? 'en'}
                            </span>
                          </p>
                          {highlights.length > 0 && (
                            <p className="mt-0.5 flex flex-wrap gap-1">
                              {highlights.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-200"
                                >
                                  ⚠ {HIGHLIGHT_LABELS[tag] ?? tag}
                                </span>
                              ))}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => void openWa(booking)}
                          disabled={!resolveWhatsAppDigits({ phone: booking.contactPhone, whatsapp: booking.whatsapp })}
                          className={`flex h-9 shrink-0 items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold disabled:opacity-30 ${
                            opened
                              ? 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]'
                              : 'bg-emerald-600 text-white'
                          }`}
                          aria-label="WhatsApp 열기"
                        >
                          <MessageCircle className="size-3.5" />
                          WA
                        </button>
                        <button
                          type="button"
                          onClick={() => void markSent(booking)}
                          disabled={sent}
                          className={`flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold ${
                            sent
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                              : 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]'
                          }`}
                          aria-label="발송 완료 체크"
                        >
                          <Check className="size-3.5" />
                          {sent ? '발송됨' : '완료'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
