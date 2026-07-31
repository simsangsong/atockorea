// AtoC 통합 §11.E — 일일 보고서 이메일 렌더 (모바일 우선 HTML).
//
// 순수 함수: DailyReport → { subject, html }. 네트워크 0, LLM 0. 기존 이메일
// 템플릿 관례(lib/email-templates/admin-booking-alert.ts) 준수 — 테이블 기반
// 인라인 스타일, esc()/money() 헬퍼, ATOC KOREA 다크 헤더 + 아이보리 본문.
//
// 레이아웃: max-width 560 단일 컬럼(모바일 우선), 섹션별 앵커, 각 섹션 카드.
// 섹션 집계 실패(SectionResult.ok=false)는 카드에 붉은 "집계 실패" 배너로 표시
// (한 섹션 실패가 보고서 전체를 막지 않는다는 계약을 UI로 드러냄).

import type {
  DailyReport,
  TodayTour,
  NewBookingsSummary,
  TomorrowTour,
  ContactStatus,
  AttentionSummary,
  SectionResult,
} from './daily'

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function money(amount: number | null | undefined, currency?: string | null): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—'
  const cur = (currency || 'KRW').toUpperCase()
  const formatted = amount.toLocaleString('en-US', { maximumFractionDigits: cur === 'KRW' ? 0 : 2 })
  return cur === 'KRW' ? `₩${formatted}` : `${formatted} ${cur}`
}

function krw(amount: number): string {
  return `₩${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

/** timestamptz → HH:MM KST (없으면 —). */
function hhmmKst(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

const C = {
  ink: '#1c1917',
  sub: '#8a8578',
  hair: '#f0ece1',
  card: '#ffffff',
  cardBorder: '#e7e2d5',
  bg: '#f4f1e9',
  brass: '#b08d3e',
  red: '#b91c1c',
  redBg: '#fef2f2',
  redBorder: '#fecaca',
  green: '#166534',
  greenBg: '#dcfce7',
  amber: '#92700c',
  amberBg: '#fdf3d7',
}

function sectionCard(anchor: string, no: string, title: string, inner: string, failed?: SectionResult<unknown>): string {
  const banner =
    failed && !failed.ok
      ? `<div style="margin:0 0 12px;padding:10px 12px;background:${C.redBg};border:1px solid ${C.redBorder};border-radius:10px;color:${C.red};font-size:12px;line-height:1.5;">⚠ 이 섹션 집계에 실패했습니다 (다른 섹션은 정상). <span style="color:${C.sub}">${esc(
          failed.error ?? '',
        ).slice(0, 160)}</span></div>`
      : ''
  return `<a name="${anchor}"></a>
  <div style="margin:0 0 14px;background:${C.card};border:1px solid ${C.cardBorder};border-radius:16px;overflow:hidden;">
    <div style="padding:14px 18px 10px;border-bottom:1px solid ${C.hair};">
      <span style="display:inline-block;min-width:22px;height:22px;line-height:22px;text-align:center;background:${C.ink};color:#fff;font-size:12px;font-weight:700;border-radius:7px;">${no}</span>
      <span style="margin-left:8px;font-size:15px;font-weight:700;color:${C.ink};">${esc(title)}</span>
    </div>
    <div style="padding:14px 18px;">${banner}${inner}</div>
  </div>`
}

function emptyLine(text: string): string {
  return `<p style="margin:0;color:${C.sub};font-size:13px;">${esc(text)}</p>`
}

// ── ① 오늘 투어 실적 ────────────────────────────────────────────────────────
function renderToday(res: SectionResult<TodayTour[]>): string {
  const tours = res.data
  if (tours.length === 0) return emptyLine('오늘 진행된 투어가 없습니다.')
  const blocks = tours
    .map((t: TodayTour) => {
      const assign =
        [
          t.guides.length ? `가이드 ${t.guides.map(esc).join(', ')}` : `<span style="color:${C.red}">가이드 미배정</span>`,
          t.drivers.length ? `기사 ${t.drivers.map(esc).join(', ')}` : `<span style="color:${C.red}">기사 미배정</span>`,
        ].join(' · ')
      const checkin =
        t.seatCount === null
          ? `<span style="color:${C.sub}">체크인 데이터 없음</span>`
          : `체크인 ${t.checkedIn ?? 0}/${t.seatCount}${(t.noShow ?? 0) > 0 ? ` · <span style="color:${C.red}">노쇼 ${t.noShow}</span>` : ''}`
      const times = `${hhmmKst(t.startedAt)} → ${hhmmKst(t.endedAt)}`
      const extras = t.extrasKrw > 0 ? ` · 추가 ${krw(t.extrasKrw)}` : ''
      return `<div style="padding:10px 0;border-bottom:1px solid ${C.hair};">
        <div style="font-size:14px;font-weight:700;color:${C.ink};">${esc(t.tourTitle)}${
          t.city ? ` <span style="color:${C.sub};font-weight:400;font-size:12px;">${esc(t.city)}</span>` : ''
        }</div>
        <div style="margin-top:3px;font-size:12px;color:${C.ink};">총 ${t.totalGuests}명 · ${t.roomCount}룸 · ${assign}</div>
        <div style="margin-top:2px;font-size:12px;color:${C.sub};">${checkin} · ${times}${extras}</div>
      </div>`
    })
    .join('')
  return blocks
}

// ── ② 오늘 신규 예약 ────────────────────────────────────────────────────────
function renderNew(res: SectionResult<NewBookingsSummary>): string {
  const s = res.data
  if (s.total === 0) return emptyLine('오늘 신규 예약이 없습니다.')
  const commitChips = `<span style="color:${C.green}">자동 ${s.byCommit.auto}</span> · <span style="color:${C.amber}">리뷰 ${s.byCommit.review}</span> · 수동 ${s.byCommit.manual}`
  const channelStrip = s.byChannel
    .map((c) => `${esc(c.channel)} ${c.count}건`)
    .join(' · ')
  const rows = s.bookings
    .map((b) => {
      const commitTag =
        b.commit === 'auto'
          ? `<span style="color:${C.green}">auto</span>`
          : b.commit === 'review'
            ? `<span style="color:${C.amber}">review</span>`
            : `<span style="color:${C.sub}">수동</span>`
      return `<tr>
        <td style="padding:6px 0;font-size:12px;color:${C.ink};">${esc(b.name || 'Guest')} <span style="color:${C.sub}">(${b.guests}명)</span></td>
        <td style="padding:6px 0;font-size:12px;color:${C.sub};text-align:right;white-space:nowrap;">${esc(b.source)} · ${commitTag}</td>
        <td style="padding:6px 0 6px 10px;font-size:12px;color:${C.ink};text-align:right;white-space:nowrap;">${money(b.amount, b.currency)}</td>
      </tr>`
    })
    .join('')
  return `<div style="font-size:13px;font-weight:700;color:${C.ink};">총 ${s.total}건 &nbsp; <span style="font-weight:400;font-size:12px;color:${C.sub};">${channelStrip}</span></div>
    <div style="margin-top:2px;font-size:12px;">${commitChips}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border-collapse:collapse;">${rows}</table>`
}

// ── ③ 내일 투어 예정 ────────────────────────────────────────────────────────
function renderTomorrow(res: SectionResult<TomorrowTour[]>): string {
  const tours = res.data
  if (tours.length === 0) return emptyLine('내일 예정된 투어가 없습니다.')
  return tours
    .map((t: TomorrowTour) => {
      const badge = (ok: boolean, label: string) =>
        ok
          ? `<span style="display:inline-block;padding:1px 7px;border-radius:999px;background:${C.greenBg};color:${C.green};font-size:11px;font-weight:700;">${label} ✓</span>`
          : `<span style="display:inline-block;padding:1px 7px;border-radius:999px;background:${C.redBg};color:${C.red};font-size:11px;font-weight:700;">${label} 미배정</span>`
      const pickups =
        t.pickups.length === 0
          ? `<span style="color:${C.sub}">픽업 정보 없음</span>`
          : t.pickups
              .map((p) => `${esc(p.name)}${p.firstTime ? ` ${esc(p.firstTime)}` : ''} (${p.pax}명)`)
              .join(' · ')
      const vehicles = t.vehicles.length ? esc(t.vehicles.join(', ')) : `<span style="color:${C.sub}">차량 미배정</span>`
      return `<div style="padding:10px 0;border-bottom:1px solid ${C.hair};">
        <div style="font-size:14px;font-weight:700;color:${C.ink};">${esc(t.tourTitle)} <span style="color:${C.sub};font-weight:400;font-size:12px;">총 ${t.totalGuests}명 · ${t.roomCount}룸</span></div>
        <div style="margin-top:4px;">${badge(t.guideAssigned, '가이드')} ${badge(t.driverAssigned, '기사')} <span style="margin-left:4px;font-size:12px;color:${C.ink};">🚐 ${vehicles}</span></div>
        <div style="margin-top:4px;font-size:12px;color:${C.sub};">📍 ${pickups}</div>
      </div>`
    })
    .join('')
}

// ── ④ 손님 연락 현황 ────────────────────────────────────────────────────────
function renderContact(res: SectionResult<ContactStatus>): string {
  const s = res.data
  if (s.rows.length === 0) return emptyLine('내일 투어 손님이 없습니다.')
  const rows = s.rows
    .map((r) => {
      const wa = r.waMarkedSentAt ? '발송✓' : r.waOpenedAt ? '열람' : '—'
      const email = r.emailedAt ? '발송✓' : '—'
      const style = r.missing
        ? `background:${C.redBg};`
        : ''
      const nameColor = r.missing ? C.red : C.ink
      return `<tr style="${style}">
        <td style="padding:6px 8px;font-size:12px;color:${nameColor};font-weight:${r.missing ? 700 : 400};">${
          r.missing ? '🔴 ' : ''
        }${esc(r.name || 'Guest')} <span style="color:${C.sub};font-weight:400;">(${r.guests})</span></td>
        <td style="padding:6px 8px;font-size:12px;color:${C.sub};text-align:center;">WA ${wa}</td>
        <td style="padding:6px 8px;font-size:12px;color:${C.sub};text-align:center;">✉ ${email}</td>
      </tr>`
    })
    .join('')
  const head = s.missingCount
    ? `<div style="margin:0 0 8px;padding:8px 12px;background:${C.redBg};border:1px solid ${C.redBorder};border-radius:10px;color:${C.red};font-size:12px;font-weight:700;">연락 누락 ${s.missingCount}명 — 아래 빨간 행 우선 처리</div>`
    : `<div style="margin:0 0 8px;color:${C.green};font-size:12px;font-weight:700;">전원 연락 완료 ✓</div>`
  return `${head}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>`
}

// ── ⑤ 요주의 종합 ──────────────────────────────────────────────────────────
/**
 * FA-014 — 오늘 도착이 몇 건 기록됐나, 두 소스를 나눠서.
 *
 * 커버리지 122/124는 "말할 수 있다"이고 이 숫자는 "말했다"다. 두 소스를 갈라
 * 적는 이유: 수동 [도착]과 지오펜스는 다른 테이블에 떨어지고, 어느 쪽이 안 되는지
 * 모르면 고칠 수가 없다(매트릭스가 한 쪽만 읽어 몇 달을 비어 있었다).
 *
 * 투어가 없던 날은 `null` — 0이 정상인 날에 뜨는 경고는 다음 날부터 안 읽힌다.
 */
function arrivalsLine(a: AttentionSummary): string {
  if (!a.arrivals) return ''
  const { recorded, toursToday, sources } = a.arrivals
  return `<div style="margin-top:6px;font-size:11px;color:${recorded === 0 ? C.red : C.sub};">도착 기록 ${recorded}건 (수동 ${sources.manual} · 지오펜스 ${sources.geofence}) · 오늘 투어 ${toursToday}건</div>`
}

/**
 * 🔴 요주의 항목 — **한 곳에서만 센다.**
 *
 * 사장님이 2026-07-30 18:00 보고서를 캡처해 보내주셨다. 상단 배지와 제목은
 * "이상 없음"인데, 같은 메일 ⑤번 목록에는 **오토파일럿 미처리 제안 23건이
 * 빨갛게, 체크 안 된 채로** 들어 있었다. 헤드라인이 거짓말을 하고 있었던 것이다.
 *
 * 원인은 두 곳에서 센 것이다: `attentionTotal`(배지·제목)은 7개 필드를 손으로
 * 더하면서 `autopilotOpen` 을 빠뜨렸고, ⑤번의 "이상 없음" 판단(`clean`)은 그걸
 * 포함했다. 이 파일의 다른 주석이 이미 경고하고 있던 바로 그 형태다 —
 * **"같은 숫자를 두 곳에서 계산하면 반드시 어긋난다"(§H-4).**
 *
 * (같은 함정에 하나 더 빠져 있었다: FA-014 로 넣은 `arrivals` 도 `clean` 에만
 * 있고 `attentionTotal` 에는 없었다. 투어가 돌고 도착이 0인 날, 목록은 그걸
 * 띄우는데 배지는 "이상 없음"이라 말했을 것이다.)
 *
 * 그래서 목록·합계·배지·제목·"이상 없음" 배너가 **전부 이 함수 하나**를 읽는다.
 * 새 항목을 여기 추가하면 다섯 곳이 동시에 안다.
 */
export function attentionItems(a: AttentionSummary): Array<{ label: string; n: number }> {
  const items: Array<{ label: string; n: number }> = [
    { label: '가이드/기사 미배정 투어 (내일)', n: a.unassignedRooms },
    { label: '손님 연락 누락', n: a.uncontacted },
    { label: '인박스 리뷰 큐 대기', n: a.reviewQueued },
    { label: '파싱 실패 (오늘)', n: a.parseFailures },
    { label: '좌석 미지정 게스트', n: a.unseated },
    { label: '정원 초과 그룹 (2호차 필요)', n: (a.overCapacity ?? []).length },
    // 관제 W5 — 크론이 채운 큐를 아무도 안 열면 큐가 없는 것과 같다.
    { label: '오토파일럿 미처리 제안', n: a.autopilotOpen ?? 0 },
    { label: 'LLM 예산 초과 투어', n: (a.llm?.overBudgetTours ?? []).length },
  ]
  /**
   * 🔴 FA-014 — 투어가 돌았는데 도착 기록이 0이면 그것만 요주의다.
   *
   * 도착이 1건이라도 있으면 이 줄은 목록에 끼지 않는다(조용한 계측 한 줄로만
   * 남는다). 매일 뜨는 항목은 곧 안 보이는 항목이 된다.
   */
  if (a.arrivals && a.arrivals.recorded === 0) {
    items.push({ label: `도착 기록 0건 (오늘 투어 ${a.arrivals.toursToday}건)`, n: a.arrivals.toursToday })
  }
  return items
}

/** 합계 = 목록의 합. 배지·제목·배너가 같은 값을 본다. */
export function attentionCount(a: AttentionSummary): number {
  return attentionItems(a).reduce((sum, it) => sum + it.n, 0)
}

/** 깨끗한 날에도 큐가 쌓여 있으면 그 사실은 보인다(arrivalsLine 과 같은 이유). */
function staleNote(a: AttentionSummary): string {
  if (!a.autopilotStale) return ''
  return `<div style="margin-top:4px;font-size:11px;color:${C.sub};">지난 날짜 오토파일럿 제안 ${a.autopilotStale}건 — 조치 불가, /admin/tour-ops 큐 정리 대상</div>`
}

function renderAttention(res: SectionResult<AttentionSummary>): string {
  const a = res.data
  if (res.ok && attentionCount(a) === 0) {
    /**
     * FA-014 — 조용한 계측은 좋은 날에도 보인다.
     *
     * 처음엔 이 줄을 요주의 목록 옆에만 뒀는데, 그러면 "이상 없음"인 날에는
     * 숫자가 통째로 사라진다. 매일 보이지 않는 계측은 0으로 떨어진 날에도
     * 눈에 걸리지 않는다 — FA-014가 전 기간 보이지 않은 이유가 정확히 그것이다.
     */
    return `<div style="padding:16px;background:${C.greenBg};border:1px solid #bbf7d0;border-radius:12px;text-align:center;color:${C.green};font-size:15px;font-weight:800;">✓ 이상 없음 — 오늘 처리할 요주의 항목이 없습니다</div>${arrivalsLine(a)}${staleNote(a)}`
  }
  const items = attentionItems(a)
  const rows = items
    .map((it) => {
      const flagged = it.n > 0
      return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid ${C.hair};">
        <span style="font-size:13px;color:${flagged ? C.ink : C.sub};">${flagged ? '☐' : '☑'} ${esc(it.label)}</span>
        <span style="font-size:13px;font-weight:700;color:${flagged ? C.red : C.sub};">${it.n}</span>
      </div>`
    })
    .join('')

  // §K B2.3 — 초과는 숫자만으로는 조치가 안 된다. 어느 투어가 몇 명 초과인지
  // 적어야 운영자가 2호차를 부를 수 있다. 문구는 capacity.ts가 만든 것 그대로.
  // §L L6 — 예산 안이어도 오늘 쓴 양은 한 줄로 보여준다. 숫자를 매일 보는 것이
  // 예산이 문서가 아니라 방어선이 되는 유일한 방법이다.
  const llmLine = a.llm
    ? `<div style="margin-top:8px;font-size:11px;color:${C.sub};">AI 호출 ${a.llm.calls}회 · 캐시로 아낀 것 ${a.llm.cacheHits}회</div>`
    : ''

  const arrivalLine = arrivalsLine(a)

  /**
   * 지난 날짜 제안은 요주의 숫자에서 빠지지만 사라지지는 않는다. 조치할 수는
   * 없어도 "큐를 아무도 안 열고 있다"는 사실은 매일 한 줄로 보일 값이 있다.
   */
  const staleLine = staleNote(a)

  const overLines = [...(a.overCapacity ?? []), ...(a.llm?.overBudgetTours ?? [])]
  if (overLines.length === 0) return `${rows}${llmLine}${arrivalLine}${staleLine}`
  const detail = overLines
    .map(
      (line) =>
        `<div style="font-size:12px;color:${C.amber};padding:4px 0;">· ${esc(line)}</div>`,
    )
    .join('')
  return `${rows}${llmLine}${arrivalLine}${staleLine}<div style="margin-top:10px;padding:10px 12px;background:${C.amberBg};border-radius:10px;">${detail}</div>`
}

function fmtKstDate(ymd: string): string {
  // YYYY-MM-DD → "7월 24일 (목)"
  const [y, m, d] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const wd = ['일', '월', '화', '수', '목', '금', '토'][date.getUTCDay()]
  return `${m}월 ${d}일 (${wd})`
}

export function renderDailyReport(report: DailyReport): { subject: string; html: string } {
  const a = report.attention.data
  const missing = report.contactStatus.data.missingCount
  // 배지·제목·⑤번 배너가 같은 함수를 읽는다 — 손으로 더하던 합계가
  // `autopilotOpen` 을 빠뜨려 헤드라인이 거짓말을 했다(위 attentionItems 주석).
  const attentionTotal = report.attention.ok ? attentionCount(a) : null

  const summaryBadge =
    attentionTotal === 0
      ? `<span style="background:${C.greenBg};color:${C.green};font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;">이상 없음</span>`
      : `<span style="background:${C.amberBg};color:${C.amber};font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;">요주의 ${attentionTotal ?? '?'}건</span>`

  const subject =
    attentionTotal && attentionTotal > 0
      ? `[AtoC 일일보고] ${fmtKstDate(report.todayKst)} · 신규 ${report.newBookings.data.total}건 · 요주의 ${attentionTotal}건`
      : `[AtoC 일일보고] ${fmtKstDate(report.todayKst)} · 신규 ${report.newBookings.data.total}건 · 이상 없음`

  const body = [
    sectionCard('s1', '1', `오늘 투어 실적 — ${fmtKstDate(report.todayKst)}`, renderToday(report.todayTours), report.todayTours),
    sectionCard('s2', '2', '오늘 신규 예약', renderNew(report.newBookings), report.newBookings),
    sectionCard('s3', '3', `내일 투어 예정 — ${fmtKstDate(report.tomorrowKst)}`, renderTomorrow(report.tomorrowTours), report.tomorrowTours),
    sectionCard('s4', '4', '손님 연락 현황 (내일)', renderContact(report.contactStatus), report.contactStatus),
    sectionCard('s5', '5', '요주의 종합 — 오늘 처리할 것', renderAttention(report.attention), report.attention),
  ].join('')

  const generatedKst = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(report.generatedAt))

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:20px 10px;background:${C.bg};font-family:-apple-system,'Apple SD Gothic Neo',Segoe UI,Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;">
    <div style="background:${C.ink};border-radius:16px 16px 0 0;padding:22px 22px 18px;">
      <p style="margin:0;color:#c9a75c;font-size:11px;font-weight:700;letter-spacing:.22em;">ATOC KOREA · 일일 운영 보고 每日報表</p>
      <p style="margin:10px 0 0;color:#fff;font-size:20px;font-weight:700;font-family:Georgia,serif;">${fmtKstDate(report.todayKst)} 마감 보고</p>
      <div style="margin-top:12px;">${summaryBadge} ${
        missing ? `<span style="margin-left:6px;background:${C.redBg};color:${C.red};font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;">연락누락 ${missing}</span>` : ''
      }</div>
    </div>
    <div style="background:${C.bg};padding:16px 12px 8px;border-radius:0 0 16px 16px;">
      ${body}
      <p style="margin:8px 4px 0;color:${C.sub};font-size:11px;line-height:1.6;">이 보고서는 매일 18:00 KST 자동 발송됩니다 · 생성 ${esc(generatedKst)} KST · 결정론 집계(LLM 미사용) · 수신자 변경: Vercel env <span style="color:#a8a29e;">OPS_REPORT_EMAIL</span></p>
    </div>
  </div>
</body></html>`

  return { subject, html }
}
