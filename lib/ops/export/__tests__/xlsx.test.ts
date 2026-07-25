/**
 * 의존성 0 xlsx 작성기 — 관제 W6.
 *
 * 이 스위트가 답하는 질문은 하나다: **엑셀이 이 파일을 열 수 있는가.**
 * 라이브러리를 안 쓰기로 한 이상 "형식이 맞다"를 스스로 증명해야 한다. 그래서
 * ZIP을 실제로 풀어서(inflateRawSync) 안의 XML을 검사한다 — 바이트를 만들어
 * 놓고 눈으로 확인하지 않으면 "성공한 척하는 실패"가 된다.
 */

import { inflateRawSync } from 'node:zlib';
import {
  buildXlsx,
  columnLetter,
  crc32,
  escapeXml,
  sanitizeSheetName,
  xlsxDownloadHeaders,
} from '../xlsx';

/** 만들어진 zip을 풀어 { 경로: 내용 } 으로. 중앙 디렉터리를 읽어 항목을 찾는다. */
function unzip(buf: Buffer): Map<string, string> {
  const out = new Map<string, string>();

  // EOCD 를 뒤에서부터 찾는다(주석 없음 → 마지막 22바이트지만 안전하게 스캔).
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error('EOCD not found — not a zip');

  const total = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16);

  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) throw new Error('bad central directory signature');
    const method = buf.readUInt16LE(ptr + 10);
    const storedCrc = buf.readUInt32LE(ptr + 16);
    const csize = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOffset = buf.readUInt32LE(ptr + 42);
    const name = buf.subarray(ptr + 46, ptr + 46 + nameLen).toString('utf8');

    // local header 에서 실제 데이터 시작점을 다시 계산한다.
    if (buf.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('bad local header signature');
    const localNameLen = buf.readUInt16LE(localOffset + 26);
    const localExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const compressed = buf.subarray(dataStart, dataStart + csize);

    if (method !== 8) throw new Error(`unexpected compression method ${method}`);
    const raw = inflateRawSync(compressed);
    // CRC 가 맞지 않으면 엑셀이 파일을 거부한다 — 여기서 잡는다.
    expect(crc32(raw)).toBe(storedCrc);

    out.set(name, raw.toString('utf8'));
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

describe('columnLetter', () => {
  it('rolls over past Z the way Excel does', () => {
    expect(columnLetter(0)).toBe('A');
    expect(columnLetter(25)).toBe('Z');
    expect(columnLetter(26)).toBe('AA');
    expect(columnLetter(27)).toBe('AB');
    expect(columnLetter(51)).toBe('AZ');
    expect(columnLetter(52)).toBe('BA');
    expect(columnLetter(701)).toBe('ZZ');
    expect(columnLetter(702)).toBe('AAA');
  });
});

describe('escapeXml', () => {
  it('escapes every character that would break the part', () => {
    expect(escapeXml('a & b < c > d " e \' f')).toBe(
      'a &amp; b &lt; c &gt; d &quot; e &apos; f',
    );
  });

  it('drops control characters XML 1.0 cannot represent but keeps tab and newline', () => {
    const input = `a${String.fromCharCode(0)}b${String.fromCharCode(7)}c\td\ne`;
    expect(escapeXml(input)).toBe('abc\td\ne');
  });

  it('leaves korean text untouched', () => {
    expect(escapeXml('김가이드 · 사업소득')).toBe('김가이드 · 사업소득');
  });
});

describe('sanitizeSheetName', () => {
  it('strips the characters Excel forbids in a tab name', () => {
    expect(sanitizeSheetName('2026/08 [정산]', 'x')).toBe('2026 08  정산');
  });

  it('truncates to 31 characters', () => {
    expect(sanitizeSheetName('가'.repeat(40), 'x')).toHaveLength(31);
  });

  it('falls back when nothing usable is left', () => {
    expect(sanitizeSheetName('///', 'Sheet1')).toBe('Sheet1');
    expect(sanitizeSheetName('   ', 'Sheet1')).toBe('Sheet1');
  });
});

describe('buildXlsx', () => {
  const sheet = {
    name: '정산',
    headerRowIndex: 0,
    rows: [
      ['성명', '지급액', '소득세'],
      ['김가이드', 1_500_000, 45_000],
      ['이가이드 & 동료', 900_000, 27_000],
    ],
  };

  it('produces a zip whose parts all pass their CRC', () => {
    const files = unzip(buildXlsx([sheet]));
    expect([...files.keys()].sort()).toEqual(
      [
        '[Content_Types].xml',
        '_rels/.rels',
        'xl/_rels/workbook.xml.rels',
        'xl/styles.xml',
        'xl/workbook.xml',
        'xl/worksheets/sheet1.xml',
      ].sort(),
    );
  });

  it('writes numbers as numbers, not as text', () => {
    const files = unzip(buildXlsx([sheet]));
    const xml = files.get('xl/worksheets/sheet1.xml')!;
    // 숫자 셀은 <v>, 문자열 셀은 inlineStr. CSV에서 "1,500,000"이 문자열이 되던
    // 문제가 이 구분 하나로 사라진다.
    expect(xml).toContain('<v>1500000</v>');
    expect(xml).not.toContain('<t xml:space="preserve">1500000</t>');
  });

  it('escapes user text inside cells', () => {
    const files = unzip(buildXlsx([sheet]));
    const xml = files.get('xl/worksheets/sheet1.xml')!;
    expect(xml).toContain('이가이드 &amp; 동료');
  });

  it('freezes the pane under the header row', () => {
    const files = unzip(buildXlsx([sheet]));
    const xml = files.get('xl/worksheets/sheet1.xml')!;
    expect(xml).toContain('ySplit="1"');
    expect(xml).toContain('topLeftCell="A2"');
  });

  it('omits the frozen pane when there is no header', () => {
    const files = unzip(buildXlsx([{ name: 'raw', rows: [['a', 'b']] }]));
    expect(files.get('xl/worksheets/sheet1.xml')!).not.toContain('<pane');
  });

  it('registers every sheet in the workbook, its rels and the content types', () => {
    const files = unzip(
      buildXlsx([
        { name: '요약', rows: [['a']] },
        { name: '명세', rows: [['b']] },
        { name: '원장', rows: [['c']] },
      ]),
    );
    const workbook = files.get('xl/workbook.xml')!;
    const rels = files.get('xl/_rels/workbook.xml.rels')!;
    const types = files.get('[Content_Types].xml')!;

    for (const n of [1, 2, 3]) {
      expect(workbook).toContain(`sheetId="${n}"`);
      expect(rels).toContain(`worksheets/sheet${n}.xml`);
      expect(types).toContain(`/xl/worksheets/sheet${n}.xml`);
    }
    // styles 관계는 시트 다음 번호를 받아야 한다 — 겹치면 엑셀이 파일을 거부한다.
    expect(rels).toContain('Id="rId4"');
    expect(rels).toContain('Target="styles.xml"');
  });

  it('de-duplicates sheet names, because Excel refuses a workbook with two identical tabs', () => {
    const files = unzip(
      buildXlsx([
        { name: '정산', rows: [['a']] },
        { name: '정산', rows: [['b']] },
      ]),
    );
    const workbook = files.get('xl/workbook.xml')!;
    expect(workbook).toContain('name="정산"');
    expect(workbook).toContain('name="정산 2"');
  });

  it('skips empty cells rather than emitting hollow ones', () => {
    const files = unzip(buildXlsx([{ name: 's', rows: [['a', null, '', 0]] }]));
    const xml = files.get('xl/worksheets/sheet1.xml')!;
    expect(xml).toContain('r="A1"');
    expect(xml).not.toContain('r="B1"');
    expect(xml).not.toContain('r="C1"');
    // 0은 빈 칸이 아니다 — 금액 0원은 사실이다.
    expect(xml).toContain('r="D1"');
  });

  it('is byte-identical for identical input', () => {
    // 타임스탬프를 고정한 이유. 같은 서식을 두 번 뽑았는데 파일이 다르면
    // 사람은 무엇이 바뀌었는지 찾느라 시간을 쓴다.
    expect(buildXlsx([sheet]).equals(buildXlsx([sheet]))).toBe(true);
  });

  it('refuses to build an empty workbook', () => {
    expect(() => buildXlsx([])).toThrow(/at least one sheet/);
  });
});

describe('xlsxDownloadHeaders', () => {
  it('reduces the filename to ASCII so header encoding cannot mangle it', () => {
    const headers = xlsxDownloadHeaders('가이드-정산-2026-08.xlsx');
    expect(headers['Content-Disposition']).toMatch(/^attachment; filename="[A-Za-z0-9._-]+"$/);
  });

  it('sets the spreadsheet content type', () => {
    expect(xlsxDownloadHeaders('a.xlsx')['Content-Type']).toContain('spreadsheetml.sheet');
  });
});
