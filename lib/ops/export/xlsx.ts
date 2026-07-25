/**
 * 의존성 0의 .xlsx 작성기 — 관제 W6
 * (`docs/ops-center-settlement-upgrade-plan-2026-07-25.md` §7).
 *
 * 🔴 **서버 전용.** `node:zlib`을 쓰므로 클라이언트 컴포넌트에서 import하면
 * 프로덕션 번들이 깨진다. 라우트에서만 부른다.
 *
 * 왜 직접 쓰는가: 이 저장소는 신규 npm 의존성을 받지 않는 정책이고
 * (`lib/ops/tax/forms.ts`가 xlsx를 뺀 이유), 그 결과 모든 내보내기가 CSV에서
 * 멈춰 있었다. 그런데 .xlsx는 사실 **XML 몇 장을 담은 ZIP**이고 Node에는 zlib이
 * 내장돼 있다 — 외부 라이브러리가 필요한 일이 아니었다.
 *
 * CSV가 못 하는 것 중 실제로 아쉬웠던 것만 지원한다:
 *   · 시트 여러 장 (서식 + 근거 데이터를 한 파일에)
 *   · 숫자를 진짜 숫자로 (CSV의 "1,234,000"은 엑셀에서 문자열이 된다)
 *   · 헤더 굵게 + 틀 고정 + 열 너비 (세무사가 그대로 검토한다)
 *   · 한글 깨짐 없음 (BOM 요령이 필요 없다 — XML이 UTF-8이다)
 *
 * 하지 않는 것: 수식, 병합, 조건부 서식, 이미지. 필요해지면 그때 넣는다.
 */

import { deflateRawSync } from 'node:zlib';

export type XlsxCell = string | number | null | undefined;
export type XlsxRow = XlsxCell[];

export interface XlsxSheet {
  /** 시트 탭 이름. 31자 초과·금지문자는 자동 정리된다. */
  name: string;
  rows: XlsxRow[];
  /**
   * 헤더로 굵게 칠할 행의 인덱스. 지정하면 그 행 아래로 틀이 고정된다.
   * 헤더가 없는 시트는 생략(또는 -1).
   */
  headerRowIndex?: number;
  /** 열 너비(문자 수). 생략된 열은 내용 길이로 추정한다. */
  columnWidths?: number[];
}

// ---------------------------------------------------------------------------
// XML 조각
// ---------------------------------------------------------------------------

/**
 * XML 이스케이프. 소득자 이름·메모는 사람이 입력한 값이고 그대로 XML에 들어간다 —
 * `&`나 `<`가 하나라도 새면 엑셀이 파일 전체를 "손상됨"으로 거부한다.
 *
 * XML 1.0이 아예 표현할 수 없는 제어문자도 여기서 떨어뜨린다(탭·개행은 유지).
 */
export function escapeXml(value: string): string {
  return value
    // eslint-disable-next-line no-control-regex -- XML 1.0이 표현할 수 없는 제어문자 제거 (탭·개행은 남긴다)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** 0 → 'A', 25 → 'Z', 26 → 'AA'. */
export function columnLetter(index: number): string {
  let n = index;
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/**
 * 시트 이름 정리 — 엑셀 규칙: 1~31자, `[]:*?/\` 금지, 앞뒤 작은따옴표 금지.
 * 위반하면 파일을 열 때 침묵하며 실패하는 대신 여기서 고친다.
 */
export function sanitizeSheetName(name: string, fallback: string): string {
  const cleaned = name.replace(/[[\]:*?/\\]/g, ' ').replace(/^'+|'+$/g, '').trim();
  const trimmed = cleaned.slice(0, 31).trim();
  return trimmed || fallback;
}

/** 내용으로 추정한 열 너비. CJK는 폭이 2배라 그만큼 더 준다. */
function estimateWidth(rows: XlsxRow[], col: number): number {
  let max = 8;
  for (const row of rows) {
    const cell = row[col];
    if (cell == null) continue;
    const text = typeof cell === 'number' ? cell.toLocaleString('en-US') : String(cell);
    let width = 0;
    for (const ch of text) width += /[ᄀ-ᇿ⺀-鿿가-힯＀-￯]/.test(ch) ? 2 : 1;
    if (width > max) max = width;
  }
  return Math.min(max + 2, 60);
}

function sheetXml(sheet: XlsxSheet): string {
  const rows = sheet.rows;
  const width = rows.reduce((m, r) => Math.max(m, r.length), 1);
  const headerIndex = sheet.headerRowIndex ?? -1;

  const cols = Array.from({ length: width }, (_, i) => {
    const w = sheet.columnWidths?.[i] ?? estimateWidth(rows, i);
    return `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`;
  }).join('');

  const body = rows
    .map((row, r) => {
      const cells = row
        .map((cell, c) => {
          if (cell == null || cell === '') return '';
          const ref = `${columnLetter(c)}${r + 1}`;
          const isHeader = r === headerIndex;
          if (typeof cell === 'number' && Number.isFinite(cell)) {
            // 숫자는 숫자로. CSV에서 "1,234,000"이 문자열이 되던 것이 이 한 줄의 차이다.
            return `<c r="${ref}" s="${isHeader ? 3 : 2}"><v>${cell}</v></c>`;
          }
          const text = escapeXml(String(cell));
          // inlineStr — sharedStrings 파트를 만들지 않아도 되고, 파일 크기 차이는
          // 이 규모(수백~수천 행)에서 무의미하다.
          return `<c r="${ref}" s="${isHeader ? 1 : 0}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
        })
        .join('');
      return `<row r="${r + 1}"${r === headerIndex ? ' ht="22" customHeight="1"' : ''}>${cells}</row>`;
    })
    .join('');

  // 헤더 바로 아래에서 틀 고정. 헤더가 없으면 고정하지 않는다.
  const pane =
    headerIndex >= 0
      ? `<pane ySplit="${headerIndex + 1}" topLeftCell="A${headerIndex + 2}" activePane="bottomLeft" state="frozen"/>`
      : '';
  const dimension = `A1:${columnLetter(Math.max(width - 1, 0))}${Math.max(rows.length, 1)}`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${dimension}"/><sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${body}</sheetData></worksheet>`;
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts><fonts count="2"><font><sz val="11"/><color theme="1"/><name val="Malgun Gothic"/></font><font><b/><sz val="11"/><color theme="1"/><name val="Malgun Gothic"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right><top style="thin"><color rgb="FFD1D5DB"/></top><bottom style="thin"><color rgb="FFD1D5DB"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="1" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

// ---------------------------------------------------------------------------
// ZIP (store/deflate) — .xlsx 컨테이너
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

export function crc32(buf: Buffer): number {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Buffer;
}

/**
 * 고정 타임스탬프(2026-01-01 00:00). 같은 입력이 같은 바이트를 내도록 —
 * 파일 시각이 매번 달라지면 스냅샷 테스트도, "같은 서식을 두 번 뽑았는데
 * 파일이 다르다"는 의심도 생긴다.
 */
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

function buildZip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const compressed = deflateRawSync(entry.data, { level: 6 });
    const crc = crc32(entry.data);

    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // flags: bit 11 = UTF-8 names
    local.writeUInt16LE(8, 8); // method: deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);

    locals.push(local, compressed);
    centrals.push(central);
    offset += local.length + compressed.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralBuf, eocd]);
}

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------

/**
 * 시트 배열 → .xlsx 바이트.
 *
 * 시트 이름은 정리되고, 중복되면 뒤에 번호가 붙는다 — 같은 이름 두 장이면
 * 엑셀이 파일을 열지 못한다.
 */
export function buildXlsx(sheets: XlsxSheet[]): Buffer {
  if (sheets.length === 0) throw new Error('buildXlsx: at least one sheet is required');

  const usedNames = new Set<string>();
  const named = sheets.map((sheet, i) => {
    let name = sanitizeSheetName(sheet.name, `Sheet${i + 1}`);
    if (usedNames.has(name)) {
      let n = 2;
      const base = name.slice(0, 28);
      while (usedNames.has(`${base} ${n}`)) n += 1;
      name = `${base} ${n}`;
    }
    usedNames.add(name);
    return { ...sheet, name };
  });

  const sheetEntries = named.map((sheet, i) => ({
    name: `xl/worksheets/sheet${i + 1}.xml`,
    data: Buffer.from(sheetXml(sheet), 'utf8'),
  }));

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${named
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${named
    .map((sheet, i) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('')}</sheets></workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${named
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join('')}<Relationship Id="rId${named.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

  return buildZip([
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(ROOT_RELS, 'utf8') },
    { name: 'xl/workbook.xml', data: Buffer.from(workbook, 'utf8') },
    { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(workbookRels, 'utf8') },
    { name: 'xl/styles.xml', data: Buffer.from(STYLES_XML, 'utf8') },
    ...sheetEntries,
  ]);
}

export const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * 다운로드 응답 헤더. 파일명은 ASCII로 만든다 — 한글 파일명은 헤더 인코딩이
 * 브라우저마다 달라 깨지는 쪽이 더 흔하다(기존 CSV 라우트와 같은 방침).
 */
export function xlsxDownloadHeaders(filename: string): Record<string, string> {
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, '-');
  return {
    'Content-Type': XLSX_CONTENT_TYPE,
    'Content-Disposition': `attachment; filename="${safe}"`,
    'Cache-Control': 'no-store',
  };
}
