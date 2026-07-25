/**
 * 가이드 배정 안내 메일 — 손님 안내 체인의 가이드 쪽 짝.
 *
 * 손님에게는 D-1 안내를 보내면서 **가이드에게는 아무것도 안 보내고 있었다.**
 * 배정은 원장에만 적히고, 가이드는 카톡이나 전화로 따로 들었다 — 그 경로에는
 * 기록이 없어서 "말했다/못 들었다"가 붙으면 확인할 방법이 없다.
 *
 * 설계:
 *   · **가이드 1명당 메일 1통.** 8건 배정된 사람에게 8통을 보내면 그 사람은
 *     다음부터 안 읽는다. 한 통에 날짜순으로 묶는다.
 *   · 손님 PII 없음 — 가이드에게 필요한 것은 날짜·투어·시각·인원이지 손님
 *     연락처가 아니다. 명단은 투어룸 안에서 본다.
 *   · 발송 사실은 `ops_guide_assignments.notified_at`에 남는다. NULL이면
 *     "아직 안 알렸다"이고, 화면이 그것을 표시한다.
 *
 * 순수 모듈이다. 조회·발송은 라우트가 한다.
 */

export interface NoticeAssignment {
  id: string;
  tourDate: string;
  tourType: string;
  role: string;
  startTime?: string | null;
  endTime?: string | null;
  /** 투어 상품명(있으면). */
  tourTitle?: string | null;
  /** 예약 인원 합계(있으면). */
  guests?: number | null;
  note?: string | null;
  /** 단가 스냅샷 또는 단가표에서 해석된 금액. null = 미설정. */
  amountKrw?: number | null;
}

export interface NoticeInput {
  guideName: string;
  assignments: NoticeAssignment[];
  /** 가이드 셀프 스케줄 링크(있으면 본문 끝에 붙는다). */
  scheduleLink?: string | null;
  operatorName?: string;
}

const ROLE_LABEL: Record<string, string> = { guide: '가이드', driver: '기사', both: '가이드·기사' };

function timeRange(a: NoticeAssignment): string {
  if (!a.startTime) return '시각 미정';
  const start = a.startTime.slice(0, 5);
  return a.endTime ? `${start}–${a.endTime.slice(0, 5)}` : start;
}

/** 제목 — 몇 건인지와 첫 날짜가 제목에 있어야 목록에서 판단할 수 있다. */
export function noticeSubject(input: NoticeInput): string {
  const sorted = [...input.assignments].sort((a, b) => (a.tourDate < b.tourDate ? -1 : 1));
  const first = sorted[0];
  const operator = input.operatorName ?? 'AtoC Korea';
  if (!first) return `[${operator}] 배정 안내`;
  return sorted.length === 1
    ? `[${operator}] ${first.tourDate} 배정 안내`
    : `[${operator}] ${first.tourDate} 외 ${sorted.length - 1}건 배정 안내`;
}

/**
 * 본문(평문). 금액을 넣는 이유: 가이드가 가장 먼저 확인하는 것이고, 나중에
 * 정산서와 대조할 근거가 된다. **단가 미설정이면 "미정"이라고 적는다** — 0원으로
 * 적으면 무보수로 합의한 것처럼 읽힌다.
 */
export function noticeBody(input: NoticeInput): string {
  const operator = input.operatorName ?? 'AtoC Korea';
  const sorted = [...input.assignments].sort((a, b) =>
    a.tourDate === b.tourDate ? (a.startTime ?? '').localeCompare(b.startTime ?? '') : a.tourDate < b.tourDate ? -1 : 1,
  );

  const lines: string[] = [
    `${input.guideName}님, ${operator}입니다.`,
    '',
    `아래 일정으로 배정되었습니다. (${sorted.length}건)`,
    '',
  ];

  for (const a of sorted) {
    lines.push(`■ ${a.tourDate} · ${timeRange(a)}`);
    lines.push(`   ${a.tourTitle ?? a.tourType} · ${ROLE_LABEL[a.role] ?? a.role}${a.guests ? ` · ${a.guests}명` : ''}`);
    lines.push(
      `   단가: ${typeof a.amountKrw === 'number' ? `${a.amountKrw.toLocaleString('ko-KR')}원` : '미정 — 확인 후 안내드립니다'}`,
    );
    if (a.note) lines.push(`   메모: ${a.note}`);
    lines.push('');
  }

  lines.push('일정 변경이 필요하시면 이 메일에 회신해 주세요.');
  if (input.scheduleLink) {
    lines.push('');
    lines.push('내 일정·휴무 확인:');
    lines.push(input.scheduleLink);
  }
  lines.push('');
  lines.push(operator);

  return lines.join('\n');
}

/** 평문 → 최소 HTML. 링크만 클릭 가능하게 만든다. */
export function noticeHtml(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const linked = escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#2563eb">$1</a>');
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.7;color:#111827;white-space:pre-wrap">${linked}</div>`;
}

export interface NoticePlanEntry {
  guideId: string;
  guideName: string;
  email: string | null;
  assignments: NoticeAssignment[];
}

/**
 * 배정들을 **가이드별로** 묶는다. 이메일이 없는 가이드도 목록에 남긴다 —
 * 조용히 빼면 "전원에게 보냈다"고 읽히고, 그 사람은 아무 연락도 못 받는다.
 */
export function groupByGuide(
  rows: Array<NoticeAssignment & { guideId: string }>,
  guides: Map<string, { name: string; email: string | null }>,
): NoticePlanEntry[] {
  const byGuide = new Map<string, NoticePlanEntry>();
  for (const row of rows) {
    const guide = guides.get(row.guideId);
    const entry = byGuide.get(row.guideId) ?? {
      guideId: row.guideId,
      guideName: guide?.name ?? row.guideId.slice(0, 8),
      email: guide?.email ?? null,
      assignments: [],
    };
    entry.assignments.push(row);
    byGuide.set(row.guideId, entry);
  }
  return [...byGuide.values()].sort((a, b) => a.guideName.localeCompare(b.guideName, 'ko'));
}
