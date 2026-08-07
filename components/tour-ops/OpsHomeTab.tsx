'use client';

/**
 * 관제센터 홈 — the ops hub: today's vitals + one-tap entry into every ops
 * job (룸/링크 만들기, 모니터링, 메시지 모아보기, 위치, 문답 학습). The tiles
 * exist so an operator never has to remember which tab or admin page owns a
 * task — the hub is the task list.
 */

import { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Bot,
  CalendarRange,
  Send,
  FileBarChart,
  GraduationCap,
  History,
  Inbox,
  Link2,
  MailCheck,
} from 'lucide-react';
import { isRecent, type OpsRoom, type SosInfo } from '@/components/tour-ops/opsShared';
import type { AttentionItem } from '@/lib/tour-ops/attention';
import type { OpsTab } from '@/components/tour-ops/OpsApp';

export default function OpsHomeTab({
  rooms,
  sosRooms,
  attention,
  unreadTotal,
  onNavigate,
  onOpenManager,
  onOpenInbox,
  onOpenReview,
  onOpenRoomHistory,
  onOpenSchedule,
  onOpenAutopilot,
  onOpenMessaging,
  managerOpen = false,
}: {
  rooms: OpsRoom[];
  sosRooms: Map<string, SosInfo>;
  attention: AttentionItem[];
  unreadTotal: number;
  onNavigate: (tab: OpsTab) => void;
  onOpenManager: () => void;
  onOpenInbox: () => void;
  onOpenReview?: () => void;
  /** W3 — 월 범위 투어룸 내역 시트. */
  onOpenRoomHistory?: () => void;
  /** W4 — 가이드·차량 월 달력 시트. */
  onOpenSchedule?: () => void;
  /** W5 — 오토파일럿 제안 큐(제안만, 실행 없음). */
  onOpenAutopilot?: () => void;
  /** M4 — 손님 안내 보내기(이메일 일괄 + 왓츠앱 순차). */
  onOpenMessaging?: () => void;
  /** 룸·링크 관리 시트가 열려 있나. 닫히면 미배차 수를 다시 읽는다. */
  managerOpen?: boolean;
}) {
  const liveCount = rooms.filter(
    (room) =>
      isRecent(room.last_message?.created_at) ||
      room.participants.some((participant) => isRecent(participant.last_seen_at)),
  ).length;
  const sosCount = sosRooms.size;

  /**
   * 오늘 미배차 팀 수 — 허브에서 바로 보이는 유일한 배차 신호.
   *
   * 🔴 왜 여기까지 올리나. 배차 버튼은 2026-07-27에 이미 목록 행으로 올라왔는데도
   * 사장님이 또 "배차할 곳이 없다"고 했다. 버튼이 있어도 **열어보기 전에는 열어야
   * 할 이유를 알 수 없었기** 때문이다. 라이브 배차가 역대 1건인 게 그 결과다.
   * 팀(투어) 단위로 센다 — 예약 단위로 세면 조인 한 팀이 9로 부풀어 숫자가
   * 규모를 뜻하게 되고 「해야 할 일」을 뜻하지 않게 된다(목록의 집계와 같은 규칙).
   *
   * 실패하면 조용히 배지를 숨긴다. 배차 현황을 못 읽은 것을 「미배차 0」으로
   * 그리는 건 0을 초록으로 읽는 것과 같은 종류의 거짓말이다.
   */
  const [unassignedTeams, setUnassignedTeams] = useState<number | null>(null);
  /**
   * 🔴 배차는 이 화면 밖(룸·링크 관리 시트 → 룸 드로어)에서 일어난다. 마운트에서
   * 한 번만 읽으면, 배차를 끝내고 시트를 닫고 돌아온 운영자에게 허브가 낡은
   * 「미배차 N팀」을 계속 말한다. 시트가 닫힐 때 다시 읽는다.
   */
  const [dispatchEpoch, setDispatchEpoch] = useState(0);
  const prevManagerOpen = useRef(managerOpen);
  useEffect(() => {
    if (prevManagerOpen.current && !managerOpen) setDispatchEpoch((n) => n + 1);
    prevManagerOpen.current = managerOpen;
  }, [managerOpen]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      // 🔴 한 번만 쏘면 안 된다 — `getOpsToken`은 Supabase 세션에서 액세스
      // 토큰을 꺼내는데, 허브는 그 세션이 복원되기 전에 마운트된다. 실측에서
      // 첫 시도가 "세션이 만료되었습니다"로 던졌고, 배지는 영영 안 떴다.
      // 조용히 실패하는 배지는 「미배차 0」과 구별이 안 된다. 그래서 포기하지
      // 않고 상한(≈1분)까지 물러서며 다시 시도한다.
      for (let attempt = 0; attempt < 8 && alive; attempt += 1) {
        try {
          const { getOpsToken } = await import('@/components/tour-ops/opsShared');
          const token = await getOpsToken();
          const res = await fetch('/api/admin/tour-ops/bookings', {
            headers: { Authorization: `Bearer ${token}` },
            credentials: 'include',
            cache: 'no-store',
          });
          if (!res.ok) throw new Error(String(res.status));
          const json = (await res.json()) as {
            bookings?: Array<{ tour?: { title?: string } | null; vehicles?: unknown[] }>;
          };
          if (!alive || !Array.isArray(json.bookings)) return;
          setUnassignedTeams(
            new Set(
              json.bookings
                .filter((b) => (b.vehicles?.length ?? 0) === 0)
                .map((b) => b.tour?.title ?? '기타'),
            ).size,
          );
          return;
        } catch {
          await new Promise((r) => setTimeout(r, Math.min(1200 * (attempt + 1), 12_000)));
        }
      }
      /* 여덟 번 다 실패 = 배지 없음. 모르는 것을 0으로 그리지 않는다. */
    })();
    return () => {
      alive = false;
    };
  }, [dispatchEpoch]);

  // §11.E 수동 원버튼 [지금 보고서 발송] — POST /api/cron/ops-daily-report (force=true).
  const [reportState, setReportState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [reportMsg, setReportMsg] = useState<string>('');
  const sendReport = async () => {
    if (reportState === 'sending') return;
    setReportState('sending');
    setReportMsg('');
    try {
      const res = await fetch('/api/cron/ops-daily-report', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as {
        sent?: boolean;
        recipient?: string;
        attentionTotal?: number | null;
        error?: string;
      };
      if (res.ok && data.sent) {
        setReportState('sent');
        setReportMsg(`${data.recipient ?? '수신자'}에게 발송 완료${
          typeof data.attentionTotal === 'number' ? ` · 요주의 ${data.attentionTotal}건` : ''
        }`);
      } else {
        setReportState('error');
        setReportMsg(data.error ?? '발송 실패 — 잠시 후 다시 시도하세요.');
      }
    } catch {
      setReportState('error');
      setReportMsg('네트워크 오류 — 다시 시도하세요.');
    }
  };

  type Stat = { label: string; value: number; tone?: 'red' | 'amber' | 'emerald' };

  /** Something is wrong and a person must act. */
  const exceptionStats: Stat[] = [
    { label: '응대 필요', value: attention.length, tone: attention.length ? 'amber' : undefined },
    { label: 'SOS', value: sosCount, tone: sosCount ? 'red' : undefined },
  ];
  /** How big today is. Useful, never urgent. */
  const contextStats: Stat[] = [
    { label: '오늘 룸', value: rooms.length },
    { label: 'LIVE', value: liveCount, tone: 'emerald' },
    { label: '안읽음', value: unreadTotal },
  ];

  /**
   * The single accent action, chosen by what the day actually needs.
   *
   * Guests waiting on a reply outrank everything else that is not an SOS;
   * otherwise the morning job is issuing guide/driver links and assigning
   * vehicles, which is the tile an operator opens first every single day.
   */
  const primary = attention.length
    ? {
        title: `응대 필요 ${attention.length}건 처리`,
        // The queue itself lives on the dashboard tab (`ops-attention-queue`).
        desc: '기다리는 손님부터 — 대시보드 큐로',
        run: () => onNavigate('dashboard'),
      }
    : {
        // Deliberately not the tile's own name. A primary says what you are
        // about to do; repeating the destination put the same words on screen
        // twice and made the button read as a duplicate of the tile below it.
        title: '오늘 링크 · 배차 시작',
        desc: '가이드·기사 링크 발급 · 차량 배정 · QR',
        run: onOpenManager,
      };

  /** 묶음 머리글의 색 막대 — 그 묶음에서 가장 자주 눌리는 타일의 색을 쓴다. */
  const GROUP_HUE: Record<'today' | 'review' | 'analysis', string> = {
    today: 'pine',
    review: 'clay',
    analysis: 'plum',
  };

  const GROUPS: Array<{ key: 'today' | 'review' | 'analysis'; label: string }> = [
    { key: 'today', label: '오늘 운영' },
    { key: 'review', label: '검토 · 배차' },
    { key: 'analysis', label: '분석 · 보고' },
  ];

  const tiles: Array<{
    key: string;
    title: string;
    desc: string;
    icon: typeof Link2;
    /**
     * Which band the tile belongs to. Ten identical cards in one flat grid is
     * the defect this fixes: nothing about the grid said that 배정·룸·링크 is
     * touched every morning while 챗봇 분석 is touched once a month, so the
     * operator re-read all ten every time.
     */
    group: 'today' | 'review' | 'analysis';
    /**
     * 이 목적지의 색. 장식이 아니라 **주소**다 — 같은 자리에 늘 같은 색이 있으면
     * 두 번째부터는 읽지 않고 집는다. 값은 `--tr-tile-<hue>` 토큰과 짝이다.
     */
    hue: 'pine' | 'teal' | 'indigo' | 'plum' | 'clay' | 'slate';
    badge?: number;
    badgeTone?: 'red' | 'amber' | 'blue';
    onClick?: () => void;
    href?: string;
  }> = [
    {
      key: 'manager',
      hue: 'pine',
      group: 'today',
      title: '배정 · 룸 · 링크',
      desc:
        unassignedTeams && unassignedTeams > 0
          ? `미배차 ${unassignedTeams}팀 — 배차해야 손님이 좌석을 고를 수 있어요`
          : '가이드·기사 링크 발급 · 차량 배정 · QR · 초대 메일',
      icon: Link2,
      badge: unassignedTeams && unassignedTeams > 0 ? unassignedTeams : undefined,
      badgeTone: 'amber',
      onClick: onOpenManager,
    },
    {
      key: 'inbox',
      hue: 'teal',
      group: 'today',
      title: '메시지 모아보기',
      desc: '모든 룸의 메시지를 한 타임라인으로',
      icon: Inbox,
      onClick: onOpenInbox,
    },
    {
      key: 'review',
      group: 'review',
      hue: 'clay',
      title: '인박스 리뷰 큐',
      desc: 'OTA 메일 파싱 검토 · 승인 커밋 · 상품 매핑',
      icon: MailCheck,
      onClick: onOpenReview,
    },
    {
      key: 'messaging',
      hue: 'teal',
      group: 'today',
      title: '손님 안내 보내기',
      desc: '내일 투어 · 이메일 일괄 + 왓츠앱 순차 · 날씨 자동 포함',
      icon: Send,
      onClick: onOpenMessaging,
    },
    {
      key: 'autopilot',
      hue: 'clay',
      group: 'review',
      title: '오토파일럿',
      desc: '미배정 · 미배차 · 단가 누락 점검 (제안만)',
      icon: Bot,
      onClick: onOpenAutopilot,
    },
    {
      key: 'room-history',
      hue: 'slate',
      group: 'today',
      title: '투어룸 생성 내역',
      desc: '이번 달 방 · 손님 미입장 방 찾기 · 엑셀',
      icon: History,
      onClick: onOpenRoomHistory,
    },
    {
      key: 'schedule',
      hue: 'indigo',
      group: 'review',
      title: '가이드 · 차량 달력',
      desc: '월 매트릭스 · 배정 충돌 · 휴무 한눈에',
      icon: CalendarRange,
      onClick: onOpenSchedule,
    },
    {
      key: 'qa',
      hue: 'plum',
      group: 'analysis',
      title: '문답 학습',
      desc: '컨시어지 Q&A 검토 · 승인 · 학습',
      icon: GraduationCap,
      href: '/admin/qa-review',
    },
    {
      key: 'analytics',
      hue: 'plum',
      group: 'analysis',
      title: '챗봇 분석',
      desc: '해결률 · 커버리지 갭 · 피드백',
      icon: BarChart3,
      href: '/admin/chatbot-analytics',
    },
    {
      key: 'daily-report',
      hue: 'indigo',
      group: 'analysis',
      title: reportState === 'sending' ? '보고서 발송 중…' : '지금 보고서 발송',
      desc: '오늘 실적 · 신규 · 내일 · 연락 · 요주의 每日報表',
      icon: FileBarChart,
      onClick: () => void sendReport(),
    },
  ];

  /**
   * 🔴 호박 배지의 숫자가 안 읽혔다. `--tr-warn` 은 라이트에서 짙은 갈색,
   * 다크에서 밝은 호박이라 **명도가 테마마다 뒤집히는데** 글자는 양쪽 다
   * `--tr-ink-3`(회색)로 찍고 있었다 — 어느 쪽에서도 대비가 안 난다.
   * 뒤집히는 배경에는 뒤집히는 글자색이 필요하다: `--tr-warn-ink`.
   */
  const badgeClass = (tone?: 'red' | 'amber' | 'blue') =>
    tone === 'red'
      ? 'bg-[var(--tr-danger)] text-white'
      : tone === 'amber'
        ? 'bg-[var(--tr-warn)] text-[var(--tr-warn-ink)]'
        : 'bg-[var(--tr-accent)] text-white';

  return (
    <div className="space-y-4 pb-4">
      {/*
        Vitals, in two bands rather than five equal boxes.

        🔴 The five-across grid gave `SOS 0` exactly the weight of `오늘 룸 4`.
        Tone only arrived once a value was non-zero, and even then it was a tint
        on a box the same size as the others — so the screen looked identical
        whether the day was calm or someone had pressed SOS. Exceptions and
        context are not the same kind of number and must not share a row.

        The `ops-kpi-*` testids and `data-kpi-tone` contract are unchanged;
        `opsHomeHierarchy.test.tsx` pins them.
      */}
      <div className="space-y-1.5" data-testid="ops-home-stats">
        <div className="grid grid-cols-2 gap-1.5">
          {exceptionStats.map(({ label, value, tone }) => {
            const hot = Boolean(value);
            return (
              <div
                key={label}
                data-testid={`ops-kpi-${label}`}
                data-kpi-tone={value ? (tone ?? 'none') : 'none'}
                className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 ${
                  hot && tone === 'red'
                    ? 'border-[var(--tr-danger)] bg-[var(--tr-danger-soft)]'
                    : hot && tone === 'amber'
                      ? 'border-[var(--tr-warn)] bg-[var(--tr-warn-soft)]'
                      : 'border-[var(--tr-hairline)] bg-[var(--tr-surface)]'
                }`}
              >
                <p
                  className={`tr-title font-bold tabular-nums ${
                    hot && tone === 'red'
                      ? 'text-[var(--tr-danger)]'
                      : hot && tone === 'amber'
                        ? 'text-[var(--tr-warn)]'
                        : 'text-[var(--tr-ink-3)]'
                  }`}
                >
                  {value}
                </p>
                <p
                  className={`text-cjk-safe tr-label ${
                    hot ? 'font-bold text-[var(--tr-ink)]' : 'text-[var(--tr-ink-3)]'
                  }`}
                >
                  {label}
                </p>
              </div>
            );
          })}
        </div>
        {/* Context: how big today is. Never an alarm, so it never looks like one. */}
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-2">
          {contextStats.map(({ label, value, tone }) => (
            <div
              key={label}
              data-testid={`ops-kpi-${label}`}
              data-kpi-tone={value ? (tone ?? 'none') : 'none'}
              className="flex items-baseline gap-1.5"
            >
              <span
                className={`tr-card-text font-bold tabular-nums ${
                  tone === 'emerald' && value ? 'text-[var(--tr-safe)]' : 'text-[var(--tr-ink)]'
                }`}
              >
                {value}
              </span>
              <span className="text-cjk-safe tr-meta text-[var(--tr-ink-3)]">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/*
        The one thing to press.

        🔴 This screen had no accent control at all — eighteen controls, every
        one of them a white card or a plain counter, so nothing won and the
        operator had to read the whole grid to decide what to do. What the
        primary points at changes with the day: unanswered guests first, then
        the morning's real job (issuing links and assigning vehicles). SOS is
        deliberately NOT this button — an alarm is not an action, and it keeps
        its own louder red banner directly below.
      */}
      <button
        type="button"
        data-testid="ops-primary"
        onClick={primary.run}
        className="tr-cta-hero text-cjk-safe justify-between text-left"
      >
        <span className="min-w-0">
          <span className="block font-bold">{primary.title}</span>
          <span className="mt-0.5 block tr-meta opacity-80">{primary.desc}</span>
        </span>
        <span aria-hidden className="shrink-0 font-bold">
          →
        </span>
      </button>

      {/* SOS shortcut rides above the tiles only while one is active. */}
      {sosCount > 0 && (
        <button
          type="button"
          onClick={() => onNavigate('sos')}
          className="text-cjk-safe flex w-full items-center justify-between rounded-2xl border border-[var(--tr-danger-soft)] bg-[var(--tr-danger-soft)]   px-4 py-3 text-left"
        >
          <span className="tr-card-text font-bold text-[var(--tr-danger)] ">
            <span className="animate-pulse">🆘</span> 활성 SOS {sosCount}건 — 지금 확인
          </span>
          <span className="tr-label text-[var(--tr-danger)] ">SOS 탭 →</span>
        </button>
      )}

      {/* §11.E 일일 보고서 발송 결과 배너 */}
      {reportState === 'sent' && (
        <div className="rounded-2xl border border-[var(--tr-safe-soft)] bg-[var(--tr-safe-soft)] px-4 py-2.5 tr-label font-semibold text-[var(--tr-safe)]   ">
          ✓ 일일 보고서 발송 완료 — {reportMsg}
        </div>
      )}
      {reportState === 'error' && (
        <div className="rounded-2xl border border-[var(--tr-danger-soft)] bg-[var(--tr-danger-soft)] px-4 py-2.5 tr-label font-semibold text-[var(--tr-danger)]   ">
          보고서 발송 실패 — {reportMsg}
        </div>
      )}

      {/*
        Action tiles, in three named bands.

        Same ten destinations, same testids — what changes is that the grid no
        longer claims they are peers. A band heading is cheaper than teaching
        every operator which of ten identical cards is the one they need.
      */}
      <div className="space-y-3" data-testid="ops-home-tiles">
        {GROUPS.map(({ key: groupKey, label }) => {
          const inGroup = tiles.filter((t) => t.group === groupKey);
          if (inGroup.length === 0) return null;
          return (
            <section key={groupKey} data-testid={`ops-tile-group-${groupKey}`}>
              {/* 머리글도 회색 글자 한 줄이었다. 짧은 색 막대 하나가 「여기서
                  새 묶음이 시작된다」를 글자보다 먼저 말한다. */}
              <h2 className="text-cjk-safe flex items-center gap-2 px-1 pb-2 tr-label font-bold uppercase tracking-wide text-[var(--tr-ink-2)]">
                <span
                  aria-hidden
                  className="h-3.5 w-1 shrink-0 rounded-full"
                  style={{ background: `var(--tr-tile-${GROUP_HUE[groupKey]})` }}
                />
                {label}
              </h2>
              {/* 관제는 폰과 데스크톱에서 같이 쓰인다. 2열 고정이면 넓은 화면에서
                  타일 하나가 500px 짜리 현수막이 되고 세 묶음이 스크롤 밖으로
                  밀린다 — 넓어지면 열을 늘려 한 화면에 담는다. */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">{inGroup.map(renderTile)}</div>
            </section>
          );
        })}
      </div>
    </div>
  );

  function renderTile({ key, title, desc, icon: Icon, hue, badge, badgeTone, onClick, href }: (typeof tiles)[number]) {
    /**
     * 배지가 붙은 타일은 자기 색을 잠시 내려놓고 경고색을 쓴다 — 「지금 봐야
     * 한다」가 「이건 배차 메뉴다」를 이겨야 하고, 한 카드에 두 색이 다투면
     * 둘 다 안 읽힌다.
     */
    const alert = badge ? (badgeTone === 'red' ? 'danger' : 'warn') : null;
    const ink = alert ? `var(--tr-${alert})` : `var(--tr-tile-${hue})`;
    const wash = alert ? `var(--tr-${alert}-soft)` : `var(--tr-tile-${hue}-soft)`;

    const body = (
      <>
        <span className="relative inline-flex">
          {/* 칩: 색면 + 안쪽 링 + 위쪽 하이라이트. 회색 사각형이 아니라 물건처럼. */}
          <span
            className="flex size-10 items-center justify-center rounded-[14px]"
            style={{
              background: wash,
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${ink} 22%, transparent), var(--tr-rim)`,
            }}
          >
            <Icon className="size-[19px]" style={{ color: ink }} strokeWidth={1.9} />
          </span>
          {badge ? (
            <span
              className={`absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 tr-meta font-bold ${badgeClass(badgeTone)}`}
            >
              {badge > 99 ? '99+' : badge}
            </span>
          ) : null}
        </span>
        <span className="mt-2.5 block tr-card-text font-bold text-[var(--tr-ink)]">{title}</span>
        <span className="mt-1 block tr-meta leading-snug text-[var(--tr-ink-3)]">{desc}</span>
      </>
    );

    /**
     * 카드 자체도 흰 사각형이 아니다: 자기 색을 아주 옅게 깐 코너 워시 + 색을
     * 머금은 테두리 + 두 겹 그림자. 워시는 아이콘 쪽(좌상단)에서 나와 대각선으로
     * 사라지므로, 제목·설명이 앉는 자리는 그대로 깨끗한 표면이다.
     */
    const className =
      'group relative block min-h-[116px] overflow-hidden rounded-[18px] p-3.5 text-left ' +
      'transition-[transform,box-shadow] duration-150 active:translate-y-px';
    const style = {
      background: `radial-gradient(120% 100% at 0% 0%, color-mix(in srgb, ${ink} 9%, transparent) 0%, transparent 62%), var(--tr-surface)`,
      boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${ink} 16%, var(--tr-hairline)), var(--tr-rim), var(--tr-elev-1)`,
    } as const;

    // O0 — every ops overlay is reached through one of these tiles, so the
    // walk opens them by key rather than by Korean title text (which O2
    // re-typesets and O5 may reword).
    return href ? (
      <a key={key} href={href} className={className} style={style} data-testid={`ops-tile-${key}`} data-tile-hue={hue}>
        {body}
      </a>
    ) : (
      <button
        key={key}
        type="button"
        onClick={onClick}
        className={className}
        style={style}
        data-testid={`ops-tile-${key}`}
        data-tile-hue={hue}
      >
        {body}
      </button>
    );
  }
}
