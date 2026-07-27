'use client';

/**
 * 손님 안내 보내기 (가이드) — W-트랙 후속, 사용자 요청 2026-07-27.
 *
 * "전날에 고객들한테 왓츠앱/이메일 안내를 원버튼으로" — 기계는 관제(M4,
 * OpsGuestMessagingView)에 이미 있었지만 입구가 어드민 로그인 뒤에만 있었다.
 * 이 패널은 같은 bulk-message GET(가이드 토큰 인가 + mint=1 실링크)을 읽어
 * 수신자별로:
 *
 *   [왓츠앱] wa.me/<번호>?text=<렌더된 본문>  — 앱이 열리고 사람이 전송을 누른다
 *   [메일]   mailto:<주소>?subject&body      — 메일 앱에 제목/본문 프리필
 *   [복사]   본문 클립보드
 *
 * 🔴 서버가 자동 발송하는 것은 없다 — 왓츠앱 Business API 자동 발송은 이
 * 저장소에서 금지(v1.2 §4.4)이고, 서버 이메일 일괄 발송은 관제(어드민)의
 * 기존 화면에 그대로 있다. 이 패널은 "탭 → 확인 → 전송"의 원버튼 준비다.
 * KO 전용 UI (P-D10); 손님이 받는 본문은 손님 언어로 렌더되어 온다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { normalizeWaDigits } from '@/lib/ops/whatsapp/wa-deep-link';
import {
  IconCopy,
  IconDone,
  IconMail,
  IconRefresh,
  IconTabChat,
  IconWarn,
  TR_ICON,
} from '@/components/tour-mode/icons';

const PRESETS: Array<{ key: string; label: string }> = [
  { key: 'pickup_d1', label: '픽업 안내 (D-1)' },
  { key: 'cruise_d1', label: '크루즈 D-1' },
  { key: 'room_invite', label: '룸 초대·좌석' },
  { key: 'day_pass', label: '당일 체크인' },
  { key: 'thanks', label: '종료 감사' },
];

interface AnnounceRecipient {
  bookingId: string;
  guestName: string;
  locale: string;
  subject: string | null;
  body: string;
  missing: string[];
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
}

interface AnnouncePayload {
  tourTitle: string | null;
  forecast: unknown;
  recipients: AnnounceRecipient[];
  /** 크루즈 D-1 — 그날 기항 목록(배 선택 칩)과 서버가 고른 배. */
  cruiseCalls?: Array<{ id: string; label: string; ship: string; port: string }> | null;
  cruiseCallId?: string | null;
}

function buildMailto(email: string, subject: string | null, body: string): string {
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  params.set('body', body);
  // URLSearchParams encodes spaces as '+', which mail clients render literally.
  return `mailto:${email}?${params.toString().replace(/\+/g, '%20')}`;
}

export default function GuideAnnouncePanel({
  token,
  tourId,
  tourDate,
}: {
  token: string;
  tourId: string;
  tourDate: string;
}) {
  const [preset, setPreset] = useState('pickup_d1');
  // 크루즈 D-1 — 같은 날 배가 여러 척이면 서버는 지어내지 않는다(missing 배지).
  // 여기서 배를 고르면 cruiseCallId로 다시 받아와 문구가 채워진다.
  const [cruiseCallId, setCruiseCallId] = useState<string | null>(null);
  const [data, setData] = useState<AnnouncePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // whatsapp 채널 템플릿 + mint=1 실링크. 이메일은 같은 본문을 프리필한다
      // (v1 — 채널별 문구 분화는 관제 화면의 영역).
      const qs = new URLSearchParams({
        tourId,
        date: tourDate,
        preset,
        channel: 'whatsapp',
        mint: '1',
        rt: token,
      });
      if (cruiseCallId) qs.set('cruiseCallId', cruiseCallId);
      const res = await fetch(`/api/admin/tour-ops/manifest/bulk-message?${qs.toString()}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'load_failed');
      setData(json as AnnouncePayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load_failed');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, tourId, tourDate, preset, cruiseCallId]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyBody = useCallback(async (r: AnnounceRecipient) => {
    try {
      await navigator.clipboard?.writeText(r.body);
      setCopiedId(r.bookingId);
      window.setTimeout(() => setCopiedId(null), 1200);
    } catch {
      /* clipboard unavailable — the wa/mail buttons still carry the text */
    }
  }, []);

  const recipients = useMemo(() => data?.recipients ?? [], [data]);

  return (
    <div className="flex flex-col gap-3" data-testid="guide-announce">
      {/* preset chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => {
              setPreset(p.key);
              setCruiseCallId(null);
            }}
            aria-pressed={preset === p.key}
            className={`tr-label text-cjk-safe shrink-0 rounded-full border px-3 py-2 font-bold active:scale-95 ${
              preset === p.key
                ? 'border-[var(--tr-accent)] bg-[var(--tr-accent-soft)] text-[var(--tr-accent)]'
                : 'border-[var(--tr-hairline)] text-[var(--tr-ink-2)]'
            }`}
            data-testid={`announce-preset-${p.key}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* 크루즈 D-1 — 그날 기항 배 목록. 한 척이면 자동, 여러 척이면 여기서
          고른다(고르기 전엔 {cruise_*}가 missing 배지로 남는다 — 지어내지 않음). */}
      {preset === 'cruise_d1' && (data?.cruiseCalls?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5" data-testid="announce-cruise-calls">
          {data!.cruiseCalls!.map((c) => {
            const active = (data?.cruiseCallId ?? null) === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCruiseCallId(c.id)}
                aria-pressed={active}
                className={`tr-meta shrink-0 rounded-full border px-2.5 py-1.5 font-semibold active:scale-95 ${
                  active
                    ? 'border-[var(--tr-accent)] bg-[var(--tr-accent-soft)] text-[var(--tr-accent)]'
                    : 'border-[var(--tr-hairline)] text-[var(--tr-ink-2)]'
                }`}
                data-testid={`announce-cruise-${c.id}`}
              >
                🛳️ {c.label}
              </button>
            );
          })}
        </div>
      )}
      {preset === 'cruise_d1' && data && (data.cruiseCalls?.length ?? 0) === 0 && (
        <p className="tr-label rounded-xl bg-[var(--tr-danger-soft)] px-3 py-2 font-medium text-[var(--tr-danger)]" data-testid="announce-cruise-none">
          이 날짜({tourDate})에 등록된 크루즈 기항이 없어요 — 선석배정 동기화(scripts/sync-cruise-schedule.ts)를 확인해 주세요.
        </p>
      )}

      <p className="tr-meta leading-snug text-[var(--tr-ink-3)]">
        버튼을 누르면 왓츠앱/메일 앱이 문구가 채워진 채 열려요 — <b>전송은 직접</b> 누릅니다.
        개인 룸 링크는 이 화면을 열 때 발급된 실제 링크예요. 서버 일괄 이메일은 관제의 [손님
        안내 보내기]에 있어요.
      </p>

      {loading && <div className="tr-skeleton h-24 rounded-xl" />}
      {error && (
        <div className="flex items-center gap-2">
          <p className="tr-label flex-1 rounded-xl bg-[var(--tr-danger-soft)] px-3 py-2 font-medium text-[var(--tr-danger)]">
            불러오지 못했어요 — {error}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            aria-label="다시 시도"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]"
          >
            <IconRefresh size={TR_ICON.action} aria-hidden />
          </button>
        </div>
      )}
      {!loading && !error && recipients.length === 0 && (
        <p className="tr-card-text py-6 text-center text-[var(--tr-ink-3)]">이날 예약이 없어요.</p>
      )}

      <div className="space-y-2">
        {recipients.map((r) => {
          const digits = normalizeWaDigits(r.whatsapp) ?? normalizeWaDigits(r.phone);
          // 본문은 서버가 이미 수신자 언어로 렌더했다 — 여기선 링크만 조립한다.
          const waHref = digits ? `https://wa.me/${digits}?text=${encodeURIComponent(r.body)}` : null;
          const mailHref = r.email?.includes('@') ? buildMailto(r.email, r.subject, r.body) : null;
          return (
            <article
              key={r.bookingId}
              className="tr-card border border-[var(--tr-hairline)] px-3.5 py-3"
              data-testid="announce-recipient"
            >
              <div className="flex items-center gap-2">
                <p className="tr-card-text text-cjk-safe min-w-0 flex-1 font-bold text-[var(--tr-ink)]">
                  {r.guestName}
                </p>
                <span className="tr-meta shrink-0 rounded-full bg-[var(--tr-surface-2)] px-2 py-0.5 font-semibold uppercase text-[var(--tr-ink-2)]">
                  {r.locale}
                </span>
                {r.missing.length > 0 && (
                  <span
                    className="tr-meta text-cjk-safe inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--tr-danger-soft)] px-2 py-0.5 font-bold text-[var(--tr-danger)]"
                    title={`빈 변수: ${r.missing.join(', ')}`}
                    data-testid="announce-missing"
                  >
                    <IconWarn size={TR_ICON.meta} aria-hidden />
                    변수 누락
                  </span>
                )}
              </div>
              <p className="tr-meta mt-1 line-clamp-2 whitespace-pre-line leading-snug text-[var(--tr-ink-3)]">
                {r.body}
              </p>
              <div className="mt-2.5 flex gap-1.5">
                {waHref ? (
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tr-label text-cjk-safe flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--tr-safe)] px-3 font-bold text-white active:scale-[0.99]"
                    data-testid="announce-wa"
                  >
                    <IconTabChat size={TR_ICON.chip} aria-hidden />
                    왓츠앱
                  </a>
                ) : (
                  <span className="tr-label text-cjk-safe flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-[var(--tr-surface-2)] px-3 font-bold text-[var(--tr-ink-3)]">
                    번호 없음
                  </span>
                )}
                {mailHref ? (
                  <a
                    href={mailHref}
                    className="tr-label text-cjk-safe flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--tr-accent)] px-3 font-bold text-[var(--tr-bubble-me-ink)] active:scale-[0.99]"
                    data-testid="announce-mail"
                  >
                    <IconMail size={TR_ICON.chip} aria-hidden />
                    메일
                  </a>
                ) : (
                  <span className="tr-label text-cjk-safe flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-[var(--tr-surface-2)] px-3 font-bold text-[var(--tr-ink-3)]">
                    메일 없음
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void copyBody(r)}
                  aria-label="본문 복사"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)] active:scale-95"
                  data-testid="announce-copy"
                >
                  {copiedId === r.bookingId ? (
                    <IconDone size={TR_ICON.chip} className="text-[var(--tr-safe)]" aria-hidden />
                  ) : (
                    <IconCopy size={TR_ICON.chip} aria-hidden />
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
