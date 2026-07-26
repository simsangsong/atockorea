/**
 * §K B1.6 — CSV 내보내기.
 *
 * 계약:
 *   1. UTF-8 BOM — 없으면 엑셀에서 한글이 깨진다.
 *   2. 🔴 합계 행이 없다 (B1-D1) — 티어를 더한 숫자는 거짓말이다.
 *   3. 쉼표·따옴표·줄바꿈이 든 이름이 열을 밀지 않는다.
 */

import {
  UNIFIED_CSV_HEADERS,
  unifiedCsv,
  unifiedCsvFilename,
  unifiedDetailAoa,
  unifiedSummaryAoa,
  unifiedXlsxFilename,
} from '../csv';
import { buildUnifiedRecords, summarize } from '../unified';

const RANGE = { from: '2026-08-17', to: '2026-08-23' };

const records = buildUnifiedRecords({
  bookings: [
    {
      id: 'b1',
      tour_id: 't1',
      tour_date: '2026-08-17',
      created_at: '2026-08-01T02:00:00Z',
      contact_name: 'Massimo Cassina',
      number_of_guests: 2,
      status: 'confirmed',
      source: 'gyg',
    },
  ],
  parseFailures: [{ id: 'f1', source_platform: 'klook', reason: '본문 없음', created_at: '2026-08-02T00:00:00Z' }],
});

describe('unifiedCsv', () => {
  const csv = unifiedCsv(records, RANGE);

  it('BOM으로 시작한다 — 없으면 엑셀이 한글을 깨뜨린다', () => {
    expect(csv.startsWith('﻿')).toBe(true);
  });

  it('헤더가 들어 있다', () => {
    for (const h of UNIFIED_CSV_HEADERS) expect(csv).toContain(h);
  });

  it('확정과 예약실패가 티어 라벨로 구분된다', () => {
    expect(csv).toContain('확정');
    expect(csv).toContain('예약실패');
  });

  it('🔴 합계 행이 없다 — 티어를 더한 숫자는 거짓말이다 (B1-D1)', () => {
    expect(csv).not.toContain('합계');
    expect(csv).not.toContain('총계');
    expect(csv).not.toContain('Total');
  });

  it('PII를 담는다는 사실을 파일 안에 적는다 — 화면과 달리 마스킹하지 않는다', () => {
    expect(csv).toContain('Massimo Cassina');
    expect(csv).toContain('손님 이름을 포함');
  });

  it('기간이 파일 안에 남는다 — 나중에 어느 주의 파일인지 알 수 있어야 한다', () => {
    expect(csv).toContain('2026-08-17 ~ 2026-08-23');
  });

  it('CRLF 줄바꿈 (엑셀 호환)', () => {
    expect(csv).toContain('\r\n');
  });
});

describe('CSV 이스케이프 — 이름이 열을 밀면 안 된다', () => {
  it('쉼표·따옴표가 든 이름을 감싼다', () => {
    const tricky = buildUnifiedRecords({
      bookings: [
        {
          id: 'b1',
          tour_date: '2026-08-17',
          created_at: '2026-08-01T02:00:00Z',
          contact_name: 'Cassina, "Max"',
          number_of_guests: 1,
          status: 'confirmed',
          source: 'gyg',
        },
      ],
    });
    const csv = unifiedCsv(tricky, RANGE);
    expect(csv).toContain('"Cassina, ""Max"""');
  });

  it('빈 값은 빈 칸이지 "null"이 아니다', () => {
    const csv = unifiedCsv(records, RANGE);
    expect(csv).not.toContain('null');
    expect(csv).not.toContain('undefined');
  });
});

describe('파일명', () => {
  it('ASCII만 쓴다 — 한글 파일명은 헤더 인코딩이 번거롭다', () => {
    const name = unifiedCsvFilename(RANGE);
    expect(name).toBe('atockorea-bookings-2026-08-17_2026-08-23.csv');
    // eslint-disable-next-line no-control-regex
    expect(/^[\x00-\x7F]+$/.test(name)).toBe(true);
  });
});

/**
 * §2-8 — 엑셀 출력.
 *
 * 계약: CSV와 **같은 행**을 쓴다. 두 벌이 되면 같은 기간의 두 파일이 다른 숫자를
 * 말하고, 그때는 둘 다 못 믿는다(§H-4). 그리고 요약 시트에도 합계는 없다.
 */
describe('xlsx AoA', () => {
  it('shares the detail rows with the CSV path', () => {
    const detail = unifiedDetailAoa(records)
    expect(detail[0]).toEqual([...UNIFIED_CSV_HEADERS])
    const csv = unifiedCsv(records, RANGE)
    for (const cell of detail[1]) {
      if (cell !== '') expect(csv).toContain(String(cell))
    }
  })

  it('🔴 summary sheet still refuses to add the tiers up (B1-D1)', () => {
    const flat = unifiedSummaryAoa(summarize(records), RANGE).flat().join(' ')
    expect(flat).not.toContain('합계')
    expect(flat).not.toContain('총계')
    expect(flat).not.toContain('Total')
  })

  it('summary carries the per-tier counts and the room gaps', () => {
    const rows = unifiedSummaryAoa(summarize(records), RANGE)
    const find = (label: string) => rows.find((r) => r[0] === label)?.[1]
    expect(find('확정')).toBe(1)
    expect(find('예약실패')).toBe(1)
    expect(find('대상 기간')).toBe('2026-08-17 ~ 2026-08-23')
    expect(find('투어룸 없음')).toBe(1)
  })

  it('keeps the PII warning in the file, same as the CSV', () => {
    expect(unifiedSummaryAoa(summarize(records), RANGE).flat().join(' ')).toContain('손님 이름을 포함')
  })

  it('names the file in ASCII', () => {
    expect(unifiedXlsxFilename(RANGE)).toBe('atockorea-bookings-2026-08-17_2026-08-23.xlsx')
  })
})
