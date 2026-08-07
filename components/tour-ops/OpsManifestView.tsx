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
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { toast } from 'sonner';
import { Check, ChevronDown, ChevronUp, Copy, Mail, MessageCircle, Pencil, RefreshCw, X } from 'lucide-react';
import { getOpsToken } from '@/components/tour-ops/opsShared';
import {
  groupBookingsByPickup,
  manifestTotals,
  extractHighlights,
  type ManifestBooking,
} from '@/lib/ops/manifest/group';
import { renderWaTemplate, resolveWhatsAppDigits } from '@/lib/ops/whatsapp/wa-deep-link';
import {
  WA_LOCALES,
  WA_PRESETS,
  getPreset,
  presetBodyForLocale,
  waLocaleKey,
  type WaLocale,
  type WaPresetKey,
} from '@/lib/ops/whatsapp/presets';
import { weatherVars } from '@/lib/ops/messaging/guestMessage';
import { stripEmptyTokenLines } from '@/lib/ops/messaging/template';
import type { DailyForecast } from '@/lib/ops/weather/forecast';
import { SkeletonRows } from '@/components/tour-mode/LoadingHint';

const HIGHLIGHT_LABELS: Record<string, string> = {
  allergy: '알레르기',
  dietary: '식단',
  mobility: '이동보조',
  infant: '유아',
};

/** 'YYYY-MM-DDTHH:mm:ssZ' → 'M/D HH:MM' (KST). 없으면 빈 문자열. */
function shortKst(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const kst = new Date(t + 9 * 60 * 60 * 1000);
  const hh = String(kst.getUTCHours()).padStart(2, '0');
  const mm = String(kst.getUTCMinutes()).padStart(2, '0');
  return `${kst.getUTCMonth() + 1}/${kst.getUTCDate()} ${hh}:${mm}`;
}

/**
 * §2-6 — 이 손님에게 메일이 갔는가.
 *
 * 이력이 화면에 없으면 운영자는 "혹시 몰라서" 또 보낸다. 그리고 못 나간 사람은
 * 아무 표시도 없이 목록에 남아 보낸 사람처럼 보인다 — 이 저장소가 반복해서
 * 만든 실패다. 그래서 실패·건너뜀은 사유까지 적는다.
 */
function EmailTrace({ booking }: { booking: ManifestBooking }) {
  if (!booking.emailStatus) return null;
  const when = shortKst(booking.emailAt);
  if (booking.emailStatus === 'sent') {
    return (
      <p className="mt-0.5 tr-meta text-[var(--tr-ink-3)]" data-testid="manifest-email-trace">
        <Mail className="mr-0.5 inline size-3 align-[-1px]" />
        메일 발송{when ? ` ${when}` : ''}
        {booking.emailSubject ? ` · ${booking.emailSubject}` : ''}
      </p>
    );
  }
  return (
    <p className="mt-0.5 tr-meta font-semibold text-rose-600 dark:text-rose-400" data-testid="manifest-email-trace">
      <Mail className="mr-0.5 inline size-3 align-[-1px]" />
      메일 {booking.emailStatus === 'skipped' ? '제외' : '실패'}
      {booking.emailError ? ` — ${booking.emailError}` : ''}
    </p>
  );
}

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
  // M1 — 투어일 예보. 명단과 함께 온다. null 이면 wa.me 문구에서 날씨·착장 줄이 빠진다.
  const [forecast, setForecast] = useState<DailyForecast | null>(null);
  // M2 — 로케일별로 **해석된** 문구(투어 전용 → 전역 → 코드). 비어 있으면 코드 프리셋으로 떨어진다.
  const [resolvedBodies, setResolvedBodies] = useState<Record<string, string>>({});
  const [templateSource, setTemplateSource] = useState<string | null>(null);
  // §2-7 — 왓츠앱 문구 편집. 라우트는 채널 둘 다 받는데 저장 화면이 이메일에만
  // 있었다. 그래서 "왓츠앱으로 나가는 문구"는 코드를 고치지 않으면 못 바꿨다.
  const [editorOpen, setEditorOpen] = useState(false);
  const [templateReload, setTemplateReload] = useState(0);

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
      setForecast((json.forecast ?? null) as DailyForecast | null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '명단 불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [tourId, tourDate]);

  useEffect(() => {
    void load();
  }, [load]);

  // M2 — 투어 전용 문구가 있으면 그것을 쓴다. 실패하면 조용히 코드 프리셋으로
  // 떨어진다(발송 자체를 막을 이유는 없다).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await getOpsToken();
        const res = await fetch(
          `/api/admin/tour-ops/tour-templates?tourId=${encodeURIComponent(tourId)}&preset=${presetKey}&channel=whatsapp`,
          { headers: { Authorization: `Bearer ${token}` }, credentials: 'include', cache: 'no-store' },
        );
        const json = await res.json();
        if (cancelled || !res.ok) return;
        const bodies: Record<string, string> = {};
        let source: string | null = null;
        for (const [locale, entry] of Object.entries(json.locales ?? {})) {
          const e = entry as { body: string; source: string };
          bodies[locale] = e.body;
          if (e.source === 'tour') source = 'tour';
          else source ??= e.source;
        }
        setResolvedBodies(bodies);
        setTemplateSource(source);
      } catch {
        /* 코드 프리셋 폴백 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tourId, presetKey, templateReload]);

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
      // B0.3 — 이메일 없는 예약을 위한 **폴백** claim 링크다. 손님에게 나간
      // 링크가 아니라 운영자가 쓰는 것이므로, 이메일 없는 예약이 있을 때만 띄운다.
      const noEmail = Number(json.skippedNoEmail ?? 0);
      setInviteLink(noEmail > 0 && typeof json.url === 'string' ? json.url : null);
      // 두 종류를 구분해 적는다(B0.3 판정): 개인 링크를 받은 사람 / claim 폴백이
      // 필요한 사람. 합쳐서 한 숫자로 적으면 "누구에게 뭘 해야 하나"가 사라진다.
      const parts = [`개인 링크 ${json.sentPersonal ?? json.sent ?? 0}명 발송`];
      if (noEmail > 0) parts.push(`이메일 없음 ${noEmail}팀 — 아래 폴백 링크로 전달`);
      if (Number(json.failed ?? 0) > 0) parts.push(`실패 ${json.failed}명`);
      if (Number(json.revokedPrevious ?? 0) > 0) parts.push(`이전 링크 ${json.revokedPrevious}건 무효화`);
      toast.success(parts.join(' · '));
      // 시나리오 감사 #6 — AI 도착 해설은 plan confirm 이 생성 트리거다.
      // 기사 단독 투어일수록 "confirm 후 출발"이 절차여야 해설이 미리 준비된다.
      if (Number(json.unconfirmedPlans ?? 0) > 0) {
        toast(`⚠ 일정 미확정 ${json.unconfirmedPlans}팀 — confirm 해야 도착 해설이 미리 생성돼요`, { icon: '📋' });
      }
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
      // 해석된 문구(투어 전용/전역)가 있으면 그것이 이긴다.
      const localeKey = waLocaleKey(booking.preferredLanguage);
      const body = resolvedBodies[localeKey] ?? presetBodyForLocale(preset, booking.preferredLanguage);
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
      // M1 — 예보가 있으면 날씨·착장을 채우고, 없으면 그 줄을 통째로 뺀다.
      // 빈 '🌤️ 날씨: ' 가 손님에게 나가면 뭔가 빠뜨린 것처럼 읽힌다.
      const { weather, clothing } = weatherVars(forecast, booking.preferredLanguage);
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
        weather,
        clothing,
      };
      // 렌더 → 빈 줄 제거 → 그 결과를 그대로 URL에 싣는다.
      // buildWhatsAppDeepLink 에 넘기면 이미 치환된 문자열을 한 번 더 렌더하게 되므로
      // 여기서는 링크를 직접 만든다 — 화면에 보이는 문구와 보내지는 문구가 같아야 한다.
      const rendered = stripEmptyTokenLines(renderWaTemplate(body, input), body, input);
      const url = `https://wa.me/${digits}?text=${encodeURIComponent(rendered)}`;
      return { url, message: rendered };
    },
    [preset, tourDate, tourTitle, forecast, resolvedBodies],
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
      <div className="flex items-center gap-2 border-b border-[var(--tr-hairline)] px-4 py-2 tr-label">
        <span className="font-bold text-[var(--tr-ink)]">
          총 {totals.pax}명 · {totals.teams}팀
        </span>
        <span className="text-[var(--tr-safe)] ">발송 {totals.contacted}</span>
        {totals.uncontacted > 0 && (
          <span className="text-[var(--tr-warn)] ">미연락 {totals.uncontacted}</span>
        )}
        {/* §2-6 — 메일이 나갔는지를 화면에서 못 보면 같은 사람에게 또 보낸다. */}
        {totals.emailed > 0 && (
          <span className="text-[var(--tr-ink-2)]" data-testid="manifest-emailed-count">
            메일 {totals.emailed}
          </span>
        )}
        {totals.emailFailed > 0 && (
          <span className="font-semibold text-rose-600 dark:text-rose-400" data-testid="manifest-email-failed-count">
            메일 실패 {totals.emailFailed}
          </span>
        )}
        <span className="flex-1" />
        {/* M2 — 이 투어 전용 문구가 쓰이는 중이면 말해 준다. 어느 문구가 나가는지
            모른 채 보내면, 고쳐 둔 문구가 반영됐는지 확인할 방법이 없다. */}
        {templateSource === 'tour' && (
          <span className="text-cjk-safe rounded-full bg-[var(--tr-surface-2)] px-2 py-0.5 tr-meta font-semibold text-[var(--tr-ink-2)]">
            투어 전용 문구
          </span>
        )}
        <select
          value={presetKey}
          onChange={(e) => setPresetKey(e.target.value as WaPresetKey)}
          aria-label="WhatsApp 프리셋"
          className="h-8 rounded-lg border border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] px-2 tr-label text-[var(--tr-ink)]"
        >
          {WA_PRESETS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label} ({p.timing})
            </option>
          ))}
        </select>
        {/* §2-7 — 왓츠앱 문구를 이 자리에서 고친다. 문구가 나가는 화면과 문구를
            고치는 화면이 떨어져 있으면, 고친 것이 반영됐는지 확인할 방법이 없다. */}
        <button
          type="button"
          onClick={() => setEditorOpen(true)}
          className="text-cjk-safe flex h-8 items-center gap-1 rounded-lg bg-[var(--tr-surface-2)] px-2.5 tr-meta font-semibold text-[var(--tr-ink)]"
          data-testid="wa-template-edit"
        >
          <Pencil className="size-3.5" />
          문구
        </button>
        <button
          type="button"
          onClick={() => {
            setInviteLink(null);
            setEmailConfirm(true);
          }}
          disabled={emailBusy || emailEligible === 0}
          aria-label="룸 초대 이메일 일괄 발송"
          className="text-cjk-safe flex h-8 items-center gap-1 rounded-lg bg-[var(--tr-surface-2)] px-2.5 tr-meta font-semibold text-[var(--tr-ink)] disabled:opacity-40"
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

      {editorOpen && (
        <WaTemplateEditor
          tourId={tourId}
          presetKey={presetKey}
          bodies={resolvedBodies}
          onClose={() => setEditorOpen(false)}
          onSaved={() => setTemplateReload((n) => n + 1)}
        />
      )}

      {/* 룸 초대 이메일 일괄 발송 — D10 확인 게이트 (명시적 2차 클릭 요구) */}
      {emailConfirm && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--tr-hairline)] bg-[var(--tr-warn-soft)] px-4 py-2 ">
          <span className="tr-label text-[var(--tr-ink)]">
            이메일 있는 게스트 <b>{emailEligible}팀</b>에게 <b>각자의 개인 링크</b>를 보냅니다.
            이름을 고르는 화면 없이 바로 투어룸이 열립니다.
            <br />
            <span className="text-[var(--tr-ink-2)]">
              이전에 보낸 링크는 무효화됩니다(한 예약에 살아있는 링크는 항상 하나).
            </span>{' '}
            계속할까요?
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => void sendBulkInvite()}
            disabled={emailBusy}
            className="text-cjk-safe h-8 rounded-lg bg-[var(--tr-accent)] px-3 tr-label font-semibold text-[var(--tr-bubble-me-ink)] disabled:opacity-40"
          >
            {emailBusy ? '발송 중…' : '확인 발송'}
          </button>
          <button
            type="button"
            onClick={() => setEmailConfirm(false)}
            disabled={emailBusy}
            className="text-cjk-safe h-8 rounded-lg px-2 tr-label text-[var(--tr-ink-2)]"
          >
            취소
          </button>
        </div>
      )}

      {/* B0-D2 폴백 링크 — 이메일 없는 예약이 있을 때만. 손님에게 나간 개인
          링크가 아니라 운영자가 직접 전달하는 공용 claim 링크다. */}
      {inviteLink && (
        <div className="flex items-center gap-2 border-b border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] px-4 py-2">
          <Mail className="size-3.5 shrink-0 text-[var(--tr-ink-3)]" />
          <span className="shrink-0 tr-meta font-medium text-[var(--tr-ink-2)]">이메일 없는 예약용 폴백</span>
          <span className="min-w-0 flex-1 truncate tr-meta text-[var(--tr-ink-2)]" title={inviteLink}>
            {inviteLink}
          </span>
          <button
            type="button"
            onClick={() => void copyInviteLink()}
            aria-label="초대 링크 복사"
            className="text-cjk-safe flex h-8 shrink-0 items-center gap-1 rounded-lg bg-[var(--tr-surface)] px-2.5 tr-meta font-semibold text-[var(--tr-ink)]"
          >
            <Copy className="size-3.5" />
            복사
          </button>
        </div>
      )}

      {/* 일괄 순차 오픈 바 */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 border-b border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] px-4 py-2">
          <span className="tr-label text-[var(--tr-ink-2)]">
            선택 {selected.size}팀 · {Math.min(bulkCursor, bulkList.length)}/{bulkList.length} 열림
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => void bulkNext()}
            disabled={bulkCursor >= bulkList.length}
            className="text-cjk-safe h-8 rounded-lg bg-[var(--tr-safe)] px-3 tr-label font-semibold text-white disabled:opacity-40"
          >
            {bulkCursor >= bulkList.length ? '완료' : `다음 열기 (${bulkCursor + 1}번째)`}
          </button>
          <button
            type="button"
            onClick={() => {
              setSelected(new Set());
              setBulkCursor(0);
            }}
            className="text-cjk-safe h-8 rounded-lg px-2 tr-label text-[var(--tr-ink-2)]"
          >
            해제
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2 pb-6">
        {loading && <SkeletonRows rows={3} className="mt-4" />}
        {!loading && loadError && (
          <p className="mt-8 text-center tr-label text-[var(--tr-danger)] ">{loadError}</p>
        )}
        {!loading && !loadError && bookings.length === 0 && (
          <p className="mt-8 text-center tr-label text-[var(--tr-ink-3)]">이 날짜의 예약이 없습니다.</p>
        )}

        {groups.map((group) => {
          const isCollapsed = collapsed.has(group.key);
          return (
            <section key={group.key} className="rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)]">
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                className="text-cjk-safe flex w-full items-center gap-2 px-3 py-2.5 text-left"
                aria-expanded={!isCollapsed}
              >
                <span className="min-w-0 flex-1 truncate tr-card-text font-bold text-[var(--tr-ink)]">
                  {group.firstPickupTime && (
                    <span className="mr-1.5 tabular-nums text-[var(--tr-accent)]">{group.firstPickupTime}</span>
                  )}
                  {group.displayName}
                </span>
                <span className="shrink-0 tr-meta text-[var(--tr-ink-3)]">
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
                          <p className="truncate tr-card-text font-semibold text-[var(--tr-ink)]">
                            {booking.contactName ?? '게스트'}
                            <span className="ml-1 font-normal text-[var(--tr-ink-3)]">{booking.partySize}명</span>
                            {booking.source && (
                              <span className="ml-1.5 rounded bg-[var(--tr-surface-2)] px-1 py-0.5 tr-meta font-bold uppercase text-[var(--tr-ink-2)]">
                                {SOURCE_BADGE[booking.source] ?? booking.source}
                              </span>
                            )}
                            <span className="ml-1 tr-meta text-[var(--tr-ink-3)]">
                              {booking.preferredLanguage ?? 'en'}
                            </span>
                          </p>
                          {highlights.length > 0 && (
                            <p className="mt-0.5 flex flex-wrap gap-1">
                              {highlights.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded bg-[var(--tr-warn-soft)] px-1.5 py-0.5 tr-meta font-bold text-[var(--tr-warn)]  "
                                >
                                  ⚠ {HIGHLIGHT_LABELS[tag] ?? tag}
                                </span>
                              ))}
                            </p>
                          )}
                          {/* §2-6 — 메일 이력. 왓츠앱 상태와 한 칸에 섞지 않는다:
                              이메일은 서버가 실제로 보낸 것이고 왓츠앱은 사람이
                              탭한 것이라, 같은 뱃지로 쓰면 그 차이가 사라진다. */}
                          <EmailTrace booking={booking} />
                        </div>
                        <button
                          type="button"
                          onClick={() => void openWa(booking)}
                          disabled={!resolveWhatsAppDigits({ phone: booking.contactPhone, whatsapp: booking.whatsapp })}
                          className={`flex h-9 shrink-0 items-center gap-1 rounded-lg px-2.5 tr-meta font-semibold disabled:opacity-30 ${
                            opened
                              ? 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]'
                              : 'bg-[var(--tr-safe)] text-white'
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
                          className={`text-cjk-safe flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 tr-meta font-semibold ${
                            sent
                              ? 'bg-[var(--tr-safe-soft)] text-[var(--tr-safe)]  '
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

/**
 * §2-7 — 왓츠앱 문구 편집.
 *
 * `tour-templates` 라우트는 처음부터 채널 두 개를 받았지만 저장 화면은 이메일에만
 * 있었다. 그래서 왓츠앱으로 실제 나가는 문구는 코드를 고쳐야만 바뀌었다 —
 * 운영자가 못 고치는 문구는 결국 안 쓰이고, 사람이 매번 손으로 다시 쓴다.
 *
 * 이메일 쪽과 같은 규칙을 지킨다:
 *   · 편집은 **지금 실제로 나가는 문구**에서 시작한다(빈 칸에서 시작하면 운영자가
 *     전역 문구를 통째로 다시 쓰고, 그때부터 두 벌이 갈라진다).
 *   · 빈 본문 저장은 막는다. 지우려면 [기본으로 되돌리기]다 — 그 의도는 명시적이어야
 *     하고, 빈 문구를 저장하면 전역 문구를 가린 채 아무것도 안 나간다.
 */
function WaTemplateEditor({
  tourId,
  presetKey,
  bodies,
  onClose,
  onSaved,
}: {
  tourId: string;
  presetKey: WaPresetKey;
  bodies: Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  // O5 — Escape closes this editor. The walk never opened it, so only the
  // source-derived guard caught that it was missing.
  useEscapeClose(onClose);
  const [locale, setLocale] = useState<WaLocale>('en');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const preset = getPreset(presetKey) ?? WA_PRESETS[0];
  // 해석된 문구가 없으면 코드 프리셋에서 시작한다 — 빈 칸은 시작점이 아니다.
  const current = bodies[locale] ?? presetBodyForLocale(preset, locale);

  useEffect(() => {
    setDraft(current);
  }, [current]);

  const call = useCallback(
    async (init: RequestInit, url: string, okMessage: string) => {
      setBusy(true);
      try {
        const token = await getOpsToken();
        const res = await fetch(url, {
          ...init,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
          credentials: 'include',
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || '실패');
        toast.success(okMessage);
        onSaved();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '실패');
      } finally {
        setBusy(false);
      }
    },
    [onSaved],
  );

  const dirty = draft !== current;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div
        className="relative max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl border-t border-[var(--tr-hairline)] bg-[var(--tr-surface)] p-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
        data-testid="wa-template-editor"
      >
        <div className="mb-2 flex items-center gap-2">
          <p className="flex-1 tr-body font-bold text-[var(--tr-ink)]">
            왓츠앱 문구 — {preset.label}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex size-8 items-center justify-center rounded-lg text-[var(--tr-ink-3)]"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mb-2 flex flex-wrap gap-1">
          {WA_LOCALES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLocale(code)}
              aria-pressed={locale === code}
              className={
                'min-h-[32px] rounded-full px-2.5 tr-meta font-semibold ' +
                (locale === code
                  ? 'bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)]'
                  : 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]')
              }
            >
              {code}
            </button>
          ))}
        </div>

        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={10}
          className="mb-2 w-full rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] p-2 tr-card-text leading-relaxed text-[var(--tr-ink)]"
          data-testid="wa-template-body"
        />
        {/* 토큰을 적어 두지 않으면 운영자가 이름을 손으로 박아 넣고, 그 문구는
            다음 손님에게도 그 이름으로 나간다. */}
        <p className="mb-3 tr-meta leading-relaxed text-[var(--tr-ink-3)]">
          쓸 수 있는 자리표시자: {'{guestName} {tourName} {tourDate} {pickupPoint} {pickupTime} {roomLink} {weather} {clothing}'}
          <br />
          예보가 없는 날은 {'{weather}'} 줄이 통째로 빠집니다 — 빈 「날씨: 」는 나가지 않아요.
        </p>

        <div className="space-y-2">
          <button
            type="button"
            disabled={busy || !dirty || !draft.trim()}
            onClick={() =>
              void call(
                { method: 'PUT', body: JSON.stringify({ tourId, preset: presetKey, channel: 'whatsapp', locale, body: draft }) },
                '/api/admin/tour-ops/tour-templates',
                `${locale} 문구를 이 투어 전용으로 저장했어요.`,
              )
            }
            className="text-cjk-safe h-11 w-full rounded-xl bg-[var(--tr-accent)] tr-label font-semibold text-[var(--tr-bubble-me-ink)] disabled:opacity-40"
            data-testid="wa-template-save"
          >
            이 투어 전용으로 저장
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void call(
                { method: 'DELETE' },
                `/api/admin/tour-ops/tour-templates?tourId=${encodeURIComponent(tourId)}&preset=${presetKey}&channel=whatsapp&locale=${encodeURIComponent(locale)}`,
                '기본 문구로 되돌렸어요.',
              )
            }
            className="text-cjk-safe h-11 w-full rounded-xl border border-[var(--tr-hairline)] tr-label font-semibold text-[var(--tr-ink-2)] disabled:opacity-40"
            data-testid="wa-template-revert"
          >
            기본으로 되돌리기
          </button>
        </div>
      </div>
    </div>
  );
}
