'use client';

/**
 * 손님 안내 보내기 — M4 (플랜 §13.4).
 *
 * 왜 새 화면인가: 명단(`OpsManifestView`)은 룸 드로어 **안**에 있어서 "내일 안내
 * 보내기"에 도달하려면 날짜를 맞추고, 룸을 열고, 탭을 고르는 3단계가 필요했다.
 * 매일 하는 일이 3단계 깊이에 있으면 결국 안 하게 된다.
 *
 * 이 시트는 **날짜 하나를 골라 그날 투어 전체를 훑는다.** 투어를 고르면 그
 * 명단이 열리고, 거기서 왓츠앱 순차 발송(기존 구현)과 이메일 일괄 발송(신규)이
 * 같은 자리에 있다.
 *
 * 🔴 이메일은 서버가 실제로 보낸다. 왓츠앱은 wa.me 딥링크라 **사람이 탭**한다 —
 * Business API 자동 발송은 이 저장소에서 금지다(v1.2 §4.4). 화면이 그 차이를
 * 숨기지 않는다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CloudSun,
  Loader2,
  Mail,
  MessageCircle,
  RefreshCw,
  Send,
  Users,
  X,
} from 'lucide-react';
import { getOpsToken } from '@/components/tour-ops/opsShared';
import OpsManifestView from '@/components/tour-ops/OpsManifestView';
import { WA_PRESETS, type WaPresetKey } from '@/lib/ops/whatsapp/presets';
import { SKIP_REASON_LABEL } from '@/lib/ops/messaging/guestMessage';
import type { DailyForecast } from '@/lib/ops/weather/forecast';

interface TourGroup {
  tourId: string;
  tourTitle: string | null;
  city: string | null;
  roomCount: number;
  guestTotal: number;
}

interface PreviewRecipient {
  bookingId: string;
  guestName: string;
  locale: string;
  subject: string | null;
  body: string;
  missing: string[];
  email: string | null;
  canEmail: boolean;
  templateSource: 'tour' | 'tenant' | 'code';
}

interface PreviewPayload {
  tourTitle: string | null;
  city: string | null;
  forecast: DailyForecast | null;
  templateSource: string | null;
  recipients: PreviewRecipient[];
}

const TEMPLATE_SOURCE_LABEL: Record<string, string> = {
  tour: '이 투어 전용 문구',
  tenant: '전역 문구',
  code: '기본 문구',
};

function addDays(date: string, n: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
}

export default function OpsGuestMessagingView({
  initialDate,
  onClose,
}: {
  initialDate: string;
  onClose: () => void;
}) {
  // 기본값이 **내일**인 이유: 이 화면의 주 용도가 D-1 안내다.
  const [date, setDate] = useState(() => addDays(initialDate, 1));
  const [groups, setGroups] = useState<TourGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTour, setOpenTour] = useState<TourGroup | null>(null);
  const [mode, setMode] = useState<'whatsapp' | 'email'>('email');

  const [preset, setPreset] = useState<WaPresetKey>('pickup_d1');
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    sent: number;
    failed: number;
    skipped: number;
    failures: Array<{ guestName: string; error: string }>;
    skippedDetail: Array<{ guestName: string; reason: keyof typeof SKIP_REASON_LABEL }>;
  } | null>(null);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getOpsToken();
      const res = await fetch(`/api/admin/tour-ops/rooms?date=${date}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '불러오기 실패');

      // 룸은 예약 단위라 같은 투어가 여러 개다 — 투어로 접어야 "이 투어 손님 전체"가 된다.
      const byTour = new Map<string, TourGroup>();
      for (const room of (json.rooms ?? []) as Array<{
        tour_id: string | null;
        tour?: { title?: string | null; city?: string | null } | null;
        booking?: { number_of_guests?: number | null } | null;
      }>) {
        if (!room.tour_id) continue;
        const entry = byTour.get(room.tour_id) ?? {
          tourId: room.tour_id,
          tourTitle: room.tour?.title ?? null,
          city: room.tour?.city ?? null,
          roomCount: 0,
          guestTotal: 0,
        };
        entry.roomCount += 1;
        entry.guestTotal += room.booking?.number_of_guests ?? 0;
        byTour.set(room.tour_id, entry);
      }
      setGroups([...byTour.values()].sort((a, b) => (a.tourTitle ?? '').localeCompare(b.tourTitle ?? '', 'ko')));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const loadPreview = useCallback(
    async (tour: TourGroup, presetKey: WaPresetKey) => {
      setPreviewLoading(true);
      setResult(null);
      try {
        const token = await getOpsToken();
        const res = await fetch(
          `/api/admin/tour-ops/manifest/bulk-message?tourId=${tour.tourId}&date=${date}&preset=${presetKey}&channel=email`,
          { headers: { Authorization: `Bearer ${token}` }, credentials: 'include', cache: 'no-store' },
        );
        const json = (await res.json()) as PreviewPayload & { error?: string };
        if (!res.ok) throw new Error(json.error || '미리보기 실패');
        setPreview(json);
        // 첫 수신자의 렌더 결과를 편집 기준으로 삼는다 — 로케일이 섞여 있으면
        // 화면이 그 사실을 목록에서 보여주고, 편집은 공통 문구로 한다.
        const first = json.recipients[0];
        setSubject(first?.subject ?? '');
        setBody(first?.body ?? '');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '미리보기 실패');
      } finally {
        setPreviewLoading(false);
      }
    },
    [date],
  );

  const send = useCallback(async () => {
    if (!openTour) return;
    const targets = preview?.recipients.filter((r) => r.canEmail) ?? [];
    if (targets.length === 0) {
      toast.error('이메일 주소가 있는 손님이 없습니다.');
      return;
    }
    if (!window.confirm(`${targets.length}명에게 지금 발송할까요?\n제목: ${subject}`)) return;

    setSending(true);
    try {
      const token = await getOpsToken();
      const res = await fetch('/api/admin/tour-ops/manifest/bulk-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ tourId: openTour.tourId, date, preset, subject, body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '발송 실패');
      setResult(json);
      if (json.failed > 0 || json.skipped > 0) {
        toast.warning(`${json.sent}명 발송 · ${json.failed}명 실패 · ${json.skipped}명 제외`);
      } else {
        toast.success(`${json.sent}명에게 발송했습니다.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '발송 실패');
    } finally {
      setSending(false);
    }
  }, [openTour, preview, subject, body, preset, date]);

  const emailable = useMemo(() => preview?.recipients.filter((r) => r.canEmail).length ?? 0, [preview]);
  const notEmailable = useMemo(() => preview?.recipients.filter((r) => !r.canEmail) ?? [], [preview]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[var(--tr-canvas)] text-[var(--tr-ink)]"
      data-testid="ops-guest-messaging"
    >
      <header
        className="border-b border-[var(--tr-hairline)] px-4 pb-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
      >
        <div className="flex min-h-[40px] items-center justify-between gap-2">
          <h2 className="text-cjk-safe text-[15px] font-bold">
            {openTour ? openTour.tourTitle ?? '투어' : '손님 안내 보내기'}
          </h2>
          <div className="flex items-center gap-1">
            {openTour && (
              <button
                type="button"
                onClick={() => {
                  setOpenTour(null);
                  setPreview(null);
                  setResult(null);
                }}
                className="text-cjk-safe h-10 rounded-lg px-2 text-[12px] font-semibold text-[var(--tr-ink-2)]"
              >
                목록으로
              </button>
            )}
            <button
              type="button"
              onClick={() => void loadGroups()}
              aria-label="새로고침"
              className="flex size-10 items-center justify-center rounded-lg text-[var(--tr-ink-2)] active:bg-[var(--tr-surface-2)]"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="flex size-10 items-center justify-center rounded-lg text-[var(--tr-ink-2)] active:bg-[var(--tr-surface-2)]"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {!openTour && (
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDate(addDays(date, -1))}
              aria-label="이전 날"
              className="flex size-9 items-center justify-center rounded-lg text-[var(--tr-ink-2)] active:bg-[var(--tr-surface-2)]"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-[92px] text-center text-[14px] font-bold tabular-nums">{date}</span>
            <button
              type="button"
              onClick={() => setDate(addDays(date, 1))}
              aria-label="다음 날"
              className="flex size-9 items-center justify-center rounded-lg text-[var(--tr-ink-2)] active:bg-[var(--tr-surface-2)]"
            >
              <ChevronRight className="size-4" />
            </button>
            <p className="text-cjk-body ml-auto text-[11px] text-[var(--tr-ink-3)]">투어 {groups.length}개</p>
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {/* ── 1단계: 그날의 투어 고르기 ─────────────────────────────── */}
        {!openTour ? (
          loading ? (
            <p className="py-12 text-center text-[13px] text-[var(--tr-ink-3)]">불러오는 중…</p>
          ) : groups.length === 0 ? (
            <p className="text-cjk-body py-12 text-center text-[13px] text-[var(--tr-ink-3)]">
              이 날짜에 투어룸이 없습니다.
            </p>
          ) : (
            <ul className="space-y-2">
              {groups.map((g) => (
                <li key={g.tourId}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenTour(g);
                      setMode('email');
                      void loadPreview(g, preset);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-3 text-left active:bg-[var(--tr-surface-2)]"
                  >
                    <Users className="size-4 shrink-0 text-[var(--tr-ink-3)]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-cjk-body truncate text-[14px] font-bold">{g.tourTitle ?? '투어'}</p>
                      <p className="text-[11px] text-[var(--tr-ink-3)] tabular-nums">
                        {g.city ? `${g.city} · ` : ''}방 {g.roomCount} · 손님 {g.guestTotal}명
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-[var(--tr-ink-3)]" />
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <>
            {/* ── 2단계: 채널 ─────────────────────────────────────── */}
            <div className="mb-3 flex items-center gap-1 rounded-lg bg-[var(--tr-surface-2)] p-0.5">
              {(
                [
                  { key: 'email', label: '이메일 일괄', Icon: Mail },
                  { key: 'whatsapp', label: '왓츠앱 순차', Icon: MessageCircle },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setMode(t.key)}
                  aria-pressed={mode === t.key}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-[12px] font-semibold transition-colors ${
                    mode === t.key ? 'bg-[var(--tr-surface)] text-[var(--tr-ink)] shadow-sm' : 'text-[var(--tr-ink-3)]'
                  }`}
                >
                  <t.Icon className="size-3.5" />
                  <span className="text-cjk-safe">{t.label}</span>
                </button>
              ))}
            </div>

            {mode === 'whatsapp' ? (
              // 왓츠앱은 기존 구현이 이미 순차 오픈까지 갖고 있다. 다시 만들지 않는다.
              <OpsManifestView
                tourId={openTour.tourId}
                tourDate={date}
                tourTitle={openTour.tourTitle}
              />
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--tr-ink-2)]">
                    <span className="text-cjk-safe">문구</span>
                    <select
                      value={preset}
                      onChange={(e) => {
                        const next = e.target.value as WaPresetKey;
                        setPreset(next);
                        if (openTour) void loadPreview(openTour, next);
                      }}
                      className="h-9 rounded-lg border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 text-[12px]"
                    >
                      {WA_PRESETS.map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.label} ({p.timing})
                        </option>
                      ))}
                    </select>
                  </label>
                  {preview?.templateSource && (
                    <span className="text-cjk-safe rounded-full bg-[var(--tr-surface-2)] px-2 py-1 text-[10px] font-semibold text-[var(--tr-ink-2)]">
                      {TEMPLATE_SOURCE_LABEL[preview.templateSource] ?? preview.templateSource}
                    </span>
                  )}
                </div>

                {/* 날씨 — 있으면 보여주고, 없으면 없다고 말한다. 지어내지 않는다.
                    🔴 **불러오는 중을 "실패"라고 말하지 않는다.** 아직 일어나지 않은
                    실패를 단언하면 운영자는 멀쩡한 예보를 포기하고 손으로 적는다. */}
                <div className="flex items-start gap-2 rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-2">
                  <CloudSun className="mt-0.5 size-4 shrink-0 text-[var(--tr-ink-3)]" />
                  <p className="text-cjk-body text-[12px] leading-relaxed text-[var(--tr-ink-2)]">
                    {previewLoading || !preview
                      ? '예보 확인 중…'
                      : preview.forecast
                        ? `${preview.city ?? ''} ${date} 예보 — 최저 ${Math.round(preview.forecast.tempMinC)}° / 최고 ${Math.round(preview.forecast.tempMaxC)}°, 강수확률 ${Math.round(preview.forecast.precipProbability)}%. 아래 문구에 날씨·착장 안내가 자동으로 들어갑니다.`
                        : '예보를 가져오지 못했습니다 — 날씨·착장 문장은 빼고 발송됩니다.'}
                  </p>
                </div>

                {previewLoading ? (
                  <p className="py-10 text-center text-[13px] text-[var(--tr-ink-3)]">미리보기 만드는 중…</p>
                ) : (
                  <>
                    <label className="block">
                      <span className="text-cjk-safe mb-1 block text-[11px] font-semibold text-[var(--tr-ink-2)]">
                        제목
                      </span>
                      <input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="h-11 w-full rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 text-[14px]"
                        data-testid="bulk-subject"
                      />
                    </label>
                    <label className="block">
                      <span className="text-cjk-safe mb-1 block text-[11px] font-semibold text-[var(--tr-ink-2)]">
                        내용 — 여기서 고친 그대로 나갑니다
                      </span>
                      <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={10}
                        className="w-full rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-2 text-[13px] leading-relaxed"
                        data-testid="bulk-body"
                      />
                    </label>

                    {notEmailable.length > 0 && (
                      <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 dark:bg-amber-500/10">
                        <p className="flex items-start gap-1.5 text-[12px] font-bold text-amber-900 dark:text-amber-200">
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                          <span className="text-cjk-body">
                            이메일 주소가 없어 {notEmailable.length}명은 제외됩니다 — 왓츠앱 탭에서 보내주세요.
                          </span>
                        </p>
                        <p className="text-cjk-body mt-1 pl-5 text-[11px] text-amber-800 dark:text-amber-300">
                          {notEmailable.map((r) => r.guestName).join(', ')}
                        </p>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => void send()}
                      disabled={sending || emailable === 0 || !subject.trim() || !body.trim()}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--tr-ink)] text-[14px] font-bold text-[var(--tr-canvas)] disabled:opacity-50"
                      data-testid="bulk-send"
                    >
                      {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                      <span className="text-cjk-safe">{emailable}명에게 일괄 발송</span>
                    </button>

                    {result && (
                      <div className="rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-2.5">
                        <p className="flex items-center gap-1.5 text-[13px] font-bold">
                          <CheckCircle2 className="size-4 text-emerald-600" />
                          <span className="text-cjk-body">
                            발송 {result.sent} · 실패 {result.failed} · 제외 {result.skipped}
                          </span>
                        </p>
                        {result.failures.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5 pl-5">
                            {result.failures.map((f) => (
                              <li key={f.guestName} className="text-cjk-body list-disc text-[11px] text-[var(--tr-danger)]">
                                {f.guestName}: {f.error}
                              </li>
                            ))}
                          </ul>
                        )}
                        {result.skippedDetail.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5 pl-5">
                            {result.skippedDetail.map((s) => (
                              <li key={s.guestName} className="text-cjk-body list-disc text-[11px] text-[var(--tr-ink-3)]">
                                {s.guestName}: {SKIP_REASON_LABEL[s.reason] ?? s.reason}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* 수신자별 렌더 결과 — 로케일이 섞이면 사람마다 다른 문구가 나간다.
                        그 사실을 숨기지 않는다. */}
                    {preview && preview.recipients.length > 0 && (
                      <details className="rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-2">
                        <summary className="text-cjk-safe cursor-pointer text-[12px] font-semibold text-[var(--tr-ink-2)]">
                          수신자별 미리보기 ({preview.recipients.length}명)
                        </summary>
                        <ul className="mt-2 space-y-2">
                          {preview.recipients.map((r) => (
                            <li key={r.bookingId} className="rounded-lg bg-[var(--tr-surface-2)] px-2.5 py-2">
                              <p className="text-[12px] font-bold">
                                {r.guestName}{' '}
                                <span className="font-normal text-[var(--tr-ink-3)]">
                                  {r.locale} · {r.email ?? '이메일 없음'}
                                </span>
                              </p>
                              {r.missing.length > 0 && (
                                <p className="text-cjk-body mt-0.5 text-[11px] text-[var(--tr-danger)]">
                                  비어 있는 항목: {r.missing.join(', ')}
                                </p>
                              )}
                              <pre className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-[var(--tr-ink-2)]">
                                {r.body}
                              </pre>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
