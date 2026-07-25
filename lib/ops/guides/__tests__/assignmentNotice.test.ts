/**
 * 가이드 배정 안내 메일 — 손님 안내 체인의 가이드 쪽 짝.
 *
 * 두 가지를 지킨다:
 *   1. **가이드 1명당 1통.** 8건 배정된 사람에게 8통을 보내면 다음부터 안 읽는다.
 *   2. **단가 미설정을 0원으로 적지 않는다.** 0원으로 적으면 무보수로 합의한
 *      것처럼 읽히고, 그 오해는 정산 때 분쟁이 된다.
 */

import {
  groupByGuide,
  noticeBody,
  noticeSubject,
  noticeHtml,
  type NoticeAssignment,
} from '../assignmentNotice';

function assignment(over: Partial<NoticeAssignment> = {}): NoticeAssignment {
  return {
    id: 'a1',
    tourDate: '2026-08-03',
    tourType: 'private',
    role: 'guide',
    startTime: '08:00',
    endTime: '17:00',
    tourTitle: '제주 동부 일일투어',
    guests: 4,
    amountKrw: 150_000,
    ...over,
  };
}

describe('noticeSubject', () => {
  it('names the first date so the inbox row is decidable', () => {
    expect(noticeSubject({ guideName: '김가이드', assignments: [assignment()] })).toContain('2026-08-03');
  });

  it('says how many when there is more than one', () => {
    const subject = noticeSubject({
      guideName: '김가이드',
      assignments: [assignment(), assignment({ id: 'a2', tourDate: '2026-08-05' })],
    });
    expect(subject).toContain('외 1건');
  });

  it('takes the earliest date even when the input is unsorted', () => {
    const subject = noticeSubject({
      guideName: '김가이드',
      assignments: [assignment({ tourDate: '2026-08-09' }), assignment({ id: 'a2', tourDate: '2026-08-01' })],
    });
    expect(subject).toContain('2026-08-01');
  });
});

describe('noticeBody', () => {
  it('lists the facts a guide needs and nothing about the guest', () => {
    const body = noticeBody({ guideName: '김가이드', assignments: [assignment()] });
    expect(body).toContain('2026-08-03');
    expect(body).toContain('08:00–17:00');
    expect(body).toContain('제주 동부 일일투어');
    expect(body).toContain('4명');
    expect(body).toContain('150,000원');
    // 손님 연락처는 명단에서 본다 — 안내 메일에 실을 이유가 없다.
    expect(body).not.toMatch(/@/);
    expect(body).not.toMatch(/\d{3}-\d{3,4}-\d{4}/);
  });

  it('writes 미정 for an unresolved rate, never 0원', () => {
    const body = noticeBody({ guideName: '김가이드', assignments: [assignment({ amountKrw: null })] });
    expect(body).toContain('미정');
    expect(body).not.toContain('0원');
  });

  it('does show a genuine zero, because unpaid is a real arrangement', () => {
    const body = noticeBody({ guideName: '김가이드', assignments: [assignment({ amountKrw: 0 })] });
    expect(body).toContain('0원');
    expect(body).not.toContain('미정');
  });

  it('says 시각 미정 rather than inventing a time', () => {
    const body = noticeBody({ guideName: '김가이드', assignments: [assignment({ startTime: null, endTime: null })] });
    expect(body).toContain('시각 미정');
  });

  it('sorts by date then time so the list reads like a schedule', () => {
    const body = noticeBody({
      guideName: '김가이드',
      assignments: [
        assignment({ id: 'pm', tourDate: '2026-08-03', startTime: '14:00' }),
        assignment({ id: 'am', tourDate: '2026-08-03', startTime: '08:00' }),
        assignment({ id: 'prev', tourDate: '2026-08-01', startTime: '09:00' }),
      ],
    });
    expect(body.indexOf('2026-08-01')).toBeLessThan(body.indexOf('2026-08-03'));
    expect(body.indexOf('08:00')).toBeLessThan(body.indexOf('14:00'));
  });

  it('appends the self-schedule link only when there is one', () => {
    const withLink = noticeBody({
      guideName: '김가이드',
      assignments: [assignment()],
      scheduleLink: 'https://atockorea.com/g/schedule/tok',
    });
    expect(withLink).toContain('https://atockorea.com/g/schedule/tok');
    expect(noticeBody({ guideName: '김가이드', assignments: [assignment()] })).not.toContain('내 일정');
  });
});

describe('noticeHtml', () => {
  it('escapes the text and links only the URLs', () => {
    const html = noticeHtml('a & b <script> https://example.com/x');
    expect(html).toContain('&amp;');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<a href="https://example.com/x"');
  });
});

describe('groupByGuide', () => {
  const guides = new Map([
    ['g1', { name: '김가이드', email: 'kim@example.com' }],
    ['g2', { name: '박가이드', email: null }],
  ]);

  it('folds many assignments into one entry per guide', () => {
    const plan = groupByGuide(
      [
        { ...assignment({ id: 'a1' }), guideId: 'g1' },
        { ...assignment({ id: 'a2', tourDate: '2026-08-05' }), guideId: 'g1' },
        { ...assignment({ id: 'a3' }), guideId: 'g2' },
      ],
      guides,
    );
    expect(plan).toHaveLength(2);
    expect(plan.find((p) => p.guideId === 'g1')!.assignments).toHaveLength(2);
  });

  it('keeps a guide with no email in the plan so they are visibly unreachable', () => {
    // 조용히 빼면 "전원에게 보냈다"로 읽히고 그 사람은 아무 연락도 못 받는다.
    const plan = groupByGuide([{ ...assignment(), guideId: 'g2' }], guides);
    expect(plan).toHaveLength(1);
    expect(plan[0].email).toBeNull();
  });

  it('falls back to a short id when the guide row is missing', () => {
    const plan = groupByGuide([{ ...assignment(), guideId: 'deadbeef-0000' }], new Map());
    expect(plan[0].guideName).toBe('deadbeef');
  });

  it('orders by guide name so repeated runs read the same', () => {
    const plan = groupByGuide(
      [
        { ...assignment(), guideId: 'g2' },
        { ...assignment({ id: 'a2' }), guideId: 'g1' },
      ],
      guides,
    );
    expect(plan.map((p) => p.guideName)).toEqual(['김가이드', '박가이드']);
  });
});
